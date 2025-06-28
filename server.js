// server.js (Updated with MongoDB using Mongoose, and Student Registration)

// Import necessary modules
const express = require("express"); // Express.js framework
const bodyParser = require("body-parser"); // Middleware to parse incoming request bodies (like JSON)
const nodemailer = require("nodemailer"); // Library for sending emails
const mongoose = require("mongoose"); // Mongoose for MongoDB interaction
const bcrypt = require("bcrypt"); // For password hashing
require("dotenv").config(); // Loads environment variables from a .env file for security

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000; // Define the port, use 3000 by default

// --- Middleware Setup ---
app.use(express.static("public")); // Serve static files from the 'public' directory (your HTML, CSS, JS)
app.use(bodyParser.json()); // Parse JSON request bodies

// --- MongoDB Connection Setup ---
// Use the MONGODB_URI environment variable (from Replit Secrets)
const DB_URI = process.env.MONGODB_URI;

mongoose
    .connect(DB_URI)
    .then(() => console.log("Successfully connected to MongoDB!"))
    .catch((err) => console.error("MongoDB connection error:", err));

// --- Define MongoDB Schemas and Models ---

// Schema for Verification Codes (existing)
const verificationCodeSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true, // Each email should only have one active code
    },
    code: {
        type: String,
        required: true,
    },
    createdAt: {
        type: Date,
        default: Date.now,
        // Automatically delete the document after 10 minutes (600 seconds)
        // This relies on MongoDB's TTL (Time-To-Live) index.
        expires: 600, // 600 seconds = 10 minutes
    },
});

// Create a Mongoose Model from the schema. This represents the 'verificationcodes' collection in MongoDB.
const VerificationCode = mongoose.model("VerificationCode", verificationCodeSchema);

// NEW: Schema for Students
const studentSchema = new mongoose.Schema({
    studentName: {
        type: String,
        required: true,
        trim: true // Removes whitespace from both ends of a string
    },
    indexNumber: {
        type: String,
        required: true,
        unique: true, // Index numbers should be unique
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true, // Emails should be unique
        lowercase: true, // Store emails in lowercase
        trim: true
    },
    passwordHash: { // Stores the hashed password, NOT the plain text password
        type: String,
        required: true
    },
    // You can add more fields here like:
    // courses: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Course' }],
    // registrationDate: { type: Date, default: Date.now }
});

// Create a Mongoose Model for Students
const Student = mongoose.model("Student", studentSchema);


// --- Nodemailer Transporter Setup ---
const transporter = nodemailer.createTransport({
    service: "gmail", // Using Gmail SMTP. Remember to use an App password!
    auth: {
        user: process.env.EMAIL_USER, // Your email address (e.g., from your .env file)
        pass: process.env.EMAIL_PASS, // Your application-specific password (from your .env file)
    },
});

// --- API Endpoints (Routes) ---

/**
 * POST /send-verification-code
 * Handles requests to generate and send a verification code to a user's email.
 */
app.post("/send-verification-code", async (req, res) => {
    const { email } = req.body; // Extract email from the request body

    // Input validation: Check if email is provided
    if (!email) {
        return res.status(400).json({ message: "Email address is required." });
    }

    // Generate a random 6-digit verification code
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    try {
        // Try to find if a code already exists for this email
        let existingCodeEntry = await VerificationCode.findOne({
            email: email,
        });

        if (existingCodeEntry) {
            // If exists, update it with the new code and reset the expiration
            existingCodeEntry.code = code;
            existingCodeEntry.createdAt = Date.now(); // Resets the TTL expiration
            await existingCodeEntry.save();
            console.log(`Updated code for ${email} to ${code}`);
        } else {
            // If not, create a new entry
            const newCodeEntry = new VerificationCode({
                email: email,
                code: code,
            });
            await newCodeEntry.save();
            console.log(`Saved new code ${code} for ${email}`);
        }

        // Send the email
        const mailOptions = {
            from: process.env.EMAIL_USER, // Sender email address
            to: email, // Recipient email address
            subject: "Your SchoolByte Verification Code", // Email subject
            text: `Your verification code is: ${code}. This code is valid for 10 minutes.`, // Plain text body
            html: `<p>Your verification code is: <strong>${code}</strong></p>
                   <p>This code is valid for 10 minutes. Please do not share it with anyone.</p>`, // HTML body
        };

        await transporter.sendMail(mailOptions);
        res.status(200).json({
            message: "Verification code sent to your email! Please check your inbox.",
        });
    } catch (error) {
        console.error("Error in send-verification-code:", error);
        // Check for specific MongoDB duplicate key error if unique index is violated before `findOne`
        if (error.code === 11000) {
            // MongoDB duplicate key error code
            return res
                .status(500)
                .json({
                    message:
                        "A verification request is already in progress for this email. Please wait a moment or try verifying.",
                });
        }
        res.status(500).json({
            message: "Failed to send verification code. Please try again.",
        });
    }
});

