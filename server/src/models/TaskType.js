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
    default: 'General' // e.g. 'Agriculture', 'Tech', 'Retail', 'Design', 'General'
  },
  color: {
    type: String,
    default: '#6366F1'
  }
}, {
  timestamps: true
});

export default mongoose.model('TaskType', taskTypeSchema);
