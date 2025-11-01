// server.js - SchoolByte Backend - Complete Quiz System Implementation


// --- Module Imports ---
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const nodemailer = require('nodemailer');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const helmet = require('helmet');
const morgan = require('morgan');
const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require('@google/generative-ai');
const crypto = require('crypto');


const app = express();
const PORT = process.env.PORT || 5000;


// --- Middleware ---
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(helmet());
app.use(morgan('dev'));


// --- MongoDB Connection ---
const MONGODB_URI = process.env.MONGODB_URI;


if (!MONGODB_URI) {
    console.error('FATAL ERROR: MONGODB_URI is not defined. Please set it in Replit Secrets.');
    process.exit(1);
}


mongoose.connect(MONGODB_URI)
    .then(() => console.log('MongoDB connected successfully'))
    .catch(err => {
        console.error('MongoDB connection error:', err);
        process.exit(1);
    });


// --- JWT Secret ---
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    console.error('FATAL ERROR: JWT_SECRET is not defined. Please set it in Replit Secrets.');
    process.exit(1);
}


// --- Authentication Middleware ---
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'Access token required' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ message: 'Invalid or expired token' });
        }
        req.student = user;
        next();
    });
};

// --- Get Work Files (Notes) by Subject ---
app.get('/api/workfiles/:subject', authenticateToken, async (req, res) => {
    try {
        const { subject } = req.params;
        const studentId = req.student.id;

        const student = await Student.findById(studentId);
        if (!student) {
            return res.status(404).json({ message: 'Student not found' });
        }

        // Case-insensitive subject search
        const workFiles = await WorkFile.find({ subject: { $regex: new RegExp(`^${subject}$`, 'i') } })
            .populate('activity')
            .sort({ createdAt: -1 });

        const studentClass = student.class;
        const sortedFiles = workFiles.sort((a, b) => {
            if (a.intendedClass === studentClass && b.intendedClass !== studentClass) return -1;
            if (b.intendedClass === studentClass && a.intendedClass !== studentClass) return 1;
            return new Date(b.createdAt) - new Date(a.createdAt);
        });

        res.json({
            workFiles: sortedFiles.map(file => ({
                _id: file._id,
                title: file.title,
                description: file.description,
                fileUrl: file.fileUrl,
                intendedClass: file.intendedClass,
                costBytes: file.costBytes,
                uploadedBy: file.uploadedBy,
                downloadCount: file.downloadCount,
                createdAt: file.createdAt,
                hasActivity: !!file.activity
            })),
            studentClass: studentClass
        });
    } catch (error) {
        console.error('Error fetching work files:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// --- Download Work File ---
app.post('/api/workfiles/:id/download', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const studentId = req.student.id;
    let bytesDeducted = false;
    let student = null;
    let workFile = null;

    try {
        workFile = await WorkFile.findById(id).populate('uploadedBy.teacherId', 'teacherName');
        if (!workFile) {
            return res.status(404).json({ message: 'File not found' });
        }

        student = await Student.findById(studentId);
        if (!student) {
            return res.status(404).json({ message: 'Student not found' });
        }

        if (student.bytes < workFile.costBytes) {
            return res.status(400).json({
                message: 'Insufficient bytes',
                required: workFile.costBytes,
                available: student.bytes
            });
        }

        const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || "dq5mdy0yq";
        const teacherName = workFile.uploadedBy?.teacherName || 'Teacher';

        // 1. Create a clean, URL-safe base filename (without extension)
        const cleanTitle = workFile.title.replace(/[^a-zA-Z0-9\s-]/g, '').replace(/\s+/g, '_');
        const cleanSubject = workFile.subject.replace(/\s+/g, '_');
        const cleanTeacher = teacherName.replace(/\s+/g, '_');
        const customFilenameBase = `${cleanSubject}_${cleanTitle}_by_${cleanTeacher}`;

        // 2. Robustly extract the public_id from the Cloudinary URL
        const urlParts = workFile.fileUrl.split('/upload/');
        const pathAndVersion = urlParts.length > 1 ? urlParts[1] : '';
        const publicIdWithExtension = pathAndVersion.replace(/^v\d+\//, ''); // Remove version if present
        const publicId = publicIdWithExtension.substring(0, publicIdWithExtension.lastIndexOf('.'));

        if (!publicId) {
            console.error("Could not extract public_id from URL:", workFile.fileUrl);
            return res.status(500).json({ message: 'Could not process file URL.' });
        }

        // 3. Assemble the final URL with the correct transformation syntax
        const downloadUrl = `https://res.cloudinary.com/${CLOUD_NAME}/raw/upload/fl_attachment:${customFilenameBase}/${publicId}.pdf`;

        console.log(`Download URL constructed: ${downloadUrl}`);

        // Deduct bytes before sending URL
        student.bytes -= workFile.costBytes;
        bytesDeducted = true;

        workFile.downloadCount += 1;

        await student.save();
        await workFile.save();

        console.log(`Bytes deducted: ${workFile.costBytes}. Student now has ${student.bytes} bytes`);

        // Return URL to client for browser-handled download
        return res.json({
            message: 'File access granted. Redirecting for download.',
            downloadUrl: downloadUrl
        });

    } catch (error) {
        console.error('Error in download handler:', error);

        // Refund bytes if the process failed after deduction
        if (bytesDeducted && student && workFile) {
            try {
                // Use updateOne to avoid versioning conflicts
                await Student.updateOne({ _id: studentId }, { $inc: { bytes: workFile.costBytes } });
                console.log(`Bytes refunded due to handler error: ${workFile.costBytes}`);
            } catch (refundError) {
                console.error('CRITICAL: Failed to refund bytes:', refundError);
            }
        }

        if (!res.headersSent) {
            return res.status(500).json({
                message: 'Server error during download',
                error: error.message,
                bytesRefunded: bytesDeducted
            });
        }
    }
});

// --- Enhanced Database Schemas ---

// VerificationCode Schema
const verificationCodeSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    code: { type: String, required: true },
    createdAt: { type: Date, default: Date.now, expires: '10m' }
});
const VerificationCode = mongoose.model('VerificationCode', verificationCodeSchema);


// Subject Schema (Static curriculum definition)
const subjectSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true, trim: true, index: true },
    serialNumber: { type: Number, unique: true, sparse: true },
    isCompulsory: { type: Boolean, default: false },
    applicableLevels: {
        type: [String],
        enum: ["O_Level_Lower", "O_Level_Middle", "A_Level"],
        default: []
    },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});
subjectSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});
const Subject = mongoose.model('Subject', subjectSchema);


// Enhanced Student Schema with all report features
const studentSchema = new mongoose.Schema({
    studentName: { type: String, required: true, trim: true },
    indexNumber: { type: String, required: true, unique: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    isEmailVerified: { type: Boolean, default: false },
    bytes: { type: Number, default: 20 },


    // Core fields from report
    class: { type: String, required: true, trim: true, index: true },
    stream: { type: String, required: true, trim: true },
    classTeacher: { type: String, required: true, trim: true },
    subjectsEnrolled: {
        type: [String],
        required: true,
        default: [],
        index: true
    },


    // Quiz tracking fields
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


    // Display preferences
    firstNameDisplay: { type: String, trim: true },
    preferredName: { type: String, trim: true },
    preferences: {
        type: Object,
        default: {
            fontSize: "medium",
            theme: "light",
            notifications_on: true,
            fontFamily: "Inter, sans-serif"
        }
    },


    // Preader Games tracking
    totalPreaderGameTimeMinutes: { type: Number, default: 0 },


    // Achievement and XP System
    xp: { type: Number, default: 0, min: 0 },
    currentTier: { type: Number, default: 1, min: 1, max: 10 },
    
    // Achievement tracking stats
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


    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});


studentSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});
const Student = mongoose.model('Student', studentSchema);


// Enhanced QuizQuestion Schema with all question types and NLP features
const quizQuestionSchema = new mongoose.Schema({
    questionText: { type: String, required: true, trim: true },
    subject: { type: String, required: true, trim: true, index: true },
    intendedClass: { 
        type: String, 
        required: true, 
        trim: true,
        enum: ['S.1', 'S.2', 'S.3', 'S.4', 'S.5', 'S.6'],
        index: true
    },


    // Question type system
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


    // Type-specific answer fields
    options: [{
        text: { type: String, required: true },
        isCorrect: { type: Boolean, default: false }
    }],
    correctAnswers: {
        type: [String],
        required: function() {
            return ['short-answer', 'true-false', 'problem-solving', 'fill-in-the-blank', 'numeric-entry'].includes(this.type);
        }
    },
    matchingPairs: [{
        itemA: { type: String, required: true },
        itemB: { type: String, required: true }
    }],
    orderedItems: {
        type: [String],
        required: function() { return this.type === 'ordering'; }
    },


    // Additional question fields
    instructions: { type: String, trim: true },
    hint: { type: String, trim: true },
    explanation: { type: String, trim: true },
    maxBytesRewardPerQuestion: { type: Number, required: true, default: 1, min: 0 },


    // NLP and content enhancement fields
    keywordsForGrading: {
        type: [String],
        default: [],
        set: (v) => v.map(s => s.toLowerCase().trim())
    },
    negativeKeywords: {
        type: [String],
        default: [],
        set: (v) => v.map(s => s.toLowerCase().trim())
    },


    // Content tagging
    topic: { type: String, trim: true, index: true },
    subTopic: { type: String, trim: true, index: true },
    skillType: {
        type: [String],
        enum: ["Memorization", "Application", "Analysis", "Problem-Solving", "Evaluation", "Creation"],
        default: []
    },


    // Content management
    isActive: { type: Boolean, default: true, index: true },
    timesServedOverall: { type: Number, default: 0, min: 0, index: true },
    lastServedTimestamp: { type: Date, index: true },


    // Question hashing for duplicate detection
    questionHash: { type: String, unique: true, sparse: true },


    // Teacher attribution
    uploadedBy: {
        teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher', default: null },
        teacherName: { type: String, required: true }
    },


    // Featured content
    isFeatured: { type: Boolean, default: false },
    featuredUntil: { 
        type: Date, 
        required: function() { return this.isFeatured; }
    },


    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});


// Pre-save middleware to generate question hash
quizQuestionSchema.pre('save', function(next) {
    this.updatedAt = Date.now();


    // Generate hash for duplicate detection
    if (this.isModified('questionText')) {
        const normalizedText = this.questionText.toLowerCase().trim().replace(/\s+/g, ' ');
        this.questionHash = crypto.createHash('sha256').update(normalizedText).digest('hex');
    }


    next();
});


const QuizQuestion = mongoose.model('QuizQuestion', quizQuestionSchema);


// QuizSession Schema - "Fats and Beef" mechanism
const quizSessionSchema = new mongoose.Schema({
    userId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Student', 
        required: true, 
        index: true
    },
    questionsCompletedCount: { type: Number, default: 0, min: 0, max: 180 },
    subjectProgress: {
        type: mongoose.Schema.Types.Mixed,
        default: function() {
            const subjects = [
                "Mathematics", "English Language", "Biology", "Chemistry", "Physics",
                "History", "Geography", "Computer Science", "Agriculture", "Literature in English",
                "French", "German", "Kiswahili", "Luganda", "Fine Art", "Performing Arts",
                "Physical Education", "Technology and Design"
            ];


            const progress = {};
            subjects.forEach(subject => {
                progress[subject] = {
                    ownClass: 0,
                    lowerClass: 0,
                    higherClass: 0
                };
            });
            return progress;
        }
    },
    startedAt: { type: Date, default: Date.now },
    completedAt: { type: Date },
    updatedAt: { type: Date, default: Date.now }
});


quizSessionSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});
const QuizSession = mongoose.model('QuizSession', quizSessionSchema);


// CompletedQuizAttempt Schema - Immutable log
const completedQuizAttemptSchema = new mongoose.Schema({
    userId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Student', 
        required: true, 
        index: true 
    },
    quizId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'QuizQuestion', 
        required: true, 
        index: true 
    },
    studentClassAtAttempt: { type: String, required: true },
    questionSubject: { type: String, required: true, index: true },
    questionIntendedClass: { type: String, required: true },
    bytesAwarded: { type: Number, default: 0, min: 0 },
    isSuccessful: { type: Boolean, required: true },
    attemptDate: { type: Date, default: Date.now, index: true },
    quizSessionId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'QuizSession' 
    },


    // Enhanced fields for analytics
    studentAnswer: { type: mongoose.Schema.Types.Mixed },
    correctAnswer: { type: mongoose.Schema.Types.Mixed },
    questionType: { type: String, required: true },
    partialScore: { type: Number, min: 0, max: 1 }
});
const CompletedQuizAttempt = mongoose.model('CompletedQuizAttempt', completedQuizAttemptSchema);


// Teacher Schema with weekly tracking
const teacherSchema = new mongoose.Schema({
    teacherName: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    bytes: { type: Number, default: 0 },


    // Weekly contribution tracking
    quizzesUploadedThisWeek: { type: Number, default: 0, min: 0 },
    lastUploadResetDate: { type: Date, default: Date.now },


    // Profile fields
    isPasswordSet: { type: Boolean, default: false },
    gender: { 
        type: String, 
        enum: ['Male', 'Female', 'Other'], 
        trim: true, 
        default: 'Other' 
    },
    physicalDescription: { type: String, trim: true },
    preferences: {
        type: Object,
        default: {
            fontSize: "medium",
            theme: "light",
            notifications_on: true
        }
    },


    createdAt: { type: Date, default: Date.now }
});
const Teacher = mongoose.model('Teacher', teacherSchema);


// WorkFile and Activity schemas (existing)
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
    // This field links the WorkFile to its corresponding Activity
    activity: { type: mongoose.Schema.Types.ObjectId, ref: 'Activity', required: true, unique: true },
    applyDownloadWatermark: { type: Boolean, default: true },
    downloadCount: { type: Number, default: 0, min: 0 },
    createdAt: { type: Date, default: Date.now }
});
const WorkFile = mongoose.model('WorkFile', workFileSchema);

// This posts the activity schema to the cloudinary database



// REPLACE your old activitySchema with this one


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
                validator: function(v) {
                    return v && v.length > 0;
                },
                message: 'Each question must have at least one keyword for marking.'
            }
        }
    }],
    uploadedBy: {
        teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher', default: null },
        teacherName: { type: String, required: true }
    },
    createdAt: { type: Date, default: Date.now }
});

// Virtual field to calculate attempt count
activitySchema.virtual('attemptCount', {
    ref: 'StudentActivitySubmission',
    localField: '_id',
    foreignField: 'activity',
    count: true
});

// Ensure virtuals are included in JSON
activitySchema.set('toJSON', { virtuals: true });
activitySchema.set('toObject', { virtuals: true });

const Activity = mongoose.model('Activity', activitySchema);


const studentActivitySubmissionSchema = new mongoose.Schema({
    student: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Student',
        required: true
    },
    activity: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Activity',
        required: function() { return !this.quizQuestion; }
    },
    quizQuestion: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'QuizQuestion',
        required: function() { return !this.activity; }
    },
    answers: {
        type: mongoose.Schema.Types.Mixed,
        required: true
    },
    score: { type: Number, default: 0 },
    bytesEarned: { type: Number, default: 0 },
    attemptNumber: { type: Number, default: 1 },
    attemptType: { type: String, enum: ['initial', 'revision'], default: 'initial' },
    lastAttemptDate: { type: Date, default: Date.now },
    revealedKeywords: [{ type: String }],
    submittedAt: { type: Date, default: Date.now },
    isGraded: { type: Boolean, default: false }
});
const StudentActivitySubmission = mongoose.model('StudentActivitySubmission', studentActivitySubmissionSchema);


// Administrator Schema
const adminSchema = new mongoose.Schema({
    adminName: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});
const Administrator = mongoose.model('Administrator', adminSchema);


// Preader Game Schemas (existing)
const PreaderGameSessionSchema = new mongoose.Schema({
    student: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Student',
        required: true
    },
    initialTitle: {
        type: String,
        required: true,
        trim: true
    },
    startTime: {
        type: Date,
        default: Date.now
    },
    playerStats: {
        life: { type: Number, default: 20, min: 0 },
        mana: { type: Number, default: 20, min: 0 },
        morale: { type: Number, default: 20 },
        reputation: { type: Number, default: 0 },
        discipline: { type: Number, default: 50, min: 0, max: 100 },
        knowledge: { type: Number, default: 0, min: 0 },
        stress: { type: Number, default: 0, min: 0 },
        luck: { type: Number, default: 10, min: 0 }
    },
    currentEthicalScore: { type: Number, default: 0 },
    totalBytesEarnedInSession: { type: Number, default: 0 },
    currentSceneContent: { type: String, required: true, maxlength: 5000 },
    currentChoices: [{
        choiceText: { type: String, required: true, maxlength: 500 },
        ethicalImpact: {
            scoreChange: { type: Number, default: 0 },
            ethicalPrinciple: { type: String }
        },
        statChanges: {
            life: { type: Number, default: 0 },
            mana: { type: Number, default: 0 },
            morale: { type: Number, default: 0 },
            reputation: { type: Number, default: 0 },
            discipline: { type: Number, default: 0 },
            knowledge: { type: Number, default: 0 },
            stress: { type: Number, default: 0 },
            luck: { type: Number, default: 0 }
        },
        requiredStats: {
            life: { type: Number, min: 0 },
            mana: { type: Number, min: 0 },
            morale: { type: Number, min: 0 },
            reputation: { type: Number },
            discipline: { type: Number },
            knowledge: { type: Number, min: 0 },
            stress: { type: Number },
            luck: { type: Number }
        },
        unavailableReason: { type: String, maxlength: 200 },
        bytesAwarded: { type: Number, default: 1 }
    }],
    pathTaken: [{
        sceneContent: { type: String },
        choiceTextMade: { type: String },
        bytesEarnedThisTurn: { type: Number, default: 0 },
        playerStatsSnapshot: {
            life: Number,
            mana: Number,
            morale: Number,
            reputation: Number,
            discipline: Number,
            knowledge: Number,
            stress: Number,
            luck: Number
        },
        ethicalScoreSnapshot: Number,
        timestamp: { type: Date, default: Date.now }
    }],
    rewindsUsed: { type: Number, default: 0 }
});


