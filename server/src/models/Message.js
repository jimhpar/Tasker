import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  channelType: {
    type: String,
    enum: ['Community', 'Team', 'Direct'],
    required: true
  },
  channelId: {
    type: String, // 'global' for Community, or teamId/pairId
    required: true,
    index: true
  },
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  senderUsername: {
    type: String,
    required: true
  },
  content: {
    type: String,
    default: ''
  },
  isMediaP2P: {
    type: Boolean,
    default: false
  },
  mediaMetadata: {
    fileName: String,
    fileSize: Number,
    mimeType: String
  }
}, {
  timestamps: true
});

export default mongoose.model('Message', messageSchema);
