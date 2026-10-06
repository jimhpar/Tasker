import mongoose from 'mongoose';

const planConfigSchema = new mongoose.Schema({
  planId: {
    type: String,
    required: true,
    unique: true,
    enum: ['free', 'pro', 'business', 'enterprise']
  },
  name: {
    type: String,
    required: true
  },
  price: {
    type: String,
    default: '$0/mo'
  },
  description: {
    type: String,
    default: ''
  },
  teamAccess: {
    type: Boolean,
    default: true
  },
  maxTeamMembers: {
    type: Number,
    default: 100
  },
  aiChatAccess: {
    type: Boolean,
    default: true
  },
  communityChatAccess: {
    type: Boolean,
    default: true
  },
  clientDictionaryAccess: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

export default mongoose.model('PlanConfig', planConfigSchema);
