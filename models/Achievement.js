const mongoose = require('mongoose');

const achievementSchema = new mongoose.Schema({
    achievementId: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    tier: { type: String, required: true, enum: ['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond'] },
    category: { type: String, required: true, enum: ['GeoQuiz', 'ByteSudoku', 'General'] },
    byteReward: { type: Number, required: true, min: 0 },
    xpReward: { type: Number, required: true, min: 0 },
    icon: { type: String, default: 'fa-trophy' },
    createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

achievementSchema.index({ achievementId: 1 }, { unique: true });

module.exports = mongoose.model('Achievement', achievementSchema);
