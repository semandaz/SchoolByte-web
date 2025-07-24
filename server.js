// server.js - SchoolByte Backend


// --- Module Imports ---
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const nodemailer = require('nodemailer');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken'); // For JSON Web Tokens
const { body, validationResult } = require('express-validator'); // For input validation
const helmet = require('helmet'); // For security headers
const morgan = require('morgan'); // For logging HTTP requests


// Cloudinary imports for file storage
const cloudinary = require('cloudinary').v2; // Use .v2 for Cloudinary SDK
const multer = require('multer'); // For handling multipart/form-data (file uploads)


// NEW: Google Generative AI SDK for Preader Games
const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require('@google/generative-ai');


const app = express();
const PORT = process.env.PORT || 3000; // Use process.env.PORT for Replit


// --- Middleware ---
app.use(cors()); // Enable CORS for all origins (adjust in production for specific origins)
app.use(express.json()); // For parsing application/json bodies
app.use(express.urlencoded({ extended: true })); // For parsing application/x-www-form-urlencoded
app.use(express.static('public')); // Serve static files from 'public' directory


// Security middleware (Helmet) - Helps secure your app by setting various HTTP headers.
app.use(helmet());


// Request logging middleware (Morgan) - Logs HTTP requests to the console.
// 'dev' format gives concise, color-coded output for development.
app.use(morgan('dev'));


// --- MongoDB Connection ---
// MONGODB_URI should be set in Replit Secrets.
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
    console.error('FATAL ERROR: MONGODB_URI is not defined. Please set it in Replit Secrets.');
    process.exit(1); // Exit if critical env var is missing
}

mongoose.connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    // useCreateIndex: true // This option is no longer needed/supported in Mongoose 6+
})
    .then(() => console.log('MongoDB connected successfully'))
    .catch(err => {
        console.error('MongoDB connection error:', err);
        process.exit(1); // Exit if DB connection fails
    });


// --- Mongoose Schema and Model for VerificationCode ---
// Stores temporary verification codes for email confirmation.
// 'expires: 10m' automatically deletes documents after 10 minutes.
const verificationCodeSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    code: { type: String, required: true },
    createdAt: { type: Date, default: Date.now, expires: '10m' }
});
const VerificationCode = mongoose.model('VerificationCode', verificationCodeSchema);


// --- Mongoose Schema and Model for Student ---
// Defines the structure for student data storage.
const studentSchema = new mongoose.Schema({
    studentName: { type: String, required: true, trim: true }, // 'trim' removes whitespace
    indexNumber: { type: String, required: true, unique: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true }, // 'lowercase' ensures consistency
    password: { type: String, required: true }, // Stores hashed password
    isEmailVerified: { type: Boolean, default: false }, // Tracks if email is verified
    bytes: { type: Number, default: 20 }, // MODIFIED: New students start with 20 bytes
    createdAt: { type: Date, default: Date.now },


    // --- NEW FIELDS FOR STUDENT DATA ---
    class: { type: String, required: true, trim: true }, // E.g., "S.1", "S.2"
    stream: { type: String, required: true, trim: true }, // E.g., "Arts", "Science", "Blue"
    classTeacher: { type: String, required: true, trim: true }, // For now, stores the teacher's name as a string


    // For the leaderboard, if student wants a different first name displayed
    firstNameDisplay: { type: String, trim: true },


    // For preferred name display (what name to show in profile/dashboard)
    preferredName: { type: String, trim: true },


    // For font preferences and other settings
    preferences: {
        type: Object, // This allows for flexible key-value pairs
        default: {
            fontSize: "medium", // Default font size preference
            theme: "light",       // Default theme preference (e.g., 'light', 'dark')
            notifications_on: true, // Default notification preference
            fontFamily: "Inter, sans-serif" // Default font preference
        }
    },
    // NEW: Total time spent in Preader Games (minutes)
    totalPreaderGameTimeMinutes: { type: Number, default: 0 }
});
const Student = mongoose.model('Student', studentSchema);




// --- Mongoose Schema and Model for Teacher ---
// Defines the structure for teacher data storage.
const teacherSchema = new mongoose.Schema({
    teacherName: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true }, // Stores hashed password
    bytes: { type: Number, default: 0 }, // Teachers also have bytes, starting at 0
    createdAt: { type: Date, default: Date.now },
    // NEW FIELD: To track if teacher has set their initial password
    isPasswordSet: { type: Boolean, default: false },
    // NEW FIELDS: Added for admin portal management
    gender: { type: String, enum: ['Male', 'Female', 'Other'], trim: true, default: 'Other' }, // Optional gender field
    physicalDescription: { type: String, trim: true }, // Optional physical description/notes


    // Teachers also have preferences, similar to students
    preferences: {
        type: Object,
        default: {
            fontSize: "medium",
            theme: "light",
            notifications_on: true
        }
    }
});
const Teacher = mongoose.model('Teacher', teacherSchema);


// --- Mongoose Schema and Model for WorkFile (PDFs) ---
const workFileSchema = new mongoose.Schema({
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    fileUrl: { type: String, required: true }, // URL to the PDF file in cloud storage
    subject: { type: String, required: true, trim: true }, // E.g., "Mathematics", "English Language" (from your list)
    intendedClass: { type: String, required: true, trim: true }, // E.g., "S.1", "S.2", "S.3", "S.4", "S.5", "S.6"
    costBytes: { type: Number, required: true, default: 2, min: 0 }, // Bytes required to download
    // MODIFIED: Store both teacherId and teacherName for persistence
    uploadedBy: {
        teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher', default: null }, // Can be null if teacher account is deleted
        teacherName: { type: String, required: true }
    },
    // This field will link to the associated activity
    activity: { type: mongoose.Schema.Types.ObjectId, ref: 'Activity', required: true, unique: true }, // Each WorkFile must have ONE unique Activity


    // NEW: Watermark preferences for download
    applyDownloadWatermark: { type: Boolean, default: true }, // Teacher's choice for downloaded PDF


    createdAt: { type: Date, default: Date.now }
});
const WorkFile = mongoose.model('WorkFile', workFileSchema);


// --- Mongoose Schema and Model for Activity (Long-Answer Tasks linked to PDFs) ---
const activitySchema = new mongoose.Schema({
    title: { type: String, required: true, trim: true }, // E.g., "Photosynthesis Deep Dive"
    description: { type: String, trim: true }, // A brief overview of the activity
    subject: { type: String, required: true, trim: true }, // E.g., "Biology", "History" - must match one of your predefined subjects
    intendedClass: { type: String, required: true, trim: true }, // E.g., "S.1", "S.4" - the class this activity is primarily for
    maxBytesReward: { type: Number, required: true, default: 5, min: 0 }, // Fixed bytes for activity completion (as per your last discussion)


    // Reference to the WorkFile (PDF) this activity is associated with.
    // 'unique: true' ensures one activity is tied to one work file.
    associatedWorkFile: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'WorkFile',
        required: true,
        unique: true
    },


    // Array of questions for the activity. Each question has its text and keywords.
    questions: [
        {
            questionText: { type: String, required: true, trim: true },
            // Keywords the teacher sets for automated marking.
            // Student's answer will be compared against these.
            keywordsForMarking: {
                type: [String], // Array of strings
                required: true,
                validate: {
                    validator: function(v) {
                        return v && v.length > 0; // Ensure at least one keyword is provided
                    },
                    message: 'Each question must have at least one keyword for marking.'
                }
            }
        }
    ],


    // MODIFIED: Store both teacherId and teacherName for persistence
    uploadedBy: {
        teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher', default: null },
        teacherName: { type: String, required: true }
    },
    createdAt: { type: Date, default: Date.now }
});
const Activity = mongoose.model('Activity', activitySchema);


// --- Mongoose Schema and Model for QuizQuestion (Individual Random Questions) ---
const quizQuestionSchema = new mongoose.Schema({
    questionText: { type: String, required: true, trim: true },
    subject: { type: String, required: true, trim: true }, // E.g., "History", "Biology" - the specific subject of *this question*
    intendedClass: { type: String, required: true, trim: true }, // E.g., "S.1", "S.4" - target class for *this specific question*


    // This field defines the type of quiz question, enabling different data structures
    // and frontend rendering/marking logic.
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
            // 'labeling' could be added later, might require more complex data for diagram coordinates.
        ],
        required: true
    },


    // --- Fields that are conditional based on 'type' ---


    // For 'multiple-choice-single', 'multiple-choice-multi'
    // Stores all options, with a boolean indicating if each option is correct.
    options: [{
        text: { type: String, required: true },
        isCorrect: { type: Boolean, default: false }
    }],


    // For 'short-answer', 'true-false', 'fill-in-the-blank', 'problem-solving'
    // Can be an array to allow for multiple correct phrasings or acceptable answers.
    // For 'true-false', this array would contain ["true"] or ["false"].
    correctAnswers: {
        type: [String],
        // This array is required for types that don't rely on the 'options' array.
        required: function() {
            return ['short-answer', 'true-false', 'problem-solving'].includes(this.type);
        },
        // For 'fill-in-the-blank', it's required only if present and not empty, as the questionText might also guide it.
        // Let's refine this, if fill-in-the-blank uses correctAnswers, it should be required and non-empty.
        validate: {
            validator: function(v) {
                // If the type is one that requires correctAnswers, ensure it's not an empty array
                if (['short-answer', 'true-false', 'problem-solving', 'fill-in-the-blank'].includes(this.type)) {
                    return v && v.length > 0;
                }
                return true; // For other types, this validation doesn't apply
            },
            message: props => `${props.path} must contain at least one correct answer for this question type.`
        }
    },


    // For 'matching' questions
    // An array of objects, where each object is a correct pair.
    matchingPairs: [{
        itemA: { type: String, required: true },
        itemB: { type: String, required: true }
    }],


    // For 'ordering' questions
    // An array of strings, representing the items in their correct sequential order.
    orderedItems: {
        type: [String],
        required: function() { return this.type === 'ordering'; },
        validate: {
            validator: function(v) {
                return v && v.length > 0;
            },
            message: 'Ordering questions must have at least one item.'
        }
    },


    // General instructions for answering this specific question (e.g., "Select the best option", "Round to two decimal places")
    instructions: { type: String, trim: true },
    hint: { type: String, trim: true }, // Optional hint for the student


    // The contribution this single question makes to the total quiz bytes.
    // For a 10-question quiz awarding a max of 10 bytes, each question would be 1 byte.
    maxBytesRewardPerQuestion: { type: Number, required: true, default: 1, min: 0 }, // MODIFIED: Default to 1 byte


    // MODIFIED: Store both teacherId and teacherName for persistence
    uploadedBy: {
        teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher', default: null },
        teacherName: { type: String, required: true }
    },
    isFeatured: { type: Boolean, default: false }, // For the "10 bytes for a month" feature
    featuredUntil: { type: Date, required: function() { return this.isFeatured; } }, // Only required if isFeatured is true
    createdAt: { type: Date, default: Date.now }
});
const QuizQuestion = mongoose.model('QuizQuestion', quizQuestionSchema);