const PreaderGameSession = mongoose.model('PreaderGameSession', PreaderGameSessionSchema);


const PreaderGameSessionLogSchema = new mongoose.Schema({
    student: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Student',
        required: true
    },
    initialTitle: {
        type: String,
        required: true,
        trim: true
    },
    startTime: {
        type: Date,
        required: true
    },
    endTime: {
        type: Date,
        required: true
    },
    durationMinutes: {
        type: Number,
        required: true,
        min: 0
    },
    bytesEarned: {
        type: Number,
        required: true,
        default: 0
    },
    finalEthicalScore: {
        type: Number,
        required: true,
        default: 0
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});


const PreaderGameSessionLog = mongoose.model('PreaderGameSessionLog', PreaderGameSessionLogSchema);


// --- Achievement and XP System Schemas ---

// Player Level Tiers (10 levels)
const playerLevelSchema = new mongoose.Schema({
    tier: { 
        type: Number, 
        required: true, 
        min: 1, 
        max: 10, 
        unique: true 
    },
    name: { 
        type: String, 
        required: true,
        enum: ['New User', 'Novice', 'Apprentice', 'Adept', 'Specialist', 'Expert', 'Master', 'Grandmaster', 'Virtuoso', 'Legend']
    },
    totalXPRequired: { 
        type: Number, 
        required: true, 
        min: 0 
    },
    levelUpByteReward: { 
        type: Number, 
        required: true, 
        min: 0 
    }
}, { timestamps: true });
const PlayerLevel = mongoose.model('PlayerLevel', playerLevelSchema);


// Achievement Definitions
const achievementSchema = new mongoose.Schema({
    achievementId: { 
        type: String, 
        required: true, 
        unique: true, 
        trim: true 
    },
    name: { 
        type: String, 
        required: true, 
        trim: true 
    },
    description: { 
        type: String, 
        required: true, 
        trim: true 
    },
    tier: { 
        type: String, 
        required: true, 
        enum: ['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond'] 
    },
    category: { 
        type: String, 
        required: true, 
        enum: ['GeoQuiz', 'ByteSudoku', 'General'] 
    },
    byteReward: { 
        type: Number, 
        required: true, 
        min: 0 
    },
    xpReward: { 
        type: Number, 
        required: true, 
        min: 0 
    },
    icon: { 
        type: String, 
        default: 'fa-trophy' 
    },
    createdAt: { 
        type: Date, 
        default: Date.now 
    }
}, { timestamps: true });
const Achievement = mongoose.model('Achievement', achievementSchema);


// Student Achievement Progress
const studentAchievementSchema = new mongoose.Schema({
    student: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Student', 
        required: true, 
        index: true 
    },
    achievement: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Achievement', 
        required: true 
    },
    achievementId: { 
        type: String, 
        required: true, 
        trim: true 
    },
    unlocked: { 
        type: Boolean, 
        default: false 
    },
    unlockedAt: { 
        type: Date 
    },
    progress: { 
        type: Number, 
        default: 0, 
        min: 0 
    },
    target: { 
        type: Number, 
        default: 1, 
        min: 1 
    },
    notificationSent: { 
        type: Boolean, 
        default: false 
    }
}, { timestamps: true });
studentAchievementSchema.index({ student: 1, achievementId: 1 }, { unique: true });
const StudentAchievement = mongoose.model('StudentAchievement', studentAchievementSchema);


// Notification Schema
const notificationSchema = new mongoose.Schema({
    student: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Student', 
        required: true, 
        index: true 
    },
    type: { 
        type: String, 
        required: true, 
        enum: ['achievement', 'message', 'level_up', 'system'] 
    },
    title: { 
        type: String, 
        required: true, 
        trim: true 
    },
    message: { 
        type: String, 
        required: true, 
        trim: true 
    },
    read: { 
        type: Boolean, 
        default: false 
    },
    data: { 
        type: mongoose.Schema.Types.Mixed 
    },
    createdAt: { 
        type: Date, 
        default: Date.now, 
        index: true 
    }
}, { timestamps: true });
notificationSchema.index({ student: 1, read: 1, createdAt: -1 });
const Notification = mongoose.model('Notification', notificationSchema);


// --- Utility Functions ---


// Helper to apply stat changes with boundaries
function applyStatChanges(currentStats, changes) {
    const newStats = { ...currentStats };
    for (const stat in changes) {
        if (newStats.hasOwnProperty(stat) && typeof changes[stat] === 'number') {
            newStats[stat] = newStats[stat] + changes[stat];


            if (stat === 'life' || stat === 'mana' || stat === 'knowledge' || stat === 'luck') {
                newStats[stat] = Math.max(0, newStats[stat]);
            }
            if (stat === 'discipline') {
                newStats[stat] = Math.min(100, Math.max(0, newStats[stat]));
            }
        }
    }
    return newStats;
}


// Enhanced NLP grading function
async function gradeNLPAnswer(studentAnswer, quizQuestion) {
    if (!quizQuestion.keywordsForGrading || quizQuestion.keywordsForGrading.length === 0) {
        return 1; // If no keywords, assume correct
    }


    let matchedKeywords = 0;
    let negativeMatches = 0;
    const normalizedAnswer = studentAnswer.toLowerCase().trim();


    // Check positive keywords
    for (const keyword of quizQuestion.keywordsForGrading) {
        if (normalizedAnswer.includes(keyword.toLowerCase().trim())) {
            matchedKeywords++;
        }
    }


    // Check negative keywords
    if (quizQuestion.negativeKeywords && quizQuestion.negativeKeywords.length > 0) {
        for (const negKeyword of quizQuestion.negativeKeywords) {
            if (normalizedAnswer.includes(negKeyword.toLowerCase().trim())) {
                negativeMatches++;
            }
        }
    }


    // Calculate score with negative penalty
    let score = matchedKeywords / quizQuestion.keywordsForGrading.length;
    score = Math.max(0, score - (negativeMatches * 0.1)); // Deduct 0.1 per negative match


    return Math.min(1, score);
}


// Weekly reset checker for students
async function checkAndResetWeeklyCounters(student) {
    const now = new Date();
    const lastReset = new Date(student.lastQuizResetDate);
    const startOfThisWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());


    if (lastReset < startOfThisWeek) {
        student.quizzesCompletedThisWeek = 0;
        student.lastQuizResetDate = startOfThisWeek;
        await student.save();
    }
}


// Weekly reset checker for teachers
async function checkAndResetTeacherWeeklyCounters(teacher) {
    const now = new Date();
    const lastReset = new Date(teacher.lastUploadResetDate);
    const startOfThisWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());


    if (lastReset < startOfThisWeek) {
        teacher.quizzesUploadedThisWeek = 0;
        teacher.lastUploadResetDate = startOfThisWeek;
        await teacher.save();
    }
}


// Quiz generation algorithm implementing "Fats and Beef"
async function generateQuizQuestions(student, requestedSubject = null) {
    const session = await mongoose.startSession();
    session.startTransaction();


    try {
        // Get or create quiz session
        let quizSession = await QuizSession.findById(student.currentQuizSessionId).session(session);
        if (!quizSession) {
            quizSession = new QuizSession({
                userId: student._id,
                questionsCompletedCount: 0
            });
            await quizSession.save({ session });
            student.currentQuizSessionId = quizSession._id;
            await student.save({ session });
        }


        // Determine question distribution based on class level
        let ownClassCount, lowerClassCount, higherClassCount;
        const studentClass = student.class;


        if (['S.1', 'S.2', 'S.3', 'S.4'].includes(studentClass)) {
            // O-Level distribution: 5 own, 2 lower, 3 higher
            ownClassCount = 5;
            lowerClassCount = 2;
            higherClassCount = 3;
        } else {
            // A-Level distribution: 7 own, 3 adjacent
            ownClassCount = 7;
            lowerClassCount = 0;
            higherClassCount = 3;
        }


        const selectedQuestions = [];
        const usedQuestionIds = new Set();


        // Priority 1: Fill underrepresented subjects
        const underrepresentedSlots = findUnderrepresentedSlots(quizSession.subjectProgress);


        // Helper function to get class levels for distribution
        function getClassLevels(targetClass, type) {
            const classOrder = ['S.1', 'S.2', 'S.3', 'S.4', 'S.5', 'S.6'];
            const currentIndex = classOrder.indexOf(targetClass);


            if (type === 'own') return [targetClass];
            if (type === 'lower') {
                return classOrder.slice(0, currentIndex);
            }
            if (type === 'higher') {
                return classOrder.slice(currentIndex + 1);
            }
        }


        // Fill questions for each category
        await fillQuestionCategory('own', ownClassCount, getClassLevels(studentClass, 'own'));
        await fillQuestionCategory('lower', lowerClassCount, getClassLevels(studentClass, 'lower'));
        await fillQuestionCategory('higher', higherClassCount, getClassLevels(studentClass, 'higher'));


        async function fillQuestionCategory(categoryType, count, allowedClasses) {
            let filled = 0;


            // Try to fill from underrepresented subjects first
            for (const subject in underrepresentedSlots) {
                if (filled >= count) break;
                if (underrepresentedSlots[subject][categoryType] > 0) {
                    const questions = await QuizQuestion.find({
                        subject: subject,
                        intendedClass: { $in: allowedClasses },
                        isActive: true,
                        _id: { $nin: [...student.recentQuizIds, ...usedQuestionIds] }
                    }).limit(Math.min(underrepresentedSlots[subject][categoryType], count - filled))
                      .session(session);


                    for (const q of questions) {
                        if (filled < count) {
                            selectedQuestions.push({ question: q, category: categoryType, subject: subject });
                            usedQuestionIds.add(q._id);
                            filled++;
                        }
                    }
                }
            }


            // Fill remaining slots with enrolled subjects
            while (filled < count) {
                let found = false;
                for (const subject of student.subjectsEnrolled) {
                    if (filled >= count) break;


                    const questions = await QuizQuestion.find({
                        subject: subject,
                        intendedClass: { $in: allowedClasses },
                        isActive: true,
                        _id: { $nin: [...student.recentQuizIds, ...usedQuestionIds] }
                    }).limit(1).session(session);


                    if (questions.length > 0) {
                        selectedQuestions.push({ 
                            question: questions[0], 
                            category: categoryType, 
                            subject: subject 
                        });
                        usedQuestionIds.add(questions[0]._id);
                        filled++;
                        found = true;
                    }
                }


                if (!found) {
                    // Fallback: use least-served questions globally
                    const questions = await QuizQuestion.find({
                        intendedClass: { $in: allowedClasses },
                        isActive: true,
                        _id: { $nin: [...usedQuestionIds] }
                    }).sort({ timesServedOverall: 1, lastServedTimestamp: 1 })
                      .limit(count - filled)
                      .session(session);


                    for (const q of questions) {
                        selectedQuestions.push({ 
                            question: q, 
                            category: categoryType, 
                            subject: q.subject 
                        });
                        usedQuestionIds.add(q._id);
                        filled++;
                    }
                    break;
                }
            }
        }


        // Update question stats asynchronously (in background)
        setImmediate(async () => {
            for (const { question } of selectedQuestions) {
                await QuizQuestion.updateOne(
                    { _id: question._id },
                    { 
                        $inc: { timesServedOverall: 1 },
                        $set: { lastServedTimestamp: new Date() }
                    }
                );
            }
        });


        await session.commitTransaction();
        return selectedQuestions.map(sq => sq.question);


    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        session.endSession();
    }
}


function findUnderrepresentedSlots(subjectProgress) {
    const underrepresented = {};
    const quotas = { ownClass: 5, lowerClass: 2, higherClass: 3 };


    for (const subject in subjectProgress) {
        underrepresented[subject] = {};
        for (const category in quotas) {
            const current = subjectProgress[subject][category] || 0;
            const needed = quotas[category] - current;
            if (needed > 0) {
                underrepresented[subject][category] = needed;
            }
        }
    }


    return underrepresented;
}


// --- Email Configuration ---
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});


if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.warn('WARNING: EMAIL_USER or EMAIL_PASS not set. Email functionalities will not work.');
}


// --- Cloudinary Configuration ---
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});


if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    console.warn('WARNING: Cloudinary environment variables are not fully set. File uploads will not work.');
} else {
    console.log('Cloudinary configured successfully.');
}



// --- Authentication Middleware ---
// authenticateToken is defined above


const authenticateTeacherToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];


    if (!token) {
        console.error('No authentication token provided in teacher request');
        return res.status(401).json({ message: 'Access Denied: No authentication token provided.' });
    }


    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
            console.error('JWT verification error (Teacher):', {
                error: err.message,
                token: token.substring(0, 20) + '...',
                headers: req.headers.authorization ? 'present' : 'missing'
            });
            return res.status(403).json({ message: 'Access Denied: Invalid or expired teacher token.' });
        }


        // Ensure the token is for a teacher
        if (decoded.role !== 'teacher') {
            console.error('Token role mismatch:', decoded.role);
            return res.status(403).json({ message: 'Access Denied: Teacher access required.' });
        }


        req.teacher = decoded;
        next();
    });
};


const authenticateAdminToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];


    if (!token) {
        return res.status(401).json({ message: 'Access Denied: No authentication token provided.' });
    }


    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
            console.error('JWT verification error (Admin):', err.message);
            return res.status(403).json({ message: 'Access Denied: Invalid or expired admin token.' });
        }
        req.admin = decoded;
        next();
    });
};


// --- AI Service Configuration ---
const MODEL_NAME = "gemini-1.5-flash-latest";
const API_KEY = process.env.GEMINI_API_KEY;


let genAI;
if (!API_KEY) {
    console.error("GEMINI_API_KEY environment variable is not set. Preader Games AI features will not work.");
} else {
    genAI = new GoogleGenerativeAI(API_KEY);
}


async function generateStoryNode(basePrompt, currentGameState, studentClass, previousScene = null, chosenOptionText = null) {
    if (!genAI) {
        throw new Error("AI service not configured: GEMINI_API_KEY is missing or invalid.");
    }


    const model = genAI.getGenerativeModel({ model: MODEL_NAME });


    let contentSafetyInstruction = "";
    const classNumber = parseInt(studentClass.replace('S.', ""));


    if (classNumber <= 4) {
        contentSafetyInstruction = 'The story MUST be entirely clean, appropriate for all ages, ' +
            'and contain NO sexual content, suggestive themes, or explicit language whatsoever. ' +
            'Focus on adventure, mystery, and school-appropriate dilemmas.';
    } else {
        contentSafetyInstruction = 'The story should be engaging and can explore more ' +
            'complex themes suitable for older secondary students, but it MUST remain clean and ' +
            'appropriate for a school environment. Absolutely NO sexually explicit or suggestive content ' +
            'is allowed. Focus on mature themes like complex ethical dilemmas, advanced ' +
            'problem-solving, and character development, while maintaining a non-explicit narrative.';
    }


    let ethicalImpactPrompt = "";
    if (currentGameState && typeof currentGameState.currentEthicalScore === 'number') {
        if (currentGameState.currentEthicalScore < -20) {
            ethicalImpactPrompt = "Introduce significant and harsh unexpected twists, difficult consequences, and morally ambiguous situations.";
        } else if (currentGameState.currentEthicalScore < 0) {
            ethicalImpactPrompt = "Introduce some unexpected twists and challenging dilemmas as a consequence of past choices.";
        } else if (currentGameState.currentEthicalScore > 20) {
            ethicalImpactPrompt = "Introduce opportunities for positive outcomes and rewarding challenges, but still include unexpected twists to keep it thrilling.";
        } else {
            ethicalImpactPrompt = "Ensure the story has unexpected twists and hard decisions.";
        }
    } else {
        ethicalImpactPrompt = "Ensure the story has unexpected twists and hard decisions.";
    }


    let continuationContext = "";
    if (previousScene && chosenOptionText) {
        continuationContext = `
            **Previous Scene:**
            ${previousScene}


            **Player's Choice:**
            "${chosenOptionText}"
            Based on this choice, continue the narrative.
        `;
    }


    const fullPrompt = `
        You are generating a scene for an interactive story game set in a typical, vibrant Ugandan secondary school.
        Focus on details relevant to this setting. Use common Ugandan names for characters. Incorporate elements like
        school uniforms, assembly grounds, dormitories (if boarding), specific classroom environments, common school
        activities (e.g., morning assembly, prep time, sports day), and interactions with 'mwalimu' (teacher) or 'prefects').


        **Your Task:** Generate the next scene of the interactive story.
        The narrative must be rich, descriptive, and novel-like.
        ${ethicalImpactPrompt}
        ${contentSafetyInstruction}


        ${continuationContext}


        **Current Player State (for context, do not explicitly reference in narrative unless relevant):**
        ${JSON.stringify(currentGameState, null, 2)}


        **Output Format:**
        Respond ONLY with a JSON object.
        The JSON must have two top-level keys: \`sceneDescription\` (string) and \`choices\` (array of objects).
        Each choice object must have:
        - \`choiceText\` (string)
        - \`ethicalImpact\` (object: \`scoreChange\` (number), \`ethicalPrinciple\` (string, e.g., "compassion", "integrity", "deception"))
        - \`statChanges\` (object: \`life\`, \`mana\`, \`morale\`, \`reputation\`, \`discipline\`, \`knowledge\`, \`stress\`, \`luck\` - all numbers, default to 0 if no change)
        - \`requiredStats\` (optional object: \`life\`, \`mana\`, \`morale\`, etc. - numbers, if this choice has prerequisites)
        - \`unavailableReason\` (optional string, if \`requiredStats\` are not met, e.g., "Not enough mana to cast this spell").
        - \`bytesAwarded\` (number, default to 1, for this specific choice).
        Ensure all numerical values for stat changes are provided, even if 0.
        Ensure \`ethicalImpact\` and \`bytesAwarded\` are always present for each choice.
    `;


    try {
        const result = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: fullPrompt }] }],
            generationConfig: {
                responseMimeType: "application/json"
            },
            safetySettings: [
                {
                    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
                    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
                },
                {
                    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
                    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
                },
                {
                    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
                    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
                },
                {
                    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
                    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
                },
            ]
        });


        const responseText = result.candidates[0].content.parts[0].text;
        const parsedResponse = JSON.parse(responseText);


        if (!parsedResponse.sceneDescription || !Array.isArray(parsedResponse.choices)) {
            throw new Error("AI response did not match expected JSON structure.");
        }


        parsedResponse.choices = parsedResponse.choices.map(choice => ({
            ...choice,
            bytesAwarded: typeof choice.bytesAwarded === 'number' ? choice.bytesAwarded : 1
        }));


        return parsedResponse;
    } catch (error) {
        console.error("Error calling Gemini API:", error.message);
        throw new Error(`Failed to generate story content: ${error.message}`);
    }
}


