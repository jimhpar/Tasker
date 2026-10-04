import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

import authRoutes from './routes/auth.js';
import taskRoutes from './routes/tasks.js';
import clientRoutes from './routes/clients.js';
import taskTypeRoutes from './routes/taskTypes.js';
import teamRoutes from './routes/teams.js';
import communityRoutes from './routes/community.js';

dotenv.config();

const app = express();
const server = http.createServer(app);

// CORS configuration for desktop and mobile clients
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'tauri://localhost'
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, Tauri)
    if (!origin || allowedOrigins.includes(origin) || origin.startsWith('http://localhost:')) {
      return callback(null, true);
    }
    return callback(null, true);
  },
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Socket.io for Real-time messaging and WebRTC P2P Signaling
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Real-time Socket & WebRTC Signaling
const onlineUsers = new Map(); // userId -> socketId

io.on('connection', (socket) => {
  socket.on('user_online', (userData) => {
    if (userData && userData.userId) {
      onlineUsers.set(userData.userId, socket.id);
      io.emit('online_users_count', onlineUsers.size);
    }
  });

  // Global Community Message broadcast
  socket.on('send_community_message', (msg) => {
    io.emit('new_community_message', msg);
  });

  // Team Message broadcast
  socket.on('send_team_message', (data) => {
    io.emit(`team_message_${data.teamId}`, data.message);
  });

  // WebRTC P2P Signaling for Direct File / Media Transfer (Zero server storage)
  socket.on('p2p_signal_offer', ({ targetUserId, offer, fileMeta }) => {
    const targetSocketId = onlineUsers.get(targetUserId);
    if (targetSocketId) {
      io.to(targetSocketId).emit('p2p_signal_offer', {
        fromSocketId: socket.id,
        offer,
        fileMeta
      });
    }
  });

  socket.on('p2p_signal_answer', ({ targetSocketId, answer }) => {
    io.to(targetSocketId).emit('p2p_signal_answer', {
      fromSocketId: socket.id,
      answer
    });
  });

  socket.on('p2p_ice_candidate', ({ targetSocketId, candidate }) => {
    io.to(targetSocketId).emit('p2p_ice_candidate', {
      fromSocketId: socket.id,
      candidate
    });
  });

  socket.on('disconnect', () => {
    for (let [userId, sId] of onlineUsers.entries()) {
      if (sId === socket.id) {
        onlineUsers.delete(userId);
        break;
      }
    }
    io.emit('online_users_count', onlineUsers.size);
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/task-types', taskTypeRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/community', communityRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    appName: 'Tasker Productivity Suite',
    mongoStatus: mongoose.connection.readyState === 1 ? 'connected' : 'connecting_or_disconnected',
    timestamp: new Date().toISOString()
  });
});

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/tasker';

// Connect to MongoDB
mongoose.connect(MONGO_URI)
  .then(() => {
    console.log('✅ Connected to MongoDB successfully.');
  })
  .catch((err) => {
    console.warn('⚠️ MongoDB connection warning (will retry in background):', err.message);
  });

server.listen(PORT, () => {
  console.log(`🚀 Tasker Server is running on port ${PORT}`);
});