/**
 * POST /verify-code
 * Handles requests to verify a submitted code against the stored code.
 */
app.post("/verify-code", async (req, res) => {
    const { email, code } = req.body; // Extract email and code from request body

    if (!email || !code) {
        return res
            .status(400)
            .json({ message: "Email and verification code are required." });
    }

    try {
        // Find the code entry in the database for the given email
        const storedCodeEntry = await VerificationCode.findOne({
            email: email,
        });

        if (!storedCodeEntry) {
            // This could mean the code expired (due to TTL), was never sent, or already used.
            return res
                .status(400)
                .json({
                    message:
                        "No pending verification for this email, or code has expired/been used.",
                });
        }

        // The TTL index on `createdAt` should handle expiration automatically.
        // However, a double-check here for immediate feedback if TTL hasn't kicked in yet.
        const TEN_MINUTES = 10 * 60 * 1000;
        if (Date.now() - storedCodeEntry.createdAt.getTime() > TEN_MINUTES) {
            await VerificationCode.deleteOne({ email: email }); // Manually delete if expired
            return res
                .status(400)
                .json({
                    message:
                        "Verification code has expired. Please request a new one.",
                });
        }

        // Compare the submitted code with the stored one
        if (storedCodeEntry.code === code) {
            // Code matches: Delete it from the database after successful verification
            await VerificationCode.deleteOne({ email: email });
            res.status(200).json({
                message: "Email successfully verified! Proceed to registration.",
                verified: true // Indicate successful verification to the frontend
            });
        } else {
            // Code does not match
            res.status(401).json({
                message: "Invalid verification code. Please try again.",
            });
        }
    } catch (error) {
        console.error("Error in verify-code:", error);
        res.status(500).json({
            message: "An error occurred during verification. Please try again.",
        });
    }
});

/**
 * POST /register-student
 * Handles new student registration after email verification.
 */
app.post("/register-student", async (req, res) => {
    const { studentName, indexNumber, email, password } = req.body;

    // Basic validation
    if (!studentName || !indexNumber || !email || !password) {
        return res.status(400).json({ message: "All fields are required for registration." });
    }

    try {
        // Check if student with this email or index number already exists
        const existingStudentByEmail = await Student.findOne({ email: email });
        if (existingStudentByEmail) {
            return res.status(409).json({ message: "Email already registered." });
        }

        const existingStudentByIndex = await Student.findOne({ indexNumber: indexNumber });
        if (existingStudentByIndex) {
            return res.status(409).json({ message: "Index number already registered." });
        }

        // Hash the password
        const saltRounds = 10; // The number of salt rounds to use (cost factor)
        const passwordHash = await bcrypt.hash(password, saltRounds);

        // Create new student record
        const newStudent = new Student({
            studentName: studentName,
            indexNumber: indexNumber,
            email: email,
            passwordHash: passwordHash, // Store the hashed password
        });

        await newStudent.save();
        console.log(`New student registered: ${email}`);

        res.status(201).json({ message: "Student registered successfully!", studentId: newStudent._id });

    } catch (error) {
        console.error("Error in /register-student:", error);
        // Handle potential duplicate key errors (if unique constraint fails for some reason not caught by findOne)
        if (error.code === 11000) {
            return res.status(409).json({ message: "An account with this email or index number already exists." });
        }
        res.status(500).json({ message: "Student registration failed. Please try again." });
    }
});


// --- Server Start ---
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    console.log(
        "Ensure you have environment variables (Secrets) for MONGODB_URI, EMAIL_USER, and EMAIL_PASS.",
    );
    console.log(
        "Make sure your MongoDB Atlas cluster is running and accessible (0.0.0.0/0 IP access).",
    );
});
