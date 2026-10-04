import mongoose from 'mongoose';

const teamSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  members: [
    {
      userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      role: { type: String, enum: ['Admin', 'Member'], default: 'Member' },
      joinedAt: { type: Date, default: Date.now }
    }
  ],
  requests: [
    {
      fromUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      toUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      status: { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending' },
      createdAt: { type: Date, default: Date.now }
    }
  ]
}, {
  timestamps: true
});

export default mongoose.model('Team', teamSchema);