// --- Mongoose Schema and Model for StudentActivitySubmission ---
const studentActivitySubmissionSchema = new mongoose.Schema({
    student: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Student',
        required: true
    },
    // This will reference EITHER an Activity OR a QuizQuestion
    // We use a union type and then determine which one is present.
    activity: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Activity',
        required: function() { return !this.quizQuestion; } // Required if quizQuestion is not present
    },
    quizQuestion: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'QuizQuestion',
        required: function() { return !this.activity; } // Required if activity is not present
    },


    // Store the student's answers. Structure depends on the activity/quiz type.
    // For Activities (long answer), this would be an array of objects:
    // [{ questionId: ObjectId, studentAnswer: "..." }]
    // For QuizQuestions, this would be an array of objects, structured based on question type:
    // e.g., for multiple-choice: [{ questionId: ObjectId, chosenOptionIds: [ObjectId] }]
    // e.g., for short-answer: [{ questionId: ObjectId, studentAnswer: "..." }]
    answers: {
        type: mongoose.Schema.Types.Mixed, // Use Mixed to allow flexible structure
        required: true
    },


    score: { type: Number, default: 0 }, // Score for the submission (e.g., percentage, or raw score)
    bytesEarned: { type: Number, default: 0 }, // Bytes awarded for this specific submission


    // NEW FIELDS for byte re-earning and keyword revelation logic
    attemptNumber: { type: Number, default: 1 },
    attemptType: { type: String, enum: ['initial', 'revision'], default: 'initial' }, // 'initial' for byte-eligible, 'revision' for practice
    lastAttemptDate: { type: Date, default: Date.now },
    revealedKeywords: [{ type: String }], // Keywords revealed during a revision attempt


    submittedAt: { type: Date, default: Date.now },
    isGraded: { type: Boolean, default: false }, // For activities, might be true immediately for quizzes
    // For quizzes, it's always auto-graded.
});
const StudentActivitySubmission = mongoose.model('StudentActivitySubmission', studentActivitySubmissionSchema);




// --- Mongoose Schema and Model for Administrator ---
// Defines the structure for administrator data storage.
// Only administrators can create teacher accounts.
const adminSchema = new mongoose.Schema({
    adminName: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true }, // Stores hashed password
    createdAt: { type: Date, default: Date.now }
});
const Administrator = mongoose.model('Administrator', adminSchema);


// PreaderGameSession Schema (Temporary, for active game state)
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


    // Dynamic Player Stats - Current state
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


    // Current scene content and choices
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


    // The full path taken, including state snapshots
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


// PreaderGameSessionLog Schema (for permanent session history)
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


// --- Utility Functions ---


// Helper to apply stat changes with min/max boundaries
function applyStatChanges(currentStats, changes) {
    const newStats = { ...currentStats };
    for (const stat in changes) {
        if (newStats.hasOwnProperty(stat) && typeof changes[stat] === 'number') {
            newStats[stat] = newStats[stat] + changes[stat];


            // Apply min/max caps for specific stats
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


// --- Nodemailer Transporter Setup ---
// Configures email sending service. EMAIL_USER and EMAIL_PASS must be in Replit Secrets.
const transporter = nodemailer.createTransport({
    service: 'gmail', // You can change this to your email service (e.g., 'Outlook', 'SendGrid')
    auth: {
        user: process.env.EMAIL_USER, // Your email address
        pass: process.env.EMAIL_PASS // Your email app password (for Gmail, this is crucial)
    }
});

if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.warn('WARNING: EMAIL_USER or EMAIL_PASS not set. Email functionalities (verification, 2FA) will not work.');
}


// --- JWT Secret ---
// This secret is used to sign and verify JWTs. It MUST be a strong, random string
// and stored securely in Replit Secrets (Key: JWT_SECRET, Value: your_generated_secret).
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    // Critical error: If the secret is missing, the app cannot function securely.
    console.error('FATAL ERROR: JWT_SECRET is not defined. Please set it in Replit Secrets.');
    process.exit(1); // Exits the Node.js process
}


// --- Cloudinary Configuration ---
// Ensure these are set as Replit Secrets: CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
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


// --- Multer Storage Configuration ---
// We'll use memory storage for Multer, then upload to Cloudinary directly from memory.
const upload = multer({ storage: multer.memoryStorage() });


// --- IMPORTANT: Authentication Middleware Definitions (Moved to top for initialization) ---
// This section defines the JWT verification middleware functions.
// They must be defined BEFORE any route handlers that use them.

/**
 * Middleware to verify JWT for Student tokens.
 * Attaches decoded student payload to req.student.
 */
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'Access Denied: No authentication token provided.' });
    }

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
            console.error('JWT verification error (Student):', err.message);
            return res.status(403).json({ message: 'Access Denied: Invalid or expired token.' });
        }
        req.student = decoded; // Attach decoded student info to the request
        next();
    });
};

/**
 * Middleware to verify JWT for Teacher tokens.
 * Attaches decoded teacher payload to req.teacher.
 */
const authenticateTeacherToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'Access Denied: No authentication token provided.' });
    }

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
            console.error('JWT verification error (Teacher):', err.message);
            return res.status(403).json({ message: 'Access Denied: Invalid or expired teacher token.' });
        }
        req.teacher = decoded; // Attach decoded teacher info to the request
        next();
    });
};

/**
 * Middleware to verify JWT for Administrator tokens.
 * Attaches decoded admin payload to req.admin.
 */
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
        req.admin = decoded; // Attach decoded admin info to the request
        next();
    });
};
// --- END Authentication Middleware Definitions ---


// --- AI Service Configuration ---
const MODEL_NAME = "gemini-1.5-flash";
const API_KEY = process.env.GEMINI_API_KEY;

let genAI;
if (!API_KEY) {
    console.error("GEMINI_API_KEY environment variable is not set. Preader Games AI features will not work.");
} else {
    genAI = new GoogleGenerativeAI(API_KEY);
}


/**
 * Generates story content and choices using Google's Gemini AI
 * @param {string} basePrompt - The initial prompt or student's choice
 * @param {object} currentGameState - Current player stats and ethical score
 * @param {string} studentClass - Student's class (S.1 to S.6)
 * @param {string|null} previousScene - Previous scene content (for continuity)
 * @param {string|null} chosenOptionText - The choice text that led to this scene
 * @returns {Promise<object>} - Contains sceneDescription and choices array
 */
async function generateStoryNode(basePrompt, currentGameState, studentClass, previousScene = null, chosenOptionText = null) {
    if (!genAI) { // Check if genAI was successfully initialized
        throw new Error("AI service not configured: GEMINI_API_KEY is missing or invalid.");
    }

    const model = genAI.getGenerativeModel({ model: MODEL_NAME });


    // Determine content safety instructions based on student class
    let contentSafetyInstruction = "";
    const classNumber = parseInt(studentClass.replace('S.', ""));


    if (classNumber <= 4) { // S.4 and below
        contentSafetyInstruction = 'The story MUST be entirely clean, appropriate for all ages, ' +
            'and contain NO sexual content, suggestive themes, or explicit language whatsoever. ' +
            'Focus on adventure, mystery, and school-appropriate dilemmas.';
    } else { // S.5 and S.6
        contentSafetyInstruction = 'The story should be engaging and can explore more ' +
            'complex themes suitable for older secondary students, but it MUST remain clean and ' +
            'appropriate for a school environment. Absolutely NO sexually explicit or suggestive content ' +
            'is allowed. Focus on mature themes like complex ethical dilemmas, advanced ' +
            'problem-solving, and character development, while maintaining a non-explicit narrative.';
    }


    // Adjust prompt based on ethical score for twists
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


    // Construct the full prompt for the AI
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
                responseMimeType: "application/json",
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
            }
        });


        const responseText = result.candidates[0].content.parts[0].text;
        const parsedResponse = JSON.parse(responseText);


        // Basic validation of the parsed structure
        if (!parsedResponse.sceneDescription || !Array.isArray(parsedResponse.choices)) {
            throw new Error("AI response did not match expected JSON structure.");
        }


        // Ensure bytesAwarded is present for each choice, default to 1 if not provided by AI
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


