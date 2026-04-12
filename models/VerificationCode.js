const mongoose = require('mongoose');

const verificationCodeSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    code: { type: String, required: true },
    createdAt: { type: Date, default: Date.now, expires: '10m' },
    lastSentAt: { type: Date, default: Date.now }
});

// email unique index is defined on the field above

module.exports = mongoose.model('VerificationCode', verificationCodeSchema);
