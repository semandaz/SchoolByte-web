import mongoose from 'mongoose';

const groupMemberSchema = new mongoose.Schema({
  group_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DiscussionGroup',
    required: true
  },
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  joined_at: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

groupMemberSchema.index({ group_id: 1, user_id: 1 }, { unique: true });
groupMemberSchema.index({ user_id: 1 });

const GroupMember = mongoose.model('GroupMember', groupMemberSchema);

export default GroupMember;