// --- API Endpoints ---


// Initialize admin account on startup
async function initializeAdmin() {
    try {
        const adminEmail = 'zackian1122@gmail.com';
        const existingAdmin = await Administrator.findOne({ email: adminEmail });


        if (!existingAdmin) {
            const saltRounds = 10;
            const hashedPassword = await bcrypt.hash('001@simax001@simax', saltRounds);


            const newAdmin = new Administrator({
                adminName: 'Administrator',
                email: adminEmail,
                password: hashedPassword
            });


            await newAdmin.save();
            console.log('Initial administrator account created successfully.');
        } else {
            console.log('Administrator account already exists.');
        }
    } catch (error) {
        console.error('Error creating initial administrator:', error);
    }
}


// Initialize subjects on startup
async function initializeSubjects() {
    const subjects = [
        { name: "Mathematics", isCompulsory: true, applicableLevels: ["O_Level_Lower", "O_Level_Middle", "A_Level"] },
        { name: "English Language", isCompulsory: true, applicableLevels: ["O_Level_Lower", "O_Level_Middle", "A_Level"] },
        { name: "Biology", isCompulsory: true, applicableLevels: ["O_Level_Lower", "O_Level_Middle", "A_Level"] },
        { name: "Chemistry", isCompulsory: true, applicableLevels: ["O_Level_Lower", "O_Level_Middle", "A_Level"] },
        { name: "Physics", isCompulsory: true, applicableLevels: ["O_Level_Lower", "O_Level_Middle", "A_Level"] },
        { name: "History", isCompulsory: true, applicableLevels: ["O_Level_Lower", "O_Level_Middle", "A_Level"] },
        { name: "Geography", isCompulsory: true, applicableLevels: ["O_Level_Lower", "O_Level_Middle", "A_Level"] },
        { name: "Computer Science", isCompulsory: false, applicableLevels: ["O_Level_Middle", "A_Level"] },
        { name: "Agriculture", isCompulsory: false, applicableLevels: ["O_Level_Lower", "O_Level_Middle", "A_Level"] },
        { name: "Literature in English", isCompulsory: false, applicableLevels: ["O_Level_Middle", "A_Level"] },
        { name: "French", isCompulsory: false, applicableLevels: ["O_Level_Lower", "O_Level_Middle", "A_Level"] },
        { name: "German", isCompulsory: false, applicableLevels: ["O_Level_Lower", "O_Level_Middle", "A_Level"] },
        { name: "Kiswahili", isCompulsory: false, applicableLevels: ["O_Level_Lower", "O_Level_Middle", "A_Level"] },
        { name: "Luganda", isCompulsory: false, applicableLevels: ["O_Level_Lower", "O_Level_Middle", "A_Level"] },
        { name: "Fine Art", isCompulsory: false, applicableLevels: ["O_Level_Lower", "O_Level_Middle", "A_Level"] },
        { name: "Performing Arts", isCompulsory: false, applicableLevels: ["O_Level_Lower", "O_Level_Middle", "A_Level"] },
        { name: "Physical Education", isCompulsory: false, applicableLevels: ["O_Level_Lower", "O_Level_Middle", "A_Level"] },
        { name: "Technology and Design", isCompulsory: false, applicableLevels: ["O_Level_Lower", "O_Level_Middle", "A_Level"] }
    ];


    for (const subject of subjects) {
        await Subject.findOneAndUpdate(
            { name: subject.name },
            subject,
            { upsert: true, new: true }
        );
    }
}


// Initialize subjects and admin on startup
initializeSubjects().catch(console.error);
initializeAdmin().catch(console.error);


// Email verification endpoints (existing)
app.post('/send-verification-code', [
    body('email').isEmail().withMessage('Please provide a valid email address.')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }


    const { email } = req.body;


    try {
        const student = await Student.findOne({ email });
        if (student && student.isEmailVerified) {
            return res.status(400).json({ message: 'This email is already verified.' });
        }


        const code = Math.floor(100000 + Math.random() * 900000).toString();


        await VerificationCode.findOneAndUpdate(
            { email },
            { code, createdAt: Date.now() },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );


        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'SchoolByte Email Verification Code',
            html: `<p>Your SchoolByte verification code is: <strong>${code}</strong></p><p>This code is valid for 10 minutes.</p>`
        };


        await transporter.sendMail(mailOptions);
        res.status(200).json({ message: 'Verification code sent to your email.' });


    } catch (error) {
        console.error('Error sending verification email:', error);
        res.status(500).json({ message: 'Failed to send verification code.', error: error.message });
    }
});


app.post('/verify-code', [
    body('email').isEmail().withMessage('Please provide a valid email address.'),
    body('code').notEmpty().withMessage('Verification code is required.')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }


    const { email, code } = req.body;


    try {
        const storedCode = await VerificationCode.findOne({ email });


        if (!storedCode) {
            return res.status(400).json({ message: 'No verification code found for this email, or it has expired.', verified: false });
        }


        if (storedCode.code === code) {
            await Student.updateOne({ email }, { isEmailVerified: true });
            await VerificationCode.deleteOne({ email });
            return res.status(200).json({ message: 'Email verified successfully!', verified: true });
        } else {
            return res.status(400).json({ message: 'Invalid verification code.', verified: false });
        }
    } catch (error) {
        console.error('Error verifying code:', error);
        res.status(500).json({ message: 'Error verifying code.', error: error.message, verified: false });
    }
});


// Enhanced student registration with subject validation
app.post('/register-student', [
    body('studentName').notEmpty().withMessage('Student name is required.'),
    body('indexNumber').notEmpty().withMessage('Index number is required.').isAlphanumeric().withMessage('Index number must be alphanumeric.'),
    body('email').isEmail().withMessage('Please provide a valid email address.'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long.'),
    body('class').notEmpty().withMessage('Class is required.').isIn(['S.1', 'S.2', 'S.3', 'S.4', 'S.5', 'S.6']).withMessage('Invalid class.'),
    body('stream').notEmpty().withMessage('Stream is required.'),
    body('classTeacher').notEmpty().withMessage('Class Teacher is required.'),
    body('subjectsEnrolled').isArray().withMessage('Subjects enrolled must be an array.')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }


    const { studentName, indexNumber, email, password, class: studentClass, stream, classTeacher, subjectsEnrolled } = req.body;


    try {
        // Validate subject enrollment rules
        const compulsorySubjects = await Subject.find({ isCompulsory: true }).select('name');
        const compulsoryNames = compulsorySubjects.map(s => s.name);


        let expectedSubjectCount;
        let requiredCompulsory = true;


        if (['S.1', 'S.2'].includes(studentClass)) {
            expectedSubjectCount = 12; // 7 compulsory + 5 subsidiary
        } else if (['S.3', 'S.4'].includes(studentClass)) {
            expectedSubjectCount = 9; // 7 compulsory + 2 subsidiary
        } else if (['S.5', 'S.6'].includes(studentClass)) {
            expectedSubjectCount = 5; // Any 5 subjects
            requiredCompulsory = false;
        }


        if (subjectsEnrolled.length !== expectedSubjectCount) {
            return res.status(400).json({ 
                message: `Invalid number of subjects. ${studentClass} students must enroll in exactly ${expectedSubjectCount} subjects.` 
            });
        }


        if (requiredCompulsory) {
            const hasAllCompulsory = compulsoryNames.every(name => subjectsEnrolled.includes(name));
            if (!hasAllCompulsory) {
                return res.status(400).json({ 
                    message: `Missing required compulsory subjects: ${compulsoryNames.join(', ')}` 
                });
            }
        }


        const existingStudent = await Student.findOne({ $or: [{ email }, { indexNumber }] });
        if (existingStudent) {
            let message = 'Student with this ';
            if (existingStudent.email === email) {
                message += 'email';
            }
            if (existingStudent.indexNumber === indexNumber) {
                message += existingStudent.email === email ? ' and index number' : 'index number';
            }
            message += ' already exists.';
            return res.status(409).json({ message });
        }


        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);


        const newStudent = new Student({
            studentName,
            indexNumber,
            email,
            password: hashedPassword,
            isEmailVerified: false,
            bytes: 20,
            class: studentClass,
            stream,
            classTeacher,
            subjectsEnrolled,
            currentQuizSessionId: null // Will be set after quiz session creation
        });


        await newStudent.save();


        // Create initial quiz session with the student's ID
        const initialQuizSession = new QuizSession({
            userId: newStudent._id,
            questionsCompletedCount: 0
        });
        await initialQuizSession.save();


        // Update student with quiz session ID
        newStudent.currentQuizSessionId = initialQuizSession._id;
        await newStudent.save();


        res.status(201).json({
            message: 'Student registered successfully! Please verify your email to log in.',
            student: {
                name: studentName,
                email: email,
                class: studentClass,
                stream: stream,
                bytes: newStudent.bytes,
                subjectsEnrolled: subjectsEnrolled
            }
        });


    } catch (error) {
        console.error('Error during student registration:', error);
        if (error.code === 11000) {
            let field = Object.keys(error.keyValue)[0];
            let value = error.keyValue[field];
            return res.status(409).json({ message: `A student with this ${field} '${value}' already exists.` });
        }
        res.status(500).json({ message: 'Server error during registration.', error: error.message });
    }
});


// Enhanced student login
app.post('/login-student', [
    body('email').isEmail().withMessage('Please provide a valid email address.'),
    body('password').notEmpty().withMessage('Password is required.')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }


    const { email, password } = req.body;


    try {
        const student = await Student.findOne({ email });


        if (!student) {
            return res.status(401).json({ message: 'Invalid email or password.' });
        }


        const isMatch = await bcrypt.compare(password, student.password);


        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid email or password.' });
        }


        // Check and reset weekly counters
        await checkAndResetWeeklyCounters(student);


        const token = jwt.sign(
            { 
                id: student._id, 
                email: student.email, 
                studentName: student.studentName, 
                indexNumber: student.indexNumber, 
                role: 'student' 
            },
            JWT_SECRET,
            { expiresIn: '24h' }
        );


        res.status(200).json({
            message: 'Login successful!',
            token: token,
            student: {
                studentName: student.studentName,
                email: student.email,
                class: student.class,
                stream: student.stream,
                bytes: student.bytes,
                isEmailVerified: student.isEmailVerified,
                subjectsEnrolled: student.subjectsEnrolled
            }
        });


    } catch (error) {
        console.error('Error during student login:', error);
        res.status(500).json({ message: 'Server error during login.', error: error.message });
    }
});


// Enhanced student dashboard
app.get('/student/dashboard', authenticateToken, async (req, res) => {
    try {
        // Use req.student.id from the authenticateToken middleware
        const studentData = await Student.findById(req.student.id).select('-password').populate('currentQuizSessionId');


        if (!studentData) {
            return res.status(404).json({ message: 'Student data not found.' });
        }


        // Check and reset weekly counters
        await checkAndResetWeeklyCounters(studentData);


        res.status(200).json({
            message: `Welcome to your dashboard, ${studentData.studentName}!`,
            student: {
                studentName: studentData.studentName,
                indexNumber: studentData.indexNumber,
                email: studentData.email,
                isEmailVerified: studentData.isEmailVerified,
                bytes: studentData.bytes || 0,
                class: studentData.class,
                stream: studentData.stream,
                classTeacher: studentData.classTeacher,
                subjectsEnrolled: studentData.subjectsEnrolled,
                firstNameDisplay: studentData.firstNameDisplay,
                preferredName: studentData.preferredName,
                preferences: studentData.preferences,
                totalPreaderGameTimeMinutes: studentData.totalPreaderGameTimeMinutes || 0,
                quizzesCompletedThisWeek: studentData.quizzesCompletedThisWeek,
                quizSession: studentData.currentQuizSessionId,
                createdAt: studentData.createdAt
            }
        });


    } catch (error) {
        console.error('Error accessing student dashboard:', error);
        res.status(500).json({ message: 'Server error accessing dashboard.', error: error.message });
    }
});


// Enhanced Quiz Generation Endpoint
app.get('/student/quizzes/generate', authenticateToken, async (req, res) => {
    try {
        // Use req.student.id from the authenticateToken middleware
        const student = await Student.findById(req.student.id);
        if (!student) {
            return res.status(404).json({ message: 'Student not found.' });
        }


        // Check weekly quiz limit
        await checkAndResetWeeklyCounters(student);
        const weeklyLimit = 50; // Configurable


        if (student.quizzesCompletedThisWeek >= weeklyLimit) {
            return res.status(429).json({ 
                message: 'You have reached your weekly quiz limit. Please try again next week!',
                limit: weeklyLimit,
                completed: student.quizzesCompletedThisWeek
            });
        }


        // Generate quiz questions using enhanced algorithm
        const questions = await generateQuizQuestions(student, req.query.subject);


        if (questions.length === 0) {
            return res.status(404).json({ message: 'No suitable questions found. Please try again later.' });
        }


        // Return questions without correct answers
        const sanitizedQuestions = questions.map(q => ({
            _id: q._id,
            questionText: q.questionText,
            subject: q.subject,
            intendedClass: q.intendedClass,
            type: q.type,
            options: q.options ? q.options.map(opt => ({ text: opt.text, _id: opt._id })) : undefined,
            matchingPairs: q.matchingPairs,
            orderedItems: q.orderedItems,
            instructions: q.instructions,
            hint: q.hint,
            topic: q.topic,
            subTopic: q.subTopic,
            uploadedBy: { teacherName: q.uploadedBy.teacherName }
        }));


        res.status(200).json({
            message: 'Quiz questions generated successfully!',
            questions: sanitizedQuestions,
            totalQuestions: sanitizedQuestions.length,
            metadata: {
                studentClass: student.class,
                questionsThisWeek: student.quizzesCompletedThisWeek,
                weeklyLimit: weeklyLimit
            }
        });


    } catch (error) {
        console.error('Error generating quiz questions:', error);
        res.status(500).json({ message: 'Failed to generate quiz questions.', error: error.message });
    }
});


