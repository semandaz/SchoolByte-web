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

const app = express();
const PORT = process.env.PORT || 3000; // Use process.env.PORT for Replit

// --- Middleware ---
app.use(cors());
app.use(express.json()); // For parsing application/json bodies
app.use(express.static('public')); // Serve static files from 'public' directory

// Security middleware (Helmet) - Helps secure your app by setting various HTTP headers.
app.use(helmet());

// Request logging middleware (Morgan) - Logs HTTP requests to the console.
// 'dev' format gives concise, color-coded output for development.
app.use(morgan('dev'));

// --- MongoDB Connection ---
// MONGODB_URI should be set in Replit Secrets.
const MONGODB_URI = process.env.MONGODB_URI;

mongoose.connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    // useCreateIndex: true // This option is no longer needed/supported in Mongoose 6+
})
    .then(() => console.log('MongoDB connected successfully'))
    .catch(err => console.error('MongoDB connection error:', err));

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

    // For font preferences and other settings
    preferences: {
        type: Object, // This allows for flexible key-value pairs
        default: {
            fontSize: "medium", // Default font size preference
            theme: "light",     // Default theme preference (e.g., 'light', 'dark')
            notifications_on: true // Default notification preference
        }
    }
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
        teacherName: { type: String, required: true } // Always retains the name
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
            return ['short-answer', 'true-false', 'problem-solving'].includes(this.type) || (this.type === 'fill-in-the-blank' && this.correctAnswers && this.correctAnswers.length > 0);
        },
        validate: {
            validator: function(v) {
                // Ensure that if it's required, it's not an empty array
                return !this.correctAnswers || v.length > 0;
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
                return !this.orderedItems || v.length > 0;
            },
            message: 'Ordering questions must have at least one item.'
        }
    },

    // General instructions for answering this specific question (e.g., "Select the best option", "Round to two decimal places")
    instructions: { type: String, trim: true },
    hint: { type: String, trim: true }, // Optional hint for the student

    // The contribution this single question makes to the total quiz bytes.
    // For a 10-question quiz awarding a max of 5 bytes, each question would be 0.5 bytes.
    maxBytesRewardPerQuestion: { type: Number, required: true, default: 0.5, min: 0 },

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

// --- Mongoose Schema and Model for PreaderGame (Template for interactive stories) ---
const preaderGameSchema = new mongoose.Schema({
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    subject: { type: String, trim: true, default: 'Life Skills' }, // Or 'Ethics', 'General'
    maxBytesReward: { type: Number, required: true, default: 10, min: 0 }, // Total bytes for successful completion

    // Initial stats for a new game session
    initialStats: {
        life: { type: Number, required: true, default: 100 },
        morale: { type: Number, required: true, default: 50 },
        mana: { type: Number, required: true, default: 50 },
        // Add other stats as needed
    },

    // The initial prompt/seed for the AI to start generating the game narrative
    gamePrompt: { type: String, required: true, trim: true },

    // MODIFIED: Store both teacherId and teacherName for persistence
    uploadedBy: {
        teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher', default: null },
        teacherName: { type: String, required: true }
    },
    isFeatured: { type: Boolean, default: false },
    featuredUntil: { type: Date, required: function() { return this.isFeatured; } }, // Only required if isFeatured is true
    createdAt: { type: Date, default: Date.now }
});
const PreaderGame = mongoose.model('PreaderGame', preaderGameSchema);

// --- Mongoose Schema and Model for PreaderGameSession (Student's active playthrough) ---
const preaderGameSessionSchema = new mongoose.Schema({
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    game: { type: mongoose.Schema.Types.ObjectId, ref: 'PreaderGame', required: true },

    // Current state of the student's stats in the game
    currentStats: {
        life: { type: Number, default: 100 },
        morale: { type: Number, default: 50 },
        mana: { type: Number, default: 50 },
        // Ensure this matches initialStats in PreaderGame
    },

    // To track the narrative flow generated by AI
    // Each entry could represent a scene and the choice made to get to the next scene
    // This might get complex; for now, let's simplify to just tracking the path
    // For AI-driven games, we might not store *all* scenes, but rather the path taken.
    pathTaken: [
        {
            sceneText: { type: String }, // The text of the scene displayed
            choiceMade: { type: String }, // The choice the student selected
            ethicalScoreImpact: { type: Number }, // Ethical score for this choice
            timestamp: { type: Date, default: Date.now }
        }
    ],

    // Total ethical score accumulated during the game
    totalEthicalScore: { type: Number, default: 0 },

    isCompleted: { type: Boolean, default: false }, // True if student reached the end of the narrative
    status: { type: String, enum: ['playing', 'completed', 'failed'], default: 'playing' }, // 'failed' if life=0
    bytesEarned: { type: Number, default: 0 }, // Bytes awarded at the end of the session

    startedAt: { type: Date, default: Date.now },
    lastUpdated: { type: Date, default: Date.now }
});
const PreaderGameSession = mongoose.model('PreaderGameSession', preaderGameSessionSchema);

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
    // For activities, we might need a flag if it's manually reviewed vs auto-graded
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


