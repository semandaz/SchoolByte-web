// Energy / weekly counter helpers used by quiz, dashboard and teacher routes.

// Energy: refill 1 per hour, cap 25.
function refillEnergy(student) {
    const now = Date.now();
    if (!student.lastEnergyRefillAt) {
        student.lastEnergyRefillAt = new Date(now);
        return;
    }
    const last = new Date(student.lastEnergyRefillAt).getTime();
    const hoursElapsed = Math.floor((now - last) / (60 * 60 * 1000));
    if (hoursElapsed <= 0) return;
    const currentEnergy = student.energy ?? 25;
    const added = Math.min(hoursElapsed, 25 - currentEnergy);
    if (added <= 0) return;
    student.energy = Math.min(25, currentEnergy + added);
    student.lastEnergyRefillAt = new Date(last + added * 60 * 60 * 1000);
}

async function checkAndResetWeeklyCounters(student) {
    const now = new Date();
    const lastReset = new Date(student.lastQuizResetDate);
    const startOfThisWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());

    if (lastReset < startOfThisWeek) {
        student.quizzesCompletedThisWeek = 0;
        student.lastQuizResetDate = startOfThisWeek;
        await student.save();
    }
}

async function checkAndResetTeacherWeeklyCounters(teacher) {
    const now = new Date();
    const lastReset = new Date(teacher.lastUploadResetDate);
    const startOfThisWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());

    if (lastReset < startOfThisWeek) {
        teacher.quizzesUploadedThisWeek = 0;
        teacher.lastUploadResetDate = startOfThisWeek;
        await teacher.save();
    }
}

module.exports = {
    refillEnergy,
    checkAndResetWeeklyCounters,
    checkAndResetTeacherWeeklyCounters,
};
