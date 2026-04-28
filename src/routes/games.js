const express = require('express');
const Student = require('../../models/Student');
const { authenticateToken } = require('../middleware/auth');
const { awardAchievement } = require('../services/achievements');

const router = express.Router();

// Byte games: 2 bytes to start, 7 if well performed (net +5)
const BYTE_GAME_NAMES = ['sudoku', 'geoquiz', 'geography quiz', 'geography'];
const GAME_COST_BYTES = 2;
const GAME_MAX_REWARD_BYTES = 7;

// Daily cap: a student can only earn at most 5 bytes from games every 24h
const GAME_DAILY_BYTE_CAP = 5;
const GAME_DAILY_RESET_MS = 24 * 60 * 60 * 1000;

router.post('/api/games/start', authenticateToken, async (req, res) => {
    try {
        const { gameName } = req.body;
        const studentId = req.student.id;
        const student = await Student.findById(studentId);
        if (!student) return res.status(404).json({ message: 'Student not found' });
        const cost = GAME_COST_BYTES;
        if ((student.bytes || 0) < cost) {
            return res.status(402).json({
                message: `Byte games cost ${cost} bytes to start. You need ${cost - (student.bytes || 0)} more bytes.`,
                bytesRequired: cost,
                currentBytes: student.bytes,
            });
        }
        student.bytes = (student.bytes || 0) - cost;
        await student.save();
        res.status(200).json({
            message: 'Game started! Perform well to earn 7 bytes.',
            bytesDeducted: cost,
            totalBytes: student.bytes,
            gameName: gameName || 'game',
        });
    } catch (error) {
        console.error('Error starting game:', error);
        res.status(500).json({ message: 'Failed to start game', error: error.message });
    }
});

router.post('/api/games/award-bytes', authenticateToken, async (req, res) => {
    try {
        const { gameName, bytesEarned } = req.body;
        const studentId = req.student.id;

        if (!bytesEarned || bytesEarned <= 0) {
            return res.status(400).json({ message: 'Invalid bytes amount' });
        }

        const student = await Student.findById(studentId);
        if (!student) {
            return res.status(404).json({ message: 'Student not found' });
        }

        // Roll the daily window if 24h have passed since the last reset
        const now = new Date();
        const lastReset = student.gameBytesResetAt ? new Date(student.gameBytesResetAt) : null;
        if (!lastReset || (now - lastReset) >= GAME_DAILY_RESET_MS) {
            student.gameBytesEarnedToday = 0;
            student.gameBytesResetAt = now;
        }

        let requested = Math.round(bytesEarned);
        const isByteGame = gameName && BYTE_GAME_NAMES.some(n => String(gameName).toLowerCase().includes(n.toLowerCase()));
        if (isByteGame && requested > GAME_MAX_REWARD_BYTES) requested = GAME_MAX_REWARD_BYTES;

        const alreadyEarned = student.gameBytesEarnedToday || 0;
        const remaining = Math.max(0, GAME_DAILY_BYTE_CAP - alreadyEarned);
        const amount = Math.min(requested, remaining);

        if (amount <= 0) {
            const msUntilReset = GAME_DAILY_RESET_MS - (now - new Date(student.gameBytesResetAt));
            const hoursLeft = Math.max(1, Math.ceil(msUntilReset / (60 * 60 * 1000)));
            return res.status(200).json({
                message: `You've already earned the daily maximum of ${GAME_DAILY_BYTE_CAP} bytes from games. Try again in about ${hoursLeft} hour${hoursLeft === 1 ? '' : 's'}.`,
                bytesEarned: 0,
                requestedBytes: requested,
                cappedAtDailyLimit: true,
                dailyLimit: GAME_DAILY_BYTE_CAP,
                bytesEarnedToday: alreadyEarned,
                totalBytes: student.bytes,
                gameName: gameName,
            });
        }

        student.bytes += amount;
        student.gameBytesEarnedToday = alreadyEarned + amount;
        await student.save();

        const cappedNow = (alreadyEarned + amount) >= GAME_DAILY_BYTE_CAP;
        res.status(200).json({
            message: cappedNow && requested > amount
                ? `You earned ${amount} byte${amount === 1 ? '' : 's'} (daily ${GAME_DAILY_BYTE_CAP}-byte cap reached).`
                : 'Bytes awarded successfully!',
            bytesEarned: amount,
            requestedBytes: requested,
            cappedAtDailyLimit: cappedNow && requested > amount,
            dailyLimit: GAME_DAILY_BYTE_CAP,
            bytesEarnedToday: student.gameBytesEarnedToday,
            totalBytes: student.bytes,
            gameName: gameName,
        });
    } catch (error) {
        console.error('Error awarding game bytes:', error);
        res.status(500).json({ message: 'Failed to award bytes', error: error.message });
    }
});

