// Quiz generation + grading helpers extracted from server.js.
// Used by /student/quizzes/generate, /student/quizzes/submit and the
// AI-quiz endpoints. Pure functions live here; route wiring stays in
// the route module.

const mongoose = require('mongoose');

const Student = require('../../models/Student');
const QuizSession = require('../../models/QuizSession');
const QuizQuestion = require('../../models/QuizQuestion');
const CompletedQuizAttempt = require('../../models/CompletedQuizAttempt');

const {
    getDivision,
    getFixture,
    getQuizSerialNumber,
    getThreeQuartersCycle,
    CYCLE_SIZES,
    SLOT_CATEGORY,
    CLASS_ORDER,
    normalizeClass,
} = require('../../config/fatsAndBeef');

const { subjectsMatchClass, getCycleSubjects } = require('../../config/subjectRules');

// Enhanced NLP grading function.
async function gradeNLPAnswer(studentAnswer, quizQuestion) {
    if (!quizQuestion.keywordsForGrading || quizQuestion.keywordsForGrading.length === 0) {
        return 1; // If no keywords, assume correct
    }

    let matchedKeywords = 0;
    let negativeMatches = 0;
    const normalizedAnswer = studentAnswer.toLowerCase().trim();

    for (const keyword of quizQuestion.keywordsForGrading) {
        if (normalizedAnswer.includes(keyword.toLowerCase().trim())) {
            matchedKeywords++;
        }
    }

    if (quizQuestion.negativeKeywords && quizQuestion.negativeKeywords.length > 0) {
        for (const negKeyword of quizQuestion.negativeKeywords) {
            if (normalizedAnswer.includes(negKeyword.toLowerCase().trim())) {
                negativeMatches++;
            }
        }
    }

    let score = matchedKeywords / quizQuestion.keywordsForGrading.length;
    score = Math.max(0, score - negativeMatches * 0.1);
    return Math.min(1, score);
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

function findUnderrepresentedSlots(subjectProgress) {
    const underrepresented = {};
    const quotas = { ownClass: 5, lowerClass: 2, higherClass: 3 };

    for (const subject in subjectProgress) {
        underrepresented[subject] = {};
        for (const category in quotas) {
            const current = subjectProgress[subject][category] || 0;
            const needed = quotas[category] - current;
            if (needed > 0) {
                underrepresented[subject][category] = needed;
            }
        }
    }
    return underrepresented;
}

function determineQuestionCategory(studentClass, questionClass) {
    const classOrder = ['S.1', 'S.2', 'S.3', 'S.4', 'S.5', 'S.6'];
    const studentIndex = classOrder.indexOf(studentClass);
    const questionIndex = classOrder.indexOf(questionClass);

    if (studentIndex === questionIndex) return 'ownClass';
    if (questionIndex < studentIndex) return 'lowerClass';
    if (questionIndex > studentIndex) return 'higherClass';
    return null;
}

// Quiz generation: Fats and Beef schema with fixture tables (7 usual, 2 revision, 1 stretch).
async function generateQuizQuestions(student, requestedSubject = null, isRetry = false) {
    const session = await mongoose.startSession();
    session.startTransaction();

    const safeAbort = async () => {
        try { if (session.inTransaction()) await session.abortTransaction(); } catch (_) {}
        try { session.endSession(); } catch (_) {}
    };

    try {
        let quizSession = await QuizSession.findById(student.currentQuizSessionId).session(session);
        if (!quizSession) {
            quizSession = new QuizSession({
                userId: student._id,
                questionsCompletedCount: 0,
            });
            await quizSession.save({ session });
            student.currentQuizSessionId = quizSession._id;
            await student.save({ session });
        }

        const division = getDivision(student.class);
        if (!division) {
            const err = new Error('Invalid student class for quiz generation.');
            err.userMessage = 'Your class is not set correctly. Please update your profile.';
            err.statusCode = 400;
            throw err;
        }

        if (student.needsSubjectSelection) {
            const err = new Error('Student must re-select subjects after promotion.');
            err.userMessage = `You were just promoted to ${student.class}. The subject structure has changed — please pick your new subjects in your profile before taking another quiz.`;
            err.statusCode = 400;
            err.code = 'NEEDS_SUBJECT_SELECTION';
            throw err;
        }

        if (!subjectsMatchClass(student.class, student.subjectsEnrolled)) {
            const err = new Error('Enrolled subjects do not match current class.');
            err.userMessage = `Your enrolled subjects do not match the structure for ${student.class}. Please update your subject list in your profile.`;
            err.statusCode = 400;
            err.code = 'NEEDS_SUBJECT_SELECTION';
            throw err;
        }

        const enrolledSubjects = getCycleSubjects(student.class, student.subjectsEnrolled);
        if (enrolledSubjects.length === 0) {
            const err = new Error('No subjects enrolled.');
            err.userMessage = 'You have no subjects enrolled yet. Please add your subjects in your profile to start taking quizzes.';
            err.statusCode = 400;
            err.code = 'NO_SUBJECTS';
            throw err;
        }

        const fixture = getFixture(division);
        if (!fixture) {
            const err = new Error('No fixture for division.');
            err.userMessage = 'Quiz schedule could not be loaded for your class. Please try again later.';
            err.statusCode = 500;
            throw err;
        }

        const sn = getQuizSerialNumber(quizSession.questionsCompletedCount, division);
        const rowIndex = (sn - 1) % fixture.length;
        const fixtureRow = fixture[rowIndex];

        const studentClass = normalizeClass(student.class) || student.class;
        const classIndex = CLASS_ORDER.indexOf(studentClass);
        const ownClasses = [studentClass];
        const lowerClasses = classIndex > 0 ? CLASS_ORDER.slice(0, classIndex) : [];
        const upperClasses = classIndex < CLASS_ORDER.length - 1 ? CLASS_ORDER.slice(classIndex + 1) : [];

        function getAllowedClasses(category) {
            if (category === 'usual') return ownClasses;
            if (category === 'revision') return lowerClasses;
            if (category === 'stretch') return upperClasses;
            return [];
        }

        const selectedQuestions = [];
        const usedQuestionIds = new Set();
        const gaps = [];

        for (let slot = 1; slot <= 10; slot++) {
            const subjectIndex = fixtureRow[slot - 1] % enrolledSubjects.length;
            const subject = enrolledSubjects[subjectIndex];
            const category = SLOT_CATEGORY[slot];
            const allowedClasses = getAllowedClasses(category);

            if (allowedClasses.length === 0) {
                gaps.push({ slot, subject, intendedClasses: allowedClasses, category });
                continue;
            }

            const excludeIds = [...(student.recentQuizIds || []), ...Array.from(usedQuestionIds)];
            const questions = await QuizQuestion.find({
                subject,
                intendedClass: { $in: allowedClasses },
                isActive: true,
                _id: excludeIds.length ? { $nin: excludeIds } : { $exists: true },
            })
                .sort({ timesServedOverall: 1, lastServedTimestamp: 1 })
                .limit(20)
                .session(session)
                .lean();

            if (questions.length === 0) {
                const usedIdsStr = new Set(Array.from(usedQuestionIds).map((id) => id.toString()));
                const recentCandidateIds = (student.recentQuizIds || []).filter(
                    (id) => !usedIdsStr.has(id.toString())
                );
                const fallbackQs = recentCandidateIds.length
                    ? await QuizQuestion.find({
                        subject,
                        intendedClass: { $in: allowedClasses },
                        isActive: true,
                        _id: { $in: recentCandidateIds },
                    })
                        .sort({ lastServedTimestamp: 1 })
                        .limit(3)
                        .session(session)
                        .lean()
                    : [];

                if (fallbackQs.length > 0) {
                    const chosen = fallbackQs[Math.floor(Math.random() * fallbackQs.length)];
                    selectedQuestions.push({ question: chosen, slot });
                    usedQuestionIds.add(chosen._id);
                    continue;
                }

                if (!isRetry) {
                    await safeAbort();
                    const result = await runContingencyAndRetry(student, quizSession, division);
                    return result;
                }
                gaps.push({ slot, subject, intendedClasses: allowedClasses, category });
                continue;
            }

            const chosen = questions[Math.floor(Math.random() * questions.length)];
            selectedQuestions.push({ question: chosen, slot });
            usedQuestionIds.add(chosen._id);
        }

        shuffleArray(selectedQuestions);

        setImmediate(async () => {
            for (const { question } of selectedQuestions) {
                await QuizQuestion.updateOne(
                    { _id: question._id },
                    { $inc: { timesServedOverall: 1 }, $set: { lastServedTimestamp: new Date() } }
                );
            }
        });

        await session.commitTransaction();
        session.endSession();

        const foundQuestions = selectedQuestions.map((sq) => sq.question);
        if (gaps.length === 0) {
            return foundQuestions;
        }
        return { questions: foundQuestions, gaps, division, studentClass };
    } catch (error) {
        await safeAbort();
        throw error;
    }
}

async function runContingencyAndRetry(student, quizSession, division) {
    const studentId = student._id;
    const currentSessionId = quizSession._id;
    const questionsInCycle = quizSession.questionsCompletedCount;
    const cycleSize = CYCLE_SIZES[division];
    const threeQuarters = getThreeQuartersCycle(division);

    const sessionsToUnflag = [];
    if ((student.contingencyRepeatCount || 0) >= 10) {
        const lastTwo = await QuizSession.find({ userId: studentId }).sort({ startedAt: -1 }).limit(2).lean();
        sessionsToUnflag.push(...lastTwo.map((s) => s._id));
    } else if (questionsInCycle >= threeQuarters) {
        sessionsToUnflag.push(currentSessionId);
    } else {
        sessionsToUnflag.push(currentSessionId);
        const previous = await QuizSession.findOne({ userId: studentId, _id: { $ne: currentSessionId } })
            .sort({ startedAt: -1 })
            .lean();
        if (previous) sessionsToUnflag.push(previous._id);
    }

    const attempts = await CompletedQuizAttempt.find({ quizSessionId: { $in: sessionsToUnflag } })
        .select('quizId')
        .lean();
    const idsToRestore = attempts.map((a) => a.quizId);
    const recentIds = (student.recentQuizIds || []).filter((id) => !idsToRestore.some((rid) => rid.equals(id)));
    student.recentQuizIds = recentIds;
    student.contingencyRepeatCount = (student.contingencyRepeatCount || 0) + 1;
    await student.save();

    const updatedStudent = await Student.findById(studentId);
    return generateQuizQuestions(updatedStudent, null, true);
}

module.exports = {
    gradeNLPAnswer,
    shuffleArray,
    findUnderrepresentedSlots,
    determineQuestionCategory,
    generateQuizQuestions,
    runContingencyAndRetry,
};