// Enhanced Quiz Submission with full grading system
app.post('/student/quizzes/submit', authenticateToken, [
    body('quizSubmissions').isArray({ min: 1 }).withMessage('Quiz submissions array is required and must not be empty.'),
    body('quizSubmissions.*.questionId').isMongoId().withMessage('Invalid question ID.'),
    body('quizSubmissions.*.studentAnswer').notEmpty().withMessage('Student answer is required for each question.')
], async (req, res) => {
    const { quizSubmissions } = req.body;
    // Use req.student.id from the authenticateToken middleware
    const studentId = req.student.id; 


    const session = await mongoose.startSession();
    session.startTransaction();


    try {
        const student = await Student.findById(studentId).session(session);
        if (!student) {
            return res.status(404).json({ message: 'Student not found.' });
        }


        const quizSession = await QuizSession.findById(student.currentQuizSessionId).session(session);
        if (!quizSession) {
            return res.status(404).json({ message: 'Quiz session not found.' });
        }


        let totalBytesEarned = 0;
        const gradedAnswers = [];
        const completedAttempts = [];


        // Grade each question
        for (const submission of quizSubmissions) {
            const questionId = submission.questionId;
            const studentAnswer = submission.studentAnswer;


            const quizQuestion = await QuizQuestion.findById(questionId).session(session);
            if (!quizQuestion) {
                console.warn(`Quiz question with ID ${questionId} not found. Skipping.`);
                continue;
            }


            let isCorrect = false;
            let questionBytes = 0;
            let partialScore = 0;


            // Enhanced grading based on question type
            switch (quizQuestion.type) {
                case 'short-answer':
                case 'problem-solving':
                    if (typeof studentAnswer === 'string') {
                        partialScore = await gradeNLPAnswer(studentAnswer, quizQuestion);
                        isCorrect = partialScore >= 0.7;
                        questionBytes = partialScore;
                    }
                    break;


                case 'fill-in-the-blank':
                    if (typeof studentAnswer === 'string') {
                        const normalizedStudentAnswer = studentAnswer.toLowerCase().trim();
                        isCorrect = quizQuestion.correctAnswers.some(correctAns =>
                            normalizedStudentAnswer === correctAns.toLowerCase().trim()
                        );
                        questionBytes = isCorrect ? 1 : 0;
                        partialScore = questionBytes;
                    }
                    break;


                case 'true-false':
                    if (typeof studentAnswer === 'boolean' || typeof studentAnswer === 'string') {
                        const normalizedStudentAnswer = String(studentAnswer).toLowerCase();
                        isCorrect = quizQuestion.correctAnswers.some(correctAns =>
                            normalizedStudentAnswer === correctAns.toLowerCase().trim()
                        );
                        questionBytes = isCorrect ? 1 : 0;
                        partialScore = questionBytes;
                    }
                    break;


                case 'multiple-choice-single':
                    if (typeof studentAnswer === 'string' && mongoose.Types.ObjectId.isValid(studentAnswer)) {
                        isCorrect = quizQuestion.options.some(option =>
                            option._id.toString() === studentAnswer && option.isCorrect
                        );
                        questionBytes = isCorrect ? 1 : 0;
                        partialScore = questionBytes;
                    }
                    break;


                case 'multiple-choice-multi':
                    if (Array.isArray(studentAnswer)) {
                        const correctOptionIds = quizQuestion.options
                            .filter(option => option.isCorrect)
                            .map(option => option._id.toString());
                        const chosenOptionIds = studentAnswer.map(id => id.toString());


                        const correctChoices = chosenOptionIds.filter(id => correctOptionIds.includes(id)).length;
                        const incorrectChoices = chosenOptionIds.filter(id => !correctOptionIds.includes(id)).length;


                        partialScore = Math.max(0, (correctChoices - incorrectChoices) / correctOptionIds.length);
                        isCorrect = partialScore >= 0.7;
                        questionBytes = partialScore;
                    }
                    break;


                case 'matching':
                    if (Array.isArray(studentAnswer)) {
                        const normalizedCorrectPairs = quizQuestion.matchingPairs
                            .map(pair => ({ itemA: pair.itemA.toLowerCase().trim(), itemB: pair.itemB.toLowerCase().trim() }));
                        const normalizedStudentPairs = studentAnswer
                            .map(pair => ({ itemA: pair.itemA.toLowerCase().trim(), itemB: pair.itemB.toLowerCase().trim() }));


                        let correctMatches = 0;
                        normalizedStudentPairs.forEach(studentPair => {
                            if (normalizedCorrectPairs.some(correctPair => 
                                correctPair.itemA === studentPair.itemA && correctPair.itemB === studentPair.itemB)) {
                                correctMatches++;
                            }
                        });


                        partialScore = correctMatches / normalizedCorrectPairs.length;
                        isCorrect = partialScore >= 0.7;
                        questionBytes = partialScore;
                    }
                    break;


                case 'ordering':
                    if (Array.isArray(studentAnswer)) {
                        const normalizedCorrectOrder = quizQuestion.orderedItems.map(item => item.toLowerCase().trim());
                        const normalizedStudentOrder = studentAnswer.map(item => item.toLowerCase().trim());


                        let correctPositions = 0;
                        normalizedStudentOrder.forEach((item, index) => {
                            if (normalizedCorrectOrder[index] === item) {
                                correctPositions++;
                            }
                        });


                        partialScore = correctPositions / normalizedCorrectOrder.length;
                        isCorrect = partialScore >= 0.7;
                        questionBytes = partialScore;
                    }
                    break;


                case 'numeric-entry':
                    if (typeof studentAnswer === 'string' || typeof studentAnswer === 'number') {
                        const numericAnswer = parseFloat(studentAnswer);
                        if (!isNaN(numericAnswer)) {
                            isCorrect = quizQuestion.correctAnswers.some(correctAns => {
                                const correctNum = parseFloat(correctAns);
                                return Math.abs(numericAnswer - correctNum) < 0.01;
                            });
                            questionBytes = isCorrect ? 1 : 0;
                            partialScore = questionBytes;
                        }
                    }
                    break;


                default:
                    console.warn(`Unknown quiz question type: ${quizQuestion.type} for question ID: ${questionId}`);
                    questionBytes = 0;
                    isCorrect = false;
                    partialScore = 0;
            }


            totalBytesEarned += questionBytes;


            gradedAnswers.push({
                questionId: questionId,
                studentAnswer: studentAnswer,
                isCorrect: isCorrect,
                bytesEarned: questionBytes,
                partialScore: partialScore,
                subject: quizQuestion.subject,
                intendedClass: quizQuestion.intendedClass,
                questionType: quizQuestion.type
            });


            // Create completed attempt log
            completedAttempts.push({
                userId: studentId,
                quizId: questionId,
                studentClassAtAttempt: student.class,
                questionSubject: quizQuestion.subject,
                questionIntendedClass: quizQuestion.intendedClass,
                bytesAwarded: questionBytes,
                isSuccessful: isCorrect,
                attemptDate: new Date(),
                quizSessionId: quizSession._id,
                studentAnswer: studentAnswer,
                correctAnswer: quizQuestion.correctAnswers || quizQuestion.options?.filter(o => o.isCorrect),
                questionType: quizQuestion.type,
                partialScore: partialScore
            });


            // Update subject progress in quiz session
            const categoryType = determineQuestionCategory(student.class, quizQuestion.intendedClass);
            if (categoryType && quizSession.subjectProgress[quizQuestion.subject]) {
                quizSession.subjectProgress[quizQuestion.subject][categoryType]++;
            }
        }


        // Round total bytes earned
        const finalBytesEarned = Math.round(totalBytesEarned);


        // Update student data
        student.bytes += finalBytesEarned;
        student.quizzesCompletedThisWeek += 1;


        // Update recent quiz IDs (sliding window)
        const newQuizIds = quizSubmissions.map(sub => new mongoose.Types.ObjectId(sub.questionId));
        student.recentQuizIds = [...newQuizIds, ...student.recentQuizIds].slice(0, 200);


        await student.save({ session });


        // Update quiz session
        quizSession.questionsCompletedCount += quizSubmissions.length;
        quizSession.updatedAt = new Date();


        // Check if 180-question cycle is complete
        if (quizSession.questionsCompletedCount >= 180) {
            quizSession.completedAt = new Date();


            // Create new quiz session
            const newQuizSession = new QuizSession({
                userId: studentId,
                questionsCompletedCount: 0
            });
            await newQuizSession.save({ session });


            student.currentQuizSessionId = newQuizSession._id;
            await student.save({ session });
        }


        await quizSession.save({ session });


        // Bulk insert completed attempts
        await CompletedQuizAttempt.insertMany(completedAttempts, { session });


        await session.commitTransaction();


        res.status(200).json({
            message: 'Quiz submitted and graded successfully!',
            totalCorrectQuestions: gradedAnswers.filter(a => a.isCorrect).length,
            totalAttemptedQuestions: gradedAnswers.length,
            score: Math.round((gradedAnswers.filter(a => a.isCorrect).length / gradedAnswers.length) * 100),
            bytesEarned: finalBytesEarned,
            studentCurrentBytes: student.bytes,
            gradedAnswers: gradedAnswers,
            cycleProgress: {
                questionsCompleted: quizSession.questionsCompletedCount,
                totalCycleQuestions: 180,
                cycleComplete: quizSession.completedAt ? true : false
            }
        });


    } catch (error) {
        await session.abortTransaction();
        console.error('Error submitting quiz:', error);
        res.status(500).json({ message: 'Failed to submit quiz. Please try again.', error: error.message });
    } finally {
        session.endSession();
    }
});


// Helper function to determine question category
function determineQuestionCategory(studentClass, questionClass) {
    const classOrder = ['S.1', 'S.2', 'S.3', 'S.4', 'S.5', 'S.6'];
    const studentIndex = classOrder.indexOf(studentClass);
    const questionIndex = classOrder.indexOf(questionClass);


    if (studentIndex === questionIndex) return 'ownClass';
    if (questionIndex < studentIndex) return 'lowerClass';
    if (questionIndex > studentIndex) return 'higherClass';
    return null;
}


// Enhanced teacher quiz question management
app.post('/teacher/quiz-questions', authenticateTeacherToken, [
    body('questionText').notEmpty().withMessage('Question text is required.').trim(),
    body('subject').notEmpty().withMessage('Subject is required.').trim(),
    body('intendedClass').notEmpty().withMessage('Intended class is required.').trim().isIn(['S.1', 'S.2', 'S.3', 'S.4', 'S.5', 'S.6']).withMessage('Invalid intended class.'),
    body('type').notEmpty().withMessage('Question type is required.').isIn([
        'short-answer', 'multiple-choice-single', 'multiple-choice-multi',
        'true-false', 'fill-in-the-blank', 'matching', 'ordering', 'problem-solving', 'numeric-entry'
    ]).withMessage('Invalid question type.')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }


    const {
        questionText, subject, intendedClass, type, options, correctAnswers,
        matchingPairs, orderedItems, instructions, hint, explanation,
        maxBytesRewardPerQuestion, keywordsForGrading, negativeKeywords,
        topic, subTopic, skillType
    } = req.body;


    const teacherId = req.teacher.id;
    const teacherName = req.teacher.teacherName;


    const session = await mongoose.startSession();
    session.startTransaction();


    try {
        // Check for exact duplicates using hash
        const normalizedText = questionText.toLowerCase().trim().replace(/\s+/g, ' ');
        const questionHash = crypto.createHash('sha256').update(normalizedText).digest('hex');


        const existingQuestion = await QuizQuestion.findOne({ questionHash }).session(session);
        if (existingQuestion) {
            await session.abortTransaction();
            return res.status(409).json({ 
                message: 'This question appears to be an exact duplicate of an existing question. Please review and modify if you still wish to submit.',
                existingQuestion: {
                    id: existingQuestion._id,
                    text: existingQuestion.questionText,
                    uploadedBy: existingQuestion.uploadedBy.teacherName
                }
            });
        }


        // Validate type-specific fields
        if (['multiple-choice-single', 'multiple-choice-multi'].includes(type) && (!options || options.length === 0)) {
            return res.status(400).json({ message: 'Options are required for multiple-choice questions.' });
        }
        if (['short-answer', 'true-false', 'fill-in-the-blank', 'problem-solving', 'numeric-entry'].includes(type) && (!correctAnswers || correctAnswers.length === 0)) {
            return res.status(400).json({ message: 'Correct answers are required for this question type.' });
        }
        if (type === 'matching' && (!matchingPairs || matchingPairs.length === 0)) {
            return res.status(400).json({ message: 'Matching pairs are required for matching questions.' });
        }
        if (type === 'ordering' && (!orderedItems || orderedItems.length === 0)) {
            return res.status(400).json({ message: 'Ordered items are required for ordering questions.' });
        }


        const newQuizQuestion = new QuizQuestion({
            questionText,
            subject,
            intendedClass,
            type,
            options,
            correctAnswers,
            matchingPairs,
            orderedItems,
            instructions,
            hint,
            explanation,
            maxBytesRewardPerQuestion: maxBytesRewardPerQuestion || 1,
            keywordsForGrading,
            negativeKeywords,
            topic,
            subTopic,
            skillType,
            uploadedBy: {
                teacherId,
                teacherName
            },
            questionHash
        });


        await newQuizQuestion.save({ session });


        // Update teacher's weekly upload count
        const teacher = await Teacher.findById(teacherId).session(session);
        await checkAndResetTeacherWeeklyCounters(teacher);
        teacher.quizzesUploadedThisWeek += 1;
        await teacher.save({ session });


        await session.commitTransaction();


        res.status(201).json({
            message: 'Quiz question created successfully!',
            question: {
                id: newQuizQuestion._id,
                questionText: newQuizQuestion.questionText,
                subject: newQuizQuestion.subject,
                intendedClass: newQuizQuestion.intendedClass,
                type: newQuizQuestion.type,
                isActive: newQuizQuestion.isActive
            },
            weeklyStats: {
                uploaded: teacher.quizzesUploadedThisWeek,
                target: 10 // Configurable target
            }
        });


    } catch (error) {
        await session.abortTransaction();
        console.error('Error creating quiz question:', error);

// Student endpoint to fetch work files by subject
app.get('/student/workfiles', authenticateToken, async (req, res) => {
    try {
        const { subject, intendedClass } = req.query;

        let query = {};
        if (subject) query.subject = subject;
        if (intendedClass) query.intendedClass = intendedClass;

        const workFiles = await WorkFile.find(query)
            .populate('uploadedBy.teacherId', 'teacherName')
            .sort({ createdAt: -1 });

        res.status(200).json({
            message: 'Work files fetched successfully.',
            workFiles: workFiles.map(file => ({
                _id: file._id,
                title: file.title,
                description: file.description,
                fileUrl: file.fileUrl,
                subject: file.subject,
                intendedClass: file.intendedClass,
                costBytes: file.costBytes,
                uploadedBy: {
                    teacherName: file.uploadedBy.teacherName
                },
                downloadCount: file.downloadCount || 0,
                createdAt: file.createdAt
            }))
        });
    } catch (error) {
        console.error('Error fetching work files:', error);
        res.status(500).json({ message: 'Failed to fetch work files.', error: error.message });
    }
});

// Student endpoint to download a work file (with bytes deduction)
app.post('/student/download-workfile/:workFileId', authenticateToken, async (req, res) => {
    const { workFileId } = req.params;
    const studentId = req.student.id; // Use student ID from token

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const student = await Student.findById(studentId).session(session);
        if (!student) {
            await session.abortTransaction();
            return res.status(404).json({ message: 'Student not found.' });
        }

        const workFile = await WorkFile.findById(workFileId).session(session);
        if (!workFile) {
            await session.abortTransaction();
            return res.status(404).json({ message: 'Work file not found.' });
        }

        // Check if student has enough bytes
        if (student.bytes < workFile.costBytes) {
            await session.abortTransaction();
            return res.status(400).json({ 
                message: `Insufficient bytes. You need ${workFile.costBytes} bytes but only have ${student.bytes} bytes.`,
                requiredBytes: workFile.costBytes,
                currentBytes: student.bytes
            });
        }

        // Deduct bytes
        student.bytes -= workFile.costBytes;
        await student.save({ session });

        // Increment download count
        await WorkFile.updateOne(
            { _id: workFileId },
            { $inc: { downloadCount: 1 } }
        ).session(session);

        await session.commitTransaction();

        res.status(200).json({
            message: 'Download authorized successfully.',
            downloadUrl: workFile.fileUrl,
            bytesDeducted: workFile.costBytes,
            remainingBytes: student.bytes
        });

    } catch (error) {
        await session.abortTransaction();
        console.error('Error processing download:', error);
        res.status(500).json({ message: 'Failed to process download.', error: error.message });
    } finally {
        session.endSession();
    }
});

        res.status(500).json({ message: 'Failed to create quiz question.', error: error.message });
    } finally {
        session.endSession();
    }
});


// Get teacher's quiz questions with enhanced filtering
app.get('/teacher/quiz-questions', authenticateTeacherToken, async (req, res) => {
    const teacherId = req.teacher.id;
    const { subject, intendedClass, type, isActive, page = 1, limit = 20 } = req.query;


    let query = { 'uploadedBy.teacherId': teacherId };
    if (subject) query.subject = subject;
    if (intendedClass) query.intendedClass = intendedClass;
    if (type) query.type = type;
    if (isActive !== undefined) query.isActive = isActive === 'true';


    try {
        const skip = (parseInt(page) - 1) * parseInt(limit);


        const [questions, total] = await Promise.all([
            QuizQuestion.find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit)),
            QuizQuestion.countDocuments(query)
        ]);


        // Get teacher's weekly stats
        const teacher = await Teacher.findById(teacherId);
        await checkAndResetTeacherWeeklyCounters(teacher);


        res.status(200).json({
            message: 'Quiz questions fetched successfully.',
            questions: questions,
            pagination: {
                current: parseInt(page),
                total: Math.ceil(total / parseInt(limit)),
                count: questions.length,
                totalQuestions: total
            },
            weeklyStats: {
                uploaded: teacher.quizzesUploadedThisWeek,
                target: 10 // Configurable target
            }
        });
    } catch (error) {
        console.error('Error fetching quiz questions:', error);
        res.status(500).json({ message: 'Failed to fetch quiz questions.', error: error.message });
    }
});


