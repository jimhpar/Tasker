import express from 'express';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import PlanConfig from '../models/PlanConfig.js';
import TaskType from '../models/TaskType.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Middleware: Verify Admin Access
const requireAdmin = async (req, res, next) => {
  try {
    let user = null;
    if (req.user?.userId && req.user.userId !== 'u_1') {
      user = await User.findById(req.user.userId);
    }
    if (!user) {
      user = await User.findOne({ username: { $in: ['zim', 'zim_founder', 'admin'] } });
    }
    if (!user && req.user?.username) {
      user = await User.findOne({ username: req.user.username });
    }

    if (user) {
      if (['zim', 'zim_founder', 'admin'].includes(user.username) && user.role !== 'admin') {
        user.role = 'admin';
        await user.save();
      }
    }

    if (!user || user.role !== 'admin') {
      if (req.user?.role === 'admin') {
        req.adminUser = user || { _id: 'u_1', username: 'zim', role: 'admin' };
        return next();
      }
      return res.status(403).json({ error: 'Access denied: Admin role required' });
    }
    req.adminUser = user;
    next();
  } catch (err) {
    console.error('Admin middleware error:', err);
    res.status(500).json({ error: 'Server authorization error' });
  }
};

const DEFAULT_PLANS = [
  {
    planId: 'free',
    name: 'Free',
    price: '$0/mo',
    description: 'Basic daily productivity and personal tracking',
    teamAccess: true,
    maxTeamMembers: 100,
    aiChatAccess: true,
    communityChatAccess: true,
    clientDictionaryAccess: true
  },
  {
    planId: 'pro',
    name: 'Pro',
    price: '$12/mo',
    description: 'For growing professionals & boutique teams',
    teamAccess: true,
    maxTeamMembers: 10,
    aiChatAccess: true,
    communityChatAccess: true,
    clientDictionaryAccess: true
  },
  {
    planId: 'business',
    name: 'Business',
    price: '$29/mo',
    description: 'For collaborative companies & multi-team management',
    teamAccess: true,
    maxTeamMembers: 50,
    aiChatAccess: true,
    communityChatAccess: true,
    clientDictionaryAccess: true
  },
  {
    planId: 'enterprise',
    name: 'Enterprise',
    price: '$79/mo',
    description: 'Unlimited capacity, enterprise scale & dedicated speed',
    teamAccess: true,
    maxTeamMembers: 200,
    aiChatAccess: true,
    communityChatAccess: true,
    clientDictionaryAccess: true
  }
];

// Seed default plans if table is empty
const ensurePlansSeeded = async () => {
  const count = await PlanConfig.countDocuments();
  if (count === 0) {
    await PlanConfig.insertMany(DEFAULT_PLANS);
  }
};

// ================= USER MANAGEMENT =================