// GeoQuiz Game Progress Tracking Endpoint
router.post('/api/games/geoquiz/submit-answer', authenticateToken, async (req, res) => {
    try {
        const studentId = req.student.id;
        const { isCorrect, isAlias, nearnessScore, continent, finalScore, accuracy } = req.body;

        const student = await Student.findById(studentId);
        if (!student) {
            return res.status(404).json({ message: 'Student not found.' });
        }

        const achievementsUnlocked = [];

        if (isCorrect) {
            student.totalCountriesIdentified = (student.totalCountriesIdentified || 0) + 1;

            if (!student.geoQuizStats) {
                student.geoQuizStats = {
                    totalCountriesIdentified: 0,
                    perfectSpellings: 0,
                    aliasesUsed: 0,
                    continentsCompleted: [],
                    highestScore: 0,
                    totalGamesPlayed: 0,
                };
            }

            student.geoQuizStats.totalCountriesIdentified++;

            if (student.totalCountriesIdentified === 1) {
                const result = await awardAchievement(studentId, 'geo_first_steps');
                if (result?.newlyUnlocked) achievementsUnlocked.push(result.achievement);
            }

            if (isAlias) {
                student.geoQuizStats.aliasesUsed++;
                const result = await awardAchievement(studentId, 'geo_alias_user');
                if (result?.newlyUnlocked) achievementsUnlocked.push(result.achievement);
            }

            if (nearnessScore === 100) {
                student.geoQuizStats.perfectSpellings++;
            }

            if (student.totalCountriesIdentified === 100) {
                const result = await awardAchievement(studentId, 'geo_geography_adept');
                if (result?.newlyUnlocked) achievementsUnlocked.push(result.achievement);
            }

            if (student.totalCountriesIdentified === 500) {
                const result = await awardAchievement(studentId, 'geo_globe_trotter');
                if (result?.newlyUnlocked) achievementsUnlocked.push(result.achievement);
            }
        }

        if (finalScore && continent) {
            if (finalScore >= 150) {
                const result = await awardAchievement(studentId, 'geo_high_scorer');
                if (result?.newlyUnlocked) achievementsUnlocked.push(result.achievement);
            }

            if (finalScore > (student.geoQuizStats?.highestScore || 0)) {
                student.geoQuizStats.highestScore = finalScore;
            }

            if (!student.geoQuizStats.continentsCompleted.includes(continent)) {
                student.geoQuizStats.continentsCompleted.push(continent);

                if (continent === 'Africa') {
                    const result = await awardAchievement(studentId, 'geo_african_explorer');
                    if (result?.newlyUnlocked) achievementsUnlocked.push(result.achievement);
                }

                if (continent === 'South America') {
                    const result = await awardAchievement(studentId, 'geo_south_american_voyager');
                    if (result?.newlyUnlocked) achievementsUnlocked.push(result.achievement);
                }
            }

            if (accuracy && accuracy >= 90) {
                const result = await awardAchievement(studentId, 'geo_human_gps');
                if (result?.newlyUnlocked) achievementsUnlocked.push(result.achievement);
            }

            if (accuracy === 100) {
                const result = await awardAchievement(studentId, 'geo_flawless_cartographer');
                if (result?.newlyUnlocked) achievementsUnlocked.push(result.achievement);
            }

            if (student.geoQuizStats.continentsCompleted.includes('Africa') &&
                student.geoQuizStats.continentsCompleted.includes('South America')) {
                const result = await awardAchievement(studentId, 'geo_world_class');
                if (result?.newlyUnlocked) achievementsUnlocked.push(result.achievement);
            }
        }

        await student.save();

        res.status(200).json({
            message: 'GeoQuiz progress tracked successfully!',
            achievementsUnlocked,
            stats: {
                totalCountries: student.totalCountriesIdentified,
                geoQuizStats: student.geoQuizStats,
            },
        });
    } catch (error) {
        console.error('Error tracking GeoQuiz progress:', error);
        res.status(500).json({ message: 'Failed to track progress', error: error.message });
    }
});

