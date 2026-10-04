import express from 'express';
import Client from '../models/Client.js';
import Task from '../models/Task.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticateToken);

// Get all clients
router.get('/', async (req, res) => {
  try {
    const clients = await Client.find({ userId: req.user.userId }).sort({ name: 1 });
    
    // Attach task count to each client
    const clientsWithCount = await Promise.all(
      clients.map(async (client) => {
        const taskCount = await Task.countDocuments({
          userId: req.user.userId,
          clientId: client._id
        });
        return {
          ...client.toObject(),
          taskCount
        };
      })
    );

    res.json(clientsWithCount);
  } catch (err) {
    console.error('Fetch clients error:', err);
    res.status(500).json({ error: 'Failed to fetch clients' });
  }
});

// Create Client
router.post('/', async (req, res) => {
  try {
    const { name, contactPerson, email, phone, company, notes } = req.body;
    if (!name) return res.status(400).json({ error: 'Client name is required' });

    const newClient = new Client({
      userId: req.user.userId,
      name: name.trim(),
      contactPerson: contactPerson || '',
      email: email || '',
      phone: phone || '',
      company: company || '',
      notes: notes || ''
    });

    const saved = await newClient.save();
    res.status(201).json(saved);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create client' });
  }
});

// Update Client
router.put('/:id', async (req, res) => {
  try {
    const updated = await Client.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.userId },
      { $set: req.body },
      { new: true }
    );
    if (!updated) return res.status(404).json({ error: 'Client not found' });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update client' });
  }
});

// Delete Client
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await Client.findOneAndDelete({ _id: req.params.id, userId: req.user.userId });
    if (!deleted) return res.status(404).json({ error: 'Client not found' });
    
    // Unlink from tasks
    await Task.updateMany({ clientId: req.params.id }, { $set: { clientId: null } });

    res.json({ message: 'Client deleted and unlinked from tasks' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete client' });
  }
});

// Get tasks for specific client
router.get('/:id/tasks', async (req, res) => {
  try {
    const tasks = await Task.find({
      userId: req.user.userId,
      clientId: req.params.id
    }).sort({ scheduledDate: -1 });

    res.json(tasks);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch client tasks' });
  }
});

export default router;
