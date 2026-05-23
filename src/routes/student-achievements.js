const express = require('express');
const Student = require('../../models/Student');
const Achievement = require('../../models/Achievement');
const StudentAchievement = require('../../models/StudentAchievement');
const PlayerLevel = require('../../models/PlayerLevel');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// ─── Comprehensive Achievement Definitions ────────────────────────────────────
const ALL_ACHIEVEMENTS = [
    // ── Quiz Achievements ─────────────────────────────────────────────────────
    { achievementId: 'quiz_first_step', name: 'First Step', description: 'Complete your very first quiz.', tier: 'Bronze', category: 'Quiz', byteReward: 10, xpReward: 10, icon: 'fa-check-circle' },
    { achievementId: 'quiz_5_total', name: 'Quiz Curious', description: 'Complete 5 quizzes total.', tier: 'Bronze', category: 'Quiz', byteReward: 20, xpReward: 20, icon: 'fa-question-circle' },
    { achievementId: 'quiz_25_total', name: 'Quiz Enthusiast', description: 'Complete 25 quizzes total.', tier: 'Silver', category: 'Quiz', byteReward: 50, xpReward: 50, icon: 'fa-book-open' },
    { achievementId: 'quiz_50_total', name: 'Quiz Veteran', description: 'Complete 50 quizzes total.', tier: 'Silver', category: 'Quiz', byteReward: 75, xpReward: 75, icon: 'fa-graduation-cap' },
    { achievementId: 'quiz_100_total', name: 'Century Scholar', description: 'Complete 100 quizzes total.', tier: 'Gold', category: 'Quiz', byteReward: 150, xpReward: 150, icon: 'fa-award' },
    { achievementId: 'quiz_250_total', name: 'Knowledge Hunter', description: 'Complete 250 quizzes total.', tier: 'Platinum', category: 'Quiz', byteReward: 300, xpReward: 300, icon: 'fa-scroll' },
    { achievementId: 'quiz_500_total', name: 'Grand Scholar', description: 'Complete 500 quizzes — a true legend of learning.', tier: 'Diamond', category: 'Quiz', byteReward: 500, xpReward: 500, icon: 'fa-crown' },
    { achievementId: 'quiz_perfect_first', name: 'Perfectionist', description: 'Score 100% on any quiz for the first time.', tier: 'Bronze', category: 'Quiz', byteReward: 30, xpReward: 30, icon: 'fa-star' },
    { achievementId: 'quiz_perfect_5', name: 'Flawless Five', description: 'Score 100% on 5 different quizzes.', tier: 'Silver', category: 'Quiz', byteReward: 75, xpReward: 75, icon: 'fa-stars' },
    { achievementId: 'quiz_perfect_25', name: 'Absolute Master', description: 'Score 100% on 25 quizzes.', tier: 'Gold', category: 'Quiz', byteReward: 200, xpReward: 200, icon: 'fa-trophy' },
    { achievementId: 'quiz_streak_3', name: 'Three\'s a Habit', description: 'Maintain a 3-day learning streak.', tier: 'Bronze', category: 'Quiz', byteReward: 25, xpReward: 25, icon: 'fa-fire' },
    { achievementId: 'quiz_streak_7', name: 'Week Warrior', description: 'Maintain a 7-day learning streak.', tier: 'Silver', category: 'Quiz', byteReward: 75, xpReward: 75, icon: 'fa-fire-flame-curved' },
    { achievementId: 'quiz_streak_30', name: 'Monthly Dedication', description: 'Maintain a 30-day learning streak.', tier: 'Gold', category: 'Quiz', byteReward: 200, xpReward: 200, icon: 'fa-calendar-check' },
    { achievementId: 'quiz_streak_100', name: 'Century Streak', description: 'Maintain a 100-day learning streak — unstoppable!', tier: 'Platinum', category: 'Quiz', byteReward: 400, xpReward: 400, icon: 'fa-infinity' },
    { achievementId: 'quiz_weekly_5', name: 'Weekly Grind', description: 'Complete 5 quizzes in a single week.', tier: 'Bronze', category: 'Quiz', byteReward: 30, xpReward: 30, icon: 'fa-calendar-week' },

    // ── Activity Achievements ─────────────────────────────────────────────────
    { achievementId: 'activity_first', name: 'Hands On', description: 'Complete your first activity.', tier: 'Bronze', category: 'Activity', byteReward: 10, xpReward: 10, icon: 'fa-pen-to-square' },
    { achievementId: 'activity_5_total', name: 'Active Learner', description: 'Complete 5 activities.', tier: 'Bronze', category: 'Activity', byteReward: 25, xpReward: 25, icon: 'fa-pencil' },
    { achievementId: 'activity_25_total', name: 'Activity Addict', description: 'Complete 25 activities.', tier: 'Silver', category: 'Activity', byteReward: 60, xpReward: 60, icon: 'fa-clipboard-list' },
    { achievementId: 'activity_50_total', name: 'Practise Makes Perfect', description: 'Complete 50 activities.', tier: 'Gold', category: 'Activity', byteReward: 120, xpReward: 120, icon: 'fa-laptop-code' },
    { achievementId: 'activity_100_total', name: 'Activity Legend', description: 'Complete 100 activities.', tier: 'Platinum', category: 'Activity', byteReward: 250, xpReward: 250, icon: 'fa-medal' },
    { achievementId: 'activity_perfect_first', name: 'Full Marks', description: 'Score 100% on any activity.', tier: 'Silver', category: 'Activity', byteReward: 40, xpReward: 40, icon: 'fa-check-double' },
    { achievementId: 'activity_perfect_5', name: 'Five Star Performer', description: 'Score 100% on 5 activities.', tier: 'Gold', category: 'Activity', byteReward: 100, xpReward: 100, icon: 'fa-star-half-stroke' },

    // ── Gallery / UNEB Project Achievements ──────────────────────────────────
    { achievementId: 'gallery_first_upload', name: 'Project Pioneer', description: 'Upload your first UNEB project to the gallery.', tier: 'Bronze', category: 'Gallery', byteReward: 30, xpReward: 30, icon: 'fa-upload' },
    { achievementId: 'gallery_5_uploads', name: 'Gallery Contributor', description: 'Upload 5 UNEB projects.', tier: 'Silver', category: 'Gallery', byteReward: 80, xpReward: 80, icon: 'fa-images' },
    { achievementId: 'gallery_10_uploads', name: 'Research Champion', description: 'Upload 10 UNEB projects — a true researcher!', tier: 'Gold', category: 'Gallery', byteReward: 150, xpReward: 150, icon: 'fa-flask' },
    { achievementId: 'gallery_first_like', name: 'First Fan', description: 'Receive your first like on a project.', tier: 'Bronze', category: 'Gallery', byteReward: 20, xpReward: 20, icon: 'fa-thumbs-up' },
    { achievementId: 'gallery_10_likes_single', name: 'Rising Star', description: 'Receive 10 likes on a single project.', tier: 'Silver', category: 'Gallery', byteReward: 60, xpReward: 60, icon: 'fa-star-of-life' },
    { achievementId: 'gallery_50_likes_total', name: 'Community Favourite', description: 'Receive 50 total likes across all your projects.', tier: 'Gold', category: 'Gallery', byteReward: 150, xpReward: 150, icon: 'fa-heart' },
    { achievementId: 'gallery_helpful_1', name: 'Helpful Start', description: 'Get your first helpful vote on a project.', tier: 'Bronze', category: 'Gallery', byteReward: 15, xpReward: 15, icon: 'fa-hands-helping' },
    { achievementId: 'gallery_helpful_10', name: 'Trusted Source', description: 'Get 10 helpful votes on one project.', tier: 'Silver', category: 'Gallery', byteReward: 50, xpReward: 50, icon: 'fa-shield-check' },

    // ── Platform / General Achievements ──────────────────────────────────────
    { achievementId: 'platform_first_login', name: 'Welcome to SchoolByte!', description: 'Log in for the first time and begin your journey.', tier: 'Bronze', category: 'Platform', byteReward: 5, xpReward: 5, icon: 'fa-door-open' },
    { achievementId: 'platform_profile_setup', name: 'Identity Established', description: 'Set your preferred display name.', tier: 'Bronze', category: 'Platform', byteReward: 10, xpReward: 10, icon: 'fa-id-card' },
    { achievementId: 'platform_tier_2', name: 'Level Up!', description: 'Reach Tier 2: Novice.', tier: 'Bronze', category: 'Platform', byteReward: 20, xpReward: 20, icon: 'fa-arrow-up' },
    { achievementId: 'platform_tier_5', name: 'Halfway There', description: 'Reach Tier 5: Specialist.', tier: 'Silver', category: 'Platform', byteReward: 50, xpReward: 50, icon: 'fa-chart-line' },
    { achievementId: 'platform_tier_8', name: 'Elite Scholar', description: 'Reach Tier 8: Grandmaster.', tier: 'Gold', category: 'Platform', byteReward: 150, xpReward: 150, icon: 'fa-gem' },
    { achievementId: 'platform_tier_10', name: 'Legend', description: 'Reach Tier 10: Legend — the highest rank!', tier: 'Diamond', category: 'Platform', byteReward: 500, xpReward: 500, icon: 'fa-dragon' },
    { achievementId: 'platform_100_xp', name: 'XP Starter', description: 'Earn 100 XP total.', tier: 'Bronze', category: 'Platform', byteReward: 15, xpReward: 15, icon: 'fa-bolt' },
    { achievementId: 'platform_500_xp', name: 'XP Collector', description: 'Earn 500 XP total.', tier: 'Silver', category: 'Platform', byteReward: 40, xpReward: 40, icon: 'fa-bolt-lightning' },
    { achievementId: 'platform_1000_xp', name: 'XP Master', description: 'Earn 1,000 XP total.', tier: 'Gold', category: 'Platform', byteReward: 100, xpReward: 100, icon: 'fa-zap' },
    { achievementId: 'platform_5000_xp', name: 'XP Legend', description: 'Earn 5,000 XP — an extraordinary achievement.', tier: 'Platinum', category: 'Platform', byteReward: 300, xpReward: 300, icon: 'fa-star' },
    { achievementId: 'platform_500_bytes', name: 'Byte Saver', description: 'Hold 500 bytes at once.', tier: 'Silver', category: 'Platform', byteReward: 50, xpReward: 50, icon: 'fa-piggy-bank' },
    { achievementId: 'platform_1000_bytes', name: 'Byte Millionaire', description: 'Hold 1,000 bytes at once.', tier: 'Gold', category: 'Platform', byteReward: 100, xpReward: 100, icon: 'fa-coins' },
    { achievementId: 'platform_early_bird', name: 'Early Bird', description: 'Use SchoolByte before 7 AM.', tier: 'Bronze', category: 'Platform', byteReward: 20, xpReward: 20, icon: 'fa-sun' },
    { achievementId: 'platform_night_owl', name: 'Night Owl', description: 'Use SchoolByte after 10 PM.', tier: 'Bronze', category: 'Platform', byteReward: 20, xpReward: 20, icon: 'fa-moon' },

    // ── GeoQuiz Achievements ──────────────────────────────────────────────────
    { achievementId: 'geo_first_steps', name: 'First Steps', description: 'Correctly identify your first country.', tier: 'Bronze', category: 'GeoQuiz', byteReward: 10, xpReward: 10, icon: 'fa-flag' },
    { achievementId: 'geo_alias_user', name: 'Alias User', description: 'Answer correctly using a country\'s alias (e.g., "DRC").', tier: 'Bronze', category: 'GeoQuiz', byteReward: 15, xpReward: 15, icon: 'fa-tag' },
    { achievementId: 'geo_the_speller', name: 'The Speller', description: 'Get 5 answers in a row with a perfect nearness score.', tier: 'Silver', category: 'GeoQuiz', byteReward: 35, xpReward: 35, icon: 'fa-spell-check' },
    { achievementId: 'geo_high_scorer', name: 'High Scorer', description: 'Achieve a final score of 150 or more on a single continent.', tier: 'Silver', category: 'GeoQuiz', byteReward: 50, xpReward: 50, icon: 'fa-star' },
    { achievementId: 'geo_african_explorer', name: 'African Explorer', description: 'Successfully identify all countries in the Africa quiz.', tier: 'Silver', category: 'GeoQuiz', byteReward: 50, xpReward: 50, icon: 'fa-globe-africa' },
    { achievementId: 'geo_south_american_voyager', name: 'S. American Voyager', description: 'Successfully identify all countries in the South America quiz.', tier: 'Silver', category: 'GeoQuiz', byteReward: 40, xpReward: 40, icon: 'fa-globe-americas' },
    { achievementId: 'geo_geography_adept', name: 'Geography Adept', description: 'Correctly identify 100 countries total (across all games).', tier: 'Gold', category: 'GeoQuiz', byteReward: 75, xpReward: 75, icon: 'fa-globe' },
    { achievementId: 'geo_human_gps', name: 'Human GPS', description: 'Finish a continent with a final accuracy of 90% or higher.', tier: 'Gold', category: 'GeoQuiz', byteReward: 100, xpReward: 100, icon: 'fa-location-dot' },
    { achievementId: 'geo_world_class', name: 'World-Class', description: 'Complete both the Africa and South America quizzes at least once.', tier: 'Gold', category: 'GeoQuiz', byteReward: 100, xpReward: 100, icon: 'fa-earth-americas' },
    { achievementId: 'geo_flawless_cartographer', name: 'Flawless Cartographer', description: 'Finish a continent with 100% accuracy (no incorrect guesses).', tier: 'Platinum', category: 'GeoQuiz', byteReward: 200, xpReward: 200, icon: 'fa-map' },
    { achievementId: 'geo_globe_trotter', name: 'Globe Trotter', description: 'Correctly identify 500 countries total.', tier: 'Diamond', category: 'GeoQuiz', byteReward: 300, xpReward: 300, icon: 'fa-plane' },

    // ── Byte-Sudoku Achievements ──────────────────────────────────────────────
    { achievementId: 'sudoku_first_digit', name: 'First Digit', description: 'Place your first correct number.', tier: 'Bronze', category: 'ByteSudoku', byteReward: 10, xpReward: 10, icon: 'fa-1' },
    { achievementId: 'sudoku_just_a_nudge', name: 'Just a Nudge', description: 'Use one of your free hints.', tier: 'Bronze', category: 'ByteSudoku', byteReward: 10, xpReward: 10, icon: 'fa-lightbulb' },
    { achievementId: 'sudoku_novice', name: 'Sudoku Novice', description: 'Complete an Easy puzzle.', tier: 'Bronze', category: 'ByteSudoku', byteReward: 20, xpReward: 20, icon: 'fa-check' },
    { achievementId: 'sudoku_on_a_roll', name: 'On a Roll!', description: 'Get 5 consecutive correct answers.', tier: 'Bronze', category: 'ByteSudoku', byteReward: 20, xpReward: 20, icon: 'fa-fire' },
    { achievementId: 'sudoku_cost_of_knowledge', name: 'Cost of Knowledge', description: 'Pay bytes for a hint after free hints are gone.', tier: 'Silver', category: 'ByteSudoku', byteReward: 25, xpReward: 25, icon: 'fa-coins' },
    { achievementId: 'sudoku_close_shave', name: 'Close Shave', description: 'Complete a puzzle with 0 chances remaining.', tier: 'Silver', category: 'ByteSudoku', byteReward: 40, xpReward: 40, icon: 'fa-heart-crack' },
    { achievementId: 'sudoku_adept', name: 'Sudoku Adept', description: 'Complete a Hard puzzle.', tier: 'Silver', category: 'ByteSudoku', byteReward: 50, xpReward: 50, icon: 'fa-chart-simple' },
    { achievementId: 'sudoku_self_sufficient', name: 'Self-Sufficient', description: 'Complete a Hard+ puzzle without any hints.', tier: 'Gold', category: 'ByteSudoku', byteReward: 100, xpReward: 100, icon: 'fa-user-ninja' },
    { achievementId: 'sudoku_valedictorian', name: 'Valedictorian', description: 'Get a final grade of 100% on any puzzle.', tier: 'Gold', category: 'ByteSudoku', byteReward: 120, xpReward: 120, icon: 'fa-graduation-cap' },
    { achievementId: 'sudoku_grandmaster', name: 'Sudoku Grandmaster', description: 'Complete a Brutal puzzle.', tier: 'Gold', category: 'ByteSudoku', byteReward: 150, xpReward: 150, icon: 'fa-crown' },
    { achievementId: 'sudoku_perfect_game', name: 'Perfect Game', description: 'Complete any puzzle with no mistakes and no hints.', tier: 'Platinum', category: 'ByteSudoku', byteReward: 250, xpReward: 250, icon: 'fa-gem' },
    { achievementId: 'sudoku_full_grid', name: 'Full Grid', description: 'Complete one puzzle of each difficulty level.', tier: 'Diamond', category: 'ByteSudoku', byteReward: 500, xpReward: 500, icon: 'fa-trophy' },
];

