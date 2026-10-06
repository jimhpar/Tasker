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

// Helper: Ensure at least one default team exists for the user
const ensureUserHasTeam = async (userId) => {
  let teams = await Team.find({
    $or: [{ ownerId: userId }, { 'members.userId': userId }]
  })
    .populate('members.userId', 'username profile')
    .populate('requests.fromUserId', 'username profile')
    .populate('requests.toUserId', 'username profile');

  if (teams.length === 0) {
    const defaultTeam = new Team({
      name: 'Default Workspace Team',
      ownerId: userId,
      members: [{ userId, role: 'Admin' }],
      requests: []
    });
    await defaultTeam.save();
    const populated = await Team.findById(defaultTeam._id)
      .populate('members.userId', 'username profile')
      .populate('requests.fromUserId', 'username profile')
      .populate('requests.toUserId', 'username profile');
    teams = [populated];
  }

  return teams;
};

// GET /api/teams - List all teams current user belongs to or owns
router.get('/', async (req, res) => {
  try {
    const teams = await ensureUserHasTeam(req.user.userId);
    res.json(teams);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch teams' });
  }
});

// POST /api/teams - Create a new team
router.post('/', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Team name is required' });
    }

    const newTeam = new Team({
      name: name.trim(),
      ownerId: req.user.userId,
      members: [{ userId: req.user.userId, role: 'Admin' }],
      requests: []
    });

    await newTeam.save();
    const populated = await Team.findById(newTeam._id)
      .populate('members.userId', 'username profile')
      .populate('requests.fromUserId', 'username profile')
      .populate('requests.toUserId', 'username profile');

    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create team' });
  }
});

// PUT /api/teams/:teamId - Rename or update team
router.put('/:teamId', async (req, res) => {
  try {
    const { teamId } = req.params;
    const { name } = req.body;

    const team = await Team.findById(teamId);
    if (!team) return res.status(404).json({ error: 'Team not found' });

    // Only owner or admin can rename
    const isAdmin = team.ownerId.toString() === req.user.userId ||
      team.members.some(m => m.userId.toString() === req.user.userId && m.role === 'Admin');

    if (!isAdmin) {
      return res.status(403).json({ error: 'Only team admins can update this team' });
    }

    if (name && name.trim()) {
      team.name = name.trim();
    }

    await team.save();
    res.json(team);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update team' });
  }
});

// DELETE /api/teams/:teamId - Delete team (if owner) or leave team (if member)
router.delete('/:teamId', async (req, res) => {
  try {
    const { teamId } = req.params;
    const team = await Team.findById(teamId);
    if (!team) return res.status(404).json({ error: 'Team not found' });

    if (team.ownerId.toString() === req.user.userId) {
      await Team.findByIdAndDelete(teamId);
      return res.json({ message: 'Team deleted successfully', deletedTeamId: teamId });
    } else {
      // Leave team
      team.members = team.members.filter(m => m.userId.toString() !== req.user.userId);
      await team.save();
      return res.json({ message: 'Left team successfully', leftTeamId: teamId });
    }
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete/leave team' });
  }
});

// GET /api/teams/members or /api/teams/:teamId/members
router.get('/members', async (req, res) => {
  try {
    const teams = await ensureUserHasTeam(req.user.userId);
    res.json(teams[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch team' });
  }
});

router.get('/:teamId/members', async (req, res) => {
  try {
    const team = await Team.findById(req.params.teamId)
      .populate('members.userId', 'username profile')
      .populate('requests.fromUserId', 'username profile')
      .populate('requests.toUserId', 'username profile');

    if (!team) return res.status(404).json({ error: 'Team not found' });
    res.json(team);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch team members' });
  }
});

// Send Team Invite
router.post('/invite', async (req, res) => {
  try {
    const { targetUsername, teamId } = req.body;
    if (!targetUsername) return res.status(400).json({ error: 'Target username is required' });

    const targetUser = await User.findOne({ username: targetUsername.trim().toLowerCase() });
    if (!targetUser) return res.status(404).json({ error: 'User not found' });

    if (targetUser._id.toString() === req.user.userId) {
      return res.status(400).json({ error: 'Cannot invite yourself' });
    }

    let team;
    if (teamId) {
      team = await Team.findById(teamId);
    } else {
      const teams = await ensureUserHasTeam(req.user.userId);
      team = teams[0];
    }

    if (!team) return res.status(404).json({ error: 'Team not found' });

    // Check if already a member
    const isMember = team.members.some(
      m => m.userId?.toString() === targetUser._id.toString() || m.userId?._id?.toString() === targetUser._id.toString()
    );
    if (isMember) {
      return res.status(400).json({ error: 'User is already in this team' });
    }

    // Check if already invited
    const existingReq = team.requests.find(
      r => (r.toUserId?.toString() === targetUser._id.toString() || r.toUserId?._id?.toString() === targetUser._id.toString()) && r.status === 'pending'
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

// Get incoming & outgoing team requests (ONLY pending requests)
router.get('/requests', async (req, res) => {
  try {
    const teamsWithIncoming = await Team.find({
      'requests.toUserId': req.user.userId,
      'requests.status': 'pending'
    })
      .populate('ownerId', 'username profile')
      .populate('requests.fromUserId', 'username profile');

    const incoming = [];
    teamsWithIncoming.forEach(team => {
      team.requests.forEach(r => {
        if (
          r.status === 'pending' &&
          (r.toUserId?.toString() === req.user.userId || r.toUserId?._id?.toString() === req.user.userId)
        ) {
          incoming.push({
            requestId: r._id.toString(),
            teamId: team._id.toString(),
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
      const isAlready = team.members.some(m => m.userId.toString() === req.user.userId);
      if (!isAlready) {
        team.members.push({ userId: req.user.userId, role: 'Member', joinedAt: new Date() });
      }
    } else {
      requestItem.status = 'rejected';
    }

    await team.save();

    res.json({ message: `Request ${action}ed successfully`, action, teamId: team._id });
  } catch (err) {
    console.error('Respond request error:', err);
    res.status(500).json({ error: 'Failed to respond to request' });
  }
});

// Remove a member from a team
router.delete('/:teamId/members/:memberId', async (req, res) => {
  try {
    const { teamId, memberId } = req.params;
    const team = await Team.findById(teamId);
    if (!team) return res.status(404).json({ error: 'Team not found' });

    team.members = team.members.filter(m => m.userId?.toString() !== memberId && m._id?.toString() !== memberId);
    await team.save();

    res.json({ message: 'Member removed successfully', team });
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove member' });
  }
});

// Backward compatibility: Remove member without teamId
router.delete('/members/:memberId', async (req, res) => {
  try {
    const { memberId } = req.params;
    const team = await Team.findOne({
      $or: [{ ownerId: req.user.userId }, { 'members.userId': req.user.userId }]
    });

    if (!team) return res.status(404).json({ error: 'Team not found' });

    team.members = team.members.filter(m => m.userId?.toString() !== memberId && m._id?.toString() !== memberId);
    await team.save();

    res.json({ message: 'Member removed successfully', team });
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove member' });
  }
});

export default router;
