import express from 'express';
import Message from '../models/Message.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticateToken);

// Get global community messages
router.get('/messages', async (req, res) => {
  try {
    const messages = await Message.find({ channelType: 'Community', channelId: 'global' })
      .populate('senderId', 'username profile')
      .sort({ createdAt: -1 })
      .limit(60);

    res.json(messages.reverse());
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch community messages' });
  }
});

// Post a community message (text or P2P media metadata)
router.post('/messages', async (req, res) => {
  try {
    const { content, isMediaP2P, mediaMetadata } = req.body;

    const newMessage = new Message({
      channelType: 'Community',
      channelId: 'global',
      senderId: req.user.userId,
      senderUsername: req.user.username,
      content: content || '',
      isMediaP2P: !!isMediaP2P,
      mediaMetadata: mediaMetadata || null
    });

    const saved = await newMessage.save();
    const populated = await Message.findById(saved._id).populate('senderId', 'username profile');

    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to send message' });
  }
});

export default router;