// Analytics endpoint for quiz performance
app.get('/student/analytics/quiz-performance', authenticateToken, async (req, res) => {
    try {
        const studentId = req.student.id;
        const { timeframe = '30', subject } = req.query;


        const startDate = new Date();
        startDate.setDate(startDate.getDate() - parseInt(timeframe));


        let matchCriteria = {
            userId: new mongoose.Types.ObjectId(studentId),
            attemptDate: { $gte: startDate }
        };


        if (subject) {
            matchCriteria.questionSubject = subject;
        }


        const analytics = await CompletedQuizAttempt.aggregate([
            { $match: matchCriteria },
            {
                $group: {
                    _id: {
                        subject: '$questionSubject',
                        date: { $dateToString: { format: '%Y-%m-%d', date: '$attemptDate' } }
                    },
                    totalAttempts: { $sum: 1 },
                    successfulAttempts: { 
                        $sum: { $cond: ['$isSuccessful', 1, 0] } 
                    },
                    averageScore: { $avg: '$partialScore' },
                    totalBytes: { $sum: '$bytesAwarded' }
                }
            },
            {
                $group: {
                    _id: '$_id.subject',
                    attempts: { $sum: '$totalAttempts' },
                    correct: { $sum: '$successfulAttempts' },
                    accuracy: { 
                        $avg: { 
                            $divide: ['$successfulAttempts', '$totalAttempts'] 
                        } 
                    },
                    averageScore: { $avg: '$averageScore' },
                    totalBytes: { $sum: '$totalBytes' },
                    dailyData: {
                        $push: {
                            date: '$_id.date',
                            attempts: '$totalAttempts',
                            correct: '$successfulAttempts',
                            bytes: '$totalBytes'
                        }
                    }
                }
            },
            { $sort: { _id: 1 } }
        ]);


        res.status(200).json({
            message: 'Quiz performance analytics fetched successfully.',
            timeframe: parseInt(timeframe),
            analytics: analytics
        });


    } catch (error) {
        console.error('Error fetching quiz analytics:', error);
        res.status(500).json({ message: 'Failed to fetch analytics.', error: error.message });
    }
});

// --- Multer Configuration for File Uploads ---
const storage = multer.memoryStorage(); // Use memory storage for Cloudinary upload
const fileFilter = (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type. Only PDFs are allowed.'), false);
    }
};
const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: { fileSize: 25 * 1024 * 1024 } // 25MB file size limit
});



// Game bytes award endpoint
app.post('/api/games/award-bytes', authenticateToken, async (req, res) => {
    try {
        const { gameName, bytesEarned, ...gameData } = req.body;
        const studentId = req.student.id;

        if (!bytesEarned || bytesEarned <= 0) {
            return res.status(400).json({ message: 'Invalid bytes amount' });
        }

        const student = await Student.findById(studentId);
        if (!student) {
            return res.status(404).json({ message: 'Student not found' });
        }

        // Award bytes
        student.bytes += Math.round(bytesEarned);
        await student.save();

        res.status(200).json({
            message: 'Bytes awarded successfully!',
            bytesEarned: Math.round(bytesEarned),
            totalBytes: student.bytes,
            gameName: gameName
        });

    } catch (error) {
        console.error('Error awarding game bytes:', error);
        res.status(500).json({ message: 'Failed to award bytes', error: error.message });
    }
});

app.post(
    '/teacher/upload-content',
    authenticateTeacherToken,
    upload.single('workFilePdf'),
    [
        // Validation chain to check all incoming data
        body('workFileTitle').notEmpty().withMessage('WorkFile title is required.').trim(),
        body('workFileSubject').notEmpty().withMessage('Subject is required.').trim(),
        body('workFileIntendedClass').notEmpty().withMessage('Intended class is required.').trim(),
        body('workFileCostBytes').isInt({ min: 0 }).withMessage('Cost in Bytes must be a number.'),
        body('applyDownloadWatermark').optional().toBoolean(),
        body('activityJson').notEmpty().withMessage('Activity data is required.'),
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        if (!req.file) {
            return res.status(400).json({ message: 'A PDF file is required.' });
        }

        let activityData;
        try {
            activityData = JSON.parse(req.body.activityJson);
        } catch (e) {
            return res.status(400).json({ message: 'Invalid activity JSON format.' });
        }

        const {
            workFileTitle,
            workFileDescription,
            workFileSubject,
            workFileIntendedClass,
            workFileCostBytes,
            applyDownloadWatermark
        } = req.body;

        const teacherId = req.teacher.id;
        const teacherName = req.teacher.teacherName;

        const session = await mongoose.startSession();
        session.startTransaction();

        let uploadedFileUrl = null;
        let workFilePublicId = null;

        try {
            // 1. Upload file to Cloudinary with organized folder structure
            const timestamp = Date.now();
            const randomId = Math.random().toString(36).substring(2, 10);
            workFilePublicId = `schoolbyte/workfiles/${teacherId}/workfile-${timestamp}-${randomId}`;

            const uploadResult = await new Promise((resolve, reject) => {
                const uploadStream = cloudinary.uploader.upload_stream({
                    resource_type: 'raw',
                    public_id: workFilePublicId,
                    folder: `schoolbyte/workfiles/${teacherId}`,
                    format: 'pdf'
                }, (error, result) => {
                    if (error) {
                        return reject(new Error(`Cloudinary upload failed: ${error.message}`));
                    }
                    resolve(result);
                });
                uploadStream.end(req.file.buffer);
            });

            uploadedFileUrl = uploadResult.secure_url;
            console.log(`PDF uploaded to Cloudinary: ${uploadedFileUrl}`);

            // 2. Create the two linked documents in the database
            const newActivity = new Activity({
                title: activityData.title,
                description: activityData.description,
                subject: activityData.subject,
                intendedClass: activityData.intendedClass,
                maxBytesReward: 5, // Or get from form
                questions: activityData.questions, // This saves all questions and keywords
                uploadedBy: { teacherId, teacherName },
                // Temporarily set associatedWorkFile to a placeholder
                associatedWorkFile: new mongoose.Types.ObjectId()
            });

            const newWorkFile = new WorkFile({
                title: workFileTitle,
                description: workFileDescription,
                fileUrl: uploadedFileUrl,
                subject: workFileSubject,
                intendedClass: workFileIntendedClass,
                costBytes: workFileCostBytes,
                uploadedBy: { teacherId, teacherName },
                applyDownloadWatermark: applyDownloadWatermark,
                activity: newActivity._id // Link to the new activity
            });

            // Now update the activity with the real WorkFile ID
            newActivity.associatedWorkFile = newWorkFile._id;

            // 3. Save both to the database
            await newWorkFile.save({ session });
            await newActivity.save({ session });

            // 4. Commit the transaction if everything succeeded
            await session.commitTransaction();

            res.status(201).json({
                message: 'Content uploaded successfully!',
                workFile: newWorkFile,
                activity: newActivity
            });

        } catch (error) {
            // If anything fails, roll back the transaction
            await session.abortTransaction();
            console.error('Upload transaction failed:', error);

            // If the file was uploaded to Cloudinary but the DB failed, delete it
            if (workFilePublicId) {
                try {
                    await cloudinary.uploader.destroy(workFilePublicId, { resource_type: 'raw' });
                } catch (deleteError) {
                    console.error('Failed to delete orphaned Cloudinary file:', deleteError);
                }
            }

            res.status(500).json({ message: 'Failed to upload content. Please try again.' });
        } finally {
            // End the session
            session.endSession();
        }
    }
);



// Existing endpoints for teacher upload, admin management, etc.


