const mongoose = require('mongoose');

const studentActivitySubmissionSchema = new mongoose.Schema({
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    activity: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Activity',
        required: function () { return !this.quizQuestion; }
    },
    quizQuestion: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'QuizQuestion',
        required: function () { return !this.activity; }
    },
    answers: { type: mongoose.Schema.Types.Mixed, required: true },
    score: { type: Number, default: 0 },
    bytesEarned: { type: Number, default: 0 },
    attemptNumber: { type: Number, default: 1 },
    attemptType: { type: String, enum: ['initial', 'revision'], default: 'initial' },
    lastAttemptDate: { type: Date, default: Date.now },
    revealedKeywords: [{ type: String }],
    submittedAt: { type: Date, default: Date.now },
    isGraded: { type: Boolean, default: false }
});

studentActivitySubmissionSchema.index({ student: 1 });
studentActivitySubmissionSchema.index({ activity: 1 });

module.exports = mongoose.model('StudentActivitySubmission', studentActivitySubmissionSchema);
