const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    type: {
        type: String,
        required: true,
        enum: [
            'achievement', 'message', 'level_up', 'system',
            'download_success', 'download_fail',
            'quiz_complete', 'quiz_fail',
            'activity_complete', 'activity_fail',
            'new_chat_message', 'bytes_refund'
        ]
    },
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    read: { type: Boolean, default: false },
    data: { type: mongoose.Schema.Types.Mixed },
    createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

notificationSchema.index({ student: 1 });
notificationSchema.index({ createdAt: -1 });
notificationSchema.index({ student: 1, read: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
