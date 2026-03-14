import mongoose from 'mongoose';

const personalMessageSchema = new mongoose.Schema({
  sender_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  recipient_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    type: String,
    required: true,
    trim: true
  },
  read: {
    type: Boolean,
    default: false
  },
  created_at: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

personalMessageSchema.index({ sender_id: 1, recipient_id: 1, created_at: -1 });
personalMessageSchema.index({ recipient_id: 1, read: 1 });

const PersonalMessage = mongoose.model('PersonalMessage', personalMessageSchema);

export default PersonalMessage;
