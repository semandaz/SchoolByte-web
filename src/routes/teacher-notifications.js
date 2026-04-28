const express = require('express');
const TeacherNotification = require('../../models/TeacherNotification');
const { authenticateTeacherToken } = require('../middleware/auth');

const router = express.Router();

router.get('/teacher/notifications', authenticateTeacherToken, async (req, res) => {
    try {
        const notifications = await TeacherNotification.find({ teacher: req.teacher.id })
            .sort({ createdAt: -1 }).limit(50).lean();
        const unreadCount = notifications.filter(n => !n.read).length;
        res.json({ notifications, unreadCount });
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch notifications', error: err.message });
    }
});

router.patch('/teacher/notifications/:id/read', authenticateTeacherToken, async (req, res) => {
    try {
        await TeacherNotification.updateOne({ _id: req.params.id, teacher: req.teacher.id }, { $set: { read: true } });
        res.json({ message: 'Marked as read' });
    } catch (err) {
        res.status(500).json({ message: 'Failed to mark notification as read' });
    }
});

router.post('/teacher/notifications/mark-all-read', authenticateTeacherToken, async (req, res) => {
    try {
        await TeacherNotification.updateMany({ teacher: req.teacher.id, read: false }, { $set: { read: true } });
        res.json({ message: 'All notifications marked as read' });
    } catch (err) {
        res.status(500).json({ message: 'Failed to mark all read' });
    }
});

router.get('/teacher/notifications/unread-count', authenticateTeacherToken, async (req, res) => {
    try {
        const count = await TeacherNotification.countDocuments({ teacher: req.teacher.id, read: false });
        res.json({ count });
    } catch (err) {
        res.status(500).json({ count: 0 });
    }
});

module.exports = router;