// Endpoint to send verification code to a student's email.
app.post('/send-verification-code', [
    // Validate that the 'email' field is present and is a valid email format.
    body('email').isEmail().withMessage('Please provide a valid email address.')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }


    const { email } = req.body;


    try {
        // Optional: Check if a student with this email already exists and is already verified.
        const student = await Student.findOne({ email });
        if (student && student.isEmailVerified) {
            return res.status(400).json({ message: 'This email is already verified.' });
        }


        // Generate a 6-digit random verification code.
        const code = Math.floor(100000 + Math.random() * 900000).toString();


        // Save or update the verification code in the database.
        // 'upsert: true' creates a new document if one doesn't exist for the email.
        // 'new: true' returns the updated document.
        // 'setDefaultsOnInsert: true' applies schema defaults on insert.
        await VerificationCode.findOneAndUpdate(
            { email },
            { code, createdAt: Date.now() },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );


        // Configure email options.
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'SchoolByte Email Verification Code',
            html: `<p>Your SchoolByte verification code is: <strong>${code}</strong></p><p>This code is valid for 10 minutes.</p>`
        };


        // Send the email.
        await transporter.sendMail(mailOptions);
        res.status(200).json({ message: 'Verification code sent to your email.' });


    } catch (error) {
        console.error('Error sending verification email:', error);
        res.status(500).json({ message: 'Failed to send verification code.', error: error.message });
    }
});


// Endpoint to verify the code sent to the student's email.
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
        // Find the stored verification code for the given email.
        const storedCode = await VerificationCode.findOne({ email });


        // If no code is found, it means it was never sent or has expired.
        if (!storedCode) {
            return res.status(400).json({ message: 'No verification code found for this email, or it has expired.', verified: false });
        }


        // Check if the provided code matches the stored code.
        if (storedCode.code === code) {
            // If codes match, mark the student's email as verified in the Student collection.
            await Student.updateOne({ email }, { isEmailVerified: true });
            // Delete the verification code after successful use to prevent reuse.
            await VerificationCode.deleteOne({ email });
            return res.status(200).json({ message: 'Email verified successfully!', verified: true });
        } else {
            // If codes do not match.
            return res.status(400).json({ message: 'Invalid verification code.', verified: false });
        }
    } catch (error) {
        console.error('Error verifying code:', error);
        res.status(500).json({ message: 'Error verifying code.', error: error.message, verified: false });
    }
});


// Endpoint to register a new student.
app.post('/register-student', [
    body('studentName').notEmpty().withMessage('Student name is required.'),
    body('indexNumber').notEmpty().withMessage('Index number is required.').isAlphanumeric().withMessage('Index number must be alphanumeric.'),
    body('email').isEmail().withMessage('Please provide a valid email address.'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long.'),
    body('class').notEmpty().withMessage('Class is required.'), // Validation for class
    body('stream').notEmpty().withMessage('Stream is required.'), // Validation for stream
    body('classTeacher').notEmpty().withMessage('Class Teacher is required.') // Validation for classTeacher
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }


    const { studentName, indexNumber, email, password, class: studentClass, stream, classTeacher } = req.body; // 'class' renamed to 'studentClass' to avoid conflict with JS keyword


    try {
        // Check if a student with the given email or index number already exists.
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
            return res.status(409).json({ message }); // 409 Conflict
        }


        // Hash the student's password before saving it to the database.
        const saltRounds = 10; // Recommended number of salt rounds for bcrypt.
        const hashedPassword = await bcrypt.hash(password, saltRounds);


        // Create a new student document.
        const newStudent = new Student({
            studentName,
            indexNumber,
            email,
            password: hashedPassword, // Store the hashed password.
            isEmailVerified: false, // New students are not email-verified by default.
            bytes: 20, // Default bytes for new students
            class: studentClass, // Save class
            stream: stream, // Save stream
            classTeacher: classTeacher, // Save classTeacher
            // firstNameDisplay and preferences will use their defaults if not provided in the request body
        });


        // Save the new student to the database.
        await newStudent.save();


        res.status(201).json({
            message: 'Student registered successfully! Please verify your email to log in.',
            student: {
                name: studentName,
                email: email,
                class: studentClass,
                stream: stream,
                bytes: newStudent.bytes // Confirm initial bytes
            }
        });


    } catch (error) {
        console.error('Error during student registration:', error);
        // Handle specific Mongoose duplicate key error (error.code === 11000).
        if (error.code === 11000) {
            let field = Object.keys(error.keyValue)[0]; // Get the field that caused the duplicate error.
            let value = error.keyValue[field];
            return res.status(409).json({ message: `A student with this ${field} '${value}' already exists.` });
        }
        res.status(500).json({ message: 'Server error during registration.', error: error.message });
    }
});


// Endpoint to log in a student.
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
        // Find the student by email.
        const student = await Student.findOne({ email });


        // If no student is found, return a generic error for security.
        if (!student) {
            return res.status(401).json({ message: 'Invalid email or password.' });
        }


        // Email verification check removed - students can log in without verifying email


        // Compare the provided password with the hashed password stored in the database.
        const isMatch = await bcrypt.compare(password, student.password);


        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid email or password.' });
        }


        // If login is successful, generate a JSON Web Token (JWT).
        // The token payload contains non-sensitive user information.
        const token = jwt.sign(
            { id: student._id, email: student.email, studentName: student.studentName, indexNumber: student.indexNumber, role: 'student' }, // Added role
            JWT_SECRET, // The secret key used to sign the token.
            { expiresIn: '1h' } // The token will expire in 1 hour.
        );


        res.status(200).json({
            message: 'Login successful!',
            token: token, // Send the JWT back to the client.
            student: {
                studentName: student.studentName,
                email: student.email,
                class: student.class, // Include class in login response
                stream: student.stream, // Include stream in login response
                bytes: student.bytes, // Include current bytes in login response
                isEmailVerified: student.isEmailVerified // Include email verification status
            }
        });


    } catch (error) {
        console.error('Error during student login:', error);
        res.status(500).json({ message: 'Server error during login.', error: error.message });
    }
});


// Protected route to get student dashboard data.
// This route can only be accessed by authenticated users who provide a valid JWT.
app.get('/student/dashboard', authenticateToken, async (req, res) => {
    try {
        // 'req.student' contains the decoded payload from the JWT (id, email, studentName, indexNumber).
        // We select all fields except password, including 'bytes' which is now in the schema.
        const studentData = await Student.findById(req.student.id).select('-password');


        if (!studentData) {
            return res.status(404).json({ message: 'Student data not found.' });
        }


        res.status(200).json({
            message: `Welcome to your dashboard, ${studentData.studentName}!`,
            student: {
                studentName: studentData.studentName,
                indexNumber: studentData.indexNumber,
                email: studentData.email,
                isEmailVerified: studentData.isEmailVerified,
                bytes: studentData.bytes || 0,
                class: studentData.class, // Include class
                stream: studentData.stream, // Include stream
                classTeacher: studentData.classTeacher, // Include classTeacher
                firstNameDisplay: studentData.firstNameDisplay, // Include firstNameDisplay
                preferredName: studentData.preferredName, // Include preferredName
                preferences: studentData.preferences, // Include preferences
                totalPreaderGameTimeMinutes: studentData.totalPreaderGameTimeMinutes || 0, // Include total game time
                createdAt: studentData.createdAt
            }
        });


    } catch (error) {
        console.error('Error accessing student dashboard:', error);
        res.status(500).json({ message: 'Server error accessing dashboard.', error: error.message });
    }
});


// Endpoint to update student preferences
app.put('/student/preferences', authenticateToken, [
    // Optional validation for preferences if specific types are expected
    body('preferences').isObject().withMessage('Preferences must be an object.'),
    body('preferences.fontSize').optional().isString().withMessage('Font size must be a string.'),
    body('preferences.theme').optional().isString().withMessage('Theme must be a string.'),
    body('preferences.notifications_on').optional().isBoolean().withMessage('Notifications_on must be a boolean.'),
    body('preferences.fontFamily').optional().isString().withMessage('Font family must be a string.')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }


    const { preferences } = req.body;
    const studentId = req.student.id; // Get student ID from the authenticated token


    try {
        const updatedStudent = await Student.findByIdAndUpdate(
            studentId,
            { $set: { preferences: preferences } }, // Use $set to update the entire preferences object
            { new: true, runValidators: true } // Return the updated document and run schema validators
        ).select('-password'); // Exclude password from the response


        if (!updatedStudent) {
            return res.status(404).json({ message: 'Student not found.' });
        }


        res.status(200).json({
            message: 'Preferences updated successfully!',
            student: {
                studentName: updatedStudent.studentName,
                email: updatedStudent.email,
                preferences: updatedStudent.preferences
            }
        });


    } catch (error) {
        console.error('Error updating student preferences:', error);
        res.status(500).json({ message: 'Server error updating preferences.', error: error.message });
    }
});


// Endpoint to update student preferred name
app.put('/student/preferred-name', authenticateToken, [
    body('preferredName').notEmpty().withMessage('Preferred name is required.').trim().isLength({ min: 1, max: 100 }).withMessage('Preferred name must be between 1 and 100 characters.')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }


    const { preferredName } = req.body;
    const studentId = req.student.id;


    try {
        const updatedStudent = await Student.findByIdAndUpdate(
            studentId,
            { $set: { preferredName: preferredName } },
            { new: true, runValidators: true }
        ).select('-password');


        if (!updatedStudent) {
            return res.status(404).json({ message: 'Student not found.' });
        }


        res.status(200).json({
            message: 'Preferred name updated successfully!',
            student: {
                studentName: updatedStudent.studentName,
                preferredName: updatedStudent.preferredName,
                email: updatedStudent.email
            }
        });


    } catch (error) {
        console.error('Error updating preferred name:', error);
        res.status(500).json({ message: 'Server error updating preferred name.', error: error.message });
    }
});


