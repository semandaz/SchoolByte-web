const mongoose = require('mongoose');

const completedQuizAttemptSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    quizId: { type: mongoose.Schema.Types.ObjectId, ref: 'QuizQuestion', required: true },
    studentClassAtAttempt: { type: String, required: true },
    questionSubject: { type: String, required: true },
    questionIntendedClass: { type: String, required: true },
    bytesAwarded: { type: Number, default: 0, min: 0 },
    isSuccessful: { type: Boolean, required: true },
    attemptDate: { type: Date, default: Date.now },
    quizSessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'QuizSession' },

    studentAnswer: { type: mongoose.Schema.Types.Mixed },
    correctAnswer: { type: mongoose.Schema.Types.Mixed },
    questionType: { type: String, required: true },
    partialScore: { type: Number, min: 0, max: 1 }
});

completedQuizAttemptSchema.index({ userId: 1 });
completedQuizAttemptSchema.index({ quizId: 1 });
completedQuizAttemptSchema.index({ questionSubject: 1 });
completedQuizAttemptSchema.index({ attemptDate: 1 });
completedQuizAttemptSchema.index({ quizSessionId: 1 });

module.exports = mongoose.model('CompletedQuizAttempt', completedQuizAttemptSchema);
