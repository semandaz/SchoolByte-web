// Ensure you have these imports at the top of your server.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const nodemailer = require('nodemailer');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken'); // NEW: For JSON Web Tokens
const { body, validationResult } = require('express-validator'); // NEW: For input validation
const helmet = require('helmet'); // NEW: For security headers
const morgan = require('morgan'); // NEW: For logging HTTP requests

const app = express();
const PORT = process.env.PORT || 3000; // Use process.env.PORT for Replit

// --- Middleware ---
app.use(cors());
app.use(express.json()); // For parsing application/json bodies
app.use(express.static('public')); // Serve static files from 'public' directory

// NEW: Security middleware (Helmet) - Helps secure your app by setting various HTTP headers.
app.use(helmet());

// NEW: Request logging middleware (Morgan) - Logs HTTP requests to the console.
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
    isEmailVerified: { type: Boolean, default: false }, // NEW: Tracks if email is verified
    bytes: { type: Number, default: 0 }, // Added bytes field with default
    createdAt: { type: Date, default: Date.now }
});
const Student = mongoose.model('Student', studentSchema);

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
        req.student = decoded;
        next(); // Proceed to the next middleware or route handler.
    });
};


// --- API Endpoints ---

// Endpoint to send verification code to a student's email.
app.post('/send-verification-code', [
    // Validate that the 'email' field is present and is a valid email format.
    body('email').isEmail().withMessage('Please provide a valid email address.')
], async (req, res) => {
    // Check for validation errors from express-validator.
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
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long.')
], async (req, res) => {
    // Check for validation errors from express-validator.
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { studentName, indexNumber, email, password } = req.body;

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
            bytes: 0 // Initialize bytes for new students
        });

        // Save the new student to the database.
        await newStudent.save();

        res.status(201).json({
            message: 'Student registered successfully! Please verify your email to log in.', // This message will still display, but login won't enforce it.
            student: {
                name: studentName,
                email: email
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

        // --- PREVIOUS EMAIL VERIFICATION CHECK (COMMENTED OUT) ---
        // if (!student.isEmailVerified) {
        //     return res.status(403).json({ message: 'Please verify your email address before logging in.' });
        // }
        // --- END OF COMMENTED OUT SECTION ---

        // Compare the provided password with the hashed password stored in the database.
        const isMatch = await bcrypt.compare(password, student.password);

        // If passwords do not match, return a generic error.
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid email or password.' });
        }

        // If login is successful, generate a JSON Web Token (JWT).
        // The token payload contains non-sensitive user information.
        const token = jwt.sign(
            { id: student._id, email: student.email, studentName: student.studentName, indexNumber: student.indexNumber },
            JWT_SECRET, // The secret key used to sign the token.
            { expiresIn: '1h' } // The token will expire in 1 hour.
        );

        res.status(200).json({
            message: 'Login successful!',
            token: token, // Send the JWT back to the client.
            student: {
                studentName: student.studentName, // Corrected: Use studentName here
                email: student.email
            }
        });

    } catch (error) {
        console.error('Error during student login:', error);
        res.status(500).json({ message: 'Server error during login.', error: error.message });
    }
});

// NEW: Example of a protected route.
// This route can only be accessed by authenticated users who provide a valid JWT.
app.get('/student/dashboard', authenticateToken, async (req, res) => {
    try {
        // 'req.student' contains the decoded payload from the JWT (id, email, studentName, indexNumber).
        // You can use 'req.student.id' to fetch more detailed data from the database if needed.
        // We select all fields except password, including 'bytes' which is now in the schema.
        const studentData = await Student.findById(req.student.id).select('-password');

        if (!studentData) {
            return res.status(404).json({ message: 'Student data not found.' });
        }

        res.status(200).json({
            message: `Welcome to your dashboard, ${studentData.studentName}!`,
            student: {
                studentName: studentData.studentName, // CORRECTED: This now matches frontend expectation
                email: studentData.email,
                indexNumber: studentData.indexNumber,
                isEmailVerified: studentData.isEmailVerified,
                bytes: studentData.bytes || 0, // ADDED: Ensure bytes are sent
                createdAt: studentData.createdAt
                // Add any other non-sensitive student data you want to display on the dashboard.
            }
        });

    } catch (error) {
        console.error('Error accessing student dashboard:', error);
        res.status(500).json({ message: 'Server error accessing dashboard.', error: error.message });
    }
});

// NEW: Global Error Handling Middleware.
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