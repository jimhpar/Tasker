import express from 'express';
import TaskType from '../models/TaskType.js';
import Task from '../models/Task.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticateToken);

// Get all task types for user
router.get('/', async (req, res) => {
  try {
    const { workspaceType, teamId } = req.query;
    const filter = { userId: req.user.userId };
    if (workspaceType) filter.workspaceType = workspaceType;
    if (teamId) filter.teamId = teamId;

    const types = await TaskType.find(filter).sort({ name: 1 });
    res.json(types);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch task types' });
  }
});

// Create task type
router.post('/', async (req, res) => {
  try {
    const { name, category, color, workspaceType, teamId } = req.body;
    if (!name) return res.status(400).json({ error: 'Task type name is required' });

    const newType = new TaskType({
      userId: req.user.userId,
      name: name.trim(),
      category: category || 'General',
      workspaceType: workspaceType || 'Personal',
      teamId: workspaceType === 'Team' ? (teamId || null) : null,
      color: color || '#090A0F'
    });

    const saved = await newType.save();
    res.status(201).json(saved);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create task type' });
  }
});

// Update task type
router.put('/:id', async (req, res) => {
  try {
    const updated = await TaskType.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.userId },
      { $set: req.body },
      { new: true }
    );
    if (!updated) return res.status(404).json({ error: 'Task type not found' });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update task type' });
  }
});

// Delete task type
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await TaskType.findOneAndDelete({ _id: req.params.id, userId: req.user.userId });
    if (!deleted) return res.status(404).json({ error: 'Task type not found' });

    await Task.updateMany({ taskTypeId: req.params.id }, { $set: { taskTypeId: null } });
    res.json({ message: 'Task type removed' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete task type' });
  }
});

export default router;
