const express = require('express');
const Student = require('../../models/Student');
const Notification = require('../../models/Notification');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// ============= STUDENT NOTIFICATIONS (Notification model) =============

// Get Student Notifications
router.get('/api/student/notifications', authenticateToken, async (req, res) => {
    try {
        const studentId = req.student.id;
        const { limit = 50, unreadOnly = false } = req.query;

        const query = { student: studentId };
        if (unreadOnly === 'true') {
            query.read = false;
        }

        const notifications = await Notification.find(query)
            .sort({ createdAt: -1 })
            .limit(parseInt(limit, 10));

        const unreadCount = await Notification.countDocuments({
            student: studentId,
            read: false,
        });

        res.status(200).json({
            notifications,
            unreadCount,
        });
    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({ message: 'Failed to fetch notifications', error: error.message });
    }
});

// Mark Notification as Read
router.patch('/api/student/notifications/:id/read', authenticateToken, async (req, res) => {
    try {
        const studentId = req.student.id;
        const { id } = req.params;

        const notification = await Notification.findOneAndUpdate(
            { _id: id, student: studentId },
            { read: true },
            { new: true },
        );

        if (!notification) {
            return res.status(404).json({ message: 'Notification not found.' });
        }

        res.status(200).json({ message: 'Notification marked as read.', notification });
    } catch (error) {
        console.error('Error marking notification as read:', error);
        res.status(500).json({ message: 'Failed to update notification', error: error.message });
    }
});

// ============= ACHIEVEMENTS & EMBEDDED NOTIFICATIONS (on Student doc) =============

// Get student achievements (only recent ones from past week)
router.get('/api/achievements', authenticateToken, async (req, res) => {
    try {
        const studentId = req.student.id;
        const student = await Student.findById(studentId);

        if (!student) {
            return res.status(404).json({ error: 'Student not found' });
        }

        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

        const recentAchievements = student.achievements.filter(achievement =>
            new Date(achievement.earnedAt) >= oneWeekAgo,
        ).sort((a, b) => new Date(b.earnedAt) - new Date(a.earnedAt));

        res.json({
            recentAchievements,
            totalAchievements: student.achievements.length,
            currentStreak: student.currentStreak,
            longestStreak: student.longestStreak,
            totalQuizzes: student.totalQuizzesCompleted,
            bytes: student.bytes,
        });
    } catch (error) {
        console.error('Error fetching achievements:', error);
        res.status(500).json({ error: 'Failed to fetch achievements' });
    }
});

// Get all achievements (for profile page)
router.get('/api/achievements/all', authenticateToken, async (req, res) => {
    try {
        const studentId = req.student.id;
        const student = await Student.findById(studentId);

        if (!student) {
            return res.status(404).json({ error: 'Student not found' });
        }

        res.json({
            achievements: student.achievements.sort((a, b) => new Date(b.earnedAt) - new Date(a.earnedAt)),
            totalAchievements: student.achievements.length,
            currentStreak: student.currentStreak,
            longestStreak: student.longestStreak,
            totalQuizzes: student.totalQuizzesCompleted,
            bytes: student.bytes,
        });
    } catch (error) {
        console.error('Error fetching all achievements:', error);
        res.status(500).json({ error: 'Failed to fetch achievements' });
    }
});

// Get notifications (embedded on Student doc)
router.get('/api/notifications', authenticateToken, async (req, res) => {
    try {
        const studentId = req.student.id;
        const student = await Student.findById(studentId);

        if (!student) {
            return res.status(404).json({ error: 'Student not found' });
        }

        const sortedNotifications = student.notifications.sort((a, b) =>
            new Date(b.createdAt) - new Date(a.createdAt),
        );

        const unreadCount = student.notifications.filter(n => !n.isRead).length;

        res.json({
            notifications: sortedNotifications.slice(0, 50),
            unreadCount,
        });
    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({ error: 'Failed to fetch notifications' });
    }
});

// Mark notification as read
router.patch('/api/notifications/:notificationId/read', authenticateToken, async (req, res) => {
    try {
        const studentId = req.student.id;
        const { notificationId } = req.params;

        const student = await Student.findById(studentId);
        if (!student) {
            return res.status(404).json({ error: 'Student not found' });
        }

        const notification = student.notifications.id(notificationId);
        if (!notification) {
            return res.status(404).json({ error: 'Notification not found' });
        }

        notification.isRead = true;
        await student.save();

        res.json({ message: 'Notification marked as read' });
    } catch (error) {
        console.error('Error marking notification as read:', error);
        res.status(500).json({ error: 'Failed to update notification' });
    }
});

// Mark all notifications as read
router.post('/api/notifications/mark-all-read', authenticateToken, async (req, res) => {
    try {
        const studentId = req.student.id;
        const student = await Student.findById(studentId);

        if (!student) {
            return res.status(404).json({ error: 'Student not found' });
        }

        student.notifications.forEach(notification => {
            notification.isRead = true;
        });

        await student.save();

        res.json({ message: 'All notifications marked as read' });
    } catch (error) {
        console.error('Error marking all notifications as read:', error);
        res.status(500).json({ error: 'Failed to update notifications' });
    }
});

// Get unread notification count
router.get('/api/notifications/unread-count', authenticateToken, async (req, res) => {
    try {
        const studentId = req.student.id;
        const student = await Student.findById(studentId);

        if (!student) {
            return res.status(404).json({ error: 'Student not found' });
        }

        const unreadCount = student.notifications.filter(n => !n.isRead).length;

        res.json({ unreadCount });
    } catch (error) {
        console.error('Error fetching unread count:', error);
        res.status(500).json({ error: 'Failed to fetch unread count' });
    }
});

module.exports = router;
