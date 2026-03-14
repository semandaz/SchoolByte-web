const mongoose = require('mongoose');

const defaultSubjectProgress = () => {
    const subjects = [
        'Mathematics', 'English Language', 'Biology', 'Chemistry', 'Physics',
        'History', 'Geography', 'Computer Science', 'Agriculture', 'Literature in English',
        'French', 'German', 'Kiswahili', 'Luganda', 'Fine Art', 'Performing Arts',
        'Physical Education', 'Technology and Design'
    ];
    const progress = {};
    subjects.forEach(subject => {
        progress[subject] = { ownClass: 0, lowerClass: 0, higherClass: 0 };
    });
    return progress;
};

const quizSessionSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    questionsCompletedCount: { type: Number, default: 0, min: 0 },
    subjectProgress: {
        type: mongoose.Schema.Types.Mixed,
        default: defaultSubjectProgress
    },
    startedAt: { type: Date, default: Date.now },
    completedAt: { type: Date },
    updatedAt: { type: Date, default: Date.now }
});

quizSessionSchema.index({ userId: 1 });
quizSessionSchema.pre('save', function (next) {
    this.updatedAt = Date.now();
    next();
});

module.exports = mongoose.model('QuizSession', quizSessionSchema);
