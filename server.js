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
    classTeacher: { type: String, default: '' }, // Added for profile
    class: { type: String, default: '' },       // Added for profile
    stream: { type: String, default: '' },      // Added for profile
    bytes: { type: Number, default: 0 },        // Added for dashboard progress
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
        if (storedCode.code === code) {
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
    if (!studentName || !indexNumber || !email || !password) {
        return res.status(400).json({ message: 'All fields are required.' });
    }

    try {
        const existingStudent = await Student.findOne({ $or: [{ email }, { indexNumber }] });
        if (existingStudent) {
            return res.status(409).json({ message: 'Student with this email or index number already exists.' });
        }
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);
        const newStudent = new Student({
            studentName,
            indexNumber,
            email,
            password: hashedPassword,
            bytes: 0
        });
        await newStudent.save();
        res.status(201).json({ message: 'Student registered successfully!', student: { name: studentName, email: email } });

    } catch (error) {
        console.error('Error during student registration:', error);
        if (error.code === 11000) {
            return res.status(409).json({ message: 'A student with this email or index number already exists.' });
        }
        res.status(500).json({ message: 'Server error during registration.', error: error.message });
    }
});

// Endpoint for student login
app.post('/login-student', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required.' });
    }

    try {
        const student = await Student.findOne({ email });
        if (!student) {
            return res.status(401).json({ message: 'Invalid email or password.' });
        }
        const isMatch = await bcrypt.compare(password, student.password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid email or password.' });
        }
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

// Endpoint to fetch student data for dashboard/profile
app.get('/student-dashboard-data', async (req, res) => {
    const { email } = req.query;
    if (!email) {
        return res.status(400).json({ message: 'Email query parameter is required.' });
    }

    try {
        const student = await Student.findOne({ email }).select('-password');

        if (!student) {
            return res.status(404).json({ message: 'Student not found.' });
        }

        res.status(200).json({ message: 'Student data retrieved successfully.', student });

    } catch (error) {
        console.error('Error fetching student dashboard data:', error);
        res.status(500).json({ message: 'Server error fetching student data.', error: error.message });
    }
});

// NEW: Endpoint to update student profile
app.put('/update-student-profile', async (req, res) => {
    const { email } = req.query; // Get email from query parameter
    const { studentName, indexNumber, classTeacher, class: studentClass, stream, currentPassword, newPassword } = req.body;

    if (!email) {
        return res.status(400).json({ message: 'Email query parameter is required for update.' });
    }

    try {
        const student = await Student.findOne({ email });

        if (!student) {
            return res.status(404).json({ message: 'Student not found.' });
        }

        // Handle password change if newPassword is provided
        if (newPassword) {
            if (!currentPassword) {
                return res.status(400).json({ message: 'Current password is required to set a new password.' });
            }
            const isMatch = await bcrypt.compare(currentPassword, student.password);
            if (!isMatch) {
                return res.status(401).json({ message: 'Current password is incorrect.' });
            }
            // Hash the new password
            const saltRounds = 10;
            student.password = await bcrypt.hash(newPassword, saltRounds);
        }

        // Update other profile fields
        student.studentName = studentName || student.studentName; // Only update if provided
        student.indexNumber = indexNumber || student.indexNumber;
        student.classTeacher = classTeacher !== undefined ? classTeacher : student.classTeacher; // Allow empty string
        student.class = studentClass !== undefined ? studentClass : student.class;
        student.stream = stream !== undefined ? stream : student.stream;

        await student.save();

        // Respond with updated (non-sensitive) student data
        const updatedStudent = student.toObject();
        delete updatedStudent.password; // Remove password before sending back

        res.status(200).json({ 
            message: 'Profile updated successfully!', 
            student: updatedStudent 
        });

    } catch (error) {
        console.error('Error updating student profile:', error);
        res.status(500).json({ message: 'Server error updating profile.', error: error.message });
    }
});


// Start the server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
