const mongoose = require('mongoose');

const personalMessageSchema = new mongoose.Schema({
    sender_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    recipient_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    content: { type: String, required: true, trim: true },
    read: { type: Boolean, default: false },
    delivered: { type: Boolean, default: false },
    replyTo: {
        id: { type: mongoose.Schema.Types.ObjectId },
        content: { type: String },
        sender_id: { type: mongoose.Schema.Types.ObjectId }
    },
    quoteProject: {
        id: { type: mongoose.Schema.Types.ObjectId, ref: 'UnebProject' },
        photoUrl: { type: String },
        title: { type: String }
    },
    created_at: { type: Date, default: Date.now }
}, { timestamps: true });

personalMessageSchema.index({ sender_id: 1, recipient_id: 1, created_at: -1 });
personalMessageSchema.index({ recipient_id: 1, read: 1 });

module.exports = mongoose.model('PersonalMessage', personalMessageSchema);