// Endpoint for students to submit answers to an Activity
// This endpoint will handle automated scoring, byte awarding, and keyword revelation.
app.post(
    '/student/activities/:activityId/submit',
    authenticateToken, // Ensure only authenticated students can submit
    [
        // Validate the answers array structure
        body('answers')
            .isArray({ min: 1 }).withMessage('Answers array is required and must not be empty.'),
        body('answers.*.questionIndex') // Validate each item in the answers array
            .isInt({ min: 0 }).withMessage('Question index must be a non-negative integer.'),
        body('answers.*.studentAnswer')
            .isString().withMessage('Student answer must be a string.')
            .trim()
            .notEmpty().withMessage('Student answer cannot be empty.')
            .isLength({ min: 1, max: 2000 }).withMessage('Student answer must be between 1 and 2000 characters.')
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }


        const { activityId } = req.params;
        const { answers: studentAnswers } = req.body; // Renamed to avoid confusion
        const studentId = req.student.id; // Get student ID from authenticated token


        // Start a Mongoose session for transactional behavior
        const session = await mongoose.startSession();
        session.startTransaction();


        try {
            // --- Step 1: Fetch Activity and Student Data ---
            const activity = await Activity.findById(activityId).session(session);
            if (!activity) {
                return res.status(404).json({ message: 'Activity not found.' });
            }


            const student = await Student.findById(studentId).session(session);
            if (!student) {
                return res.status(404).json({ message: 'Student not found.' });
            }


            // --- Step 2: Retrieve Previous Submissions for this Activity and Student ---
            const existingSubmissions = await StudentActivitySubmission.find({
                student: studentId,
                activity: activityId
            }).sort({ submittedAt: -1 }).session(session); // Sort to get the latest attempt


            const latestSubmission = existingSubmissions.length > 0 ? existingSubmissions[0] : null;
            const initialAttempt = existingSubmissions.find(sub => sub.attemptType === 'initial'); // Find the first initial attempt


            let currentAttemptNumber = (latestSubmission ? latestSubmission.attemptNumber : 0) + 1;
            let currentAttemptType = 'revision'; // Default to revision
            let bytesAwardedForThisAttempt = 0;
            let keywordsToReveal = [];
            let totalCorrectKeywords = 0;
            let totalPossibleKeywords = 0;


            // --- Step 3: Automated Scoring Logic ---
            const gradedAnswers = [];
            for (const [ansIndex, studentAns] of studentAnswers.entries()) {
                const question = activity.questions[studentAns.questionIndex];


                if (!question) {
                    // Skip if question index is invalid, or handle as an error
                    console.warn(`Invalid questionIndex ${studentAns.questionIndex} for activity ${activityId}`);
                    continue;
                }


                let questionCorrectKeywords = 0;
                const normalizedStudentAnswer = studentAns.studentAnswer.toLowerCase().trim();
                const normalizedKeywords = question.keywordsForMarking.map(k => k.toLowerCase().trim());


                // For long answers, check if student's answer includes each keyword
                for (const keyword of normalizedKeywords) {
                    if (normalizedStudentAnswer.includes(keyword)) {
                        questionCorrectKeywords++;
                    }
                }


                totalCorrectKeywords += questionCorrectKeywords;
                totalPossibleKeywords += normalizedKeywords.length;


                gradedAnswers.push({
                    questionIndex: studentAns.questionIndex,
                    studentAnswer: studentAns.studentAnswer,
                    correctKeywordsFound: questionCorrectKeywords,
                    totalKeywordsForQuestion: normalizedKeywords.length,
                    isQuestionCorrect: questionCorrectKeywords === normalizedKeywords.length // Mark question as correct if all keywords are found
                });


                // If question is not fully correct, add its keywords to potential revelation list
                if (questionCorrectKeywords < normalizedKeywords.length) {
                    keywordsToReveal = keywordsToReveal.concat(question.keywordsForMarking);
                }
            }


            const overallScore = totalPossibleKeywords > 0 ? (totalCorrectKeywords / totalPossibleKeywords) * 100 : 0;
            const passed = overallScore >= 70; // Define your passing threshold (e.g., 70%)


            // --- Step 4: Byte Awarding Logic ---
            if (!initialAttempt) { // This is the very first attempt for this activity
                currentAttemptType = 'initial';
                if (passed) {
                    bytesAwardedForThisAttempt = activity.maxBytesReward;
                    student.bytes += bytesAwardedForThisAttempt; // Add bytes to student
                    await student.save({ session }); // Save updated student bytes
                }
            } else {
                // Subsequent attempt logic
                const twoWeeksInMs = 14 * 24 * 60 * 60 * 1000;
                const timeSinceLastAttempt = Date.now() - initialAttempt.lastAttemptDate.getTime();


                // Check if the initial attempt failed AND it's been more than 14 days
                if (initialAttempt.score < 70 && timeSinceLastAttempt > twoWeeksInMs) {
                    // This is an eligible revision attempt for re-earning bytes
                    currentAttemptType = 'revision';
                    if (passed) {
                        bytesAwardedForThisAttempt = activity.maxBytesReward;
                        student.bytes += bytesAwardedForThisAttempt; // Add bytes to student
                        await student.save({ session }); // Save updated student bytes
                    }
                } else {
                    // Not eligible for bytes (either initial attempt passed, or it's within 14 days)
                    currentAttemptType = 'revision'; // Still a revision attempt, but no bytes
                }
            }


            // --- Step 5: Keyword Revelation Logic ---
            // Keywords are revealed if the student failed the current attempt
            // AND it's a revision attempt (meaning they are practicing or re-earning)
            let finalRevealedKeywords = [];
            if (!passed && currentAttemptType === 'revision') {
                // Only reveal keywords for questions they got wrong in this specific attempt
                finalRevealedKeywords = keywordsToReveal;
            } else if (latestSubmission && latestSubmission.revealedKeywords.length > 0) {
                // If they previously had keywords revealed (e.g., from a failed initial attempt),
                // ensure they can still see them even if they pass this revision attempt.
                // This prevents keywords from disappearing if they pass a revision after failing initial.
                finalRevealedKeywords = latestSubmission.revealedKeywords;
            }




            // --- Step 6: Create New StudentActivitySubmission Document ---
            const newSubmission = new StudentActivitySubmission({
                student: studentId,
                activity: activityId,
                answers: gradedAnswers, // Store the graded answers including correctness info
                score: overallScore,
                bytesEarned: bytesAwardedForThisAttempt,
                attemptNumber: currentAttemptNumber,
                attemptType: currentAttemptType,
                lastAttemptDate: Date.now(), // Update last attempt date for this new submission
                revealedKeywords: finalRevealedKeywords // Store keywords revealed for this submission
            });
            await newSubmission.save({ session });


            // --- Step 7: Commit Transaction ---
            await session.commitTransaction();


            res.status(200).json({
                message: 'Activity submitted and graded successfully!',
                score: overallScore,
                bytesEarned: bytesAwardedForThisAttempt,
                attemptNumber: newSubmission.attemptNumber,
                attemptType: newSubmission.attemptType,
                revealedKeywords: newSubmission.revealedKeywords, // Send revealed keywords to frontend
                studentCurrentBytes: student.bytes // Send updated student bytes
            });


        } catch (error) {
            await session.abortTransaction(); // Rollback on error
            console.error('Error submitting student activity:', error);
            res.status(500).json({ message: 'Failed to submit activity. Please try again.', error: error.message });
        } finally {
            session.endSession(); // End the session
        }
    }
);




