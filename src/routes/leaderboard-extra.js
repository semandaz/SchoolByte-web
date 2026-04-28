const express = require('express');
const Teacher = require('../../models/Teacher');
const { authenticateToken } = require('../middleware/auth');
const { getLeaderboardHandler } = require('../services/leaderboard');

const router = express.Router();

// Single handler, mounted on both paths to avoid duplicate logic
router.get('/leaderboard', authenticateToken, getLeaderboardHandler);
router.get('/api/leaderboard', authenticateToken, getLeaderboardHandler);

router.get('/teacher/leaderboard', async (req, res) => {
    try {
        const teachers = await Teacher.find({})
            .sort({ bytes: -1 })
            .select('teacherName bytes')
            .lean();

        const teacherLeaderboard = teachers.map(teacher => ({
            name: teacher.teacherName,
            bytes: teacher.bytes,
        }));

        res.status(200).json({
            message: 'Teacher Leaderboard fetched successfully!',
            leaderboard: teacherLeaderboard,
        });
    } catch (error) {
        console.error('Error fetching teacher leaderboard:', error);
        res.status(500).json({ message: 'Server error fetching teacher leaderboard.', error: error.message });
    }
});

module.exports = router;
