const mongoose = require('mongoose');

// activity: required but NOT unique — one activity can be referenced by notes; multiple workfiles can link to same activity if needed
const workFileSchema = new mongoose.Schema({
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    fileUrl: { type: String, required: true },
    subject: { type: String, required: true, trim: true },
    intendedClass: { type: String, required: true, trim: true },
    costBytes: { type: Number, required: true, default: 2, min: 0 },
    uploadedBy: {
        teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher', default: null },
        teacherName: { type: String, required: true }
    },
    activity: { type: mongoose.Schema.Types.ObjectId, ref: 'Activity', required: true },
    applyDownloadWatermark: { type: Boolean, default: true },
    downloadCount: { type: Number, default: 0, min: 0 },
    createdAt: { type: Date, default: Date.now }
});

workFileSchema.index({ subject: 1 });
workFileSchema.index({ intendedClass: 1 });
workFileSchema.index({ 'uploadedBy.teacherId': 1 });

module.exports = mongoose.model('WorkFile', workFileSchema);