// Endpoint to get the Student Leaderboard
app.get('/leaderboard', async (req, res) => {
    try {
        // Find all students, sort by bytes in descending order, and limit to 200 for the top tier.
        // Select only necessary fields to reduce data transfer.
        const students = await Student.find({})
            .sort({ bytes: -1 }) // Sort by bytes, highest first
            .select('studentName firstNameDisplay bytes') // Select only these fields
            .lean(); // Use .lean() for faster query results when not modifying documents


        const leaderboard = students.map((student, index) => {
            const displayName = student.firstNameDisplay || student.studentName.split(' ')[0]; // Use firstNameDisplay or first part of studentName
            const bytesStatus = index < 200 ? student.bytes : undefined; // Only show bytes for the first 200


            return {
                name: displayName,
                bytes: bytesStatus // Will be undefined for students beyond the top 200
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


// NEW: Endpoint to log in a teacher.
app.post('/login-teacher', [
    body('email').isEmail().withMessage('Please provide a valid email address.'),
    body('password').notEmpty().withMessage('Password is required.')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }


    const { email, password } = req.body;


    try {
        const teacher = await Teacher.findOne({ email });


        if (!teacher) {
            return res.status(401).json({ message: 'Invalid email or password.' });
        }


        const isMatch = await bcrypt.compare(password, teacher.password);


        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid email or password.' });
        }


        // Generate JWT for teacher
        const token = jwt.sign(
            { id: teacher._id, email: teacher.email, teacherName: teacher.teacherName, role: 'teacher' }, // Added role for clarity
            JWT_SECRET,
            { expiresIn: '1h' }
        );


        res.status(200).json({
            message: 'Teacher login successful!',
            token: token,
            teacher: {
                teacherName: teacher.teacherName,
                email: teacher.email,
                bytes: teacher.bytes,
                isPasswordSet: teacher.isPasswordSet // Include isPasswordSet in login response
            }
        });


    } catch (error) {
        console.error('Error during teacher login:', error);
        res.status(500).json({ message: 'Server error during teacher login.', error: error.message });
    }
});


// NEW: Endpoint for teacher to set their initial password (after admin creation)
app.put('/teacher/set-initial-password', authenticateTeacherToken, [
    body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters long.')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }


    const { newPassword } = req.body;
    const teacherId = req.teacher.id; // Get teacher ID from the authenticated token


    try {
        const teacher = await Teacher.findById(teacherId);
        if (!teacher) {
            return res.status(404).json({ message: 'Teacher not found.' });
        }


        // Only allow setting initial password if it hasn't been set yet
        if (teacher.isPasswordSet) {
            return res.status(400).json({ message: 'Password already set. Use password reset if you forgot it.' });
        }


        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(newPassword, saltRounds);


        teacher.password = hashedPassword;
        teacher.isPasswordSet = true;
        await teacher.save();


        res.status(200).json({ message: 'Initial password set successfully!' });


    } catch (error) {
        console.error('Error setting initial teacher password:', error);
        res.status(500).json({ message: 'Server error setting password.', error: error.message });
    }
});




// Protected route to get teacher dashboard data.
app.get('/teacher/dashboard', authenticateTeacherToken, async (req, res) => {
    try {
        const teacherData = await Teacher.findById(req.teacher.id).select('-password');


        if (!teacherData) {
            return res.status(404).json({ message: 'Teacher data not found.' });
        }


        res.status(200).json({
            message: `Welcome to your teacher dashboard, ${teacherData.teacherName}!`,
            teacher: {
                teacherName: teacherData.teacherName,
                email: teacherData.email,
                bytes: teacherData.bytes,
                preferences: teacherData.preferences,
                createdAt: teacherData.createdAt,
                isPasswordSet: teacherData.isPasswordSet,
                gender: teacherData.gender, // Include new field
                physicalDescription: teacherData.physicalDescription // Include new field
            }
        });


    } catch (error) {
        console.error('Error accessing teacher dashboard:', error);
        res.status(500).json({ message: 'Server error accessing teacher dashboard.', error: error.message });
    }
});


// NEW: Endpoint to update teacher preferences
app.put('/teacher/preferences', authenticateTeacherToken, [
    body('preferences').isObject().withMessage('Preferences must be an object.'),
    body('preferences.fontSize').optional().isString().withMessage('Font size must be a string.'),
    body('preferences.theme').optional().isString().withMessage('Theme must be a string.'),
    body('preferences.notifications_on').optional().isBoolean().withMessage('Notifications_on must be a boolean.')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }


    const { preferences } = req.body;
    const teacherId = req.teacher.id;


    try {
        const updatedTeacher = await Teacher.findByIdAndUpdate(
            teacherId,
            { $set: { preferences: preferences } },
            { new: true, runValidators: true }
        ).select('-password');


        if (!updatedTeacher) {
            return res.status(404).json({ message: 'Teacher not found.' });
        }


        res.status(200).json({
            message: 'Teacher preferences updated successfully!',
            teacher: {
                teacherName: updatedTeacher.teacherName,
                email: updatedTeacher.email,
                preferences: updatedTeacher.preferences
            }
        });


    } catch (error) {
        console.error('Error updating teacher preferences:', error);
        res.status(500).json({ message: 'Server error updating teacher preferences.', error: error.message });
    }
});




// Endpoint to get the Teacher Leaderboard
app.get('/teacher/leaderboard', async (req, res) => {
    try {
        // Find all teachers, sort by bytes in descending order.
        // Select only necessary fields (full name and bytes).
        const teachers = await Teacher.find({})
            .sort({ bytes: -1 }) // Sort by bytes, highest first
            .select('teacherName bytes') // Select teacher's full name and bytes
            .lean(); // Use .lean() for faster query results


        const teacherLeaderboard = teachers.map(teacher => ({
            name: teacher.teacherName,
            bytes: teacher.bytes // All bytes statuses are seen for everyone
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


// MODIFIED: Endpoint to log in an administrator (now initiates 2FA).
app.post('/login-admin', [
    body('email').isEmail().withMessage('Please provide a valid email address.'),
    body('password').notEmpty().withMessage('Password is required.')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }


    const { email, password } = req.body;


    try {
        const admin = await Administrator.findOne({ email });


        if (!admin) {
            return res.status(401).json({ message: 'Invalid email or password.' });
        }


        const isMatch = await bcrypt.compare(password, admin.password);


        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid email or password.' });
        }


        // --- 2FA Step 1: Generate and Send Code ---
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
            message: 'Admin login successful. A 2FA code has been sent to your email. Please verify it.'
        });


    } catch (error) {
        console.error('Error during admin login (2FA initiation):', error);
        res.status(500).json({ message: 'Server error during admin login.', error: error.message });
    }
});


// NEW: Endpoint for Administrator to verify 2FA code and get JWT.
app.post('/admin/verify-2fa', [
    body('email').isEmail().withMessage('Please provide a valid email address.'),
    body('code').notEmpty().withMessage('2FA code is required.')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }


    const { email, code } = req.body;


    try {        // Find the stored verification code for the given email.
        const storedCode = await VerificationCode.findOne({ email });


        if (!storedCode) {
            return res.status(400).json({ message: 'No 2FA code found for this email, or it has expired.' });
        }


        // Check if the provided code matches the stored code.
        if (storedCode.code === code) {
            // If codes match, find the admin to generate the JWT.
            const admin = await Administrator.findOne({ email });
            if (!admin) {
                return res.status(404).json({ message: 'Administrator not found.' });
            }


            // Delete the verification code after successful use.
            await VerificationCode.deleteOne({ email });


            // Generate JWT for admin
            const token = jwt.sign(
                { id: admin._id, email: admin.email, adminName: admin.adminName, role: 'admin' },
                JWT_SECRET,
                { expiresIn: '1h' }
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




// NEW: Endpoint for Administrator to create a new Teacher account.
// This route is protected by authenticateAdminToken.
app.post('/admin/teachers', authenticateAdminToken, [ // Changed path to /admin/teachers
    body('teacherName').notEmpty().withMessage('Teacher name is required.'),
    body('email').isEmail().withMessage('Please provide a valid email address.'),
    body('initialPassword').isLength({ min: 6 }).withMessage('Initial password must be at least 6 characters long.'),
    body('gender').optional().isIn(['Male', 'Female', 'Other']).withMessage('Gender must be Male, Female, or Other.'), // New validation
    body('physicalDescription').optional().isString().withMessage('Physical description must be a string.') // New validation
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }


    const { teacherName, email, initialPassword, gender, physicalDescription } = req.body; // Destructure new fields


    try {
        const existingTeacher = await Teacher.findOne({ email });
        if (existingTeacher) {
            return res.status(409).json({ message: 'A teacher with this email already exists.' });
        }


        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(initialPassword, saltRounds);


        const newTeacher = new Teacher({
            teacherName,
            email,
            password: hashedPassword,
            bytes: 0, // New teachers start with 0 bytes
            isPasswordSet: false, // Admin creates, teacher sets on first login
            gender, // Assign new field
            physicalDescription // Assign new field
        });


        await newTeacher.save();


        res.status(201).json({
            message: 'Teacher account created successfully by administrator! Teacher needs to set their password on first login.',
            teacher: {
                id: newTeacher._id,
                name: newTeacher.teacherName,
                email: newTeacher.email,
                isPasswordSet: newTeacher.isPasswordSet,
                gender: newTeacher.gender, // Include new field in response
                physicalDescription: newTeacher.physicalDescription // Include new field in response
            }
        });


    } catch (error) {
        console.error('Error creating teacher account by admin:', error);
        res.status(500).json({ message: 'Server error creating teacher account.', error: error.message });
    }
});


// NEW: Endpoint for Administrator to get all teachers.
// This route is protected by authenticateAdminToken.
app.get('/admin/teachers', authenticateAdminToken, async (req, res) => {
    try {
        const teachers = await Teacher.find({}).select('-password'); // Exclude passwords
        res.status(200).json({
            message: 'Teachers fetched successfully.',
            teachers: teachers
        });
    } catch (error) {
        console.error('Error fetching teachers by admin:', error);
        res.status(500).json({ message: 'Server error fetching teachers.', error: error.message });
    }
});


// NEW: Endpoint for Administrator to delete a teacher account.
// This route is protected by authenticateAdminToken.
app.delete('/admin/teachers/:id', authenticateAdminToken, async (req, res) => {
    const teacherIdToDelete = req.params.id;


    try {
        const teacher = await Teacher.findById(teacherIdToDelete);
        if (!teacher) {
            return res.status(404).json({ message: 'Teacher not found.' });
        }


        // --- Step 1: Update uploaded content to retain teacherName but nullify teacherId ---
        // Update WorkFiles
        await WorkFile.updateMany(
            { 'uploadedBy.teacherId': teacherIdToDelete },
            { $set: { 'uploadedBy.teacherId': null } }
        );
        // Update Activities
        await Activity.updateMany(
            { 'uploadedBy.teacherId': teacherIdToDelete },
            { $set: { 'uploadedBy.teacherId': null } }
        );
        // Update QuizQuestions
        await QuizQuestion.updateMany(
            { 'uploadedBy.teacherId': teacherIdToDelete },
            { $set: { 'uploadedBy.teacherId': null } }
        );
        // PreaderGames are now created by students, so no need to update teacherId for them here.


        // --- Step 2: Delete the Teacher document ---
        await Teacher.deleteOne({ _id: teacherIdToDelete });


        res.status(200).json({
            message: `Teacher ${teacher.teacherName} and their associated content references updated/deleted successfully. Content remains attributed by name.`
        });


    } catch (error) {
        console.error('Error deleting teacher account by admin:', error);
        res.status(500).json({ message: 'Server error deleting teacher account.', error: error.message });
    }
});




// NEW: Manual trigger endpoint for yearly student class upgrade and account deletion
// This would ideally be triggered by a cron job in a production environment.
app.post('/admin/trigger-yearly-upgrade', authenticateAdminToken, async (req, res) => {
    try {
        const students = await Student.find({}); // Get all students


        let upgradedCount = 0;
        let deletedCount = 0;


        for (const student of students) {
            const currentClass = student.class.toUpperCase(); // Ensure consistent casing


            if (currentClass === 'S.6' || currentClass === 'SENIOR 6') {
                // Delete account for Senior 6 students
                await Student.deleteOne({ _id: student._id });
                deletedCount++;
                console.log(`Deleted S.6 student: ${student.studentName} (Email: ${student.email})`);
            } else {
                // Upgrade class for other students
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


// Endpoint for Teacher to upload a WorkFile PDF and its associated Activity
// This route will handle multipart/form-data, including the PDF file and JSON data.
app.post(
    '/teacher/upload-content',
    authenticateTeacherToken, // Ensure only authenticated teachers can upload
    upload.single('workFilePdf'), // 'workFilePdf' is the field name for the PDF file in the form
    [
        // --- Validation for WorkFile Metadata ---
        body('workFileTitle')
            .notEmpty().withMessage('WorkFile title is required.')
            .trim()
            .isLength({ min: 3, max: 200 }).withMessage('WorkFile title must be between 3 and 200 characters.'),
        body('workFileDescription')
            .optional()
            .isString().withMessage('WorkFile description must be a string.')
            .trim()
            .isLength({ max: 500 }).withMessage('WorkFile description cannot exceed 500 characters.'),
        body('workFileSubject')
            .notEmpty().withMessage('WorkFile subject is required.')
            .trim()
            .isLength({ min: 2, max: 100 }).withMessage('WorkFile subject must be between 2 and 100 characters.'),
        body('workFileIntendedClass')
            .notEmpty().withMessage('WorkFile intended class is required.')
            .trim()
            .isIn(['S.1', 'S.2', 'S.3', 'S.4', 'S.5', 'S.6']).withMessage('Invalid WorkFile intended class.'),
        body('workFileCostBytes')
            .isInt({ min: 0 }).withMessage('WorkFile cost bytes must be a non-negative integer.')
            .notEmpty().withMessage('WorkFile cost bytes is required.'),
        body('applyDownloadWatermark')
            .optional()
            .isBoolean().withMessage('Apply download watermark must be a boolean value (true/false).'),


        // --- Validation for Activity Data ---
        // Note: activityJson will be a string, so we validate its content after parsing.
        // For now, we only validate its existence. Detailed validation of its parsed content
        // will happen inside the route handler.
        body('activityJson')
            .notEmpty().withMessage('Activity data is required and must be a JSON string.'),


        // We'll parse activityJson inside the route and validate its structure there.
        // For example, validating questions array and its contents:
        // body('activityJson.questions').isArray({ min: 1 }).withMessage('Activity must have at least one question.'),
        // body('activityJson.questions.*.questionText').notEmpty().withMessage('Question text cannot be empty.'),
        // ... and so on. This is harder to do with express-validator on a stringified JSON.
        // So, we'll do this validation *after* JSON.parse inside the try block.
    ],
    async (req, res) => {
        // Check for validation errors from express-validator for initial fields
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }


        // Ensure a file was uploaded
        if (!req.file) {
            return res.status(400).json({ message: 'WorkFile PDF is required.' });
        }


        // Parse the JSON string from the request body for activity data
        let activityData;
        try {
            activityData = JSON.parse(req.body.activityJson);
        } catch (parseError) {
            console.error('Error parsing activity JSON:', parseError);
            return res.status(400).json({ message: 'Invalid activity data format. Must be a valid JSON string.' });
        }


        // --- Additional Validation for Parsed Activity Data ---
        // These validations are done here because express-validator's 'body' directly
        // on 'activityJson.questions' etc. doesn't work well when 'activityJson' is a string.
        if (!activityData.title || typeof activityData.title !== 'string' || activityData.title.trim().length < 3 || activityData.title.trim().length > 200) {
            return res.status(400).json({ message: 'Activity title is required and must be between 3 and 200 characters.' });
        }
        if (activityData.description && (typeof activityData.description !== 'string' || activityData.description.trim().length > 500)) {
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




        // Destructure WorkFile metadata from req.body
        const {
            workFileTitle,
            workFileDescription,
            workFileSubject,
            workFileIntendedClass,
            workFileCostBytes,
            applyDownloadWatermark = true // Default to true if not provided
        } = req.body;


        // Destructure Activity data (from parsed activityData)
        const {
            title: activityTitle, // Renaming to avoid conflict with workFileTitle
            description: activityDescription, // Renaming
            subject: activitySubject, // Renaming
            intendedClass: activityIntendedClass, // Renaming
            questions
        } = activityData;


        // Get teacher info from authenticated token
        const teacherId = req.teacher.id;
        const teacherName = req.teacher.teacherName; // Assuming teacherName is in JWT payload


        let uploadedFileUrl = null; // To store Cloudinary URL
        let workFilePublicId = null; // To store Cloudinary public ID for potential deletion


        // Start a Mongoose session for transactional behavior (if using replica sets)
        // This ensures atomicity: either both WorkFile and Activity are saved, or neither are.
        const session = await mongoose.startSession();
        session.startTransaction();


        try {
            // --- Step 1: Upload WorkFile PDF to Cloudinary ---
            // Generate a unique public ID for the PDF
            workFilePublicId = `schoolbyte/workfiles/${teacherId}/workfile-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;


            // Use a Promise-based approach for upload_stream to await its completion
            const cloudinaryUploadResult = await new Promise((resolve, reject) => {
                const uploadStream = cloudinary.uploader.upload_stream(
                    {
                        resource_type: 'raw', // Important: Treat as a raw file (PDF)
                        public_id: workFilePublicId,
                        folder: `schoolbyte/workfiles/${teacherId}`, // Organize by teacher ID
                        format: 'pdf', // Explicitly set format to PDF
                        // No transformations applied directly on upload, they are done on-the-fly via URL
                    },
                    (error, result) => {
                        if (error) {
                            return reject(new Error(`Cloudinary upload failed: ${error.message}`));
                        }
                        uploadedFileUrl = result.secure_url;
                        resolve(result);
                    }
                );
                uploadStream.end(req.file.buffer); // Upload the file buffer from multer's memory storage
            });




            // --- Step 2: Create WorkFile Document in MongoDB ---
            const newWorkFile = new WorkFile({
                title: workFileTitle,
                description: workFileDescription,
                fileUrl: uploadedFileUrl, // Store the Cloudinary URL
                subject: workFileSubject,
                intendedClass: workFileIntendedClass,
                costBytes: workFileCostBytes,
                uploadedBy: {
                    teacherId: teacherId,
                    teacherName: teacherName
                },
                applyDownloadWatermark: applyDownloadWatermark // Store teacher's preference
                // 'activity' field will be linked after Activity creation
            });
            await newWorkFile.save({ session }); // Save within the transaction


            // --- Step 3: Create Activity Document in MongoDB ---
            const newActivity = new Activity({
                title: activityTitle,
                description: activityDescription,
                subject: activitySubject,
                intendedClass: activityIntendedClass,
                maxBytesReward: 5, // Fixed at 5 bytes as per your requirement
                associatedWorkFile: newWorkFile._id, // Link to the newly created WorkFile
                questions: questions, // Array of questionText and keywordsForMarking
                uploadedBy: {
                    teacherId: teacherId,
                    teacherName: teacherName
                }
            });
            await newActivity.save({ session }); // Save within the transaction


            // --- Step 4: Link Activity ID back to WorkFile ---
            newWorkFile.activity = newActivity._id;
            await newWorkFile.save({ session }); // Update WorkFile with Activity ID within the transaction


            // --- Step 5: Commit the transaction ---
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
            // --- Rollback on Error ---
            await session.abortTransaction(); // Abort the transaction if any error occurs
            console.error('Error during WorkFile/Activity upload transaction:', error);


            // If Cloudinary upload succeeded but DB failed, attempt to delete the Cloudinary file
            if (uploadedFileUrl && workFilePublicId) {
                try {
                    // Cloudinary destroy expects public_id and resource_type
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
            session.endSession(); // End the session
        }
    }
);


// --- Quiz Management Endpoints (Teacher) ---


// 1. Create a New Quiz Question
app.post(
    '/teacher/quiz-questions',
    authenticateTeacherToken,
    [
        body('questionText').notEmpty().withMessage('Question text is required.').trim(),
        body('subject').notEmpty().withMessage('Subject is required.').trim(),
        body('intendedClass').notEmpty().withMessage('Intended class is required.').trim().isIn(['S.1', 'S.2', 'S.3', 'S.4', 'S.5', 'S.6']).withMessage('Invalid intended class.'),
        // Add more specific validations based on 'type' here if needed,
        // or handle within the route logic for conditional fields.
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }


        const {
            questionText, subject, intendedClass, type,
            options, correctAnswers, matchingPairs, orderedItems,
            instructions, hint, maxBytesRewardPerQuestion
        } = req.body;


        const teacherId = req.teacher.id;
        const teacherName = req.teacher.teacherName;


        try {
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
                maxBytesRewardPerQuestion,
                uploadedBy: {
                    teacherId,
                    teacherName
                }
            });


            // Specific validation based on type for required fields
            if (['multiple-choice-single', 'multiple-choice-multi'].includes(type) && (!options || options.length === 0)) {
                return res.status(400).json({ message: 'Options are required for multiple-choice questions.' });
            }
            if (['short-answer', 'true-false', 'fill-in-the-blank', 'problem-solving'].includes(type) && (!correctAnswers || correctAnswers.length === 0)) {
                return res.status(400).json({ message: 'Correct answers are required for this question type.' });
            }
            if (type === 'matching' && (!matchingPairs || matchingPairs.length === 0)) {
                return res.status(400).json({ message: 'Matching pairs are required for matching questions.' });
            }
            if (type === 'ordering' && (!orderedItems || orderedItems.length === 0)) {
                return res.status(400).json({ message: 'Ordered items are required for ordering questions.' });
            }


            await newQuizQuestion.save();


            res.status(201).json({
                message: 'Quiz question created successfully!',
                question: newQuizQuestion
            });


        } catch (error) {
            console.error('Error creating quiz question:', error);
            res.status(500).json({ message: 'Failed to create quiz question.', error: error.message });
        }
    }
);


// 2. Get All Quiz Questions (for a teacher to manage their questions)
// Teachers might want to filter by subject or class
app.get('/teacher/quiz-questions', authenticateTeacherToken, async (req, res) => {
    const teacherId = req.teacher.id;
    const { subject, intendedClass } = req.query; // Allow filtering


    let query = { 'uploadedBy.teacherId': teacherId };
    if (subject) {
        query.subject = subject;
    }
    if (intendedClass) {
        query.intendedClass = intendedClass;
    }


    try {
        const quizQuestions = await QuizQuestion.find(query).sort({ createdAt: -1 });
        res.status(200).json({
            message: 'Quiz questions fetched successfully.',
            questions: quizQuestions
        });
    } catch (error) {
        console.error('Error fetching quiz questions:', error);
        res.status(500).json({ message: 'Failed to fetch quiz questions.', error: error.message });
    }
});


// 3. Get a Single Quiz Question by ID (for editing)
app.get('/teacher/quiz-questions/:id', authenticateTeacherToken, async (req, res) => {
    const { id } = req.params;
    const teacherId = req.teacher.id;


    try {
        const quizQuestion = await QuizQuestion.findOne({ _id: id, 'uploadedBy.teacherId': teacherId });
        if (!quizQuestion) {
            return res.status(404).json({ message: 'Quiz question not found or you do not have permission to view it.' });
        }
        res.status(200).json({
            message: 'Quiz question fetched successfully.',
            question: quizQuestion
        });
    } catch (error) {
        console.error('Error fetching single quiz question:', error);
        res.status(500).json({ message: 'Failed to fetch quiz question.', error: error.message });
    }
});


// 4. Update a Quiz Question by ID
app.put(
    '/teacher/quiz-questions/:id',
    authenticateTeacherToken,
    [
        body('questionText').optional().notEmpty().withMessage('Question text cannot be empty.').trim(),
        body('subject').optional().notEmpty().withMessage('Subject cannot be empty.').trim(),
        body('intendedClass').optional().notEmpty().withMessage('Intended class cannot be empty.').trim().isIn(['S.1', 'S.2', 'S.3', 'S.4', 'S.5', 'S.6']).withMessage('Invalid intended class.'),
        body('type').optional().notEmpty().withMessage('Question type cannot be empty.').isIn([
            'short-answer', 'multiple-choice-single', 'multiple-choice-multi',
            'true-false', 'fill-in-the-blank', 'matching', 'ordering', 'problem-solving'
        ]).withMessage('Invalid question type.'),
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }


        const { id } = req.params;
        const teacherId = req.teacher.id;
        const updateData = req.body;


        try {
            // Ensure the teacher owns the question
            const quizQuestion = await QuizQuestion.findOne({ _id: id, 'uploadedBy.teacherId': teacherId });
            if (!quizQuestion) {
                return res.status(404).json({ message: 'Quiz question not found or you do not have permission to update it.' });
            }


            // Apply updates
            Object.assign(quizQuestion, updateData);


            // Re-validate conditional fields if type is changed or relevant fields are updated
            if (updateData.type || updateData.options || updateData.correctAnswers || updateData.matchingPairs || updateData.orderedItems) {
                const type = quizQuestion.type;
                if (['multiple-choice-single', 'multiple-choice-multi'].includes(type) && (!quizQuestion.options || quizQuestion.options.length === 0)) {
                    return res.status(400).json({ message: 'Options are required for multiple-choice questions.' });
                }
                if (['short-answer', 'true-false', 'fill-in-the-blank', 'problem-solving'].includes(type) && (!quizQuestion.correctAnswers || quizQuestion.correctAnswers.length === 0)) {
                    return res.status(400).json({ message: 'Correct answers are required for this question type.' });
                }
                if (type === 'matching' && (!quizQuestion.matchingPairs || quizQuestion.matchingPairs.length === 0)) {
                    return res.status(400).json({ message: 'Matching pairs are required for matching questions.' });
                }
                if (type === 'ordering' && (!quizQuestion.orderedItems || quizQuestion.orderedItems.length === 0)) {
                    return res.status(400).json({ message: 'Ordered items are required for ordering questions.' });
                }
            }


            await quizQuestion.save(); // Save the updated document


            res.status(200).json({
                message: 'Quiz question updated successfully!',
                question: quizQuestion
            });


        } catch (error) {
            console.error('Error updating quiz question:', error);
            res.status(500).json({ message: 'Failed to update quiz question.', error: error.message });
        }
    }
);


// 5. Delete a Quiz Question by ID
app.delete('/teacher/quiz-questions/:id', authenticateTeacherToken, async (req, res) => {
    const { id } = req.params;
    const teacherId = req.teacher.id;


    try {
        const result = await QuizQuestion.deleteOne({ _id: id, 'uploadedBy.teacherId': teacherId });


        if (result.deletedCount === 0) {
            return res.status(404).json({ message: 'Quiz question not found or you do not have permission to delete it.' });
        }
        res.status(200).json({ message: 'Quiz question deleted successfully.' });
    } catch (error) {
        console.error('Error deleting quiz question:', error);
        res.status(500).json({ message: 'Failed to delete quiz question.', error: error.message });
    }
});


// --- Quiz Endpoints (Student) ---


// 1. Fetch 10 Random Quiz Questions
app.get('/student/quizzes/fetch-random-set', authenticateToken, async (req, res) => {
    const { class: studentClass, subject } = req.query; // Get filter criteria from query params


    try {
        let query = {};
        if (studentClass) {
            query.intendedClass = studentClass;
        }
        if (subject) {
            query.subject = subject;
        }


        // Aggregate pipeline to get 10 random questions
        const randomQuestions = await QuizQuestion.aggregate([
            { $match: query }, // Filter by class/subject if provided
            { $sample: { size: 10 } }, // Select 10 random documents
            {
                $project: { // Project only necessary fields for the student (hide answers)
                    questionText: 1,
                    subject: 1,
                    intendedClass: 1,
                    type: 1,
                    options: {
                        $map: { // For multiple-choice, include text and _id, but not isCorrect
                            input: "$options",
                            as: "option",
                            in: { text: "$$option.text", _id: "$$option._id" }
                        }
                    },
                    matchingPairs: 1, // Include these as they are part of the question setup
                    orderedItems: 1,
                    instructions: 1,
                    hint: 1,
                    uploadedBy: { teacherName: 1 } // Only teacher name
                }
            }
        ]);


        if (randomQuestions.length === 0) {
            return res.status(404).json({ message: 'No quiz questions found matching your criteria.' });
        }


        res.status(200).json({
            message: 'Random quiz questions fetched successfully!',
            questions: randomQuestions
        });


    } catch (error) {
        console.error('Error fetching random quiz questions:', error);
        res.status(500).json({ message: 'Failed to fetch random quiz questions.', error: error.message });
    }
});


// NEW: 2. Submit Quiz Answers and Get Score/Bytes
app.post('/student/quizzes/submit', authenticateToken, [
    body('quizSubmissions').isArray({ min: 1 }).withMessage('Quiz submissions array is required and must not be empty.'),
    body('quizSubmissions.*.questionId').isMongoId().withMessage('Invalid question ID.'),
    // The structure of studentAnswer depends on the question type.
    // For simplicity, we'll allow Mixed and validate content within the route.
    body('quizSubmissions.*.studentAnswer').notEmpty().withMessage('Student answer is required for each question.'),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }


    const { quizSubmissions } = req.body;
    const studentId = req.student.id;


    const session = await mongoose.startSession();
    session.startTransaction();


    try {
        const student = await Student.findById(studentId).session(session);
        if (!student) {
            return res.status(404).json({ message: 'Student not found.' });
        }


        let totalCorrectQuestions = 0;
        let totalAttemptedQuestions = quizSubmissions.length;
        const gradedAnswers = [];


        for (const submission of quizSubmissions) {
            const questionId = submission.questionId;
            const studentAnswer = submission.studentAnswer; // This can be a string, array of IDs, array of objects, etc.


            const quizQuestion = await QuizQuestion.findById(questionId).session(session);
            if (!quizQuestion) {
                console.warn(`Quiz question with ID ${questionId} not found. Skipping.`);
                continue; // Skip if question not found
            }


            let isCorrect = false;


            switch (quizQuestion.type) {
                case 'short-answer':
                case 'problem-solving':
                case 'fill-in-the-blank':
                    // For these types, studentAnswer is a string. Compare against correctAnswers array.
                    if (typeof studentAnswer === 'string') {
                        const normalizedStudentAnswer = studentAnswer.toLowerCase().trim();
                        isCorrect = quizQuestion.correctAnswers.some(correctAns =>
                            normalizedStudentAnswer === correctAns.toLowerCase().trim()
                        );
                    }
                    break;
                case 'true-false':
                    // studentAnswer is a boolean or string "true"/"false"
                    if (typeof studentAnswer === 'boolean' || typeof studentAnswer === 'string') {
                        const normalizedStudentAnswer = String(studentAnswer).toLowerCase();
                        isCorrect = quizQuestion.correctAnswers.some(correctAns =>
                            normalizedStudentAnswer === correctAns.toLowerCase().trim()
                        );
                    }
                    break;
                case 'multiple-choice-single':
                    // studentAnswer is the _id of the chosen option
                    if (typeof studentAnswer === 'string' && mongoose.Types.ObjectId.isValid(studentAnswer)) {
                        isCorrect = quizQuestion.options.some(option =>
                            option._id.toString() === studentAnswer && option.isCorrect
                        );
                    }
                    break;
                case 'multiple-choice-multi':
                    // studentAnswer is an array of _ids of chosen options
                    if (Array.isArray(studentAnswer)) {
                        const correctOptionIds = quizQuestion.options
                            .filter(option => option.isCorrect)
                            .map(option => option._id.toString());
                        const chosenOptionIds = studentAnswer.map(id => id.toString());


                        // Check if all correct options are chosen and no incorrect ones are chosen
                        isCorrect = correctOptionIds.length === chosenOptionIds.length &&
                                    correctOptionIds.every(id => chosenOptionIds.includes(id)) &&
                                    chosenOptionIds.every(id => correctOptionIds.includes(id));
                    }
                    break;
                case 'matching':
                    // studentAnswer is an array of { itemA: string, itemB: string } pairs from student
                    if (Array.isArray(studentAnswer)) {
                        // Normalize and sort both arrays for reliable comparison
                        const normalizedCorrectPairs = quizQuestion.matchingPairs
                            .map(pair => ({ itemA: pair.itemA.toLowerCase().trim(), itemB: pair.itemB.toLowerCase().trim() }))
                            .sort((a, b) => a.itemA.localeCompare(b.itemA));


                        const normalizedStudentPairs = studentAnswer
                            .map(pair => ({ itemA: pair.itemA.toLowerCase().trim(), itemB: pair.itemB.toLowerCase().trim() }))
                            .sort((a, b) => a.itemA.localeCompare(b.itemA));


                        isCorrect = normalizedCorrectPairs.length === normalizedStudentPairs.length &&
                                    normalizedCorrectPairs.every((correctPair, index) =>
                                        correctPair.itemA === normalizedStudentPairs[index].itemA &&
                                        correctPair.itemB === normalizedStudentPairs[index].itemB
                                    );
                    }
                    break;
                case 'ordering':
                    // studentAnswer is an array of strings representing the student's order
                    if (Array.isArray(studentAnswer)) {
                        const normalizedCorrectOrder = quizQuestion.orderedItems.map(item => item.toLowerCase().trim());
                        const normalizedStudentOrder = studentAnswer.map(item => item.toLowerCase().trim());


                        isCorrect = normalizedCorrectOrder.length === normalizedStudentOrder.length &&
                                    normalizedCorrectOrder.every((item, index) => item === normalizedStudentOrder[index]);
                    }
                    break;
                default:
                    console.warn(`Unknown quiz question type: ${quizQuestion.type} for question ID: ${questionId}`);
                    isCorrect = false;
            }


            if (isCorrect) {
                totalCorrectQuestions++;
            }


            gradedAnswers.push({
                questionId: questionId,
                studentAnswer: studentAnswer, // Store the raw student answer
                isCorrect: isCorrect
            });
        }


        // Calculate bytes earned for the quiz session
        const bytesEarned = totalAttemptedQuestions > 0 ?
            Math.round((totalCorrectQuestions / totalAttemptedQuestions) * 10) : 0; // Max 10 bytes


        // Update student's total bytes
        student.bytes += bytesEarned;
        await student.save({ session });


        // Create a new StudentActivitySubmission for this quiz session
        const newQuizSubmission = new StudentActivitySubmission({
            student: studentId,
            quizQuestion: null, // This is a quiz session, not a single quizQuestion
            answers: gradedAnswers, // Store the detailed graded answers
            score: (totalCorrectQuestions / totalAttemptedQuestions) * 100, // Percentage score
            bytesEarned: bytesEarned,
            attemptNumber: 1, // For quizzes, each submission is a new "session"
            attemptType: 'initial', // Quizzes are always initial attempts for bytes
            isGraded: true, // Quizzes are auto-graded
        });
        await newQuizSubmission.save({ session });


        await session.commitTransaction();


        res.status(200).json({
            message: 'Quiz submitted and graded successfully!',
            totalCorrectQuestions,
            totalAttemptedQuestions,
            score: newQuizSubmission.score,
            bytesEarned: bytesEarned,
            studentCurrentBytes: student.bytes,
            gradedAnswers: gradedAnswers // Provide detailed feedback
        });


    } catch (error) {
        await session.abortTransaction();
        console.error('Error submitting quiz:', error);
        res.status(500).json({ message: 'Failed to submit quiz. Please try again.', error: error.message });
    } finally {
        session.endSession();
    }
});




// --- Preader Game Endpoints (Student-Facing) ---


// 1. Start a New Preader Game Session
app.post('/student/preader-games/start', authenticateToken, [
    body('gameTitle').notEmpty().withMessage('Game title is required.').trim().isLength({ min: 3, max: 200 }),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }


    const { gameTitle } = req.body;
    const studentId = req.student.id;
    // const studentName = req.student.studentName; // studentName not used here, removed to avoid lint warning


    const session = await mongoose.startSession();
    session.startTransaction();


    try {
        const student = await Student.findById(studentId).session(session);
        if (!student) {
            await session.abortTransaction();
            return res.status(404).json({ message: 'Student not found.' });
        }
        const studentClass = student.class;


        // Initial game state for the AI
        const initialGameState = {
            playerStats: {
                life: 20, mana: 20, morale: 20, reputation: 0,
                discipline: 50, knowledge: 0, stress: 0, luck: 10
            },
            currentEthicalScore: 0,
            pathTaken: []
        };


        // Generate the initial story content using AI
        const initialPromptContent = `Start an interactive story based on the title: "${gameTitle}".`;
        const aiGeneratedContent = await generateStoryNode(
            initialPromptContent,
            initialGameState,
            studentClass,
            null, // No previous scene
            null  // No chosen option
        );


        // Create a new PreaderGameSession document
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
                choiceTextMade: null, // Initial scene has no choice leading to it
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


// 2. Make a Choice and Get Next Story Segment
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


        // Validate choice index
        if (choiceIndex < 0 || choiceIndex >= gameSession.currentChoices.length) {
            await session.abortTransaction();
            return res.status(400).json({ message: 'Invalid choice index.' });
        }


        const chosenOption = gameSession.currentChoices[choiceIndex];


        // Apply stat changes and ethical impact
        const newPlayerStats = applyStatChanges(gameSession.playerStats, chosenOption.statChanges);
        const newEthicalScore = gameSession.currentEthicalScore + chosenOption.ethicalImpact.scoreChange;
        const bytesEarnedThisTurn = chosenOption.bytesAwarded || 1; // Default to 1 byte if not specified by AI


        // Update game session state
        gameSession.playerStats = newPlayerStats;
        gameSession.currentEthicalScore = newEthicalScore;
        gameSession.totalBytesEarnedInSession += bytesEarnedThisTurn;


        // Add to pathTaken
        gameSession.pathTaken.push({
            sceneContent: gameSession.currentSceneContent, // The scene *before* this choice
            choiceTextMade: chosenOption.choiceText,
            bytesEarnedThisTurn: bytesEarnedThisTurn,
            playerStatsSnapshot: newPlayerStats, // Snapshot *after* changes
            ethicalScoreSnapshot: newEthicalScore,
            timestamp: Date.now()
        });


        // Generate the next story segment using AI
        const nextScenePromptContent = `The player chose "${chosenOption.choiceText}". Continue the story from the previous scene: "${gameSession.currentSceneContent}".`;
        const aiGeneratedContent = await generateStoryNode(
            nextScenePromptContent,
            { playerStats: newPlayerStats, currentEthicalScore: newEthicalScore, pathTaken: gameSession.pathTaken },
            studentClass,
            gameSession.currentSceneContent, // Pass previous scene content
            chosenOption.choiceText // Pass chosen option text
        );


        // Update current scene and choices in the session
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


// 3. End a Preader Game Session
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
        const durationMinutes = Math.round((endTime - gameSession.startTime.getTime()) / (1000 * 60)); // Duration in minutes


        // Sum up total bytes earned from pathTaken (each choice's bytesAwarded)
        // This is already accumulated in gameSession.totalBytesEarnedInSession
        const totalBytesEarned = gameSession.totalBytesEarnedInSession;


        // Update student's total bytes
        student.bytes += totalBytesEarned;
        student.totalPreaderGameTimeMinutes += durationMinutes;
        await student.save({ session });


        // Create a log entry for the completed session
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


        // Delete the temporary PreaderGameSession
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


// 4. Get Student's Preader Game Session History (for profile)
app.get('/student/preader-games/history', authenticateToken, async (req, res) => {
    const studentId = req.student.id;


    try {
        const history = await PreaderGameSessionLog.find({ student: studentId })
                                                    .sort({ createdAt: -1 }) // Latest first
                                                    .select('-student -_id -__v'); // Exclude sensitive/unnecessary fields


        res.status(200).json({
            message: 'Preader Game session history fetched successfully!',
            history: history
        });
    } catch (error) {
        console.error('Error fetching Preader Game history:', error);
        res.status(500).json({ message: 'Failed to fetch Preader Game history.', error: error.message });
    }
});




// Start the server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
