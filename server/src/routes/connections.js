import express from 'express';
import mongoose from 'mongoose';
import ConnectionRequest from '../models/ConnectionRequest.js';
import User from '../models/User.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Helper to extract authenticated or body username
const getActiveUsername = (req) => {
  return (req.user?.username || req.query.username || req.body.fromUsername || '').toLowerCase().trim();
};

// GET /api/connections/requests - List incoming pending requests for the current user
router.get('/requests', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    let myUsername = '';
    if (authHeader) {
      await new Promise(resolve => authenticateToken(req, res, resolve));
      myUsername = req.user?.username?.toLowerCase();
    }
    if (!myUsername && req.query.username) {
      myUsername = req.query.username.toLowerCase().trim();
    }

    if (!myUsername) {
      return res.json([]);
    }

    const requests = await ConnectionRequest.find({
      toUsername: myUsername,
      status: 'pending'
    }).sort({ createdAt: -1 });

    res.json(requests);
  } catch (err) {
    console.error('Error fetching incoming connection requests:', err);
    res.status(500).json({ error: 'Failed to fetch connection requests' });
  }
});

// GET /api/connections/outgoing - List outgoing pending requests sent by current user
router.get('/outgoing', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    let myUsername = '';
    if (authHeader) {
      await new Promise(resolve => authenticateToken(req, res, resolve));
      myUsername = req.user?.username?.toLowerCase();
    }
    if (!myUsername && req.query.username) {
      myUsername = req.query.username.toLowerCase().trim();
    }

    if (!myUsername) {
      return res.json([]);
    }

    const requests = await ConnectionRequest.find({
      fromUsername: myUsername,
      status: 'pending'
    }).sort({ createdAt: -1 });

    res.json(requests);
  } catch (err) {
    console.error('Error fetching outgoing connection requests:', err);
    res.status(500).json({ error: 'Failed to fetch outgoing requests' });
  }
});

// POST /api/connections/request - Send a new connection request
router.post('/request', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    let senderUsername = '';
    let senderId = null;

    if (authHeader) {
      await new Promise(resolve => authenticateToken(req, res, resolve));
      senderUsername = req.user?.username?.toLowerCase();
      senderId = req.user?.userId;
    }

    if (!senderUsername) {
      senderUsername = (req.body.fromUsername || '').toLowerCase().trim();
    }

    const toUsername = (req.body.toUsername || '').toLowerCase().trim();

    if (!senderUsername || !toUsername) {
      return res.status(400).json({ error: 'Both sender and recipient usernames are required' });
    }

    if (senderUsername === toUsername) {
      return res.status(400).json({ error: 'You cannot send a connection request to yourself' });
    }

    // Find DB users if available
    const [senderUser, recipientUser] = await Promise.all([
      User.findOne({ username: senderUsername }),
      User.findOne({ username: toUsername })
    ]);

    // Check if an existing pending request exists between them
    const existing = await ConnectionRequest.findOne({
      fromUsername: senderUsername,
      toUsername: toUsername,
      status: 'pending'
    });

    if (existing) {
      return res.status(200).json({ status: 'already_sent', request: existing });
    }

    const newRequest = new ConnectionRequest({
      fromUserId: senderUser?._id || (mongoose.Types.ObjectId.isValid(senderId) ? senderId : undefined),
      fromUsername: senderUsername,
      fromFullName: req.body.fromFullName || senderUser?.profile?.fullName || senderUsername,
      fromBio: req.body.fromBio || senderUser?.profile?.bio || 'Collaborator',
      fromEmail: req.body.fromEmail || senderUser?.email || `${senderUsername}@tasker.app`,
      toUserId: recipientUser?._id,
      toUsername: toUsername,
      toFullName: req.body.toFullName || recipientUser?.profile?.fullName || toUsername,
      status: 'pending'
    });

    const saved = await newRequest.save();
    res.status(201).json({ status: 'sent', request: saved });
  } catch (err) {
    console.error('Error creating connection request:', err);
    res.status(500).json({ error: 'Failed to send connection request' });
  }
});

// PUT /api/connections/requests/:id/accept - Accept incoming request
router.put('/requests/:id/accept', async (req, res) => {
  try {
    const { id } = req.params;
    const request = await ConnectionRequest.findById(id);
    if (!request) {
      return res.status(404).json({ error: 'Connection request not found' });
    }

    request.status = 'accepted';
    await request.save();

    res.json({ success: true, request });
  } catch (err) {
    console.error('Error accepting connection request:', err);
    res.status(500).json({ error: 'Failed to accept connection request' });
  }
});

// PUT /api/connections/requests/:id/decline - Decline incoming request
router.put('/requests/:id/decline', async (req, res) => {
  try {
    const { id } = req.params;
    const request = await ConnectionRequest.findById(id);
    if (!request) {
      return res.status(404).json({ error: 'Connection request not found' });
    }

    request.status = 'declined';
    await request.save();

    res.json({ success: true, message: 'Request declined' });
  } catch (err) {
    console.error('Error declining connection request:', err);
    res.status(500).json({ error: 'Failed to decline connection request' });
  }
});

export default router;
