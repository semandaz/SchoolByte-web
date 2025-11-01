import mongoose from 'mongoose';

const groupMessageSchema = new mongoose.Schema({
  group_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DiscussionGroup',
    required: true
  },
  sender_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    type: String,
    required: true,
    trim: true
  },
  has_latex: {
    type: Boolean,
    default: false
  },
  is_flagged: {
    type: Boolean,
    default: false
  },
  is_boosted: {
    type: Boolean,
    default: false
  },
  boost_cost: {
    type: Number,
    default: 0,
    min: 0
  },
  created_at: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

groupMessageSchema.index({ group_id: 1, created_at: -1 });
groupMessageSchema.index({ sender_id: 1 });
groupMessageSchema.index({ is_boosted: 1, created_at: -1 });

const GroupMessage = mongoose.model('GroupMessage', groupMessageSchema);

export default GroupMessage;
