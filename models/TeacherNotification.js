const mongoose = require('mongoose');

const teacherNotificationSchema = new mongoose.Schema({
    teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher', required: true },
    type: {
        type: String,
        required: true,
        enum: ['account_deleted', 'admin_deleted', 'password_reset', 'admin_message', 'system']
    },
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    read: { type: Boolean, default: false },
    data: { type: mongoose.Schema.Types.Mixed },
    createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

teacherNotificationSchema.index({ teacher: 1 });
teacherNotificationSchema.index({ createdAt: -1 });
teacherNotificationSchema.index({ teacher: 1, read: 1, createdAt: -1 });

module.exports = mongoose.model('TeacherNotification', teacherNotificationSchema);
