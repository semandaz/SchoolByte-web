const mongoose = require('mongoose');

const studentAchievementSchema = new mongoose.Schema({
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    achievement: { type: mongoose.Schema.Types.ObjectId, ref: 'Achievement', required: true },
    achievementId: { type: String, required: true, trim: true },
    unlocked: { type: Boolean, default: false },
    unlockedAt: { type: Date },
    progress: { type: Number, default: 0, min: 0 },
    target: { type: Number, default: 1, min: 1 },
    notificationSent: { type: Boolean, default: false }
}, { timestamps: true });

studentAchievementSchema.index({ student: 1, achievementId: 1 }, { unique: true });

module.exports = mongoose.model('StudentAchievement', studentAchievementSchema);
