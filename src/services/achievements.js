// Achievement / notification / tier helpers.
// These are imported from many route handlers — keep their public signature
// stable so callers don't need to change.

const Student = require('../../models/Student');
const Achievement = require('../../models/Achievement');
const StudentAchievement = require('../../models/StudentAchievement');
const Notification = require('../../models/Notification');
const PlayerLevel = require('../../models/PlayerLevel');

async function createNotification(studentId, type, title, message, metadata = {}) {
    try {
        const notification = new Notification({
            student: studentId,
            type,
            title,
            message,
            data: metadata,
            read: false,
        });
        await notification.save();
        return notification;
    } catch (error) {
        console.error('Error creating notification:', error);
        return null;
    }
}

async function checkAndUpdateTier(studentId) {
    try {
        const student = await Student.findById(studentId);
        if (!student) return null;

        const nextTier = await PlayerLevel.findOne({ tier: student.currentTier + 1 });

        if (nextTier && student.xp >= nextTier.totalXPRequired) {
            const oldTier = student.currentTier;
            student.currentTier = nextTier.tier;
            student.bytes += nextTier.levelUpByteReward;
            await student.save();

            await createNotification(
                studentId,
                'level_up',
                `Tier Up! You're now ${nextTier.name}!`,
                `Congratulations! You've earned ${nextTier.levelUpByteReward} bonus bytes for reaching Tier ${nextTier.tier}.`,
                {
                    oldTier,
                    newTier: nextTier.tier,
                    tierName: nextTier.name,
                    byteReward: nextTier.levelUpByteReward,
                }
            );

            return nextTier;
        }
        return null;
    } catch (error) {
        console.error('Error checking tier update:', error);
        return null;
    }
}

async function awardAchievement(studentId, achievementId, progress = 1, target = 1) {
    try {
        const student = await Student.findById(studentId);
        if (!student) {
            console.error('Student not found for achievement award:', studentId);
            return null;
        }

        const achievement = await Achievement.findOne({ achievementId });
        if (!achievement) {
            console.error('Achievement not found:', achievementId);
            return null;
        }

        let studentAchievement = await StudentAchievement.findOne({
            student: studentId,
            achievementId,
        });

        if (!studentAchievement) {
            studentAchievement = new StudentAchievement({
                student: studentId,
                achievementId,
                achievement: achievement._id,
                progress: 0,
                target,
                unlocked: false,
            });
        }

        if (studentAchievement.unlocked) {
            return null;
        }

        studentAchievement.progress = Math.min(studentAchievement.progress + progress, target);

        if (studentAchievement.progress >= target && !studentAchievement.unlocked) {
            studentAchievement.unlocked = true;
            studentAchievement.unlockedAt = new Date();

            student.bytes += achievement.byteReward;
            student.xp += achievement.xpReward;
            await student.save();

            await checkAndUpdateTier(studentId);

            await createNotification(
                studentId,
                'achievement',
                `Achievement Unlocked: ${achievement.name}!`,
                `You've earned ${achievement.byteReward} bytes and ${achievement.xpReward} XP!`,
                {
                    achievementId: achievement.achievementId,
                    icon: achievement.icon,
                    tier: achievement.tier,
                }
            );

            await studentAchievement.save();
            return { achievement, newlyUnlocked: true };
        }

        await studentAchievement.save();
        return {
            achievement,
            newlyUnlocked: false,
            progress: studentAchievement.progress,
            target: studentAchievement.target,
        };
    } catch (error) {
        console.error('Error awarding achievement:', error);
        return null;
    }
}

module.exports = {
    awardAchievement,
    createNotification,
    checkAndUpdateTier,
};
