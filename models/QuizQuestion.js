const mongoose = require('mongoose');
const crypto = require('crypto');

const quizQuestionSchema = new mongoose.Schema({
    questionText: { type: String, required: true, trim: true },
    subject: { type: String, required: true, trim: true },
    intendedClass: {
        type: String,
        required: true,
        trim: true,
        enum: ['S.1', 'S.2', 'S.3', 'S.4', 'S.5', 'S.6']
    },

    type: {
        type: String,
        enum: [
            'short-answer',
            'multiple-choice-single',
            'multiple-choice-multi',
            'true-false',
            'fill-in-the-blank',
            'matching',
            'ordering',
            'problem-solving',
            'numeric-entry'
        ],
        required: true
    },

    options: [{
        text: { type: String, required: true },
        isCorrect: { type: Boolean, default: false }
    }],
    correctAnswers: {
        type: [String],
        required: function () {
            return ['short-answer', 'true-false', 'problem-solving', 'fill-in-the-blank', 'numeric-entry'].includes(this.type);
        }
    },
    matchingPairs: [{
        itemA: { type: String, required: true },
        itemB: { type: String, required: true }
    }],
    orderedItems: {
        type: [String],
        required: function () { return this.type === 'ordering'; }
    },

    instructions: { type: String, trim: true },
    hint: { type: String, trim: true },
    explanation: { type: String, trim: true },
    maxBytesRewardPerQuestion: { type: Number, required: true, default: 1, min: 0 },

    keywordsForGrading: {
        type: [String],
        default: [],
        set: (v) => (v || []).map(s => s.toLowerCase().trim())
    },
    negativeKeywords: {
        type: [String],
        default: [],
        set: (v) => (v || []).map(s => s.toLowerCase().trim())
    },

    topic: { type: String, trim: true },
    subTopic: { type: String, trim: true },
    skillType: {
        type: [String],
        enum: ['Memorization', 'Application', 'Analysis', 'Problem-Solving', 'Evaluation', 'Creation'],
        default: []
    },

    isActive: { type: Boolean, default: true },
    timesServedOverall: { type: Number, default: 0, min: 0 },
    lastServedTimestamp: { type: Date },

    questionHash: { type: String, unique: true, sparse: true },

    uploadedBy: {
        teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher', default: null },
        teacherName: { type: String, required: true }
    },

    isFeatured: { type: Boolean, default: false },
    featuredUntil: { type: Date, required: function () { return this.isFeatured; } },

    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

quizQuestionSchema.index({ subject: 1 });
quizQuestionSchema.index({ intendedClass: 1 });
quizQuestionSchema.index({ isActive: 1 });
quizQuestionSchema.index({ timesServedOverall: 1 });
quizQuestionSchema.index({ lastServedTimestamp: 1 });
// questionHash unique sparse index is defined on the field above
quizQuestionSchema.index({ topic: 1 });

quizQuestionSchema.pre('save', function (next) {
    this.updatedAt = Date.now();
    if (this.isModified('questionText')) {
        const normalizedText = this.questionText.toLowerCase().trim().replace(/\s+/g, ' ');
        this.questionHash = crypto.createHash('sha256').update(normalizedText).digest('hex');
    }
    next();
});

module.exports = mongoose.model('QuizQuestion', quizQuestionSchema);
