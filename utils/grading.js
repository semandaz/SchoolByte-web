/**
 * Grading utilities for quizzes and activities.
 * Used by quiz submission (short-answer/NLP) and can be extended for activity formula.
 */

/**
 * NLP grading for quiz short-answer: positive/negative keyword match.
 * Returns score in [0, 1]. If no keywords, returns 1 (assume correct).
 */
async function gradeNLPAnswer(studentAnswer, quizQuestion) {
    if (!quizQuestion.keywordsForGrading || quizQuestion.keywordsForGrading.length === 0) {
        return 1;
    }

    let matchedKeywords = 0;
    let negativeMatches = 0;
    const normalizedAnswer = (studentAnswer || '').toLowerCase().trim();

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
    score = Math.max(0, score - (negativeMatches * 0.1));
    return Math.min(1, score);
}

/**
 * Activity per-question score: (min(w,30)/30)*5 + (p/P)*10 - (n/N)*5
 * P/N = teacher positive/negative keyword counts, p/n = student match counts, w = word count.
 */
function gradeActivityAnswer(studentAnswer, question) {
    const P = (question.keywordsForMarking || []).length;
    const N = (question.negativeKeywords || []).length;
    if (!studentAnswer || !studentAnswer.trim()) return 0;

    const normalizedAnswer = studentAnswer.toLowerCase();
    const words = studentAnswer.trim().split(/\s+/).filter(Boolean);
    const w = words.length;
    const wCap = Math.min(w, 30);

    let p = 0;
    for (const kw of (question.keywordsForMarking || [])) {
        if (normalizedAnswer.includes(kw.toLowerCase().trim())) p++;
    }
    let n = 0;
    for (const kw of (question.negativeKeywords || [])) {
        if (normalizedAnswer.includes(kw.toLowerCase().trim())) n++;
    }

    const wordTerm = (wCap / 30) * 5;
    const posTerm = P > 0 ? (p / P) * 10 : 0;
    const negTerm = N > 0 ? (n / N) * 5 : 0;
    return Math.max(0, wordTerm + posTerm - negTerm);
}

module.exports = { gradeNLPAnswer, gradeActivityAnswer };
