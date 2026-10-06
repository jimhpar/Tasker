import express from 'express';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import TaskType from '../models/TaskType.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'tasker_secret_jwt_token_2026_xyz';

// Default task types to seed for a new user
const DEFAULT_TASK_TYPES = [
  { name: 'কৃষি ও খামার (Farm/Agri)', category: 'Agriculture', color: '#10B981' },
  { name: 'ব্যবসা ও দোকান (Retail)', category: 'Retail', color: '#F59E0B' },
  { name: 'সফটওয়্যার ও টেক (Tech/Dev)', category: 'Tech', color: '#6366F1' },
  { name: 'ডিজাইন ও ক্রিয়েটিভ (Design)', category: 'Design', color: '#EC4899' },
  { name: 'সাধারণ কাজ (Daily General)', category: 'General', color: '#06B6D4' }
];

// Check Username Availability & Provide Suggestions
router.get('/check-username', async (req, res) => {
  try {
    const { username } = req.query;
    if (!username) {
      return res.status(400).json({ available: false, message: 'Username is required' });
    }

    const cleanUsername = username.trim().toLowerCase();
    if (cleanUsername.length < 5) {
      return res.json({
        available: false,
        reason: 'too_short',
        message: 'Username must be at least 5 characters'
      });
    }

    const existingUser = await User.findOne({ username: cleanUsername });
    if (!existingUser) {
      return res.json({ available: true, message: 'Username is available' });
    }

    // Generate smart alternative suggestions
    const candidates = [
      `${cleanUsername}${Math.floor(100 + Math.random() * 900)}`,
      `${cleanUsername}_pro`,
      `${cleanUsername}_dev`,
      `${cleanUsername}_official`
    ];

    const existingCandidates = await User.find({ username: { $in: candidates } }).select('username');
    const existingSet = new Set(existingCandidates.map(u => u.username));
    const suggestions = candidates.filter(c => !existingSet.has(c)).slice(0, 3);

    return res.json({
      available: false,
      reason: 'taken',
      message: 'Username is already taken',
      suggestions
    });
  } catch (err) {
    console.error('Check username error:', err);
    res.status(500).json({ available: false, message: 'Error checking username' });
  }
});

