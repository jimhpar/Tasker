import express from 'express';
import mongoose from 'mongoose';
import Message from '../models/Message.js';
import User from '../models/User.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticateToken);

// Get global community messages (Last 3 days only)
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
      .limit(100);

    res.json(messages.reverse());
  } catch (err) {
    console.error('Failed to fetch community messages:', err);
    res.status(500).json({ error: 'Failed to fetch community messages' });
  }
});

// Post a community message (text or P2P media metadata)
router.post('/messages', async (req, res) => {
  try {
    const { content, isMediaP2P, mediaMetadata } = req.body;

    let validSenderId = req.user.userId;
    if (!validSenderId || !mongoose.Types.ObjectId.isValid(validSenderId)) {
      let dbUser = await User.findOne({ username: req.user.username });
      if (!dbUser) {
        dbUser = await User.findOne({ username: { $in: ['zim', 'zim_founder', 'admin'] } });
      }
      if (dbUser) {
        validSenderId = dbUser._id;
      } else {
        validSenderId = new mongoose.Types.ObjectId();
      }
    }

    const newMessage = new Message({
      channelType: 'Community',
      channelId: 'global',
      senderId: validSenderId,
      senderUsername: req.user.username || 'User',
      content: content || '',
      isMediaP2P: !!isMediaP2P,
      mediaMetadata: mediaMetadata || null
    });

    const saved = await newMessage.save();
    let populated = await Message.findById(saved._id).populate('senderId', 'username profile');
    if (!populated) populated = saved;

    res.status(201).json(populated);
  } catch (err) {
    console.error('Failed to send community message:', err);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

export default router;
