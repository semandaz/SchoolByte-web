const mongoose = require('mongoose');

const helpfulVoteSchema = new mongoose.Schema({
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    helpful: { type: Boolean, required: true },
    createdAt: { type: Date, default: Date.now }
});

const unebProjectSchema = new mongoose.Schema({
    student_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    photoUrl: { type: String, required: true },
    photoPublicId: { type: String },
    title: { type: String, required: true, trim: true },
    subject: { type: String, required: true, trim: true },
    year: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true },
    methodology: { type: String, required: true, trim: true },
    abstract: { type: String, trim: true },
    findings: { type: String, trim: true },
    conclusion: { type: String, trim: true },
    keywords: [{ type: String, trim: true }],
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Student' }],
    helpfulVotes: [helpfulVoteSchema],
    isPublished: { type: Boolean, default: true },
    deletedAt: { type: Date, default: null },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

unebProjectSchema.index({ student_id: 1 });
unebProjectSchema.index({ subject: 1 });
unebProjectSchema.index({ year: 1 });
unebProjectSchema.index({ category: 1 });
unebProjectSchema.index({ createdAt: -1 });
unebProjectSchema.index({ title: 'text', abstract: 'text', keywords: 'text', methodology: 'text' });

unebProjectSchema.pre('save', function (next) {
    this.updatedAt = Date.now();
    next();
});

module.exports = mongoose.model('UnebProject', unebProjectSchema);
