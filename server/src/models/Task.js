import mongoose from 'mongoose';

const taskSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdBy: {
    type: String,
    default: 'zim'
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
  title: {
    type: String,
    required: true,
    trim: true
  },
  brief: {
    type: String,
    default: ''
  },
  sourceLink: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    enum: ['To Do', 'In Progress', 'Done'],
    default: 'To Do'
  },
  priority: {
    type: String,
    enum: ['Low', 'Medium', 'High', 'Urgent'],
    default: 'Medium'
  },
  scheduledDate: {
    type: Date,
    default: () => new Date()
  },
  dueDate: {
    type: Date,
    default: null
  },
  completedAt: {
    type: Date,
    default: null
  },
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    default: null
  },
  taskTypeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TaskType',
    default: null
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  localFileAttachments: [
    {
      fileName: String,
      localPath: String,
      fileSize: Number,
      fileType: String,
      addedAt: { type: Date, default: Date.now }
    }
  ]
}, {
  timestamps: true
});

export default mongoose.model('Task', taskSchema);
