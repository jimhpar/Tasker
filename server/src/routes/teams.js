import express from 'express';
import Team from '../models/Team.js';
import User from '../models/User.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticateToken);

// Search users by username
router.get('/users/search', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.trim().length < 2) {
      return res.json([]);
    }

    const users = await User.find({
      username: { $regex: q.trim(), $options: 'i' },
      _id: { $ne: req.user.userId }
    })
      .select('username profile')
      .limit(10);

    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Failed to search users' });
  }
});

// Helper: Get or Create default team for current user
const getUserTeam = async (userId) => {
  let team = await Team.findOne({
    $or: [
      { ownerId: userId },
      { 'members.userId': userId }
    ]
  }).populate('members.userId', 'username profile')
    .populate('requests.fromUserId', 'username profile')
    .populate('requests.toUserId', 'username profile');

  if (!team) {
    team = new Team({
      name: 'My Workspace Team',
      ownerId: userId,
      members: [{ userId, role: 'Admin' }],
      requests: []
    });
    await team.save();
    team = await Team.findById(team._id)
      .populate('members.userId', 'username profile')
      .populate('requests.fromUserId', 'username profile')
      .populate('requests.toUserId', 'username profile');
  }

  return team;
};

// Get current team and members
router.get('/members', async (req, res) => {
  try {
    const team = await getUserTeam(req.user.userId);
    res.json(team);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch team' });
  }
});

// Send Team Invite
router.post('/invite', async (req, res) => {
  try {
    const { targetUsername } = req.body;
    if (!targetUsername) return res.status(400).json({ error: 'Target username is required' });

    const targetUser = await User.findOne({ username: targetUsername.trim().toLowerCase() });
    if (!targetUser) return res.status(404).json({ error: 'User not found' });

    if (targetUser._id.toString() === req.user.userId) {
      return res.status(400).json({ error: 'Cannot invite yourself' });
    }

    let team = await getUserTeam(req.user.userId);

    // Check if already a member
    const isMember = team.members.some(m => m.userId?._id?.toString() === targetUser._id.toString() || m.userId?.toString() === targetUser._id.toString());
    if (isMember) {
      return res.status(400).json({ error: 'User is already in your team' });
    }

    // Check if already invited
    const existingReq = team.requests.find(
      r => r.toUserId?._id?.toString() === targetUser._id.toString() && r.status === 'pending'
    );
    if (existingReq) {
      return res.status(400).json({ error: 'An invite is already pending for this user' });
    }

    team.requests.push({
      fromUserId: req.user.userId,
      toUserId: targetUser._id,
      status: 'pending'
    });

    await team.save();

    res.json({ message: `Invite sent to @${targetUser.username}`, team });
  } catch (err) {
    console.error('Invite error:', err);
    res.status(500).json({ error: 'Failed to send invite' });
  }
});

// Get incoming & outgoing team requests
router.get('/requests', async (req, res) => {
  try {
    // Find any teams where current user has pending requests to them
    const teamsWithIncoming = await Team.find({
      'requests.toUserId': req.user.userId,
      'requests.status': 'pending'
    })
      .populate('ownerId', 'username profile')
      .populate('requests.fromUserId', 'username profile');

    const incoming = [];
    teamsWithIncoming.forEach(team => {
      team.requests.forEach(r => {
        if (r.toUserId?.toString() === req.user.userId && r.status === 'pending') {
          incoming.push({
            requestId: r._id,
            teamId: team._id,
            teamName: team.name,
            fromUser: r.fromUserId,
            createdAt: r.createdAt
          });
        }
      });
    });

    res.json({ incoming });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch team requests' });
  }
});

// Respond to Team Request (accept or reject)
router.post('/requests/:requestId/respond', async (req, res) => {
  try {
    const { action } = req.body; // 'accept' or 'reject'
    const { requestId } = req.params;

    const team = await Team.findOne({ 'requests._id': requestId });
    if (!team) return res.status(404).json({ error: 'Request not found' });

    const requestItem = team.requests.id(requestId);
    if (!requestItem || requestItem.toUserId.toString() !== req.user.userId) {
      return res.status(403).json({ error: 'Unauthorized to respond to this request' });
    }

    if (action === 'accept') {
      requestItem.status = 'accepted';
      // Add user to team members
      const isAlready = team.members.some(m => m.userId.toString() === req.user.userId);
      if (!isAlready) {
        team.members.push({ userId: req.user.userId, role: 'Member' });
      }
    } else {
      requestItem.status = 'rejected';
    }

    await team.save();

    res.json({ message: `Request ${action}ed successfully` });
  } catch (err) {
    res.status(500).json({ error: 'Failed to respond to request' });
  }
});

// Remove a member from the team
router.delete('/members/:memberId', async (req, res) => {
  try {
    const { memberId } = req.params;
    const team = await Team.findOne({
      $or: [{ ownerId: req.user.userId }, { 'members.userId': req.user.userId }]
    });

    if (!team) return res.status(404).json({ error: 'Team not found' });

    // Remove member
    team.members = team.members.filter(m => m.userId.toString() !== memberId && m._id.toString() !== memberId);
    await team.save();

    res.json({ message: 'Member removed successfully', team });
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove member' });
  }
});

export default router;
