const mongoose = require('mongoose');

const adminSchema = new mongoose.Schema({
    adminName: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    isPasswordSet: { type: Boolean, default: false },
    createdBy: { type: String, default: 'system' },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: String, default: null },
    deletedByEmail: { type: String, default: null },
    deletionReason: { type: String, default: null },
    createdAt: { type: Date, default: Date.now }
});

adminSchema.index({ email: 1 }, { unique: true });

module.exports = mongoose.model('Administrator', adminSchema);
