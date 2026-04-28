const express = require('express');
const Student = require('../../models/Student');
const Achievement = require('../../models/Achievement');
const StudentAchievement = require('../../models/StudentAchievement');
const PlayerLevel = require('../../models/PlayerLevel');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Initialize Player Levels and Achievements (One-time seed — Admin only)
router.post('/api/admin/initialize-achievements', async (req, res) => {
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
            { tier: 10, name: 'Legend', totalXPRequired: 4000, levelUpByteReward: 1000 },
        ];

        for (const level of playerLevels) {
            await PlayerLevel.findOneAndUpdate(
                { tier: level.tier },
                level,
                { upsert: true, new: true },
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
            { achievementId: 'geo_globe_trotter', name: 'Globe Trotter', description: 'Correctly identify 500 countries total (across all games played).', tier: 'Diamond', category: 'GeoQuiz', byteReward: 300, xpReward: 300, icon: 'fa-plane' },
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
            { achievementId: 'sudoku_full_grid', name: 'Full Grid', description: 'Complete one puzzle of each difficulty level (Easy, Medium, Hard, Impossible, Insane, Brutal).', tier: 'Diamond', category: 'ByteSudoku', byteReward: 500, xpReward: 500, icon: 'fa-trophy' },
        ];

        const allAchievements = [...geoQuizAchievements, ...sudokuAchievements];

        for (const achievement of allAchievements) {
            await Achievement.findOneAndUpdate(
                { achievementId: achievement.achievementId },
                achievement,
                { upsert: true, new: true },
            );
        }

        res.status(200).json({
            message: 'Player levels and achievements initialized successfully!',
            playerLevelsCount: playerLevels.length,
            achievementsCount: allAchievements.length,
        });
    } catch (error) {
        console.error('Error initializing achievements:', error);
        res.status(500).json({ message: 'Failed to initialize achievements', error: error.message });
    }
});

// Get Student Achievements and Progress
router.get('/api/student/achievements', authenticateToken, async (req, res) => {
    try {
        const studentId = req.student.id;

        const student = await Student.findById(studentId);
        if (!student) {
            return res.status(404).json({ message: 'Student not found.' });
        }

        const allAchievements = await Achievement.find({}).sort({ tier: 1, xpReward: 1 });

        const studentAchievements = await StudentAchievement.find({ student: studentId })
            .populate('achievement');

        const currentTierInfo = await PlayerLevel.findOne({ tier: student.currentTier });
        const nextTierInfo = await PlayerLevel.findOne({ tier: student.currentTier + 1 });

        const achievementsWithProgress = allAchievements.map(achievement => {
            const progress = studentAchievements.find(sa => sa.achievementId === achievement.achievementId);
            return {
                ...achievement.toObject(),
                unlocked: progress?.unlocked || false,
                unlockedAt: progress?.unlockedAt || null,
                progress: progress?.progress || 0,
                target: progress?.target || 1,
            };
        });

        res.status(200).json({
            student: {
                xp: student.xp,
                currentTier: student.currentTier,
                bytes: student.bytes,
            },
            currentTierInfo,
            nextTierInfo,
            achievements: achievementsWithProgress,
            stats: {
                totalCountriesIdentified: student.totalCountriesIdentified,
                totalSudokuPuzzlesCompleted: student.totalSudokuPuzzlesCompleted,
                geoQuizStats: student.geoQuizStats,
                sudokuStats: student.sudokuStats,
            },
        });
    } catch (error) {
        console.error('Error fetching student achievements:', error);
        res.status(500).json({ message: 'Failed to fetch achievements', error: error.message });
    }
});

// Convert XP to Bytes
router.post('/api/student/convert-xp-to-bytes', authenticateToken, async (req, res) => {
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
                requestedXP: xpAmount,
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
            decimalBytes,
            totalBytesEarned: bytesEarned.toFixed(1),
            remainingXP: student.xp,
            totalBytes: student.bytes,
        });
    } catch (error) {
        console.error('Error converting XP to bytes:', error);
        res.status(500).json({ message: 'Failed to convert XP', error: error.message });
    }
});

module.exports = router;
