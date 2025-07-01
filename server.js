// Ensure you have these imports at the top of your server.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const nodemailer = require('nodemailer'); // For email sending
const bcrypt = require('bcrypt'); // For password hashing

const app = express();
const PORT = 3000; // Or whatever port Replit assigns, usually handled by process.env.PORT

// Middleware
app.use(cors());
app.use(express.json()); // For parsing application/json bodies
app.use(express.static('public')); // Serve static files from 'public' directory

// --- MongoDB Connection ---
const MONGODB_URI = process.env.MONGODB_URI; // Make sure this is set in Replit Secrets

mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('MongoDB connected successfully'))
    .catch(err => console.error('MongoDB connection error:', err));

// --- Mongoose Schema and Model for Verification Codes ---
const verificationCodeSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    code: { type: String, required: true },
    createdAt: { type: Date, default: Date.now, expires: '10m' } // Code expires in 10 minutes
});
const VerificationCode = mongoose.model('VerificationCode', verificationCodeSchema);

// --- Mongoose Schema and Model for Students ---
const studentSchema = new mongoose.Schema({
    studentName: { type: String, required: true },
    indexNumber: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true }, // Store hashed password
    createdAt: { type: Date, default: Date.now }
});
const Student = mongoose.model('Student', studentSchema);

// --- Nodemailer Transporter Setup ---
const transporter = nodemailer.createTransport({
    service: 'gmail', // or your email service
    auth: {
        user: process.env.EMAIL_USER, // Your Gmail address (from Replit Secrets)
        pass: process.env.EMAIL_PASS  // Your App Password (from Replit Secrets)
    }
});

// --- API Endpoints ---

// Endpoint to send verification code (for signup)
app.post('/send-verification-code', async (req, res) => {
    const { email } = req.body;
    if (!email) {
        return res.status(400).json({ message: 'Email is required.' });
    }

    try {
        // Generate a 6-digit verification code
        const code = Math.floor(100000 + Math.random() * 900000).toString();

        // Save or update the code in the database
        await VerificationCode.findOneAndUpdate(
            { email },
            { code, createdAt: Date.now() },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        // Email options
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'SchoolByte Email Verification Code',
            html: `<p>Your SchoolByte verification code is: <strong>${code}</strong></p><p>This code is valid for 10 minutes.</p>`
        };

        // Send email
        await transporter.sendMail(mailOptions);
        res.status(200).json({ message: 'Verification code sent to your email.' });

    } catch (error) {
        console.error('Error sending verification email:', error);
        res.status(500).json({ message: 'Failed to send verification code.', error: error.message });
    }
});

// Endpoint to verify code (for signup)
app.post('/verify-code', async (req, res) => {
    const { email, code } = req.body;
    if (!email || !code) {
        return res.status(400).json({ message: 'Email and verification code are required.' });
    }

    try {
        const storedCode = await VerificationCode.findOne({ email });

        if (!storedCode) {
            return res.status(400).json({ message: 'No verification code found for this email.', verified: false });
        }

        // Check if code matches and is not expired (Mongoose's `expires` handles actual deletion)
        if (storedCode.code === code) {
            // Optional: Delete the code after successful verification to prevent reuse
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

// Endpoint to register a new student (for signup)
app.post('/register-student', async (req, res) => {
    const { studentName, indexNumber, email, password } = req.body;

    // 1. Basic Validation
    if (!studentName || !indexNumber || !email || !password) {
        return res.status(400).json({ message: 'All fields are required.' });
    }

    try {
        // 2. Check if student already exists (by email or indexNumber)
        const existingStudent = await Student.findOne({ $or: [{ email }, { indexNumber }] });
        if (existingStudent) {
            return res.status(409).json({ message: 'Student with this email or index number already exists.' });
        }

        // 3. Hash the password
        const saltRounds = 10; // Recommended salt rounds for bcrypt
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // 4. Create new student instance
        const newStudent = new Student({
            studentName,
            indexNumber,
            email,
            password: hashedPassword // Save the hashed password
        });

        // 5. Save student to database
        await newStudent.save();

        res.status(201).json({ message: 'Student registered successfully!', student: { name: studentName, email: email } });

    } catch (error) {
        console.error('Error during student registration:', error);
        // Handle specific Mongoose validation errors if needed
        if (error.code === 11000) { // Duplicate key error
            return res.status(409).json({ message: 'A student with this email or index number already exists.' });
        }
        res.status(500).json({ message: 'Server error during registration.', error: error.message });
    }
});

// NEW: Endpoint for student login
app.post('/login-student', async (req, res) => {
    const { email, password } = req.body;

    // 1. Basic validation
    if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required.' });
    }

    try {
        // 2. Find student by email
        const student = await Student.findOne({ email });

        if (!student) {
            // User not found
            return res.status(401).json({ message: 'Invalid email or password.' });
        }

        // 3. Compare provided password with hashed password in database
        const isMatch = await bcrypt.compare(password, student.password);

        if (!isMatch) {
            // Passwords do not match
            return res.status(401).json({ message: 'Invalid email or password.' });
        }

        // 4. Successful login
        // In a real application, you would generate a JWT (JSON Web Token) here
        // and send it back to the client for session management.
        // For now, we'll just send a success message and student's name.
        res.status(200).json({ 
            message: 'Login successful!', 
            student: { 
                studentName: student.studentName,
                email: student.email 
            } 
        });

    } catch (error) {
        console.error('Error during student login:', error);
        res.status(500).json({ message: 'Server error during login.', error: error.message });
    }
});

// Endpoint to get student dashboard data
app.get('/student-dashboard-data', async (req, res) => {
    const { email } = req.query;

    if (!email) {
        return res.status(400).json({ message: 'Email is required.' });
    }

    try {
        const student = await Student.findOne({ email });

        if (!student) {
            return res.status(404).json({ message: 'Student not found.' });
        }

        // Return student data with some default values for fields not in database
        res.status(200).json({
            message: 'Student data retrieved successfully',
            student: {
                studentName: student.studentName,
                indexNumber: student.indexNumber,
                email: student.email,
                class: 'S.4', // Default class - you can modify this
                stream: 'Science', // Default stream - you can modify this
                classTeacher: 'Mr. Smith', // Default teacher - you can modify this
                bytes: 150 // Default bytes - you can modify this
            }
        });

    } catch (error) {
        console.error('Error fetching student dashboard data:', error);
        res.status(500).json({ message: 'Server error fetching student data.', error: error.message });
    }
});


// Start the server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
