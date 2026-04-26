const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema({
    studentName: { type: String, required: true, trim: true },
    indexNumber: { type: String, required: true, unique: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    isEmailVerified: { type: Boolean, default: false },
    bytes: { type: Number, default: 20 },
    peakBytes: { type: Number, default: 20 },
    gameBytesEarnedToday: { type: Number, default: 0, min: 0 },
    gameBytesResetAt: { type: Date, default: Date.now },
    energy: { type: Number, default: 25, min: 0 },
    lastEnergyRefillAt: { type: Date, default: Date.now },

    class: { type: String, required: true, trim: true },
    stream: { type: String, required: true, trim: true },
    classTeacher: { type: String, required: true, trim: true },
    subjectsEnrolled: {
        type: [String],
        required: true,
        default: []
    },
    // Set to true when a student crosses a division boundary during the
    // yearly promotion (S.2 -> S.3, S.4 -> S.5) so the new class's subject
    // structure (9-subject middle school, 5-subject A-level) takes effect.
    // The student must re-pick their subjects in the profile before they
    // can take any quizzes again.
    needsSubjectSelection: { type: Boolean, default: false },
    lastPromotedAt: { type: Date, default: null },
    previousClass: { type: String, default: null, trim: true },

    quizzesCompletedThisWeek: { type: Number, default: 0, min: 0 },
    lastQuizResetDate: { type: Date, default: Date.now },
    recentQuizIds: {
        type: [mongoose.Schema.Types.ObjectId],
        default: [],
        maxlength: 200
    },
    currentQuizSessionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'QuizSession',
        default: null
    },
    contingencyRepeatCount: { type: Number, default: 0, min: 0 },

    firstNameDisplay: { type: String, trim: true },
    preferredName: { type: String, trim: true },
    preferences: {
        type: Object,
        default: {
            fontSize: 'medium',
            theme: 'light',
            notifications_on: true,
            fontFamily: 'Inter, sans-serif'
        }
    },

    xp: { type: Number, default: 0, min: 0 },
    currentTier: { type: Number, default: 1, min: 1, max: 10 },

    totalCountriesIdentified: { type: Number, default: 0, min: 0 },
    totalSudokuPuzzlesCompleted: { type: Number, default: 0, min: 0 },
    perfectNearnessStreak: { type: Number, default: 0, min: 0 },
    consecutiveCorrectSudoku: { type: Number, default: 0, min: 0 },
    geoQuizStats: {
        africaCompleted: { type: Boolean, default: false },
        southAmericaCompleted: { type: Boolean, default: false },
        highestScore: { type: Number, default: 0, min: 0 },
        highestAccuracy: { type: Number, default: 0, min: 0, max: 100 }
    },
    sudokuStats: {
        easyCompleted: { type: Number, default: 0, min: 0 },
        mediumCompleted: { type: Number, default: 0, min: 0 },
        hardCompleted: { type: Number, default: 0, min: 0 },
        impossibleCompleted: { type: Number, default: 0, min: 0 },
        insaneCompleted: { type: Number, default: 0, min: 0 },
        brutalCompleted: { type: Number, default: 0, min: 0 },
        perfectGames: { type: Number, default: 0, min: 0 }
    },

    achievements: [{
        type: { type: String, enum: ['quiz_master', 'streak_champion', 'byte_collector', 'early_bird', 'night_owl', 'perfect_score', 'speed_demon'], required: true },
        name: { type: String, required: true },
        description: { type: String, required: true },
        earnedAt: { type: Date, default: Date.now },
        badgeIcon: { type: String, default: '' },
        progress: { type: Number, default: 100 }
    }],

    currentStreak: { type: Number, default: 0, min: 0 },
    longestStreak: { type: Number, default: 0, min: 0 },
    lastActivityDate: { type: Date, default: Date.now },
    lastLoginDate: { type: Date, default: null },
    totalQuizzesCompleted: { type: Number, default: 0, min: 0 },

    studyHours: {
        type: [{
            month: { type: String, required: true },
            minutes: { type: Number, default: 0, min: 0 }
        }],
        default: [],
        _id: false
    },

    dailyActivity: {
        type: [{
            date: { type: String, required: true },
            minutes: { type: Number, default: 0, min: 0 }
        }],
        default: [],
        _id: false
    },

    notifications: [{
        type: { type: String, enum: ['achievement', 'message', 'system', 'team', 'quiz'], required: true },
        title: { type: String, required: true },
        message: { type: String, required: true },
        isRead: { type: Boolean, default: false },
        createdAt: { type: Date, default: Date.now },
        data: { type: Object, default: {} }
    }],

    chatPublicKey: { type: String, default: null },
    chatPrivateKeyBackup: { type: String, default: null },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

// email and indexNumber unique indexes are defined on the fields above
studentSchema.index({ class: 1 });
studentSchema.index({ subjectsEnrolled: 1 });
studentSchema.pre('save', function (next) {
    this.updatedAt = Date.now();
    if (this.bytes > (this.peakBytes || 0)) {
        this.peakBytes = this.bytes;
    }
    next();
});

module.exports = mongoose.model('Student', studentSchema);