// ─── Seed endpoint ────────────────────────────────────────────────────────────
router.post('/api/admin/initialize-achievements', async (req, res) => {
    try {
        const playerLevels = [
            { tier: 1, name: 'New User',      totalXPRequired: 20,   levelUpByteReward: 20 },
            { tier: 2, name: 'Novice',        totalXPRequired: 100,  levelUpByteReward: 50 },
            { tier: 3, name: 'Apprentice',    totalXPRequired: 250,  levelUpByteReward: 100 },
            { tier: 4, name: 'Adept',         totalXPRequired: 500,  levelUpByteReward: 150 },
            { tier: 5, name: 'Specialist',    totalXPRequired: 800,  levelUpByteReward: 200 },
            { tier: 6, name: 'Expert',        totalXPRequired: 1200, levelUpByteReward: 250 },
            { tier: 7, name: 'Master',        totalXPRequired: 1700, levelUpByteReward: 300 },
            { tier: 8, name: 'Grandmaster',   totalXPRequired: 2300, levelUpByteReward: 400 },
            { tier: 9, name: 'Virtuoso',      totalXPRequired: 3000, levelUpByteReward: 500 },
            { tier: 10, name: 'Legend',       totalXPRequired: 4000, levelUpByteReward: 1000 },
        ];

        for (const level of playerLevels) {
            await PlayerLevel.findOneAndUpdate({ tier: level.tier }, level, { upsert: true, new: true });
        }

        for (const ach of ALL_ACHIEVEMENTS) {
            await Achievement.findOneAndUpdate({ achievementId: ach.achievementId }, ach, { upsert: true, new: true });
        }

        res.status(200).json({
            message: 'Player levels and achievements initialised successfully!',
            playerLevelsCount: playerLevels.length,
            achievementsCount: ALL_ACHIEVEMENTS.length,
        });
    } catch (error) {
        console.error('Error initialising achievements:', error);
        res.status(500).json({ message: 'Failed to initialise achievements', error: error.message });
    }
});

