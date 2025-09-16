
// seed.js - For creating a "Super Student" with access to all subjects for testing

const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
require('dotenv').config();

require('dotenv').config();

// --- MongoDB Connection ---
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
    console.error('FATAL ERROR: MONGODB_URI is not defined. Please set it in Replit Secrets.');
    process.exit(1);
}

mongoose.connect(MONGODB_URI)
    .then(() => console.log('MongoDB connected for seeding'))
    .catch(err => {
        console.error('MongoDB connection error for seeding:', err);
        process.exit(1);
    });

// Define models locally in seed.js to avoid import issues
const studentSchema = new mongoose.Schema({
    studentName: { type: String, required: true, trim: true },
    indexNumber: { type: String, required: true, unique: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    isEmailVerified: { type: Boolean, default: false },
    bytes: { type: Number, default: 20 },
    class: { type: String, required: true, trim: true, index: true },
    stream: { type: String, required: true, trim: true },
    classTeacher: { type: String, required: true, trim: true },
    subjectsEnrolled: {
        type: [String],
        required: true,
        default: [],
        index: true
    },
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
    totalPreaderGameTimeMinutes: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

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
    instructions: { type: String, trim: true },
    hint: { type: String, trim: true },
    explanation: { type: String, trim: true },
    maxBytesRewardPerQuestion: { type: Number, required: true, default: 1, min: 0 },
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
    topic: { type: String, trim: true, index: true },
    subTopic: { type: String, trim: true, index: true },
    skillType: {
        type: [String],
        enum: ["Memorization", "Application", "Analysis", "Problem-Solving", "Evaluation", "Creation"],
        default: []
    },
    isActive: { type: Boolean, default: true, index: true },
    timesServedOverall: { type: Number, default: 0, min: 0, index: true },
    lastServedTimestamp: { type: Date, index: true },
    questionHash: { type: String, unique: true, sparse: true },
    uploadedBy: {
        teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher', default: null },
        teacherName: { type: String, required: true }
    },
    isFeatured: { type: Boolean, default: false },
    featuredUntil: { 
        type: Date, 
        required: function() { return this.isFeatured; }
    },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

const teacherSchema = new mongoose.Schema({
    teacherName: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    bytes: { type: Number, default: 0 },
    quizzesUploadedThisWeek: { type: Number, default: 0, min: 0 },
    lastUploadResetDate: { type: Date, default: Date.now },
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

// Create models
const Student = mongoose.model('Student', studentSchema);
const Subject = mongoose.model('Subject', subjectSchema);
const QuizSession = mongoose.model('QuizSession', quizSessionSchema);
const QuizQuestion = mongoose.model('QuizQuestion', quizQuestionSchema);
const Teacher = mongoose.model('Teacher', teacherSchema);

const seedDatabase = async () => {
    try {
        // Wait for mongoose to be ready
        if (mongoose.connection.readyState !== 1) {
            await new Promise((resolve) => {
                mongoose.connection.once('open', resolve);
            });
        }

        console.log('Clearing existing test data...');
        // Clear existing admin test data
        await Student.deleteMany({ email: 'semandaian@gmail.com' });
        await Student.deleteMany({ email: 'test.omega@schoolbyte.com' });
        await QuizSession.deleteMany({});
        await QuizQuestion.deleteMany({});
        await Teacher.deleteMany({});

        console.log('Seeding initial subjects (ensuring all curriculum subjects are present)...');
        const allCurriculumSubjects = [
            { name: "Mathematics", isCompulsory: true, applicableLevels: ["O_Level_Lower", "O_Level_Middle", "A_Level"] },
            { name: "English Language", isCompulsory: true, applicableLevels: ["O_Level_Lower", "O_Level_Middle", "A_Level"] },
            { name: "Biology", isCompulsory: true, applicableLevels: ["O_Level_Lower", "O_Level_Middle", "A_Level"] },
            { name: "Chemistry", isCompulsory: true, applicableLevels: ["O_Level_Lower", "O_Level_Middle", "A_Level"] },
            { name: "Physics", isCompulsory: true, applicableLevels: ["O_Level_Lower", "O_Level_Middle", "A_Level"] },
            { name: "History", isCompulsory: true, applicableLevels: ["O_Level_Lower", "O_Level_Middle", "A_Level"] },
            { name: "Geography", isCompulsory: true, applicableLevels: ["O_Level_Lower", "O_Level_Middle", "A_Level"] },
            { name: "Computer Science", isCompulsory: false, applicableLevels: ["O_Level_Middle", "A_Level"], isSubsidiaryAlevel: true },
            { name: "Agriculture", isCompulsory: false, applicableLevels: ["O_Level_Lower", "O_Level_Middle", "A_Level"] },
            { name: "Literature in English", isCompulsory: false, applicableLevels: ["O_Level_Middle", "A_Level"] },
            { name: "French", isCompulsory: false, applicableLevels: ["O_Level_Lower", "O_Level_Middle", "A_Level"] },
            { name: "German", isCompulsory: false, applicableLevels: ["O_Level_Lower", "O_Level_Middle", "A_Level"] },
            { name: "Kiswahili", isCompulsory: false, applicableLevels: ["O_Level_Lower", "O_Level_Middle", "A_Level"] },
            { name: "Luganda", isCompulsory: false, applicableLevels: ["O_Level_Lower", "O_Level_Middle", "A_Level"] },
            { name: "Fine Art", isCompulsory: false, applicableLevels: ["O_Level_Lower", "O_Level_Middle", "A_Level"] },
            { name: "Performing Arts", isCompulsory: false, applicableLevels: ["O_Level_Lower", "O_Level_Middle", "A_Level"] },
            { name: "Physical Education", isCompulsory: false, applicableLevels: ["O_Level_Lower", "O_Level_Middle", "A_Level"] },
            { name: "Technology and Design", isCompulsory: false, applicableLevels: ["O_Level_Lower", "O_Level_Middle", "A_Level"] },
            { name: "General Paper", isCompulsory: false, applicableLevels: ["A_Level"], isSubsidiaryAlevel: true },
            { name: "Subsidiary Mathematics", isCompulsory: false, applicableLevels: ["A_Level"], isSubsidiaryAlevel: true },
        ];
        // Insert or update all subjects to ensure they exist with correct flags
        for (const subjectData of allCurriculumSubjects) {
            await Subject.findOneAndUpdate({ name: subjectData.name }, subjectData, { upsert: true });
        }
        console.log('Curriculum subjects ensured in DB.');

        // Get all subject names to assign to our super admin
        const allSubjectNames = allCurriculumSubjects.map(s => s.name);
        console.log(`Identified ${allSubjectNames.length} subjects for the super admin student.`);

        const hashedPassword = await bcrypt.hash('semandaian', 10); // Admin password

        console.log('Creating "Super Admin Student" account...');

        const superAdminStudent = await Student.create({
            studentName: 'semanda ian',
            indexNumber: '11ABC22',
            email: 'semandaian@gmail.com', // Admin email
            password: hashedPassword,
            isEmailVerified: true, // Auto-verify for easy testing
            bytes: 10000, // Give them plenty of bytes
            class: 'S.3', // Set them to S.3 as requested
            stream: 'Blue',
            classTeacher: 'Ms Nalukwago Irene',
            subjectsEnrolled: allSubjectNames // THIS IS THE KEY: ALL SUBJECTS!
        });

        // Create initial quiz session for the super admin
        const superAdminQuizSession = await QuizSession.create({
            userId: superAdminStudent._id,
            questionsCompletedCount: 0
            // subjectProgress will initialize with all zeros by default
        });
        superAdminStudent.currentQuizSessionId = superAdminQuizSession._id;
        await superAdminStudent.save();

        console.log(`Created Super Admin Student: ${superAdminStudent.studentName} (${superAdminStudent.email})`);
        console.log(`Index Number: ${superAdminStudent.indexNumber}`);
        console.log(`Class: ${superAdminStudent.class} - ${superAdminStudent.stream}`);
        console.log(`Class Teacher: ${superAdminStudent.classTeacher}`);
        console.log(`Password: semandaian`);
        console.log(`Access Level: ALL SUBJECTS (${allSubjectNames.length} subjects enrolled)`);

        // --- Create a Test Teacher for content creation ---
        const testTeacher = await Teacher.create({
            teacherName: 'Prof. Content Creator',
            email: 'teacher.test@schoolbyte.com',
            password: hashedPassword, // Same test password
            isPasswordSet: true,
            gender: 'Male'
        });
        console.log(`Created test teacher: ${testTeacher.teacherName} (${testTeacher.email})`);

        // --- Create diverse test quiz questions for all subjects ---
        const sampleQuestions = [
            // Mathematics
            {
                questionText: "Solve for x: 2x + 5 = 15",
                subject: "Mathematics", intendedClass: "S.4", type: "numeric-entry", correctAnswers: ["5"],
                maxBytesRewardPerQuestion: 1, isActive: true,
                uploadedBy: { teacherId: testTeacher._id, teacherName: testTeacher.teacherName }
            },
            {
                questionText: "What is the derivative of x²?",
                subject: "Mathematics", intendedClass: "S.6", type: "short-answer", correctAnswers: ["2x"],
                maxBytesRewardPerQuestion: 1, isActive: true,
                uploadedBy: { teacherId: testTeacher._id, teacherName: testTeacher.teacherName }
            },
            // English Language
            {
                questionText: "Identify the main theme in Shakespeare's Romeo and Juliet.",
                subject: "English Language", intendedClass: "S.5", type: "short-answer",
                keywordsForGrading: ["love", "tragedy", "fate", "family feud"],
                maxBytesRewardPerQuestion: 1, isActive: true,
                uploadedBy: { teacherId: testTeacher._id, teacherName: testTeacher.teacherName }
            },
            // Biology
            {
                questionText: "Identify the main function of the mitochondria.",
                subject: "Biology", intendedClass: "S.3", type: "multiple-choice-single",
                options: [
                    { text: "Protein synthesis", isCorrect: false },
                    { text: "Energy production", isCorrect: true },
                    { text: "Waste disposal", isCorrect: false },
                    { text: "Photosynthesis", isCorrect: false }
                ],
                maxBytesRewardPerQuestion: 1, isActive: true,
                uploadedBy: { teacherId: testTeacher._id, teacherName: testTeacher.teacherName }
            },
            // Chemistry
            {
                questionText: "Which elements combine to form water?",
                subject: "Chemistry", intendedClass: "S.2", type: "short-answer", 
                keywordsForGrading: ["hydrogen", "oxygen"],
                negativeKeywords: ["nitrogen"], maxBytesRewardPerQuestion: 1, isActive: true,
                uploadedBy: { teacherId: testTeacher._id, teacherName: testTeacher.teacherName }
            },
            // Physics
            {
                questionText: "Explain the concept of quantum entanglement.",
                subject: "Physics", intendedClass: "S.6", type: "short-answer",
                keywordsForGrading: ["two particles", "linked", "regardless of distance", "measurement of one affects other"],
                maxBytesRewardPerQuestion: 1, isActive: true,
                uploadedBy: { teacherId: testTeacher._id, teacherName: testTeacher.teacherName }
            },
            // History
            {
                questionText: "Discuss the key causes of World War I.",
                subject: "History", intendedClass: "S.5", type: "problem-solving",
                keywordsForGrading: ["militarism", "alliances", "imperialism", "nationalism", "assassination"],
                negativeKeywords: ["cold war", "space race"], maxBytesRewardPerQuestion: 1, isActive: true,
                uploadedBy: { teacherId: testTeacher._id, teacherName: testTeacher.teacherName }
            },
            // Geography
            {
                questionText: "What is the capital of Uganda?",
                subject: "Geography", intendedClass: "S.1", type: "short-answer", correctAnswers: ["Kampala"],
                maxBytesRewardPerQuestion: 1, isActive: true,
                uploadedBy: { teacherId: testTeacher._id, teacherName: testTeacher.teacherName }
            },
            // Computer Science
            {
                questionText: "What does HTML stand for?",
                subject: "Computer Science", intendedClass: "S.4", type: "short-answer", 
                correctAnswers: ["HyperText Markup Language"],
                maxBytesRewardPerQuestion: 1, isActive: true,
                uploadedBy: { teacherId: testTeacher._id, teacherName: testTeacher.teacherName }
            },
            // French
            {
                questionText: "Translate 'Hello, how are you?' into French.",
                subject: "French", intendedClass: "S.2", type: "short-answer", 
                correctAnswers: ["Bonjour, comment allez-vous?", "Salut, comment ça va?"],
                maxBytesRewardPerQuestion: 1, isActive: true,
                uploadedBy: { teacherId: testTeacher._id, teacherName: testTeacher.teacherName }
            },
            // Agriculture
            {
                questionText: "What are the three main nutrients plants need?",
                subject: "Agriculture", intendedClass: "S.3", type: "short-answer",
                keywordsForGrading: ["nitrogen", "phosphorus", "potassium"],
                maxBytesRewardPerQuestion: 1, isActive: true,
                uploadedBy: { teacherId: testTeacher._id, teacherName: testTeacher.teacherName }
            },
            // Literature in English
            {
                questionText: "Who wrote 'Things Fall Apart'?",
                subject: "Literature in English", intendedClass: "S.5", type: "short-answer", 
                correctAnswers: ["Chinua Achebe"],
                maxBytesRewardPerQuestion: 1, isActive: true,
                uploadedBy: { teacherId: testTeacher._id, teacherName: testTeacher.teacherName }
            },
            // German
            {
                questionText: "How do you say 'Good morning' in German?",
                subject: "German", intendedClass: "S.1", type: "short-answer", 
                correctAnswers: ["Guten Morgen"],
                maxBytesRewardPerQuestion: 1, isActive: true,
                uploadedBy: { teacherId: testTeacher._id, teacherName: testTeacher.teacherName }
            },
            // Kiswahili
            {
                questionText: "What does 'Hujambo' mean in English?",
                subject: "Kiswahili", intendedClass: "S.1", type: "short-answer", 
                correctAnswers: ["Hello", "How are you"],
                maxBytesRewardPerQuestion: 1, isActive: true,
                uploadedBy: { teacherId: testTeacher._id, teacherName: testTeacher.teacherName }
            },
            // Physical Education
            {
                questionText: "How many players are on a basketball team on the court?",
                subject: "Physical Education", intendedClass: "S.2", type: "numeric-entry", 
                correctAnswers: ["5"],
                maxBytesRewardPerQuestion: 1, isActive: true,
                uploadedBy: { teacherId: testTeacher._id, teacherName: testTeacher.teacherName }
            }
        ];

        for (const q of sampleQuestions) {
            // Generate hash for duplicate detection before creating
            const normalizedText = q.questionText.toLowerCase().trim().replace(/\s+/g, ' ');
            const questionHash = crypto.createHash('sha256').update(normalizedText).digest('hex');
            await QuizQuestion.create({ ...q, questionHash: questionHash });
        }
        console.log('Diverse test quiz questions created for multiple subjects.');

        console.log('='.repeat(60));
        console.log('DATABASE SEEDING COMPLETE!');
        console.log('='.repeat(60));
        console.log('SUPER ADMIN ACCOUNT CREATED:');
        console.log(`Name: semanda ian`);
        console.log(`Index Number: 11ABC22`);
        console.log(`Email: semandaian@gmail.com`);
        console.log(`Password: semandaian`);
        console.log(`Class: S.3 - Blue Stream`);
        console.log(`Class Teacher: Ms Nalukwago Irene`);
        console.log(`Access: ALL ${allSubjectNames.length} SUBJECTS`);
        console.log(`Bytes: 10,000`);
        console.log('='.repeat(60));
        console.log('You can now login with these credentials and access all subject dashboards!');
        
    } catch (error) {
        console.error('Error during database seeding:', error);
    } finally {
        // Ensure mongoose connection is closed after seeding
        mongoose.disconnect();
    }
};

// Call seedDatabase and handle the promise properly
(async () => {
    try {
        await seedDatabase();
    } catch (error) {
        console.error('Seeding failed:', error);
        process.exit(1);
    }
})();
