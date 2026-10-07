import mongoose from 'mongoose';

const connectionRequestSchema = new mongoose.Schema({
  fromUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },
  fromUsername: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    index: true
  },
  fromFullName: {
    type: String,
    default: ''
  },
  fromBio: {
    type: String,
    default: 'Collaborator'
  },
  fromEmail: {
    type: String,
    default: ''
  },
  toUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },
  toUsername: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    index: true
  },
  toFullName: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'declined'],
    default: 'pending',
    index: true
  }
}, {
  timestamps: true
});

connectionRequestSchema.index({ fromUsername: 1, toUsername: 1, status: 1 });

export default mongoose.model('ConnectionRequest', connectionRequestSchema);
