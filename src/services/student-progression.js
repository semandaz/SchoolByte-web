// Student progression helpers — streak tracking and milestone-style
// achievement awards. Extracted from server.js so both the quiz/activity
// submit routes (which still live in server.js) and the achievements
// router can import them.

const Student = require('../../models/Student');

async function checkAndAwardAchievements(student) {
    const newAchievements = [];
    const now = new Date();

    // Quiz Master - Complete 25 quizzes
    if (student.totalQuizzesCompleted >= 25 && !student.achievements.some(a => a.type === 'quiz_master')) {
        const achievement = {
            type: 'quiz_master',
            name: 'Quiz Master',
            description: 'Completed 25 quizzes',
            earnedAt: now,
            badgeIcon: '🎯',
            progress: 100,
        };
        student.achievements.push(achievement);
        newAchievements.push(achievement);
    }

    // Streak Champion - 7 day study streak
    if (student.currentStreak >= 7 && !student.achievements.some(a => a.type === 'streak_champion')) {
        const achievement = {
            type: 'streak_champion',
            name: 'Streak Champion',
            description: '7-day study streak',
            earnedAt: now,
            badgeIcon: '🔥',
            progress: 100,
        };
        student.achievements.push(achievement);
        newAchievements.push(achievement);
    }

    // Byte Collector - Earned 1000 bytes
    if (student.bytes >= 1000 && !student.achievements.some(a => a.type === 'byte_collector')) {
        const achievement = {
            type: 'byte_collector',
            name: 'Byte Collector',
            description: 'Earned 1000 bytes',
            earnedAt: now,
            badgeIcon: '💰',
            progress: 100,
        };
        student.achievements.push(achievement);
        newAchievements.push(achievement);
    }

    for (const achievement of newAchievements) {
        student.notifications.push({
            type: 'achievement',
            title: `Achievement Unlocked: ${achievement.name}`,
            message: achievement.description,
            isRead: false,
            createdAt: now,
            data: { achievementType: achievement.type, badgeIcon: achievement.badgeIcon },
        });
    }

    return newAchievements;
}

async function updateStudentStreak(studentId) {
    const student = await Student.findById(studentId);
    if (!student) return;

    const now = new Date();
    const lastActivity = new Date(student.lastActivityDate);
    const hoursSinceLastActivity = (now - lastActivity) / (1000 * 60 * 60);

    if (hoursSinceLastActivity <= 24) {
        // Same day activity, don't increment
        const daysSame = Math.floor(hoursSinceLastActivity / 24);
        if (daysSame === 0) {
            // Update last activity but don't change streak
            student.lastActivityDate = now;
        }
    } else if (hoursSinceLastActivity <= 48) {
        // Next day activity, increment streak
        student.currentStreak += 1;
        if (student.currentStreak > student.longestStreak) {
            student.longestStreak = student.currentStreak;
        }
        student.lastActivityDate = now;
    } else {
        // Streak broken, reset
        student.currentStreak = 1;
        student.lastActivityDate = now;
    }

    await checkAndAwardAchievements(student);
    await student.save();
}

module.exports = { checkAndAwardAchievements, updateStudentStreak };