// --- Nodemailer Transporter Setup ---
// Configures email sending service. EMAIL_USER and EMAIL_PASS must be in Replit Secrets.
const transporter = nodemailer.createTransport({
    service: 'gmail', // You can change this to your email service (e.g., 'Outlook', 'SendGrid')
    auth: {
        user: process.env.EMAIL_USER, // Your email address
        pass: process.env.EMAIL_PASS // Your email app password (for Gmail, this is crucial)
    }
});

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
console.log('Cloudinary configured successfully.');

// --- Multer Storage Configuration ---
// We'll use memory storage for Multer, then upload to Cloudinary directly from memory.
const upload = multer({ storage: multer.memoryStorage() });


// --- Middleware to verify JWT (protect routes) ---
// This function will be used on routes that require authentication.
const authenticateToken = (req, res, next) => {
    // Get the authorization header from the request.
    const authHeader = req.headers['authorization'];
    // The token is typically sent as "Bearer YOUR_TOKEN_STRING".
    const token = authHeader && authHeader.split(' ')[1];

    // If no token is provided, deny access.
    if (!token) {
        return res.status(401).json({ message: 'Access Denied: No authentication token provided.' });
    }

    // Verify the token using the JWT_SECRET.
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
            // If verification fails (e.g., token is invalid, expired, or malformed), deny access.
            console.error('JWT verification error:', err.message);
            return res.status(403).json({ message: 'Access Denied: Invalid or expired token.' });
        }
        // If the token is valid, attach the decoded payload (containing user info) to the request object.
        // This makes user data available to subsequent middleware and route handlers.
        req.student = decoded; // For student tokens
        next(); // Proceed to the next middleware or route handler.
    });
};

// NEW: Middleware to verify JWT for Teachers
const authenticateTeacherToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'Access Denied: No authentication token provided.' });
    }

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
            console.error('Teacher JWT verification error:', err.message);
            return res.status(403).json({ message: 'Access Denied: Invalid or expired teacher token.' });
        }
        req.teacher = decoded; // Attach decoded teacher info to the request
        next();
    });
};

// NEW: Middleware to verify JWT for Administrators
const authenticateAdminToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'Access Denied: No authentication token provided.' });
    }

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
            console.error('Admin JWT verification error:', err.message);
            return res.status(403).json({ message: 'Access Denied: Invalid or expired admin token.' });
        }
        // Ensure the token payload indicates an admin role if you have roles
        // For simplicity, we're assuming anyone with a valid admin token is an admin
        req.admin = decoded; // Attach decoded admin info to the request
        next();
    });
};


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

        // RE-ENABLED: Email verification check. Student must verify email to log in.
        if (!student.isEmailVerified) {
            return res.status(403).json({ message: 'Please verify your email address before logging in.' });
        }

        // Compare the provided password with the hashed password stored in the database.
        const isMatch = await bcrypt.compare(password, student.password);

        // If passwords do not match, return a generic error.
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
                preferences: studentData.preferences, // Include preferences
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
    body('preferences.notifications_on').optional().isBoolean().withMessage('Notifications_on must be a boolean.')
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

// NEW: Endpoint to log in an administrator.
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

        // Generate JWT for admin
        const token = jwt.sign(
            { id: admin._id, email: admin.email, adminName: admin.adminName, role: 'admin' }, // Added role for clarity
            JWT_SECRET,
            { expiresIn: '1h' }
        );

        res.status(200).json({
            message: 'Admin login successful!',
            token: token,
            admin: {
                adminName: admin.adminName,
                email: admin.email
            }
        });

    } catch (error) {
        console.error('Error during admin login:', error);
        res.status(500).json({ message: 'Server error during admin login.', error: error.message });
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
        // Update PreaderGames
        await PreaderGame.updateMany(
            { 'uploadedBy.teacherId': teacherIdToDelete },
            { $set: { 'uploadedBy.teacherId': null } }
        );

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

// Add this endpoint after your existing teacher routes, e.g., after app.put('/teacher/preferences', ...)

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


// Global Error Handling Middleware.
// This middleware should be placed at the very end of your middleware stack.
// It catches any errors that occur in your routes or other middleware.
app.use((err, req, res, next) => {
    console.error(err.stack); // Log the full error stack to the console for debugging.
    // Send a generic error response to the client.
    res.status(err.statusCode || 500).json({
        message: err.message || 'An unexpected error occurred on the server.',
        status: err.statusCode || 500,
    });
});


// Start the server and listen for incoming requests.
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
