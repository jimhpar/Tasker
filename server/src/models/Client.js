import mongoose from 'mongoose';

const clientSchema = new mongoose.Schema({
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
  contactPerson: { type: String, default: '' },
  email: { type: String, default: '' },
  phone: { type: String, default: '' },
  company: { type: String, default: '' },
  notes: { type: String, default: '' }
}, {
  timestamps: true
});

export default mongoose.model('Client', clientSchema);
