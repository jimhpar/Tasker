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
  },
  audioData: {
    type: String,
    default: null
  },
  replyTo: {
    id: String,
    sender: String,
    text: String
  }
}, {
  timestamps: true
});

// Automatically expire global Community messages after 3 days (259200 seconds)
messageSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 259200, partialFilterExpression: { channelType: 'Community' } }
);

export default mongoose.model('Message', messageSchema);