// Register
router.post('/register', async (req, res) => {
  try {
    const { username, email, phone, password, fullName } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const cleanUsername = username.trim().toLowerCase();
    if (cleanUsername.length < 5) {
      return res.status(400).json({ error: 'Username must be at least 5 characters' });
    }

    const existingUser = await User.findOne({ username: cleanUsername });
    if (existingUser) {
      return res.status(400).json({ error: 'Username is already taken' });
    }

    if (email && email.trim()) {
      const existingEmail = await User.findOne({ email: email.trim().toLowerCase() });
      if (existingEmail) {
        return res.status(400).json({ error: 'Email is already registered' });
      }
    }

    const totalUsers = await User.countDocuments();
    const isFirstUserOrAdmin = totalUsers === 0 || cleanUsername === 'zim_founder' || cleanUsername === 'admin';

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = new User({
      username: cleanUsername,
      email: email ? email.trim().toLowerCase() : '',
      phone: phone ? phone.trim() : '',
      role: isFirstUserOrAdmin ? 'admin' : 'user',
      plan: 'free',
      password: hashedPassword,
      profile: {
        fullName: fullName || cleanUsername,
        avatar: '',
        bio: '',
        links: []
      }
    });

    const savedUser = await newUser.save();

    // Auto seed default task categories for the user
    try {
      const seededTypes = DEFAULT_TASK_TYPES.map(t => ({
        ...t,
        userId: savedUser._id
      }));
      await TaskType.insertMany(seededTypes);
    } catch (e) {
      console.error('Seed task types error:', e);
    }

    const token = jwt.sign(
      { userId: savedUser._id, username: savedUser.username, role: savedUser.role },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.status(201).json({
      message: 'Account created successfully',
      token,
      user: {
        id: savedUser._id,
        username: savedUser.username,
        email: savedUser.email,
        phone: savedUser.phone,
        role: savedUser.role,
        plan: savedUser.plan,
        profile: savedUser.profile,
        settings: savedUser.settings
      }
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Server error during registration' });
  }
});

// Login (by Username or Email)
router.post('/login', async (req, res) => {
  try {
    const { identifier, password } = req.body; // identifier can be username or email

    if (!identifier || !password) {
      return res.status(400).json({ error: 'Username/Email and password are required' });
    }

    const cleanIdentifier = identifier.trim().toLowerCase();
    const user = await User.findOne({
      $or: [{ username: cleanIdentifier }, { email: cleanIdentifier }]
    });

    if (!user) {
      return res.status(400).json({ error: 'Invalid username or password' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid username or password' });
    }

    if (user.username === 'zim_founder' && user.role !== 'admin') {
      user.role = 'admin';
      await user.save();
    }

    const token = jwt.sign(
      { userId: user._id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        phone: user.phone || '',
        role: user.role || 'user',
        plan: user.plan || 'free',
        profile: user.profile,
        settings: user.settings
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error during login' });
  }
});

// Get current user profile & settings
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-password');
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (user.username === 'zim_founder' && user.role !== 'admin') {
      user.role = 'admin';
      await user.save();
    }

    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Update Profile (with username, email, and phone update support)
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const { fullName, username, email, phone, bio, links, avatar } = req.body;
    let user = null;
    if (mongoose.Types.ObjectId.isValid(req.user.userId)) {
      user = await User.findById(req.user.userId);
    }
    if (!user) {
      user = await User.findOne({ username: req.user.username });
    }
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (username && username.trim().toLowerCase() !== user.username) {
      const cleanUsername = username.trim().toLowerCase();
      if (cleanUsername.length < 5) {
        return res.status(400).json({ error: 'Username must be at least 5 characters' });
      }
      const checkTaken = await User.findOne({ username: cleanUsername, _id: { $ne: user._id } });
      if (checkTaken) {
        return res.status(400).json({ error: 'Username is already taken' });
      }
      user.username = cleanUsername;
    }

    if (email !== undefined) user.email = email.trim().toLowerCase();
    if (phone !== undefined) user.phone = phone.trim();
    if (fullName !== undefined) user.profile.fullName = fullName;
    if (bio !== undefined) user.profile.bio = bio;
    if (links !== undefined) user.profile.links = links;
    if (avatar !== undefined) user.profile.avatar = avatar;

    await user.save();
    res.json({
      message: 'Profile updated',
      profile: user.profile,
      username: user.username,
      email: user.email,
      phone: user.phone
    });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Update Settings (Theme, Directory, Task Mode)
router.put('/settings', authenticateToken, async (req, res) => {
  try {
    const { theme, taskCreationMode, localAttachmentDir, username, newPassword } = req.body;
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (theme && ['Light', 'Gray', 'Dark'].includes(theme)) {
      user.settings.theme = theme;
    }
    if (taskCreationMode && ['Voice', 'Simple', 'Pro'].includes(taskCreationMode)) {
      user.settings.taskCreationMode = taskCreationMode;
    }
    if (localAttachmentDir !== undefined) {
      user.settings.localAttachmentDir = localAttachmentDir;
    }

    if (username && username.trim().toLowerCase() !== user.username) {
      const checkTaken = await User.findOne({ username: username.trim().toLowerCase() });
      if (checkTaken) {
        return res.status(400).json({ error: 'Username is already taken' });
      }
      user.username = username.trim().toLowerCase();
    }

    if (newPassword && newPassword.length >= 4) {
      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(newPassword, salt);
    }

    await user.save();
    res.json({
      message: 'Settings updated successfully',
      settings: user.settings,
      username: user.username
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

export default router;
