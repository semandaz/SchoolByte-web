const mongoose = require('mongoose');

const groupMessageSchema = new mongoose.Schema({
    group_id: { type: mongoose.Schema.Types.ObjectId, ref: 'DiscussionGroup', required: true },
    sender_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    content: { type: String, required: true, trim: true },
    replyTo: {
        id: { type: mongoose.Schema.Types.ObjectId },
        content: { type: String },
        sender_id: { type: mongoose.Schema.Types.ObjectId }
    },
    created_at: { type: Date, default: Date.now }
}, { timestamps: true });

groupMessageSchema.index({ group_id: 1, created_at: 1 });

module.exports = mongoose.model('GroupMessage', groupMessageSchema);
