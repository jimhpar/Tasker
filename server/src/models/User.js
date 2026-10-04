import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    minlength: 3
  },
  email: {
    type: String,
    trim: true,
    lowercase: true,
    default: ''
  },
  password: {
    type: String,
    required: true
  },
  profile: {
    fullName: { type: String, default: '' },
    avatar: { type: String, default: '' },
    bio: { type: String, default: '' },
    links: [{ type: String }]
  },
  settings: {
    theme: { type: String, enum: ['Light', 'Gray', 'Dark'], default: 'Dark' },
    taskCreationMode: { type: String, enum: ['Voice', 'Simple', 'Pro'], default: 'Simple' },
    localAttachmentDir: { type: String, default: 'C:/TaskerFiles' }
  }
}, {
  timestamps: true
});

export default mongoose.model('User', userSchema);
