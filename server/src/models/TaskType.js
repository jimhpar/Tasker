import mongoose from 'mongoose';

const taskTypeSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  category: {
    type: String,
    default: 'General'
  },
  workspaceType: {
    type: String,
    enum: ['Personal', 'Team'],
    default: 'Personal'
  },
  teamId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Team',
    default: null
  },
  color: {
    type: String,
    default: '#090A0F'
  }
}, {
  timestamps: true
});

export default mongoose.model('TaskType', taskTypeSchema);