// Endpoint for Teacher to upload a WorkFile PDF and its associated Activity
app.post(
    '/teacher/upload-content',
    authenticateTeacherToken,
    upload.single('workFilePdf'),
    [
        // Validation chain with the fix applied
        body('workFileTitle').notEmpty().withMessage('WorkFile title is required.').trim().isLength({ min: 3, max: 200 }),
        body('workFileDescription').optional().isString().withMessage('WorkFile description must be a string.').trim().isLength({ max: 500 }),
        body('workFileSubject').notEmpty().withMessage('WorkFile subject is required.').trim().isLength({ min: 2, max: 100 }),
        body('workFileIntendedClass').notEmpty().withMessage('WorkFile intended class is required.').trim().isIn(['S.1', 'S.2', 'S.3', 'S.4', 'S.5', 'S.6']).withMessage('Invalid WorkFile intended class.'),
        body('workFileCostBytes').isInt({ min: 0 }).withMessage('WorkFile cost bytes must be a non-negative integer.').notEmpty(),

        // ✨ KEY FIX: Changed .isBoolean() to .toBoolean() to correctly handle form data.
        body('applyDownloadWatermark').optional().toBoolean(),

        body('activityJson').notEmpty().withMessage('Activity data is required and must be a JSON string.'),
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            // This is where your request was failing before the fix.
            return res.status(400).json({ errors: errors.array() });
        }

        if (!req.file) {
            return res.status(400).json({ message: 'WorkFile PDF is required.' });
        }

        let activityData;
        try {
            activityData = JSON.parse(req.body.activityJson);
        } catch (parseError) {
            console.error('Error parsing activity JSON:', parseError);
            return res.status(400).json({ message: 'Invalid activity data format. Must be a valid JSON string.' });
        }

        // Manual validation for the parsed activityData
        if (!activityData.title || typeof activityData.title !== 'string' || activityData.title.trim().length < 3 || activityData.title.trim().length > 200) {
            return res.status(400).json({ message: 'Activity title is required and must be between 3 and 200 characters.' });
        }
        if (activityData.description !== undefined && activityData.description !== null && activityData.description !== '' && (typeof activityData.description !== 'string' || activityData.description.trim().length > 500)) {
            return res.status(400).json({ message: 'Activity description must be a string and cannot exceed 500 characters.' });
        }
        if (!activityData.subject || typeof activityData.subject !== 'string' || activityData.subject.trim().length < 2 || activityData.subject.trim().length > 100) {
            return res.status(400).json({ message: 'Activity subject is required and must be between 2 and 100 characters.' });
        }
        const validClasses = ['S.1', 'S.2', 'S.3', 'S.4', 'S.5', 'S.6'];
        if (!activityData.intendedClass || typeof activityData.intendedClass !== 'string' || !validClasses.includes(activityData.intendedClass.trim())) {
            return res.status(400).json({ message: 'Invalid Activity intended class.' });
        }
        if (!Array.isArray(activityData.questions) || activityData.questions.length === 0) {
            return res.status(400).json({ message: 'Activity must have at least one question.' });
        }
        for (const [qIndex, question] of activityData.questions.entries()) {
            if (!question.questionText || typeof question.questionText !== 'string' || question.questionText.trim().length < 10 || question.questionText.trim().length > 1000) {
                return res.status(400).json({ message: `Question ${qIndex + 1}: Question text is required and must be between 10 and 1000 characters.` });
            }
            if (!Array.isArray(question.keywordsForMarking) || question.keywordsForMarking.length === 0) {
                return res.status(400).json({ message: `Question ${qIndex + 1}: Each question must have at least one keyword for marking.` });
            }
            for (const [kIndex, keyword] of question.keywordsForMarking.entries()) {
                if (!keyword || typeof keyword !== 'string' || keyword.trim().length < 1 || keyword.trim().length > 100) {
                    return res.status(400).json({ message: `Question ${qIndex + 1}, Keyword ${kIndex + 1}: Keywords cannot be empty and must be between 1 and 100 characters.` });
                }
            }
        }

        const {
            workFileTitle,
            workFileDescription,
            workFileSubject,
            workFileIntendedClass,
            workFileCostBytes,
            applyDownloadWatermark = true // Default value in case it's not provided
        } = req.body;
        const {
            title: activityTitle,
            description: activityDescription,
            subject: activitySubject,
            intendedClass: activityIntendedClass,
            questions
        } = activityData;
        const teacherId = req.teacher.id;
        const teacherName = req.teacher.teacherName;

        let uploadedFileUrl = null;
        let workFilePublicId = null;
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            workFilePublicId = `schoolbyte/workfiles/${teacherId}/workfile-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
            const cloudinaryUploadResult = await new Promise((resolve, reject) => {
                const uploadStream = cloudinary.uploader.upload_stream(
                    {
                        resource_type: 'raw',
                        public_id: workFilePublicId,
                        folder: `schoolbyte/workfiles/${teacherId}`,
                        format: 'pdf',
                    },
                    (error, result) => {
                        if (error) {
                            return reject(new Error(`Cloudinary upload failed: ${error.message}`));
                        }
                        uploadedFileUrl = result.secure_url;
                        resolve(result);
                    }
                );
                uploadStream.end(req.file.buffer);
            });
            const newWorkFile = new WorkFile({
                title: workFileTitle,
                description: workFileDescription,
                fileUrl: uploadedFileUrl,
                subject: workFileSubject,
                intendedClass: workFileIntendedClass,
                costBytes: workFileCostBytes,
                uploadedBy: {
                    teacherId: teacherId,
                    teacherName: teacherName
                },
                applyDownloadWatermark: applyDownloadWatermark
            });
            await newWorkFile.save({ session });
            const newActivity = new Activity({
                title: activityTitle,
                description: activityDescription || '',
                subject: activitySubject,
                intendedClass: activityIntendedClass,
                maxBytesReward: 5,
                associatedWorkFile: newWorkFile._id,
                questions: questions,
                uploadedBy: {
                    teacherId: teacherId,
                    teacherName: teacherName
                }
            });
            await newActivity.save({ session });

            newWorkFile.activity = newActivity._id;
            await newWorkFile.save({ session });

            await session.commitTransaction();

            res.status(201).json({
                message: 'WorkFile and Activity uploaded successfully!',
                workFile: {
                    id: newWorkFile._id,
                    title: newWorkFile.title,
                    fileUrl: newWorkFile.fileUrl,
                    subject: newWorkFile.subject,
                    intendedClass: newWorkFile.intendedClass,
                    costBytes: newWorkFile.costBytes,
                    applyDownloadWatermark: newWorkFile.applyDownloadWatermark
                },
                activity: {
                    id: newActivity._id,
                    title: newActivity.title,
                    subject: newActivity.subject,
                    intendedClass: newActivity.intendedClass,
                    maxBytesReward: newActivity.maxBytesReward,
                    questionsCount: newActivity.questions.length
                }
            });
        } catch (error) {
            await session.abortTransaction();
            console.error('Error during WorkFile/Activity upload transaction:', error);
            if (uploadedFileUrl && workFilePublicId) {
                try {
                    await cloudinary.uploader.destroy(workFilePublicId, { resource_type: 'raw' });
                    console.log(`Successfully deleted orphaned Cloudinary file: ${workFilePublicId}`);
                } catch (cloudinaryError) {
                    console.error(`Failed to delete orphaned Cloudinary file ${workFilePublicId}:`, cloudinaryError);
                }
            }

            res.status(500).json({
                message: 'Failed to upload WorkFile and Activity. Please try again.',
                error: error.message
            });
        } finally {
            session.endSession();
        }
    }
);

// Teacher login and dashboard endpoints (existing)
app.post('/login-teacher', [
    body('teacherName').notEmpty().withMessage('Teacher name is required.'),
    body('email').notEmpty().withMessage('Email is required.'),
    body('password').notEmpty().withMessage('Password is required.')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }


    let { teacherName, email, password } = req.body;


    try {
        // Check if this is an admin login attempt
        const adminPrefix = 'admin: ';
        let isAdminLogin = false;


        if (email.toLowerCase().startsWith(adminPrefix.toLowerCase())) {
            isAdminLogin = true;
            // Remove the admin prefix to get the actual email
            email = email.substring(adminPrefix.length).trim();


            // Validate admin credentials
            if (teacherName.toLowerCase() !== 'administrator') {
                return res.status(401).json({ message: 'Invalid admin credentials.' });
            }
        }


        if (isAdminLogin) {
            // Handle admin login with 2FA
            const admin = await Administrator.findOne({ email });


            if (!admin) {
                return res.status(401).json({ message: 'Invalid admin credentials.' });
            }


            const isMatch = await bcrypt.compare(password, admin.password);


            if (!isMatch) {
                return res.status(401).json({ message: 'Invalid admin credentials.' });
            }


            // Generate and send 2FA code
            const code = Math.floor(100000 + Math.random() * 900000).toString();


            await VerificationCode.findOneAndUpdate(
                { email },
                { code, createdAt: Date.now() },
                { upsert: true, new: true, setDefaultsOnInsert: true }
            );


            const mailOptions = {
                from: process.env.EMAIL_USER,
                to: email,
                subject: 'SchoolByte Admin 2FA Code',
                html: `<p>Your SchoolByte Administrator 2FA code is: <strong>${code}</strong></p><p>This code is valid for 10 minutes.</p>`
            };


            await transporter.sendMail(mailOptions);


            res.status(200).json({
                message: 'Admin 2FA code sent to your email.',
                requiresTwoFA: true,
                adminEmail: email
            });


        } else {
            // Handle regular teacher login
            const teacher = await Teacher.findOne({ email });


            if (!teacher) {
                return res.status(401).json({ message: 'Invalid teacher credentials.' });
            }


            const isMatch = await bcrypt.compare(password, teacher.password);


            if (!isMatch) {
                return res.status(401).json({ message: 'Invalid teacher credentials.' });
            }


            // Check and reset weekly counters
            await checkAndResetTeacherWeeklyCounters(teacher);


            const token = jwt.sign(
                { id: teacher._id, email: teacher.email, teacherName: teacher.teacherName, role: 'teacher' },
                JWT_SECRET,
                { expiresIn: '24h' }
            );


            res.status(200).json({
                message: 'Teacher login successful!',
                token: token,
                teacher: {
                    teacherName: teacher.teacherName,
                    email: teacher.email,
                    bytes: teacher.bytes,
                    isPasswordSet: teacher.isPasswordSet
                }
            });
        }


    } catch (error) {
        console.error('Error during login:', error);
        res.status(500).json({ message: 'Server error during login.', error: error.message });
    }
});


app.get('/teacher/dashboard', authenticateTeacherToken, async (req, res) => {
    try {
        const teacherData = await Teacher.findById(req.teacher.id).select('-password');


        if (!teacherData) {
            return res.status(404).json({ message: 'Teacher data not found.' });
        }


        // Check and reset weekly counters
        await checkAndResetTeacherWeeklyCounters(teacherData);


        res.status(200).json({
            message: `Welcome to your teacher dashboard, ${teacherData.teacherName}!`,
            teacher: {
                teacherName: teacherData.teacherName,
                email: teacherData.email,
                bytes: teacherData.bytes,
                preferences: teacherData.preferences,
                createdAt: teacherData.createdAt,
                isPasswordSet: teacherData.isPasswordSet,
                gender: teacherData.gender,
                physicalDescription: teacherData.physicalDescription,
                quizzesUploadedThisWeek: teacherData.quizzesUploadedThisWeek
            }
        });


    } catch (error) {
        console.error('Error accessing teacher dashboard:', error);
        res.status(500).json({ message: 'Server error accessing teacher dashboard.', error: error.message });
    }
});


// Admin signup endpoint
app.post('/signup-admin', [
    body('adminName').notEmpty().trim().withMessage('Admin name is required.'),
    body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email address.'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long.')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ 
                message: 'Validation failed',
                errors: errors.array() 
            });
        }


        const { adminName, email, password } = req.body;


        // Check if admin already exists
        const existingAdmin = await Administrator.findOne({ email: email.toLowerCase() });
        if (existingAdmin) {
            return res.status(409).json({ message: 'An administrator with this email already exists.' });
        }


        // Hash password
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);


        // Create new admin
        const newAdmin = new Administrator({
            adminName: adminName.trim(),
            email: email.toLowerCase(),
            password: hashedPassword
        });


        await newAdmin.save();


        res.status(201).json({ 
            message: 'Administrator account created successfully.',
            admin: {
                id: newAdmin._id,
                adminName: newAdmin.adminName,
                email: newAdmin.email
            }
        });


    } catch (error) {
        console.error('Error during admin signup:', error);
        res.status(500).json({ 
            message: 'Server error during admin account creation.',
            error: error.message 
        });
    }
});


// Admin authentication and management endpoints (existing)
app.post('/login-admin', [
    body('email').notEmpty().withMessage('Email is required.'),
    body('password').notEmpty().withMessage('Password is required.')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }


        let { email, password } = req.body;


        // Check for the admin prefix and remove it
        const adminPrefix = 'admin: ';
        if (email.toLowerCase().startsWith(adminPrefix.toLowerCase())) {
            email = email.substring(adminPrefix.length).trim();
        }


        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ message: 'Please provide a valid email address.' });
        }


        const admin = await Administrator.findOne({ email: email.toLowerCase() });


        if (!admin) {
            return res.status(401).json({ message: 'Invalid email or password.' });
        }


        const isMatch = await bcrypt.compare(password, admin.password);


        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid email or password.' });
        }


        // Generate 2FA code
        const code = Math.floor(100000 + Math.random() * 900000).toString();


        await VerificationCode.findOneAndUpdate(
            { email: email.toLowerCase() },
            { code, createdAt: Date.now() },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );


        // Send email if configured
        if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
            const mailOptions = {
                from: process.env.EMAIL_USER,
                to: email,
                subject: 'SchoolByte Admin 2FA Code',
                html: `<p>Your SchoolByte Administrator 2FA code is: <strong>${code}</strong></p><p>This code is valid for 10 minutes.</p>`
            };


            await transporter.sendMail(mailOptions);
        }


        res.status(200).json({
            message: 'Admin login successful. A 2FA code has been sent to your email.',
            requiresTwoFA: true
        });


    } catch (error) {
        console.error('Error during admin login:', error);
        res.status(500).json({ message: 'Server error during admin login.', error: error.message });
    }
});


app.post('/admin/verify-2fa', [
    body('email').isEmail().withMessage('Please provide a valid email address.'),
    body('code').notEmpty().withMessage('2FA code is required.')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }


    const { email, code } = req.body;


    try {
        const storedCode = await VerificationCode.findOne({ email });


        if (!storedCode) {
            return res.status(400).json({ message: 'No 2FA code found for this email, or it has expired.' });
        }


        if (storedCode.code === code) {
            const admin = await Administrator.findOne({ email });
            if (!admin) {
                return res.status(404).json({ message: 'Administrator not found.' });
            }


            await VerificationCode.deleteOne({ email });


            const token = jwt.sign(
                { id: admin._id, email: admin.email, adminName: admin.adminName, role: 'admin' },
                JWT_SECRET,
                { expiresIn: '24h' }
            );


            res.status(200).json({
                message: 'Admin 2FA successful! You are now logged in.',
                token: token,
                admin: {
                    adminName: admin.adminName,
                    email: admin.email
                }
            });
        } else {
            return res.status(400).json({ message: 'Invalid 2FA code.' });
        }
    } catch (error) {
        console.error('Error during admin 2FA verification:', error);
        res.status(500).json({ message: 'Server error during 2FA verification.', error: error.message });
    }
});


app.post('/admin/create-admin', authenticateAdminToken, [
    body('adminName').notEmpty().trim().withMessage('Admin name is required.'),
    body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email address.'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long.')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ 
                message: 'Validation failed',
                errors: errors.array() 
            });
        }


        const { adminName, email, password } = req.body;


        // Check if admin already exists
        const existingAdmin = await Administrator.findOne({ email: email.toLowerCase() });
        if (existingAdmin) {
            return res.status(409).json({ message: 'An administrator with this email already exists.' });
        }


        // Hash password
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);


        // Create new admin
        const newAdmin = new Administrator({
            adminName: adminName.trim(),
            email: email.toLowerCase(),
            password: hashedPassword
        });


        await newAdmin.save();


        res.status(201).json({ 
            message: 'Administrator account created successfully.',
            admin: {
                id: newAdmin._id,
                name: newAdmin.adminName,
                email: newAdmin.email
            }
        });


    } catch (error) {
        console.error('Error during admin creation:', error);
        res.status(500).json({ 
            message: 'Server error during admin account creation.',
            error: error.message 
        });
    }
});


app.post('/admin/teachers', authenticateAdminToken, [
    body('teacherName').notEmpty().withMessage('Teacher name is required.'),
    body('teacherEmail').isEmail().withMessage('Please provide a valid email address.'),
    body('teacherPassword').isLength({ min: 6 }).withMessage('Initial password must be at least 6 characters long.'),
    body('teacherGender').optional().isIn(['male', 'female', 'other']).withMessage('Gender must be male, female, or other.'),
    body('teacherPhysicalDescription').optional().isString().withMessage('Physical description must be a string.')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }


    const { teacherName, teacherEmail, teacherPassword, teacherGender, teacherPhysicalDescription } = req.body;


    try {
        const existingTeacher = await Teacher.findOne({ email: teacherEmail });
        if (existingTeacher) {
            return res.status(409).json({ message: 'A teacher with this email already exists.' });
        }


        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(teacherPassword, saltRounds);


        const newTeacher = new Teacher({
            teacherName,
            email: teacherEmail,
            password: hashedPassword,
            bytes: 0,
            isPasswordSet: false,
            gender: teacherGender === 'male' ? 'Male' : teacherGender === 'female' ? 'Female' : 'Other',
            physicalDescription: teacherPhysicalDescription
        });


        await newTeacher.save();


        res.status(201).json({
            message: 'Teacher account created successfully by administrator! Teacher needs to set their password on first login.',
            teacher: {
                id: newTeacher._id,
                name: newTeacher.teacherName,
                email: newTeacher.email,
                isPasswordSet: newTeacher.isPasswordSet,
                gender: newTeacher.gender,
                physicalDescription: newTeacher.physicalDescription
            }
        });


    } catch (error) {
        console.error('Error creating teacher account by admin:', error);
        res.status(500).json({ message: 'Server error creating teacher account.', error: error.message });
    }
});


app.get('/admin/teachers', authenticateAdminToken, async (req, res) => {
    try {
        const teachers = await Teacher.find({}).select('-password');
        res.status(200).json(teachers);
    } catch (error) {
        console.error('Error fetching teachers by admin:', error);
        res.status(500).json({ message: 'Server error fetching teachers.', error: error.message });
    }
});


// Admin dashboard stats endpoint
app.get('/admin/dashboard', authenticateAdminToken, async (req, res) => {
    try {
        const adminData = await Administrator.findById(req.admin.id).select('-password');


        if (!adminData) {
            return res.status(404).json({ message: 'Administrator data not found.' });
        }


        res.status(200).json({
            message: `Welcome to your admin dashboard, ${adminData.adminName}!`,
            admin: {
                adminName: adminData.adminName,
                email: adminData.email,
                createdAt: adminData.createdAt
            }
        });
    } catch (error) {
        console.error('Error accessing admin dashboard:', error);
        res.status(500).json({ message: 'Server error accessing admin dashboard.', error: error.message });
    }
});


app.get('/admin/dashboard-stats', authenticateAdminToken, async (req, res) => {
    try {
        const totalStudents = await Student.countDocuments();
        const totalTeachers = await Teacher.countDocuments();
        const totalQuizQuestions = await QuizQuestion.countDocuments();
        const totalWorkFiles = await WorkFile.countDocuments();
        const totalPreaderGames = await PreaderGameSessionLog.countDocuments();


        res.status(200).json({
            message: 'Dashboard stats fetched successfully.',
            stats: {
                totalStudents,
                totalTeachers,
                totalQuizQuestions,
                totalWorkFiles,
                totalPreaderGames
            }
        });
    } catch (error) {
        console.error('Error fetching dashboard stats:', error);
        res.status(500).json({ message: 'Failed to fetch dashboard statistics.', error: error.message });
    }
});


app.delete('/admin/teachers/:id', authenticateAdminToken, async (req, res) => {
    const teacherIdToDelete = req.params.id;


    try {
        const teacher = await Teacher.findById(teacherIdToDelete);
        if (!teacher) {
            return res.status(404).json({ message: 'Teacher not found.' });
        }


        await WorkFile.updateMany(
            { 'uploadedBy.teacherId': teacherIdToDelete },
            { $set: { 'uploadedBy.teacherId': null } }
        );
        await Activity.updateMany(
            { 'uploadedBy.teacherId': teacherIdToDelete },
            { $set: { 'uploadedBy.teacherId': null } }
        );
        await QuizQuestion.updateMany(
            { 'uploadedBy.teacherId': teacherIdToDelete },
            { $set: { 'uploadedBy.teacherId': null } }
        );


        await Teacher.deleteOne({ _id: teacherIdToDelete });


        res.status(200).json({
            message: `Teacher ${teacher.teacherName} and their associated content references updated/deleted successfully. Content remains attributed by name.`
        });


    } catch (error) {
        console.error('Error deleting teacher account by admin:', error);
        res.status(500).json({ message: 'Server error deleting teacher account.', error: error.message });
    }
});


app.post('/admin/trigger-yearly-upgrade', authenticateAdminToken, async (req, res) => {
    try {
        const students = await Student.find({});


        let upgradedCount = 0;
        let deletedCount = 0;


        for (const student of students) {
            const currentClass = student.class.toUpperCase();


            if (currentClass === 'S.6' || currentClass === 'SENIOR 6') {
                await Student.deleteOne({ _id: student._id });
                deletedCount++;
                console.log(`Deleted S.6 student: ${student.studentName} (Email: ${student.email})`);
            } else {
                let newClass;
                const classNumber = parseInt(currentClass.replace('S.', '').replace('SENIOR ', ''));


                if (!isNaN(classNumber) && classNumber >= 1 && classNumber <= 5) {
                    newClass = `S.${classNumber + 1}`;
                    await Student.updateOne({ _id: student._id }, { class: newClass });
                    upgradedCount++;
                    console.log(`Upgraded student ${student.studentName} from ${currentClass} to ${newClass}`);
                } else {
                    console.warn(`Skipping student ${student.studentName} with unrecognized class format: ${student.class}`);
                }
            }
        }


        res.status(200).json({
            message: 'Yearly student upgrade and deletion process completed.',
            upgradedStudents: upgradedCount,
            deletedStudents: deletedCount
        });


    } catch (error) {
        console.error('Error during yearly student upgrade/deletion:', error);
        res.status(500).json({ message: 'Server error during yearly upgrade process.', error: error.message });
    }
});


// Leaderboard endpoints (existing)
app.get('/leaderboard', async (req, res) => {
    try {
        const students = await Student.find({})
            .sort({ bytes: -1 })
            .select('studentName firstNameDisplay bytes')
            .lean();


        const leaderboard = students.map((student, index) => {
            const displayName = student.firstNameDisplay || student.studentName.split(' ')[0];
            const bytesStatus = index < 200 ? student.bytes : undefined;


            return {
                name: displayName,
                bytes: bytesStatus
            };
        });


        res.status(200).json({
            message: 'Leaderboard fetched successfully!',
            leaderboard: leaderboard
        });


    } catch (error) {
        console.error('Error fetching leaderboard:', error);
        res.status(500).json({ message: 'Server error fetching leaderboard.', error: error.message });
    }
});


app.get('/teacher/leaderboard', async (req, res) => {
    try {
        const teachers = await Teacher.find({})
            .sort({ bytes: -1 })
            .select('teacherName bytes')
            .lean();


        const teacherLeaderboard = teachers.map(teacher => ({
            name: teacher.teacherName,
            bytes: teacher.bytes
        }));


        res.status(200).json({
            message: 'Teacher Leaderboard fetched successfully!',
            leaderboard: teacherLeaderboard
        });


    } catch (error) {
        console.error('Error fetching teacher leaderboard:', error);
        res.status(500).json({ message: 'Server error fetching teacher leaderboard.', error: error.message });
    }
});


// Preader Game Endpoints (Student-Facing)
app.post('/student/preader-games/start', authenticateToken, [
    body('gameTitle').notEmpty().withMessage('Game title is required.').trim().isLength({ min: 3, max: 200 }),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }


    const { gameTitle } = req.body;
    const studentId = req.student.id;


    const session = await mongoose.startSession();
    session.startTransaction();


    try {
        const student = await Student.findById(studentId).session(session);
        if (!student) {
            await session.abortTransaction();
            return res.status(404).json({ message: 'Student not found.' });
        }
        const studentClass = student.class;


        const initialGameState = {
            playerStats: {
                life: 20, mana: 20, morale: 20, reputation: 0,
                discipline: 50, knowledge: 0, stress: 0, luck: 10
            },
            currentEthicalScore: 0,
            pathTaken: []
        };


        const initialPromptContent = `Start an interactive story based on the title: "${gameTitle}".`;
        const aiGeneratedContent = await generateStoryNode(
            initialPromptContent,
            initialGameState,
            studentClass,
            null, 
            null
        );


        const newSession = new PreaderGameSession({
            student: studentId,
            initialTitle: gameTitle,
            startTime: Date.now(),
            playerStats: initialGameState.playerStats,
            currentEthicalScore: initialGameState.currentEthicalScore,
            currentSceneContent: aiGeneratedContent.sceneDescription,
            currentChoices: aiGeneratedContent.choices,
            pathTaken: [{
                sceneContent: aiGeneratedContent.sceneDescription,
                choiceTextMade: null,
                bytesEarnedThisTurn: 0,
                playerStatsSnapshot: initialGameState.playerStats,
                ethicalScoreSnapshot: initialGameState.currentEthicalScore,
                timestamp: Date.now()
            }]
        });
        await newSession.save({ session });


        await session.commitTransaction();


        res.status(201).json({
            message: 'Preader Game session started!',
            sessionId: newSession._id,
            scene: newSession.currentSceneContent,
            choices: newSession.currentChoices,
            playerStats: newSession.playerStats,
            currentEthicalScore: newSession.currentEthicalScore
        });


    } catch (error) {
        await session.abortTransaction();
        console.error('Error starting Preader Game session:', error);
        res.status(500).json({ message: 'Failed to start Preader Game session. Please try again.', error: error.message });
    } finally {
        session.endSession();
    }
});


app.post('/student/preader-games/:sessionId/make-choice', authenticateToken, [
    body('choiceIndex').isInt({ min: 0 }).withMessage('Choice index must be a non-negative integer.'),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }


    const { sessionId } = req.params;
    const { choiceIndex } = req.body;
    const studentId = req.student.id;


    const session = await mongoose.startSession();
    session.startTransaction();


    try {
        const gameSession = await PreaderGameSession.findOne({ _id: sessionId, student: studentId }).session(session);
        if (!gameSession) {
            await session.abortTransaction();
            return res.status(404).json({ message: 'Preader Game session not found or does not belong to you.' });
        }


        const student = await Student.findById(studentId).session(session);
        if (!student) {
            await session.abortTransaction();
            return res.status(404).json({ message: 'Student not found.' });
        }
        const studentClass = student.class;


        if (choiceIndex < 0 || choiceIndex >= gameSession.currentChoices.length) {
            await session.abortTransaction();
            return res.status(400).json({ message: 'Invalid choice index.' });
        }


        const chosenOption = gameSession.currentChoices[choiceIndex];


        const newPlayerStats = applyStatChanges(gameSession.playerStats, chosenOption.statChanges);
        const newEthicalScore = gameSession.currentEthicalScore + chosenOption.ethicalImpact.scoreChange;
        const bytesEarnedThisTurn = chosenOption.bytesAwarded || 1;


        gameSession.playerStats = newPlayerStats;
        gameSession.currentEthicalScore = newEthicalScore;
        gameSession.totalBytesEarnedInSession += bytesEarnedThisTurn;


        gameSession.pathTaken.push({
            sceneContent: gameSession.currentSceneContent,
            choiceTextMade: chosenOption.choiceText,
            bytesEarnedThisTurn: bytesEarnedThisTurn,
            playerStatsSnapshot: newPlayerStats,
            ethicalScoreSnapshot: newEthicalScore,
            timestamp: Date.now()
        });


        const nextScenePromptContent = `The player chose "${chosenOption.choiceText}". Continue the story from the previous scene: "${gameSession.currentSceneContent}".`;
        const aiGeneratedContent = await generateStoryNode(
            nextScenePromptContent,
            { playerStats: newPlayerStats, currentEthicalScore: newEthicalScore, pathTaken: gameSession.pathTaken },
            studentClass,
            gameSession.currentSceneContent,
            chosenOption.choiceText
        );


        gameSession.currentSceneContent = aiGeneratedContent.sceneDescription;
        gameSession.currentChoices = aiGeneratedContent.choices;


        await gameSession.save({ session });
        await session.commitTransaction();


        res.status(200).json({
            message: 'Choice made and story advanced!',
            scene: gameSession.currentSceneContent,
            choices: gameSession.currentChoices,
            playerStats: gameSession.playerStats,
            currentEthicalScore: gameSession.currentEthicalScore,
            bytesEarnedThisTurn: bytesEarnedThisTurn,
            totalBytesEarnedInSession: gameSession.totalBytesEarnedInSession
        });


    } catch (error) {
        await session.abortTransaction();
        console.error('Error making choice in Preader Game session:', error);
        res.status(500).json({ message: 'Failed to make choice. Please try again.', error: error.message });
    } finally {
        session.endSession();
    }
});


app.post('/student/preader-games/:sessionId/end', authenticateToken, async (req, res) => {
    const { sessionId } = req.params;
    const studentId = req.student.id;


    const session = await mongoose.startSession();
    session.startTransaction();


    try {
        const gameSession = await PreaderGameSession.findOne({ _id: sessionId, student: studentId }).session(session);
        if (!gameSession) {
            await session.abortTransaction();
            return res.status(404).json({ message: 'Preader Game session not found or does not belong to you.' });
        }


        const student = await Student.findById(studentId).session(session);
        if (!student) {
            await session.abortTransaction();
            return res.status(404).json({ message: 'Student not found.' });
        }


        const endTime = Date.now();
        const durationMinutes = Math.round((endTime - gameSession.startTime.getTime()) / (1000 * 60));
        const totalBytesEarned = gameSession.totalBytesEarnedInSession;


        student.bytes += totalBytesEarned;
        student.totalPreaderGameTimeMinutes += durationMinutes;
        await student.save({ session });


        const sessionLog = new PreaderGameSessionLog({
            student: studentId,
            initialTitle: gameSession.initialTitle,
            startTime: gameSession.startTime,
            endTime: new Date(endTime),
            durationMinutes: durationMinutes,
            bytesEarned: totalBytesEarned,
            finalEthicalScore: gameSession.currentEthicalScore
        });
        await sessionLog.save({ session });


        await PreaderGameSession.deleteOne({ _id: sessionId }).session(session);


        await session.commitTransaction();


        res.status(200).json({
            message: 'Preader Game session ended successfully!',
            totalBytesEarned: totalBytesEarned,
            sessionDurationMinutes: durationMinutes,
            finalEthicalScore: gameSession.currentEthicalScore,
            studentCurrentBytes: student.bytes,
            studentTotalPreaderGameTime: student.totalPreaderGameTimeMinutes
        });


    } catch (error) {
        await session.abortTransaction();
        console.error('Error ending Preader Game session:', error);
        res.status(500).json({ message: 'Failed to end Preader Game session. Please try again.', error: error.message });
    } finally {
        session.endSession();
    }
});


app.get('/student/preader-games/history', authenticateToken, async (req, res) => {
    try {
        const studentId = req.student.id;
        const history = await PreaderGameSessionLog.find({ student: studentId })
                                                    .sort({ createdAt: -1 })
                                                    .select('-student -_id -__v');


        res.status(200).json({
            message: 'Preader Game session history fetched successfully!',
            history: history
        });
    } catch (error) {
        console.error('Error fetching Preader Game history:', error);
        res.status(500).json({ message: 'Failed to fetch Preader Game history.', error: error.message });
    }
});


// Route for the teacher's initial password setup page
app.get('/teacher-set-password.html', (req, res) => {
    // Assuming HTML files are in a 'public' folder
    res.sendFile(path.join(__dirname, 'public', 'teacher-set-password.html'));
});


// Teacher initial password setting endpoint
app.put('/teacher/set-initial-password', authenticateTeacherToken, [
    body('newPassword').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long.')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }


    const { newPassword } = req.body;
    const teacherId = req.teacher.id;


    try {
        const teacher = await Teacher.findById(teacherId);
        if (!teacher) {
            return res.status(404).json({ message: 'Teacher not found.' });
        }


        // Check if password is already set
        if (teacher.isPasswordSet) {
            return res.status(400).json({ message: 'Password has already been set. Use the profile settings to change it.' });
        }


        // Hash the new password
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(newPassword, saltRounds);


        // Update teacher password and set flag
        teacher.password = hashedPassword;
        teacher.isPasswordSet = true;
        await teacher.save();


        res.status(200).json({
            message: 'Password set successfully!',
            teacher: {
                teacherName: teacher.teacherName,
                email: teacher.email,
                isPasswordSet: teacher.isPasswordSet
            }
        });


    } catch (error) {
        console.error('Error setting initial password:', error);
        res.status(500).json({ message: 'Failed to set password. Please try again.', error: error.message });
    }
});


app.get('/teacher/profile', authenticateTeacherToken, async (req, res) => {
    try {
        const teacherData = await Teacher.findById(req.teacher.id).select('-password');


        if (!teacherData) {
            return res.status(404).json({ message: 'Teacher not found.' });
        }


        res.status(200).json({
            message: 'Teacher profile fetched successfully.',
            teacher: {
                teacherName: teacherData.teacherName,
                email: teacherData.email,
                isPasswordSet: teacherData.isPasswordSet,
                bytes: teacherData.bytes,
                gender: teacherData.gender,
                physicalDescription: teacherData.physicalDescription,
                createdAt: teacherData.createdAt
            }
        });
    } catch (error) {
        console.error('Error fetching teacher profile:', error);
        res.status(500).json({ message: 'Server error fetching profile.', error: error.message });
    }
});


// ==================== ACHIEVEMENT AND XP SYSTEM API ENDPOINTS ====================

// Initialize Player Levels and Achievements (One-time seed - Admin only)
app.post('/api/admin/initialize-achievements', async (req, res) => {
    try {
        // Initialize Player Levels
        const playerLevels = [
            { tier: 1, name: 'New User', totalXPRequired: 20, levelUpByteReward: 20 },
            { tier: 2, name: 'Novice', totalXPRequired: 100, levelUpByteReward: 50 },
            { tier: 3, name: 'Apprentice', totalXPRequired: 250, levelUpByteReward: 100 },
            { tier: 4, name: 'Adept', totalXPRequired: 500, levelUpByteReward: 150 },
            { tier: 5, name: 'Specialist', totalXPRequired: 800, levelUpByteReward: 200 },
            { tier: 6, name: 'Expert', totalXPRequired: 1200, levelUpByteReward: 250 },
            { tier: 7, name: 'Master', totalXPRequired: 1700, levelUpByteReward: 300 },
            { tier: 8, name: 'Grandmaster', totalXPRequired: 2300, levelUpByteReward: 400 },
            { tier: 9, name: 'Virtuoso', totalXPRequired: 3000, levelUpByteReward: 500 },
            { tier: 10, name: 'Legend', totalXPRequired: 4000, levelUpByteReward: 1000 }
        ];

        for (const level of playerLevels) {
            await PlayerLevel.findOneAndUpdate(
                { tier: level.tier },
                level,
                { upsert: true, new: true }
            );
        }

        // Initialize GeoQuiz Achievements
        const geoQuizAchievements = [
            { achievementId: 'geo_first_steps', name: 'First Steps', description: 'Correctly identify your first country.', tier: 'Bronze', category: 'GeoQuiz', byteReward: 10, xpReward: 10, icon: 'fa-flag' },
            { achievementId: 'geo_alias_user', name: 'Alias User', description: 'Answer correctly using a country\'s alias (e.g., "DRC" or "Cote d\'Ivoire").', tier: 'Bronze', category: 'GeoQuiz', byteReward: 15, xpReward: 15, icon: 'fa-tag' },
            { achievementId: 'geo_the_speller', name: 'The Speller', description: 'Get 5 answers in a row with a perfect nearness score (spelled 100% correctly).', tier: 'Silver', category: 'GeoQuiz', byteReward: 35, xpReward: 35, icon: 'fa-spell-check' },
            { achievementId: 'geo_high_scorer', name: 'High Scorer', description: 'Achieve a final score of 150 or more on a single continent.', tier: 'Silver', category: 'GeoQuiz', byteReward: 50, xpReward: 50, icon: 'fa-star' },
            { achievementId: 'geo_african_explorer', name: 'African Explorer', description: 'Successfully identify all countries in the Africa quiz.', tier: 'Silver', category: 'GeoQuiz', byteReward: 50, xpReward: 50, icon: 'fa-globe-africa' },
            { achievementId: 'geo_south_american_voyager', name: 'S. American Voyager', description: 'Successfully identify all countries in the South America quiz.', tier: 'Silver', category: 'GeoQuiz', byteReward: 40, xpReward: 40, icon: 'fa-globe-americas' },
            { achievementId: 'geo_geography_adept', name: 'Geography Adept', description: 'Correctly identify 100 countries total (across all games played).', tier: 'Gold', category: 'GeoQuiz', byteReward: 75, xpReward: 75, icon: 'fa-globe' },
            { achievementId: 'geo_human_gps', name: 'Human GPS', description: 'Finish a continent with a final accuracy of 90% or higher.', tier: 'Gold', category: 'GeoQuiz', byteReward: 100, xpReward: 100, icon: 'fa-location-dot' },
            { achievementId: 'geo_world_class', name: 'World-Class', description: 'Complete both the Africa and South America quizzes at least once.', tier: 'Gold', category: 'GeoQuiz', byteReward: 100, xpReward: 100, icon: 'fa-earth-americas' },
            { achievementId: 'geo_flawless_cartographer', name: 'Flawless Cartographer', description: 'Finish a continent with 100% accuracy (no incorrect guesses).', tier: 'Platinum', category: 'GeoQuiz', byteReward: 200, xpReward: 200, icon: 'fa-map' },
            { achievementId: 'geo_globe_trotter', name: 'Globe Trotter', description: 'Correctly identify 500 countries total (across all games played).', tier: 'Diamond', category: 'GeoQuiz', byteReward: 300, xpReward: 300, icon: 'fa-plane' }
        ];

        // Initialize Byte-Sudoku Achievements
        const sudokuAchievements = [
            { achievementId: 'sudoku_first_digit', name: 'First Digit', description: 'Place your first correct number.', tier: 'Bronze', category: 'ByteSudoku', byteReward: 10, xpReward: 10, icon: 'fa-1' },
            { achievementId: 'sudoku_just_a_nudge', name: 'Just a Nudge', description: 'Use one of your free hints.', tier: 'Bronze', category: 'ByteSudoku', byteReward: 10, xpReward: 10, icon: 'fa-lightbulb' },
            { achievementId: 'sudoku_novice', name: 'Sudoku Novice', description: 'Complete an \'Easy\' puzzle.', tier: 'Bronze', category: 'ByteSudoku', byteReward: 20, xpReward: 20, icon: 'fa-check' },
            { achievementId: 'sudoku_on_a_roll', name: 'On a Roll!', description: 'Get 5 consecutive correct answers and earn a bonus chance.', tier: 'Bronze', category: 'ByteSudoku', byteReward: 20, xpReward: 20, icon: 'fa-fire' },
            { achievementId: 'sudoku_cost_of_knowledge', name: 'Cost of Knowledge', description: 'Pay for a hint using your earned bytes (after free hints are gone).', tier: 'Silver', category: 'ByteSudoku', byteReward: 25, xpReward: 25, icon: 'fa-coins' },
            { achievementId: 'sudoku_close_shave', name: 'Close Shave', description: 'Successfully complete a puzzle with 0 chances remaining.', tier: 'Silver', category: 'ByteSudoku', byteReward: 40, xpReward: 40, icon: 'fa-heart-crack' },
            { achievementId: 'sudoku_adept', name: 'Sudoku Adept', description: 'Complete a \'Hard\' puzzle.', tier: 'Silver', category: 'ByteSudoku', byteReward: 50, xpReward: 50, icon: 'fa-chart-simple' },
            { achievementId: 'sudoku_self_sufficient', name: 'Self-Sufficient', description: 'Complete a \'Hard\' or harder puzzle without using any hints.', tier: 'Gold', category: 'ByteSudoku', byteReward: 100, xpReward: 100, icon: 'fa-user-ninja' },
            { achievementId: 'sudoku_valedictorian', name: 'Valedictorian', description: 'Get a final grade of 100% on any puzzle.', tier: 'Gold', category: 'ByteSudoku', byteReward: 120, xpReward: 120, icon: 'fa-graduation-cap' },
            { achievementId: 'sudoku_grandmaster', name: 'Sudoku Grandmaster', description: 'Complete a \'Brutal\' puzzle.', tier: 'Gold', category: 'ByteSudoku', byteReward: 150, xpReward: 150, icon: 'fa-crown' },
            { achievementId: 'sudoku_perfect_game', name: 'Perfect Game', description: 'Complete any puzzle and earn the "Perfect Game Bonus" (no mistakes, no hints).', tier: 'Platinum', category: 'ByteSudoku', byteReward: 250, xpReward: 250, icon: 'fa-gem' },
            { achievementId: 'sudoku_full_grid', name: 'Full Grid', description: 'Complete one puzzle of each difficulty level (Easy, Medium, Hard, Impossible, Insane, Brutal).', tier: 'Diamond', category: 'ByteSudoku', byteReward: 500, xpReward: 500, icon: 'fa-trophy' }
        ];

        const allAchievements = [...geoQuizAchievements, ...sudokuAchievements];
        
        for (const achievement of allAchievements) {
            await Achievement.findOneAndUpdate(
                { achievementId: achievement.achievementId },
                achievement,
                { upsert: true, new: true }
            );
        }

        res.status(200).json({ 
            message: 'Player levels and achievements initialized successfully!',
            playerLevelsCount: playerLevels.length,
            achievementsCount: allAchievements.length
        });

    } catch (error) {
        console.error('Error initializing achievements:', error);
        res.status(500).json({ message: 'Failed to initialize achievements', error: error.message });
    }
});

// Get Student Achievements and Progress
app.get('/api/student/achievements', authenticateToken, async (req, res) => {
    try {
        const studentId = req.student.id;
        
        const student = await Student.findById(studentId);
        if (!student) {
            return res.status(404).json({ message: 'Student not found.' });
        }

        // Get all achievements
        const allAchievements = await Achievement.find({}).sort({ tier: 1, xpReward: 1 });
        
        // Get student's progress on achievements
        const studentAchievements = await StudentAchievement.find({ student: studentId })
            .populate('achievement');

        // Get current tier info
        const currentTierInfo = await PlayerLevel.findOne({ tier: student.currentTier });
        const nextTierInfo = await PlayerLevel.findOne({ tier: student.currentTier + 1 });

        // Map achievements with student's progress
        const achievementsWithProgress = allAchievements.map(achievement => {
            const progress = studentAchievements.find(sa => sa.achievementId === achievement.achievementId);
            return {
                ...achievement.toObject(),
                unlocked: progress?.unlocked || false,
                unlockedAt: progress?.unlockedAt || null,
                progress: progress?.progress || 0,
                target: progress?.target || 1
            };
        });

        res.status(200).json({
            student: {
                xp: student.xp,
                currentTier: student.currentTier,
                bytes: student.bytes
            },
            currentTierInfo,
            nextTierInfo,
            achievements: achievementsWithProgress,
            stats: {
                totalCountriesIdentified: student.totalCountriesIdentified,
                totalSudokuPuzzlesCompleted: student.totalSudokuPuzzlesCompleted,
                geoQuizStats: student.geoQuizStats,
                sudokuStats: student.sudokuStats
            }
        });

    } catch (error) {
        console.error('Error fetching student achievements:', error);
        res.status(500).json({ message: 'Failed to fetch achievements', error: error.message });
    }
});

// Convert XP to Bytes
app.post('/api/student/convert-xp-to-bytes', authenticateToken, async (req, res) => {
    try {
        const studentId = req.student.id;
        const { xpAmount } = req.body;

        if (!xpAmount || xpAmount <= 0) {
            return res.status(400).json({ message: 'Invalid XP amount. Must be greater than 0.' });
        }

        const student = await Student.findById(studentId);
        if (!student) {
            return res.status(404).json({ message: 'Student not found.' });
        }

        if (student.xp < xpAmount) {
            return res.status(400).json({ 
                message: 'Insufficient XP.',
                availableXP: student.xp,
                requestedXP: xpAmount
            });
        }

        // Conversion rate: 1 XP = 0.3 bytes
        const bytesEarned = xpAmount * 0.3;
        const wholeBytes = Math.floor(bytesEarned);
        const decimalBytes = (bytesEarned - wholeBytes).toFixed(1);

        // Deduct XP and add bytes (whole number only)
        student.xp -= xpAmount;
        student.bytes += wholeBytes;
        await student.save();

        res.status(200).json({
            message: 'XP converted to bytes successfully!',
            xpConverted: xpAmount,
            bytesEarned: wholeBytes,
            decimalBytes: decimalBytes,
            totalBytesEarned: bytesEarned.toFixed(1),
            remainingXP: student.xp,
            totalBytes: student.bytes
        });

    } catch (error) {
        console.error('Error converting XP to bytes:', error);
        res.status(500).json({ message: 'Failed to convert XP', error: error.message });
    }
});

// Get Student Notifications
app.get('/api/student/notifications', authenticateToken, async (req, res) => {
    try {
        const studentId = req.student.id;
        const { limit = 50, unreadOnly = false } = req.query;

        const query = { student: studentId };
        if (unreadOnly === 'true') {
            query.read = false;
        }

        const notifications = await Notification.find(query)
            .sort({ createdAt: -1 })
            .limit(parseInt(limit));

        const unreadCount = await Notification.countDocuments({ 
            student: studentId, 
            read: false 
        });

        res.status(200).json({
            notifications,
            unreadCount
        });

    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({ message: 'Failed to fetch notifications', error: error.message });
    }
});

// Mark Notification as Read
app.patch('/api/student/notifications/:id/read', authenticateToken, async (req, res) => {
    try {
        const studentId = req.student.id;
        const { id } = req.params;

        const notification = await Notification.findOneAndUpdate(
            { _id: id, student: studentId },
            { read: true },
            { new: true }
        );

        if (!notification) {
            return res.status(404).json({ message: 'Notification not found.' });
        }

        res.status(200).json({ message: 'Notification marked as read.', notification });

    } catch (error) {
        console.error('Error marking notification as read:', error);
        res.status(500).json({ message: 'Failed to update notification', error: error.message });
    }
});

// Get Leaderboard
app.get('/api/leaderboard', authenticateToken, async (req, res) => {
    try {
        const { limit = 200 } = req.query;
        const currentStudentId = req.student.id;

        // Get all students sorted by bytes
        const allStudents = await Student.find({ isEmailVerified: true })
            .select('preferredName studentName bytes xp currentTier')
            .sort({ bytes: -1 });

        // Top 200 get full preferred names shown
        const leaderboard = allStudents.map((student, index) => {
            const isCurrentUser = student._id.toString() === currentStudentId;
            const rank = index + 1;
            let displayName;

            if (rank <= 200 || isCurrentUser) {
                displayName = student.preferredName || student.studentName;
            } else {
                // Anonymize: first 3 letters + ***
                const name = student.preferredName || student.studentName;
                displayName = name.substring(0, 3) + '***';
            }

            return {
                rank,
                displayName,
                bytes: student.bytes,
                xp: student.xp,
                tier: student.currentTier,
                isCurrentUser
            };
        });

        res.status(200).json({
            leaderboard: leaderboard.slice(0, parseInt(limit)),
            totalPlayers: allStudents.length
        });

    } catch (error) {
        console.error('Error fetching leaderboard:', error);
        res.status(500).json({ message: 'Failed to fetch leaderboard', error: error.message });
    }
});

// Internal Helper: Award Achievement to Student
async function awardAchievement(studentId, achievementId, progressIncrement = 1) {
    try {
        const student = await Student.findById(studentId);
        if (!student) return null;

        const achievement = await Achievement.findOne({ achievementId });
        if (!achievement) return null;

        // Find or create student achievement progress
        let studentAchievement = await StudentAchievement.findOne({
            student: studentId,
            achievementId: achievementId
        });

        if (!studentAchievement) {
            studentAchievement = new StudentAchievement({
                student: studentId,
                achievement: achievement._id,
                achievementId: achievementId,
                progress: 0,
                target: 1
            });
        }

        // Already unlocked?
        if (studentAchievement.unlocked) {
            return { alreadyUnlocked: true };
        }

        // Increment progress
        studentAchievement.progress += progressIncrement;

        // Check if unlocked
        if (studentAchievement.progress >= studentAchievement.target) {
            studentAchievement.unlocked = true;
            studentAchievement.unlockedAt = new Date();

            // Award bytes and XP
            student.bytes += achievement.byteReward;
            student.xp += achievement.xpReward;

            // Check for tier level up
            const currentTierInfo = await PlayerLevel.findOne({ tier: student.currentTier });
            const nextTierInfo = await PlayerLevel.findOne({ tier: student.currentTier + 1 });

            if (nextTierInfo && student.xp >= nextTierInfo.totalXPRequired) {
                student.currentTier = nextTierInfo.tier;
                student.bytes += nextTierInfo.levelUpByteReward;

                // Create level up notification
                const levelUpNotif = new Notification({
                    student: studentId,
                    type: 'level_up',
                    title: 'Level Up!',
                    message: `Congratulations! You've reached ${nextTierInfo.name} (Tier ${nextTierInfo.tier})! You earned ${nextTierInfo.levelUpByteReward} bonus bytes!`,
                    data: { tier: nextTierInfo.tier, tierName: nextTierInfo.name, bonusBytes: nextTierInfo.levelUpByteReward }
                });
                await levelUpNotif.save();
            }

            await student.save();

            // Create achievement notification
            if (!studentAchievement.notificationSent) {
                const achievementNotif = new Notification({
                    student: studentId,
                    type: 'achievement',
                    title: 'Achievement Unlocked!',
                    message: `You've unlocked "${achievement.name}"! Earned ${achievement.byteReward} bytes and ${achievement.xpReward} XP.`,
                    data: { achievementId, tier: achievement.tier }
                });
                await achievementNotif.save();
                studentAchievement.notificationSent = true;
            }

            await studentAchievement.save();

            return {
                unlocked: true,
                achievement,
                bytesEarned: achievement.byteReward,
                xpEarned: achievement.xpReward,
                leveledUp: nextTierInfo && student.currentTier === nextTierInfo.tier,
                newTier: student.currentTier
            };
        }

        await studentAchievement.save();
        return { progress: studentAchievement.progress, target: studentAchievement.target };

    } catch (error) {
        console.error('Error awarding achievement:', error);
        return null;
    }
}

