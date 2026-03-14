const mongoose = require('mongoose');

const verificationCodeSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    code: { type: String, required: true },
    createdAt: { type: Date, default: Date.now, expires: '10m' },
    lastSentAt: { type: Date, default: Date.now }
});

verificationCodeSchema.index({ email: 1 }, { unique: true });

module.exports = mongoose.model('VerificationCode', verificationCodeSchema);
