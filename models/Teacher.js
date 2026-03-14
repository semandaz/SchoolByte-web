const mongoose = require('mongoose');

const teacherSchema = new mongoose.Schema({
    teacherName: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    bytes: { type: Number, default: 0 },

    quizzesUploadedThisWeek: { type: Number, default: 0, min: 0 },
    lastUploadResetDate: { type: Date, default: Date.now },

    isPasswordSet: { type: Boolean, default: false },
    gender: { type: String, enum: ['Male', 'Female', 'Other'], trim: true, default: 'Other' },
    physicalDescription: { type: String, trim: true },
    preferences: {
        type: Object,
        default: {
            fontSize: 'medium',
            theme: 'light',
            notifications_on: true
        }
    },

    createdAt: { type: Date, default: Date.now }
});

teacherSchema.index({ email: 1 }, { unique: true });

module.exports = mongoose.model('Teacher', teacherSchema);
