const mongoose = require('mongoose');

const activityOfIntegrationSchema = new mongoose.Schema({
    title: { type: String, required: true, trim: true },
    subject: { type: String, required: true, trim: true },
    seniorClass: {
        type: String,
        required: true,
        enum: ['S.1', 'S.2', 'S.3', 'S.4', 'S.5', 'S.6']
    },
    topic: { type: String, required: true, trim: true },
    elementOfConstruct: {
        type: String,
        enum: ['one-topic', 'many-topics'],
        required: true
    },
    numberOfScenarios: { type: Number, required: true, min: 1, max: 10 },
    scenariosContent: { type: String, required: true },
    isApproved: { type: Boolean, default: false },
    approvedBy: {
        name: { type: String, default: null },
        role: { type: String, enum: ['admin', 'teacher'], default: null },
        id: { type: mongoose.Schema.Types.ObjectId, default: null }
    },
    approvedAt: { type: Date, default: null },
    createdByType: {
        type: String,
        enum: ['ai', 'teacher'],
        required: true
    },
    createdByStudentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', default: null },
    createdByTeacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher', default: null },
    createdByName: { type: String, required: true },
    helpfulMarkedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Student' }],
    helpfulCount: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

activityOfIntegrationSchema.index({ subject: 1 });
activityOfIntegrationSchema.index({ seniorClass: 1 });
activityOfIntegrationSchema.index({ isApproved: 1 });
activityOfIntegrationSchema.index({ createdAt: -1 });
activityOfIntegrationSchema.index({ helpfulCount: -1 });

activityOfIntegrationSchema.pre('save', function (next) {
    this.updatedAt = new Date();
    next();
});

module.exports = mongoose.model('ActivityOfIntegration', activityOfIntegrationSchema);