// ─── Get student achievements + progress ─────────────────────────────────────
router.get('/api/student/achievements', authenticateToken, async (req, res) => {
    try {
        const studentId = req.student.id;
        const student = await Student.findById(studentId);
        if (!student) return res.status(404).json({ message: 'Student not found.' });

        const [allAchievements, studentAchievements, currentTierInfo, nextTierInfo] = await Promise.all([
            Achievement.find({}).sort({ tier: 1, xpReward: 1 }).lean(),
            StudentAchievement.find({ student: studentId }).lean(),
            PlayerLevel.findOne({ tier: student.currentTier }).lean(),
            PlayerLevel.findOne({ tier: student.currentTier + 1 }).lean(),
        ]);

        const saMap = {};
        for (const sa of studentAchievements) saMap[sa.achievementId] = sa;

        const achievementsWithProgress = allAchievements.map(ach => {
            const sa = saMap[ach.achievementId];
            return {
                ...ach,
                unlocked: sa?.unlocked || false,
                unlockedAt: sa?.unlockedAt || null,
                progress: sa?.progress || 0,
                target: sa?.target || 1,
            };
        });

        const unlocked = achievementsWithProgress.filter(a => a.unlocked);
        const nearlyDone = achievementsWithProgress.filter(a => !a.unlocked && a.progress > 0 && (a.progress / a.target) >= 0.4);

        res.status(200).json({
            student: {
                xp: student.xp,
                currentTier: student.currentTier,
                bytes: student.bytes,
                totalQuizzesCompleted: student.totalQuizzesCompleted,
                totalActivitiesCompleted: student.totalActivitiesCompleted || 0,
                totalProjectsUploaded: student.totalProjectsUploaded || 0,
            },
            currentTierInfo,
            nextTierInfo,
            achievements: achievementsWithProgress,
            unlockedCount: unlocked.length,
            totalCount: allAchievements.length,
            nearlyDoneCount: nearlyDone.length,
            stats: {
                totalCountriesIdentified: student.totalCountriesIdentified,
                totalSudokuPuzzlesCompleted: student.totalSudokuPuzzlesCompleted,
            },
        });
    } catch (error) {
        console.error('Error fetching student achievements:', error);
        res.status(500).json({ message: 'Failed to fetch achievements', error: error.message });
    }
});

// ─── Convert XP to Bytes ─────────────────────────────────────────────────────
router.post('/api/student/convert-xp-to-bytes', authenticateToken, async (req, res) => {
    try {
        const studentId = req.student.id;
        const { xpAmount } = req.body;

        if (!xpAmount || xpAmount <= 0) {
            return res.status(400).json({ message: 'Invalid XP amount. Must be greater than 0.' });
        }

        const student = await Student.findById(studentId);
        if (!student) return res.status(404).json({ message: 'Student not found.' });

        if (student.xp < xpAmount) {
            return res.status(400).json({ message: 'Insufficient XP.', availableXP: student.xp, requestedXP: xpAmount });
        }

        const bytesEarned = xpAmount * 0.3;
        const wholeBytes = Math.floor(bytesEarned);

        student.xp -= xpAmount;
        student.bytes += wholeBytes;
        await student.save();

        res.status(200).json({
            message: 'XP converted to bytes successfully!',
            xpConverted: xpAmount,
            bytesEarned: wholeBytes,
            remainingXP: student.xp,
            totalBytes: student.bytes,
        });
    } catch (error) {
        console.error('Error converting XP to bytes:', error);
        res.status(500).json({ message: 'Failed to convert XP', error: error.message });
    }
});

module.exports = router;
