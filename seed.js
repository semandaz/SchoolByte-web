// seed.js - For creating a "Super Student" with access to all subjects for testing

const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

// Import your Mongoose models from server.js (adjust path as necessary)
// IMPORTANT: Ensure these models are exported from server.js (e.g., via module.exports at the end)
const { Student, Subject, QuizSession, QuizQuestion, Teacher }
    = require('./server.js'); // Assuming you export them

// --- MongoDB Connection ---
// Replace with your actual MongoDB connection string.
// If using Replit secrets, you might need to adjust how this is accessed
// or manually paste your MONGODB_URI for local testing.
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/schoolbyte_dev'; // REPLACE if needed

mongoose.connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
    .then(() => console.log('MongoDB connected for seeding'))
    .catch(err => {
        console.error('MongoDB connection error for seeding:', err);
        process.exit(1);
    });

const seedDatabase = async () => {
    try {
        console.log('Clearing existing test data...');
        // Optional: Clear existing test data to start fresh each time you seed
        // Keep Subjects if they define the curriculum and are static
        await Student.deleteMany({});
        await QuizSession.deleteMany({});
        await QuizQuestion.deleteMany({});
        await Teacher.deleteMany({});
        // Consider deleting other collections (Activities, WorkFiles, PreaderGameSession etc.)
        // if you want a completely clean slate for your super student.

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

        // Get all subject names to assign to our super student
        const allSubjectNames = allCurriculumSubjects.map(s => s.name);
        console.log(`Identified ${allSubjectNames.length} subjects for the super student.`);


        const hashedPassword = await bcrypt.hash('testpassword', 10); // Simple password for testing

        console.log('Creating "Super Student" account...');

        const superStudent = await Student.create({
            studentName: 'Test Student Omega',
            indexNumber: 'TS-007',
            email: 'test.omega@schoolbyte.com', // Use this email for login
            password: hashedPassword,
            isEmailVerified: true, // Auto-verify for easy testing
            bytes: 500, // Give them some bytes to start with
            class: 'S.6', // We'll set them to S.6 as their 'base' class level
            stream: 'Omni',
            classTeacher: 'Prof. X',
            subjectsEnrolled: allSubjectNames // THIS IS THE KEY: ALL SUBJECTS!
        });

        // Create initial quiz session for the super student
        const superStudentQuizSession = await QuizSession.create({
            userId: superStudent._id,
            questionsCompletedCount: 0
            // subjectProgress will initialize with all zeros by default
        });
        superStudent.currentQuizSessionId = superStudentQuizSession._id;
        await superStudent.save();

        console.log(`Created Super Student: ${superStudent.studentName} (${superStudent.email})`);
        console.log(`Password: testpassword`);

        // --- Create a Test Teacher ---
        const testTeacher = await Teacher.create({
            teacherName: 'Prof. Content Creator',
            email: 'teacher.test@schoolbyte.com',
            password: hashedPassword, // Same test password
            isPasswordSet: true,
            gender: 'Male'
        });
        console.log(`Created test teacher: ${testTeacher.teacherName} (${testTeacher.email})`);

        // --- Create some diverse test quiz questions ---
        // Add a few questions covering different subjects and levels
        const sampleQuestions = [
            {
                questionText: "What is the capital of Uganda?",
                subject: "Geography", intendedClass: "S.1", type: "short-answer", correctAnswers: ["Kampala"],
                maxBytesRewardPerQuestion: 1, isActive: true,
                uploadedBy: { teacherId: testTeacher._id, teacherName: testTeacher.teacherName }
            },
            {
                questionText: "Which elements combine to form water?",
                subject: "Chemistry", intendedClass: "S.2", type: "short-answer", keywordsForGrading: ["hydrogen", "oxygen"],
                negativeKeywords: ["nitrogen"], maxBytesRewardPerQuestion: 1, isActive: true,
                uploadedBy: { teacherId: testTeacher._id, teacherName: testTeacher.teacherName }
            },
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
            {
                questionText: "Solve for x: 2x + 5 = 15",
                subject: "Mathematics", intendedClass: "S.4", type: "numeric-entry", correctAnswers: ["5"],
                maxBytesRewardPerQuestion: 1, isActive: true,
                uploadedBy: { teacherId: testTeacher._id, teacherName: testTeacher.teacherName }
            },
            {
                questionText: "Discuss the key causes of World War I.",
                subject: "History", intendedClass: "S.5", type: "problem-solving",
                keywordsForGrading: ["militarism", "alliances", "imperialism", "nationalism", "assassination"],
                negativeKeywords: ["cold war", "space race"], maxBytesRewardPerQuestion: 1, isActive: true,
                uploadedBy: { teacherId: testTeacher._id, teacherName: testTeacher.teacherName }
            },
            {
                questionText: "Explain the concept of quantum entanglement.",
                subject: "Physics", intendedClass: "S.6", type: "short-answer",
                keywordsForGrading: ["two particles", "linked", "regardless of distance", "measurement of one affects other"],
                maxBytesRewardPerQuestion: 1, isActive: true,
                uploadedBy: { teacherId: testTeacher._id, teacherName: testTeacher.teacherName }
            },
            {
                questionText: "Translate 'Hello, how are you?' into French.",
                subject: "French", intendedClass: "S.2", type: "short-answer", correctAnswers: ["Bonjour, comment allez-vous?", "Salut, comment ça va?"],
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
        console.log('Diverse test quiz questions created.');

        console.log('Database seeding complete!');
    } catch (error) {
        console.error('Error during database seeding:', error);
    } finally {
        // Ensure mongoose connection is closed after seeding
        mongoose.disconnect();
    }
};

seedDatabase();