// Byte-Sudoku Game Progress Tracking Endpoint
router.post('/api/games/sudoku/submit-result', authenticateToken, async (req, res) => {
    try {
        const studentId = req.student.id;
        const { difficulty, completed, hintsUsed, paidHintsUsed, chancesRemaining, grade, isPerfectGame } = req.body;

        const student = await Student.findById(studentId);
        if (!student) {
            return res.status(404).json({ message: 'Student not found.' });
        }

        const achievementsUnlocked = [];

        if (!student.sudokuStats) {
            student.sudokuStats = {
                totalPuzzlesCompleted: 0,
                easyCompleted: 0,
                mediumCompleted: 0,
                hardCompleted: 0,
                impossibleCompleted: 0,
                insaneCompleted: 0,
                brutalCompleted: 0,
                perfectGames: 0,
                hintsUsed: 0,
                paidHintsUsed: 0,
            };
        }

        if (hintsUsed > 0 && student.sudokuStats.hintsUsed === 0) {
            const result = await awardAchievement(studentId, 'sudoku_just_a_nudge');
            if (result?.newlyUnlocked) achievementsUnlocked.push(result.achievement);
        }

        if (completed) {
            student.totalSudokuPuzzlesCompleted = (student.totalSudokuPuzzlesCompleted || 0) + 1;
            student.sudokuStats.totalPuzzlesCompleted++;

            if (difficulty === 'Easy') {
                student.sudokuStats.easyCompleted++;
                const result = await awardAchievement(studentId, 'sudoku_novice');
                if (result?.newlyUnlocked) achievementsUnlocked.push(result.achievement);
            } else if (difficulty === 'Hard') {
                student.sudokuStats.hardCompleted++;
                const result = await awardAchievement(studentId, 'sudoku_adept');
                if (result?.newlyUnlocked) achievementsUnlocked.push(result.achievement);
            } else if (difficulty === 'Brutal') {
                student.sudokuStats.brutalCompleted++;
                const result = await awardAchievement(studentId, 'sudoku_grandmaster');
                if (result?.newlyUnlocked) achievementsUnlocked.push(result.achievement);
            }

            if (chancesRemaining === 0) {
                const result = await awardAchievement(studentId, 'sudoku_close_shave');
                if (result?.newlyUnlocked) achievementsUnlocked.push(result.achievement);
            }

            if ((difficulty === 'Hard' || difficulty === 'Impossible' || difficulty === 'Insane' || difficulty === 'Brutal') &&
                hintsUsed === 0 && paidHintsUsed === 0) {
                const result = await awardAchievement(studentId, 'sudoku_self_sufficient');
                if (result?.newlyUnlocked) achievementsUnlocked.push(result.achievement);
            }

            if (grade === 100) {
                const result = await awardAchievement(studentId, 'sudoku_valedictorian');
                if (result?.newlyUnlocked) achievementsUnlocked.push(result.achievement);
            }

            if (isPerfectGame) {
                student.sudokuStats.perfectGames++;
                const result = await awardAchievement(studentId, 'sudoku_perfect_game');
                if (result?.newlyUnlocked) achievementsUnlocked.push(result.achievement);
            }

            if (student.sudokuStats.easyCompleted >= 1 &&
                student.sudokuStats.mediumCompleted >= 1 &&
                student.sudokuStats.hardCompleted >= 1 &&
                student.sudokuStats.impossibleCompleted >= 1 &&
                student.sudokuStats.insaneCompleted >= 1 &&
                student.sudokuStats.brutalCompleted >= 1) {
                const result = await awardAchievement(studentId, 'sudoku_full_grid');
                if (result?.newlyUnlocked) achievementsUnlocked.push(result.achievement);
            }
        }

        if (paidHintsUsed > 0 && student.sudokuStats.paidHintsUsed === 0) {
            const result = await awardAchievement(studentId, 'sudoku_cost_of_knowledge');
            if (result?.newlyUnlocked) achievementsUnlocked.push(result.achievement);
        }

        student.sudokuStats.hintsUsed += hintsUsed || 0;
        student.sudokuStats.paidHintsUsed += paidHintsUsed || 0;

        await student.save();

        res.status(200).json({
            message: 'Sudoku progress tracked successfully!',
            achievementsUnlocked,
            stats: {
                totalPuzzles: student.totalSudokuPuzzlesCompleted,
                sudokuStats: student.sudokuStats,
            },
        });
    } catch (error) {
        console.error('Error tracking Sudoku progress:', error);
        res.status(500).json({ message: 'Failed to track progress', error: error.message });
    }
});

module.exports = router;
