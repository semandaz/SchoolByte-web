import mongoose from 'mongoose';

const discussionGroupSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true,
    default: ''
  },
  rules: {
    type: String,
    trim: true,
    default: ''
  },
  is_public: {
    type: Boolean,
    default: true
  },
  created_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  created_at: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

discussionGroupSchema.index({ name: 'text', description: 'text' });
discussionGroupSchema.index({ is_public: 1 });

const DiscussionGroup = mongoose.model('DiscussionGroup', discussionGroupSchema);

export default DiscussionGroup;
