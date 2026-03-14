const mongoose = require('mongoose');

const activitySchema = new mongoose.Schema({
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    subject: { type: String, required: true, trim: true },
    intendedClass: { type: String, required: true, trim: true },
    maxBytesReward: { type: Number, required: true, default: 5, min: 0 },
    associatedWorkFile: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'WorkFile',
        required: true,
        unique: true
    },
    questions: [{
        questionText: { type: String, required: true, trim: true },
        keywordsForMarking: {
            type: [String],
            required: true,
            validate: {
                validator: function (v) { return v && v.length > 0; },
                message: 'Each question must have at least one keyword for marking.'
            }
        },
        negativeKeywords: { type: [String], default: [] }
    }],
    uploadedBy: {
        teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher', default: null },
        teacherName: { type: String, required: true }
    },
    createdAt: { type: Date, default: Date.now }
});

activitySchema.virtual('attemptCount', {
    ref: 'StudentActivitySubmission',
    localField: '_id',
    foreignField: 'activity',
    count: true
});
activitySchema.set('toJSON', { virtuals: true });
activitySchema.set('toObject', { virtuals: true });
activitySchema.index({ associatedWorkFile: 1 }, { unique: true });
activitySchema.index({ subject: 1 });
activitySchema.index({ intendedClass: 1 });

module.exports = mongoose.model('Activity', activitySchema);
