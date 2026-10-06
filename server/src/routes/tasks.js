import express from 'express';
import Task from '../models/Task.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticateToken);

// Get all tasks with flexible filters (workspaceType, date, client, taskType)
router.get('/', async (req, res) => {
  try {
    const { workspaceType, date, status, clientId, taskTypeId, teamId, search } = req.query;

    const query = { userId: req.user.userId };

    if (workspaceType) {
      query.workspaceType = workspaceType;
    }

    if (teamId) {
      query.teamId = teamId;
    }

    if (status) {
      query.status = status;
    }

    if (clientId) {
      query.clientId = clientId;
    }

    if (taskTypeId) {
      query.taskTypeId = taskTypeId;
    }

    // Date filter for Calendar Day View
    if (date) {
      const targetDate = new Date(date);
      const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0));
      const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999));
      query.scheduledDate = { $gte: startOfDay, $lte: endOfDay };
    }

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { brief: { $regex: search, $options: 'i' } }
      ];
    }

    const tasks = await Task.find(query)
      .populate('clientId', 'name contactPerson company')
      .populate('taskTypeId', 'name category color')
      .populate('teamId', 'name')
      .sort({ scheduledDate: 1, createdAt: -1 });

    res.json(tasks);
  } catch (err) {
    console.error('Fetch tasks error:', err);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

// Calendar Month/Date Summary (Returns task counts and statuses per date)
router.get('/calendar-summary', async (req, res) => {
  try {
    const { year, month } = req.query;
    const y = parseInt(year) || new Date().getFullYear();
    const m = parseInt(month) !== undefined ? parseInt(month) : new Date().getMonth();

    const startOfMonth = new Date(y, m, 1);
    const endOfMonth = new Date(y, m + 1, 0, 23, 59, 59, 999);

    const tasks = await Task.find({
      userId: req.user.userId,
      scheduledDate: { $gte: startOfMonth, $lte: endOfMonth }
    }).select('title status priority scheduledDate');

    res.json(tasks);
  } catch (err) {
    console.error('Calendar summary error:', err);
    res.status(500).json({ error: 'Failed to fetch calendar summary' });
  }
});

// Create Task
router.post('/', async (req, res) => {
  try {
    const {
      title,
      brief,
      sourceLink,
      status,
      priority,
      scheduledDate,
      dueDate,
      workspaceType,
      teamId,
      clientId,
      taskTypeId,
      localFileAttachments
    } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Task title is required' });
    }

    const newTask = new Task({
      userId: req.user.userId,
      title: title.trim(),
      brief: brief || '',
      sourceLink: sourceLink || '',
      status: status || 'To Do',
      priority: priority || 'Medium',
      scheduledDate: scheduledDate ? new Date(scheduledDate) : new Date(),
      dueDate: dueDate ? new Date(dueDate) : null,
      workspaceType: workspaceType || 'Personal',
      teamId: workspaceType === 'Team' ? (teamId || null) : null,
      clientId: clientId || null,
      taskTypeId: taskTypeId || null,
      localFileAttachments: localFileAttachments || []
    });

    const savedTask = await newTask.save();
    const populated = await Task.findById(savedTask._id)
      .populate('clientId', 'name contactPerson company')
      .populate('taskTypeId', 'name category color')
      .populate('teamId', 'name');

    res.status(201).json(populated);
  } catch (err) {
    console.error('Create task error:', err);
    res.status(500).json({ error: 'Failed to create task' });
  }
});

// Update Task
router.put('/:id', async (req, res) => {
  try {
    const updates = { ...req.body };

    if (updates.status === 'Done' && !updates.completedAt) {
      updates.completedAt = new Date();
    } else if (updates.status && updates.status !== 'Done') {
      updates.completedAt = null;
    }

    const updatedTask = await Task.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.userId },
      { $set: updates },
      { new: true }
    )
      .populate('clientId', 'name contactPerson company')
      .populate('taskTypeId', 'name category color')
      .populate('teamId', 'name');

    if (!updatedTask) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json(updatedTask);
  } catch (err) {
    console.error('Update task error:', err);
    res.status(500).json({ error: 'Failed to update task' });
  }
});

// Toggle Workspace: Personal <-> Team
router.post('/:id/toggle-workspace', async (req, res) => {
  try {
    const task = await Task.findOne({ _id: req.params.id, userId: req.user.userId });
    if (!task) return res.status(404).json({ error: 'Task not found' });

    task.workspaceType = task.workspaceType === 'Personal' ? 'Team' : 'Personal';
    await task.save();

    res.json({
      message: `Task moved to ${task.workspaceType}`,
      workspaceType: task.workspaceType,
      task
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to toggle workspace' });
  }
});

// Delete Task
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await Task.findOneAndDelete({ _id: req.params.id, userId: req.user.userId });
    if (!deleted) return res.status(404).json({ error: 'Task not found' });
    res.json({ message: 'Task deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

export default router;
