import express from 'express';
import mongoose from 'mongoose';
import Message from '../models/Message.js';
import User from '../models/User.js';
import Team from '../models/Team.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Optional Auth Helper: Populates req.user if token is present, but doesn't block if missing
const optionalAuth = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return next();
  authenticateToken(req, res, () => next());
};

// GET /api/community/messages - Get global community messages (Last 3 days only, public)
router.get('/messages', async (req, res) => {
  try {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const messages = await Message.find({
      channelType: 'Community',
      channelId: 'global',
      createdAt: { $gte: threeDaysAgo }
    })
      .populate('senderId', 'username profile')
      .sort({ createdAt: -1 })
      .limit(150);

    res.json(messages.reverse());
  } catch (err) {
    console.error('Failed to fetch community messages:', err);
    res.status(500).json({ error: 'Failed to fetch community messages' });
  }
});

// POST /api/community/messages - Post a community message (text, voice audio, or reply)
router.post('/messages', optionalAuth, async (req, res) => {
  try {
    const { content, audioData, replyTo, isMediaP2P, mediaMetadata, senderUsername } = req.body;

    if (!content && !audioData && !mediaMetadata) {
      return res.status(400).json({ error: 'Message content or audio is required' });
    }

    let validSenderId = req.user?.userId;
    let finalUsername = req.user?.username || senderUsername || 'User';

    if (!validSenderId || !mongoose.Types.ObjectId.isValid(validSenderId)) {
      let dbUser = await User.findOne({ username: finalUsername.toLowerCase() });
      if (!dbUser) {
        dbUser = await User.findOne({ username: { $in: ['zim', 'zim_founder', 'admin'] } });
      }
      if (dbUser) {
        validSenderId = dbUser._id;
        finalUsername = dbUser.username;
      } else {
        validSenderId = new mongoose.Types.ObjectId();
      }
    }

    const newMessage = new Message({
      channelType: 'Community',
      channelId: 'global',
      senderId: validSenderId,
      senderUsername: finalUsername,
      content: content || '',
      audioData: audioData || null,
      replyTo: replyTo || null,
      isMediaP2P: !!isMediaP2P,
      mediaMetadata: mediaMetadata || null
    });

    const saved = await newMessage.save();
    let populated = await Message.findById(saved._id).populate('senderId', 'username profile');
    if (!populated) populated = saved;

    const io = req.app.get('io');
    if (io) {
      io.emit('new_community_message', populated);
    }

    res.status(201).json(populated);
  } catch (err) {
    console.error('Failed to send community message:', err);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// GET /api/community/channel/:channelType/:channelId - Get messages for Direct or Team chat
router.get('/channel/:channelType/:channelId', async (req, res) => {
  try {
    const { channelType, channelId } = req.params;
    const messages = await Message.find({
      channelType,
      channelId: channelId.toLowerCase()
    })
      .populate('senderId', 'username profile')
      .sort({ createdAt: 1 })
      .limit(200);

    res.json(messages);
  } catch (err) {
    console.error('Failed to fetch channel messages:', err);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// POST /api/community/channel/:channelType/:channelId - Send a Direct or Team message
router.post('/channel/:channelType/:channelId', optionalAuth, async (req, res) => {
  try {
    const { channelType, channelId } = req.params;
    const { content, audioData, replyTo, isMediaP2P, mediaMetadata, senderUsername } = req.body;

    if (!content && !audioData && !mediaMetadata) {
      return res.status(400).json({ error: 'Message content or audio is required' });
    }

    let validSenderId = req.user?.userId;
    let finalUsername = req.user?.username || senderUsername || 'User';

    if (!validSenderId || !mongoose.Types.ObjectId.isValid(validSenderId)) {
      let dbUser = await User.findOne({ username: finalUsername.toLowerCase() });
      if (dbUser) {
        validSenderId = dbUser._id;
        finalUsername = dbUser.username;
      } else {
        validSenderId = new mongoose.Types.ObjectId();
      }
    }

    const newMessage = new Message({
      channelType,
      channelId: channelId.toLowerCase(),
      senderId: validSenderId,
      senderUsername: finalUsername,
      content: content || '',
      audioData: audioData || null,
      replyTo: replyTo || null,
      isMediaP2P: !!isMediaP2P,
      mediaMetadata: mediaMetadata || null
    });

    const saved = await newMessage.save();
    let populated = await Message.findById(saved._id).populate('senderId', 'username profile');
    if (!populated) populated = saved;

    // Real-time instantaneous dispatch via Socket.IO (0ms latency)
    const io = req.app.get('io');
    if (io) {
      io.emit('new_channel_message', populated);
      io.emit('new_inbox_message', populated);
    }

    res.status(201).json(populated);
  } catch (err) {
    console.error('Failed to send channel message:', err);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// GET /api/community/inbox - Poll incoming Direct and Team messages for notification dispatch
router.get('/inbox', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    let myUsername = '';
    let myUserId = null;
    if (authHeader) {
      await new Promise(resolve => authenticateToken(req, res, resolve));
      myUsername = req.user?.username?.toLowerCase();
      myUserId = req.user?.userId;
    }
    if (!myUsername && req.query.username) {
      myUsername = req.query.username.toLowerCase().trim();
    }
    if (!myUsername) return res.json([]);

    if (!myUserId) {
      const u = await User.findOne({ username: myUsername });
      if (u) myUserId = u._id;
    }

    // Find all teams where user is owner or member
    let myTeamIds = [];
    if (myUserId) {
      const userTeams = await Team.find({
        $or: [
          { ownerId: myUserId },
          { 'members.userId': myUserId }
        ]
      }).select('_id');
      myTeamIds = userTeams.map(t => t._id.toString());
    }

    const hasSince = !!req.query.since;
    const since = hasSince ? new Date(req.query.since) : new Date(Date.now() - 30 * 60 * 1000);
    const directRegex = new RegExp(`(^|_)(${myUsername})(_|$)`, 'i');

    const orConditions = [
      { channelType: 'Direct', channelId: { $regex: directRegex } }
    ];

    if (myTeamIds.length > 0) {
      orConditions.push({ channelType: 'Team', channelId: { $in: myTeamIds } });
    }

    const messages = await Message.find({
      channelType: { $in: ['Direct', 'Team'] },
      createdAt: hasSince ? { $gt: since } : { $gte: since },
      senderUsername: { $ne: myUsername },
      $or: orConditions
    })
      .sort({ createdAt: -1 })
      .limit(30);

    res.json(messages);
  } catch (err) {
    console.error('Failed to fetch inbox messages:', err);
    res.status(500).json({ error: 'Failed to fetch inbox' });
  }
});

export default router;
