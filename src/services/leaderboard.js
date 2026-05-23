const Student = require('../../models/Student');

async function getLeaderboardHandler(req, res) {
    try {
        const { limit = 500 } = req.query;
        const currentStudentId = req.student.id;
        const cap = Math.min(parseInt(limit, 10) || 500, 1000);

        const [students, totalPlayers] = await Promise.all([
            Student.find({ isEmailVerified: true })
                .sort({ xp: -1, _id: 1 })
                .select('preferredName studentName bytes xp currentTier')
                .limit(cap)
                .lean(),
            Student.countDocuments({ isEmailVerified: true }),
        ]);

        const leaderboard = students.map((student, index) => {
            const rank = index + 1;
            const isCurrentUser = student._id.toString() === currentStudentId;
            const displayName = student.preferredName || student.studentName;
            return {
                rank,
                displayName,
                bytes: student.bytes || 0,
                xp: student.xp || 0,
                tier: student.currentTier || 1,
                isCurrentUser,
            };
        });

        // If the current user is outside the returned slice, look them up and append
        let currentUserEntry = leaderboard.find((p) => p.isCurrentUser) || null;
        if (!currentUserEntry) {
            const me = await Student.findById(currentStudentId)
                .select('preferredName studentName bytes xp currentTier isEmailVerified')
                .lean();
            if (me && me.isEmailVerified) {
                const ahead = await Student.countDocuments({
                    isEmailVerified: true,
                    $or: [
                        { xp: { $gt: me.xp || 0 } },
                        { xp: me.xp || 0, _id: { $lt: me._id } },
                    ],
                });
                currentUserEntry = {
                    rank: ahead + 1,
                    displayName: me.preferredName || me.studentName,
                    bytes: me.bytes || 0,
                    xp: me.xp || 0,
                    tier: me.currentTier || 1,
                    isCurrentUser: true,
                    outsideTop: true,
                };
                leaderboard.push(currentUserEntry);
            }
        }

        res.status(200).json({
            message: 'Leaderboard fetched successfully!',
            leaderboard,
            totalPlayers,
            currentUser: currentUserEntry,
        });
    } catch (error) {
        console.error('Error fetching leaderboard:', error);
        res.status(500).json({ message: 'Server error fetching leaderboard.', error: error.message });
    }
}

module.exports = { getLeaderboardHandler };
