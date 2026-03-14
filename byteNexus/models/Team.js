import mongoose from 'mongoose';
import crypto from 'crypto';

const teamSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  share_token: {
    type: String,
    unique: true,
    default: function() {
      return crypto.randomBytes(16).toString('hex');
    }
  },
  created_at: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

teamSchema.index({ user_id: 1 });
teamSchema.index({ share_token: 1 });

const Team = mongoose.model('Team', teamSchema);

export default Team;
