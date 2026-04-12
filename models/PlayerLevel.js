const mongoose = require('mongoose');

const playerLevelSchema = new mongoose.Schema({
    tier: { type: Number, required: true, min: 1, max: 10, unique: true },
    name: {
        type: String,
        required: true,
        enum: ['New User', 'Novice', 'Apprentice', 'Adept', 'Specialist', 'Expert', 'Master', 'Grandmaster', 'Virtuoso', 'Legend']
    },
    totalXPRequired: { type: Number, required: true, min: 0 },
    levelUpByteReward: { type: Number, required: true, min: 0 }
}, { timestamps: true });

// tier unique index is defined on the field above

module.exports = mongoose.model('PlayerLevel', playerLevelSchema);
