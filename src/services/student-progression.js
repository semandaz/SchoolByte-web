// Student progression helpers — streak tracking and milestone achievement awards.

const Student = require('../../models/Student');
const { trackAchievementProgress, createNotification, checkAndUpdateTier } = require('./achievements');

async function checkAndAwardAchievements(student) {
    const newAchievements = [];
    const now = new Date();

    // Legacy embedded achievements (kept for backwards compatibility with existing student docs)
    if (student.totalQuizzesCompleted >= 25 && !student.achievements.some(a => a.type === 'quiz_master')) {
        const ach = { type: 'quiz_master', name: 'Quiz Master', description: 'Completed 25 quizzes', earnedAt: now, badgeIcon: '🎯', progress: 100 };
        student.achievements.push(ach);
        newAchievements.push(ach);
    }
    if (student.currentStreak >= 7 && !student.achievements.some(a => a.type === 'streak_champion')) {
        const ach = { type: 'streak_champion', name: 'Streak Champion', description: '7-day study streak', earnedAt: now, badgeIcon: '🔥', progress: 100 };
        student.achievements.push(ach);
        newAchievements.push(ach);
    }
    if (student.bytes >= 1000 && !student.achievements.some(a => a.type === 'byte_collector')) {
        const ach = { type: 'byte_collector', name: 'Byte Collector', description: 'Earned 1000 bytes', earnedAt: now, badgeIcon: '💰', progress: 100 };
        student.achievements.push(ach);
        newAchievements.push(ach);
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

/**
 * checkAndAwardSystemAchievements — checks and awards all StudentAchievement-based
 * (new system) milestone achievements for a student. Safe to call OUTSIDE any
 * Mongoose transaction. Runs async in the background via .catch() so it never
 * blocks the response.
 */
async function checkAndAwardSystemAchievements(studentId) {
    try {
        const student = await Student.findById(studentId).lean();
        if (!student) return;

        const quizCount = student.totalQuizzesCompleted || 0;
        const actCount = student.totalActivitiesCompleted || 0;
        const projCount = student.totalProjectsUploaded || 0;
        const perfQuiz = student.perfectQuizScores || 0;
        const perfAct = student.perfectActivityScores || 0;
        const streak = student.currentStreak || 0;
        const xp = student.xp || 0;
        const bytes = student.bytes || 0;

        const tasks = [];

        // ── Quiz milestones ────────────────────────────────────────────────
        tasks.push(trackAchievementProgress(studentId, 'quiz_first_step', quizCount, 1));
        tasks.push(trackAchievementProgress(studentId, 'quiz_5_total', quizCount, 5));
        tasks.push(trackAchievementProgress(studentId, 'quiz_25_total', quizCount, 25));
        tasks.push(trackAchievementProgress(studentId, 'quiz_50_total', quizCount, 50));
        tasks.push(trackAchievementProgress(studentId, 'quiz_100_total', quizCount, 100));
        tasks.push(trackAchievementProgress(studentId, 'quiz_250_total', quizCount, 250));
        tasks.push(trackAchievementProgress(studentId, 'quiz_500_total', quizCount, 500));
        tasks.push(trackAchievementProgress(studentId, 'quiz_weekly_5', student.quizzesCompletedThisWeek || 0, 5));

        // ── Perfect quiz scores ────────────────────────────────────────────
        tasks.push(trackAchievementProgress(studentId, 'quiz_perfect_first', perfQuiz, 1));
        tasks.push(trackAchievementProgress(studentId, 'quiz_perfect_5', perfQuiz, 5));
        tasks.push(trackAchievementProgress(studentId, 'quiz_perfect_25', perfQuiz, 25));

        // ── Streak milestones ──────────────────────────────────────────────
        tasks.push(trackAchievementProgress(studentId, 'quiz_streak_3', streak, 3));
        tasks.push(trackAchievementProgress(studentId, 'quiz_streak_7', streak, 7));
        tasks.push(trackAchievementProgress(studentId, 'quiz_streak_30', streak, 30));
        tasks.push(trackAchievementProgress(studentId, 'quiz_streak_100', streak, 100));

        // ── Activity milestones ────────────────────────────────────────────
        tasks.push(trackAchievementProgress(studentId, 'activity_first', actCount, 1));
        tasks.push(trackAchievementProgress(studentId, 'activity_5_total', actCount, 5));
        tasks.push(trackAchievementProgress(studentId, 'activity_25_total', actCount, 25));
        tasks.push(trackAchievementProgress(studentId, 'activity_50_total', actCount, 50));
        tasks.push(trackAchievementProgress(studentId, 'activity_100_total', actCount, 100));
        tasks.push(trackAchievementProgress(studentId, 'activity_perfect_first', perfAct, 1));
        tasks.push(trackAchievementProgress(studentId, 'activity_perfect_5', perfAct, 5));

        // ── Gallery milestones ─────────────────────────────────────────────
        tasks.push(trackAchievementProgress(studentId, 'gallery_first_upload', projCount, 1));
        tasks.push(trackAchievementProgress(studentId, 'gallery_5_uploads', projCount, 5));
        tasks.push(trackAchievementProgress(studentId, 'gallery_10_uploads', projCount, 10));

        // ── XP milestones ─────────────────────────────────────────────────
        tasks.push(trackAchievementProgress(studentId, 'platform_100_xp', xp, 100));
        tasks.push(trackAchievementProgress(studentId, 'platform_500_xp', xp, 500));
        tasks.push(trackAchievementProgress(studentId, 'platform_1000_xp', xp, 1000));
        tasks.push(trackAchievementProgress(studentId, 'platform_5000_xp', xp, 5000));

        // ── Byte milestones ───────────────────────────────────────────────
        tasks.push(trackAchievementProgress(studentId, 'platform_500_bytes', bytes, 500));
        tasks.push(trackAchievementProgress(studentId, 'platform_1000_bytes', bytes, 1000));

        // ── Tier milestones ───────────────────────────────────────────────
        const tier = student.currentTier || 1;
        tasks.push(trackAchievementProgress(studentId, 'platform_tier_2', tier, 2));
        tasks.push(trackAchievementProgress(studentId, 'platform_tier_5', tier, 5));
        tasks.push(trackAchievementProgress(studentId, 'platform_tier_8', tier, 8));
        tasks.push(trackAchievementProgress(studentId, 'platform_tier_10', tier, 10));

        await Promise.allSettled(tasks);
    } catch (err) {
        console.warn('checkAndAwardSystemAchievements error:', err.message);
    }
}

async function updateStudentStreak(studentId) {
    const student = await Student.findById(studentId);
    if (!student) return;

    const now = new Date();
    const lastActivity = new Date(student.lastActivityDate);
    const hoursSinceLastActivity = (now - lastActivity) / (1000 * 60 * 60);

    if (hoursSinceLastActivity <= 24) {
        student.lastActivityDate = now;
    } else if (hoursSinceLastActivity <= 48) {
        student.currentStreak += 1;
        if (student.currentStreak > student.longestStreak) {
            student.longestStreak = student.currentStreak;
        }
        student.lastActivityDate = now;
    } else {
        student.currentStreak = 1;
        student.lastActivityDate = now;
    }

    await checkAndAwardAchievements(student);
    await student.save();

    // Check system achievements after save (outside transaction)
    checkAndAwardSystemAchievements(studentId).catch(() => {});
}

module.exports = { checkAndAwardAchievements, checkAndAwardSystemAchievements, updateStudentStreak };