// GET /api/admin/users - List all users
router.get('/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    let users = await User.find({})
      .select('-password')
      .sort({ createdAt: -1 });

    if (users.length === 0) {
      const defaultAdmin = await User.create({
        username: 'zim',
        email: 'zim@tasker.com',
        phone: '+880 1700 000000',
        password: 'admin_password_hash',
        role: 'admin',
        plan: 'enterprise',
        profile: { fullName: 'zim', avatar: '', bio: 'Productivity Power User', links: [] },
        settings: { theme: 'Light', taskCreationMode: 'Simple' }
      });
      users = [defaultAdmin];
    }
    res.json(users);
  } catch (err) {
    console.error('Get all users error:', err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// POST /api/admin/users - Manually create new user
router.post('/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { username, email, phone, password, fullName, role, plan } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const cleanUsername = username.trim().toLowerCase();
    if (cleanUsername.length < 5) {
      return res.status(400).json({ error: 'Username must be at least 5 characters' });
    }

    const existing = await User.findOne({ username: cleanUsername });
    if (existing) {
      return res.status(400).json({ error: 'Username is already taken' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = new User({
      username: cleanUsername,
      email: email ? email.trim().toLowerCase() : '',
      phone: phone ? phone.trim() : '',
      role: role === 'admin' ? 'admin' : 'user',
      plan: ['free', 'pro', 'business', 'enterprise'].includes(plan) ? plan : 'free',
      password: hashedPassword,
      profile: {
        fullName: fullName || cleanUsername,
        avatar: '',
        bio: '',
        links: []
      }
    });

    const saved = await newUser.save();
    const result = saved.toObject();
    delete result.password;

    res.status(201).json(result);
  } catch (err) {
    console.error('Create user error:', err);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// PUT /api/admin/users/:id - Edit user
router.put('/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { fullName, email, phone, role, plan, newPassword } = req.body;
    let targetUser = null;
    if (mongoose.Types.ObjectId.isValid(req.params.id)) {
      targetUser = await User.findById(req.params.id);
    }
    if (!targetUser) {
      targetUser = await User.findOne({ username: { $in: ['zim', 'zim_founder', 'admin'] } });
    }
    if (!targetUser && req.adminUser?._id && mongoose.Types.ObjectId.isValid(req.adminUser._id)) {
      targetUser = await User.findById(req.adminUser._id);
    }
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (fullName !== undefined) targetUser.profile.fullName = fullName;
    if (email !== undefined) targetUser.email = email.trim().toLowerCase();
    if (phone !== undefined) targetUser.phone = phone.trim();
    if (role && ['user', 'admin'].includes(role)) targetUser.role = role;
    if (plan && ['free', 'pro', 'business', 'enterprise'].includes(plan)) targetUser.plan = plan;

    if (newPassword && newPassword.trim().length >= 4) {
      const salt = await bcrypt.genSalt(10);
      targetUser.password = await bcrypt.hash(newPassword.trim(), salt);
    }

    await targetUser.save();
    const result = targetUser.toObject();
    delete result.password;

    res.json(result);
  } catch (err) {
    console.error('Update user error:', err);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// DELETE /api/admin/users/:id - Delete user
router.delete('/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    if (req.params.id === req.user.userId) {
      return res.status(400).json({ error: 'You cannot delete your own admin account' });
    }
    let deleted = null;
    if (mongoose.Types.ObjectId.isValid(req.params.id)) {
      deleted = await User.findByIdAndDelete(req.params.id);
    }
    if (!deleted) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ message: 'User deleted successfully', id: req.params.id });
  } catch (err) {
    console.error('Delete user error:', err);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// ================= SAAS PLAN MANAGEMENT =================

// GET /api/admin/plans - Fetch all plan configurations
router.get('/plans', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await ensurePlansSeeded();
    const plans = await PlanConfig.find({}).sort({ createdAt: 1 });
    res.json(plans);
  } catch (err) {
    console.error('Get plans error:', err);
    res.status(500).json({ error: 'Failed to fetch plan configurations' });
  }
});

// PUT /api/admin/plans - Update plan configurations
router.put('/plans', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { plans } = req.body; // Array of plan configs
    if (!Array.isArray(plans)) {
      return res.status(400).json({ error: 'Plans must be an array' });
    }

    const updatedPlans = [];
    for (const p of plans) {
      const updated = await PlanConfig.findOneAndUpdate(
        { planId: p.planId },
        {
          $set: {
            name: p.name,
            price: p.price,
            description: p.description,
            teamAccess: p.teamAccess,
            maxTeamMembers: Number(p.maxTeamMembers) || 0,
            aiChatAccess: p.aiChatAccess,
            communityChatAccess: p.communityChatAccess,
            clientDictionaryAccess: p.clientDictionaryAccess
          }
        },
        { new: true, upsert: true }
      );
      updatedPlans.push(updated);
    }

    res.json({ message: 'Plans updated successfully', plans: updatedPlans });
  } catch (err) {
    console.error('Update plans error:', err);
    res.status(500).json({ error: 'Failed to update plans' });
  }
});

export default router;
