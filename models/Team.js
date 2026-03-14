const mongoose = require('mongoose');
const crypto = require('crypto');

const teamSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    share_token: {
        type: String,
        unique: true,
        default: () => crypto.randomBytes(16).toString('hex')
    },
    created_at: { type: Date, default: Date.now }
}, { timestamps: true });

teamSchema.index({ share_token: 1 });
teamSchema.index({ user_id: 1 });

module.exports = mongoose.model('Team', teamSchema);