// Serve admin login page
app.get('/admin-login.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'adminlogin.html'));
});


// Start the server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`SchoolByte server running on port ${PORT}`);
    console.log('All quiz system features implemented:');
    console.log('✓ Enhanced database schemas');
    console.log('✓ "Fats and Beef" quiz balancing mechanism');
    console.log('✓ Advanced NLP grading system');
    console.log('✓ Duplicate detection with hashing');
    console.log('✓ Weekly tracking for students and teachers');
    console.log('✓ Comprehensive analytics');
    console.log('✓ Multiple question types support');
    console.log('✓ Subject-based curriculum management');
});


// Student search and contact suggestions endpoint for ByteNexus chat
app.get('/api/students/search', authenticateToken, async (req, res) => {
    try {
        const { query } = req.query;
        const currentStudentId = req.student.id;

        const currentStudent = await Student.findById(currentStudentId);
        if (!currentStudent) {
            return res.status(404).json({ message: 'Student not found.' });
        }

        let searchQuery = {
            _id: { $ne: currentStudentId }
        };

        if (query && query.trim().length >= 2) {
            searchQuery.$or = [
                { email: { $regex: query.trim(), $options: 'i' } },
                { studentName: { $regex: query.trim(), $options: 'i' } },
                { indexNumber: { $regex: query.trim(), $options: 'i' } }
            ];
        }

        const students = await Student.find(searchQuery)
            .select('studentName email class stream avatar_url')
            .limit(50)
            .lean();

        res.status(200).json({
            message: 'Students found successfully.',
            students: students.map(student => ({
                id: student._id.toString(),
                studentName: student.studentName,
                email: student.email,
                class: student.class,
                stream: student.stream,
                avatar_url: student.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${student.studentName}`
            }))
        });
    } catch (error) {
        console.error('Error searching students:', error);
        res.status(500).json({ message: 'Failed to search students.', error: error.message });
    }
});

// Get contact suggestions based on stream, class, and other students
app.get('/api/students/suggestions', authenticateToken, async (req, res) => {
    try {
        const currentStudentId = req.student.id;

        const currentStudent = await Student.findById(currentStudentId);
        if (!currentStudent) {
            return res.status(404).json({ message: 'Student not found.' });
        }

        const allStudents = await Student.find({
            _id: { $ne: currentStudentId }
        })
            .select('studentName email class stream subjectsEnrolled')
            .lean();

        // Categorize students
        const sameStreamAndClass = [];
        const sameStream = [];
        const sameClass = [];
        const others = [];

        allStudents.forEach(student => {
            if (student.stream === currentStudent.stream && student.class === currentStudent.class) {
                sameStreamAndClass.push(student);
            } else if (student.stream === currentStudent.stream) {
                sameStream.push(student);
            } else if (student.class === currentStudent.class) {
                sameClass.push(student);
            } else {
                others.push(student);
            }
        });

        // Format and combine suggestions
        const formatStudent = (student, category) => ({
            id: student._id.toString(),
            studentName: student.studentName,
            email: student.email,
            class: student.class,
            stream: student.stream,
            category: category,
            avatar_url: `https://api.dicebear.com/7.x/initials/svg?seed=${student.studentName}`
        });

        const suggestions = [
            ...sameStreamAndClass.map(s => formatStudent(s, 'Same Stream & Class')),
            ...sameStream.map(s => formatStudent(s, 'Same Stream')),
            ...sameClass.map(s => formatStudent(s, 'Same Class')),
            ...others.map(s => formatStudent(s, 'Other Students'))
        ];

        res.status(200).json({
            message: 'Contact suggestions fetched successfully.',
            currentStudent: {
                class: currentStudent.class,
                stream: currentStudent.stream
            },
            suggestions: suggestions.slice(0, 100) // Limit to 100 suggestions
        });
    } catch (error) {
        console.error('Error fetching contact suggestions:', error);
        res.status(500).json({ message: 'Failed to fetch suggestions.', error: error.message });
    }
});

// Export models for use in other files
module.exports = {
    Student,
    Teacher,
    Subject,
    QuizSession,
    QuizQuestion,
    CompletedQuizAttempt,
    WorkFile,
    Activity,
    StudentActivitySubmission,
    Administrator,
    VerificationCode,
    PreaderGameSession,
    PreaderGameSessionLog
};




// Student endpoint to fetch activities by subject and class
app.get('/student/activities', authenticateToken, async (req, res) => {
    try {
        const { subject, intendedClass, search } = req.query;
        const studentId = req.student.id;

        const student = await Student.findById(studentId);
        if (!student) {
            return res.status(404).json({ message: 'Student not found.' });
        }

        let query = {};
        // Case-insensitive subject search
        if (subject) query.subject = { $regex: new RegExp(`^${subject}$`, 'i') };
        if (intendedClass) query.intendedClass = intendedClass;

        // Add search functionality
        if (search && search.trim()) {
            query.$or = [
                { title: { $regex: search.trim(), $options: 'i' } },
                { description: { $regex: search.trim(), $options: 'i' } }
            ];
        }

        const activities = await Activity.find(query)
            .populate('associatedWorkFile', 'title fileUrl costBytes')
            .populate('uploadedBy.teacherId', 'teacherName')
            .populate('attemptCount')
            .sort({ createdAt: -1 });

        // Sort activities by relevance to student's class
        const studentClass = student.class;
        const sortedActivities = activities.sort((a, b) => {
            if (a.intendedClass === studentClass && b.intendedClass !== studentClass) return -1;
            if (b.intendedClass === studentClass && a.intendedClass !== studentClass) return 1;
            return new Date(b.createdAt) - new Date(a.createdAt);
        });

        // Get attempt counts for all activities
        const activityIds = sortedActivities.map(a => a._id);
        const attemptCounts = await StudentActivitySubmission.aggregate([
            { $match: { activity: { $in: activityIds } } },
            { $group: { _id: '$activity', count: { $sum: 1 } } }
        ]);

        const attemptCountMap = {};
        attemptCounts.forEach(ac => {
            attemptCountMap[ac._id.toString()] = ac.count;
        });

        res.status(200).json({
            message: 'Activities fetched successfully.',
            studentClass: studentClass,
            activities: sortedActivities.map(activity => ({
                _id: activity._id,
                title: activity.title,
                description: activity.description,
                subject: activity.subject,
                intendedClass: activity.intendedClass,
                maxBytesReward: activity.maxBytesReward,
                questions: activity.questions,
                uploadedBy: {
                    teacherId: activity.uploadedBy.teacherId?._id,
                    teacherName: activity.uploadedBy.teacherName
                },
                attemptCount: attemptCountMap[activity._id.toString()] || 0,
                associatedWorkFile: activity.associatedWorkFile,
                createdAt: activity.createdAt
            }))
        });
    } catch (error) {
        console.error('Error fetching activities:', error);
        res.status(500).json({ message: 'Failed to fetch activities.', error: error.message });
    }
});


// Student endpoint to fetch a specific activity with all questions
app.get('/student/activities/:activityId', authenticateToken, async (req, res) => {
    try {
        const { activityId } = req.params;


        const activity = await Activity.findById(activityId)
            .populate('associatedWorkFile', 'title fileUrl costBytes');


        if (!activity) {
            return res.status(404).json({ message: 'Activity not found.' });
        }


        res.status(200).json({
            message: 'Activity fetched successfully.',
            activity: {
                _id: activity._id,
                title: activity.title,
                description: activity.description,
                subject: activity.subject,
                intendedClass: activity.intendedClass,
                maxBytesReward: activity.maxBytesReward,
                questions: activity.questions,
                uploadedBy: activity.uploadedBy,
                associatedWorkFile: activity.associatedWorkFile,
                createdAt: activity.createdAt
            }
        });
    } catch (error) {
        console.error('Error fetching activity:', error);
        res.status(500).json({ message: 'Failed to fetch activity.', error: error.message });
    }
});


// Student endpoint to submit activity answers with NLP grading
app.post('/student/activities/submit', authenticateToken, [
    body('activityId').isMongoId().withMessage('Valid activity ID is required.'),
    body('answers').isArray({ min: 1 }).withMessage('Answers array is required.')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { activityId, answers } = req.body;
    const studentId = req.student.id;

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const student = await Student.findById(studentId).session(session);
        if (!student) {
            await session.abortTransaction();
            return res.status(404).json({ message: 'Student not found.' });
        }

        const activity = await Activity.findById(activityId).session(session);
        if (!activity) {
            await session.abortTransaction();
            return res.status(404).json({ message: 'Activity not found.' });
        }

        // Grade each answer using NLP keyword matching
        let totalScore = 0;
        let maxPossibleScore = activity.questions.length;
        const gradedAnswers = [];

        for (let i = 0; i < activity.questions.length; i++) {
            const question = activity.questions[i];
            const studentAnswer = answers[i]?.answer || '';

            if (!studentAnswer.trim()) {
                gradedAnswers.push({
                    questionIndex: i,
                    score: 0,
                    feedback: 'No answer provided.'
                });
                continue;
            }

            // NLP Grading: Count matching keywords
            const keywords = question.keywordsForMarking || [];
            const normalizedAnswer = studentAnswer.toLowerCase();
            let matchedKeywords = 0;

            for (const keyword of keywords) {
                if (normalizedAnswer.includes(keyword.toLowerCase())) {
                    matchedKeywords++;
                }
            }

            // Calculate score as percentage of keywords found
            const questionScore = keywords.length > 0 ? matchedKeywords / keywords.length : 0;
            totalScore += questionScore;

            gradedAnswers.push({
                questionIndex: i,
                score: questionScore,
                matchedKeywords: matchedKeywords,
                totalKeywords: keywords.length,
                feedback: questionScore >= 0.7 ? 'Good answer!' : questionScore >= 0.4 ? 'Partial credit.' : 'Needs improvement.'
            });
        }

        // Calculate bytes earned (proportional to score)
        const scorePercentage = maxPossibleScore > 0 ? totalScore / maxPossibleScore : 0;
        const bytesEarned = Math.round(activity.maxBytesReward * scorePercentage);

        // Award bytes to student
        student.bytes += bytesEarned;
        await student.save({ session });

        // Save submission record
        const submission = new StudentActivitySubmission({
            student: studentId,
            activity: activityId,
            answers: answers,
            score: scorePercentage,
            bytesEarned: bytesEarned,
            submittedAt: new Date(),
            isGraded: true
        });
        await submission.save({ session });

        await session.commitTransaction();

        res.status(200).json({
            message: 'Activity submitted and graded successfully!',
            bytesEarned: bytesEarned,
            studentCurrentBytes: student.bytes,
            scorePercentage: Math.round(scorePercentage * 100),
            gradedAnswers: gradedAnswers
        });

    } catch (error) {
        await session.abortTransaction();
        console.error('Error submitting activity:', error);
        res.status(500).json({ message: 'Failed to submit activity.', error: error.message });
    } finally {
        session.endSession();
    }
});