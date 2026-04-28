// Mock mongoose so loading the quiz-generation module (which imports models)
// does not require a live MongoDB connection.
jest.mock('mongoose', () => {
    const Schema = function () { return { add: () => {}, index: () => {}, pre: () => {}, virtual: () => ({ get: () => {} }) }; };
    Schema.Types = { ObjectId: 'ObjectId', Mixed: 'Mixed' };
    return {
        Schema,
        model: () => ({}),
        models: {},
        Types: { ObjectId: jest.fn() },
        connect: jest.fn(),
    };
});

const {
    gradeNLPAnswer,
    shuffleArray,
    findUnderrepresentedSlots,
    determineQuestionCategory,
} = require('../../src/services/quiz-generation');

describe('gradeNLPAnswer', () => {
    test('returns 1.0 when no keywords are configured', async () => {
        const score = await gradeNLPAnswer('anything', { keywordsForGrading: [] });
        expect(score).toBe(1);
    });

    test('returns full credit when every keyword is present', async () => {
        const q = { keywordsForGrading: ['photosynthesis', 'chlorophyll', 'sunlight'] };
        const score = await gradeNLPAnswer('Photosynthesis uses chlorophyll and sunlight.', q);
        expect(score).toBe(1);
    });

    test('returns partial credit proportional to matched keywords', async () => {
        // Use distinctive multi-character keywords to avoid the substring
        // overlap behaviour of the grader (e.g. "and" contains "a" and "d").
        const q = { keywordsForGrading: ['mitosis', 'meiosis', 'spindle', 'centromere'] };
        const score = await gradeNLPAnswer('Mitosis involves a spindle apparatus.', q);
        expect(score).toBeCloseTo(0.5, 5);
    });

    test('keyword matching is case-insensitive and substring-based', async () => {
        const q = { keywordsForGrading: ['Photosynthesis'] };
        expect(await gradeNLPAnswer('PHOTOSYNTHESIS happens in plants.', q)).toBe(1);
        expect(await gradeNLPAnswer('photosynthesisrate diagram', q)).toBe(1);
    });

    test('subtracts 0.1 per negative keyword and clamps at 0', async () => {
        const q = {
            keywordsForGrading: ['photosynthesis', 'chlorophyll'],
            negativeKeywords: ['guess', 'maybe'],
        };
        const score = await gradeNLPAnswer('photosynthesis chlorophyll guess maybe', q);
        // 1.0 (full match) - 2 * 0.1 = 0.8
        expect(score).toBeCloseTo(0.8, 5);
    });

    test('never returns more than 1 or less than 0', async () => {
        const q = { keywordsForGrading: ['x'], negativeKeywords: ['bad', 'wrong', 'nope', 'no', 'never'] };
        const score = await gradeNLPAnswer('bad wrong nope no never', q);
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(1);
    });
});

describe('shuffleArray', () => {
    test('preserves length and contents (multiset)', () => {
        const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
        const before = [...arr];
        shuffleArray(arr);
        expect(arr).toHaveLength(before.length);
        expect([...arr].sort((a, b) => a - b)).toEqual(before);
    });

    test('eventually produces a different ordering across many runs', () => {
        const original = [1, 2, 3, 4, 5, 6, 7, 8];
        let seenDifferent = false;
        for (let i = 0; i < 100 && !seenDifferent; i++) {
            const a = [...original];
            shuffleArray(a);
            if (a.some((v, idx) => v !== original[idx])) seenDifferent = true;
        }
        expect(seenDifferent).toBe(true);
    });
});

describe('findUnderrepresentedSlots', () => {
    test('returns empty per-subject buckets when all quotas are met', () => {
        const progress = { Math: { ownClass: 5, lowerClass: 2, higherClass: 3 } };
        expect(findUnderrepresentedSlots(progress)).toEqual({ Math: {} });
    });

    test('reports remaining count per category when below quota', () => {
        const progress = { Math: { ownClass: 2, lowerClass: 0, higherClass: 1 } };
        expect(findUnderrepresentedSlots(progress)).toEqual({
            Math: { ownClass: 3, lowerClass: 2, higherClass: 2 },
        });
    });

    test('handles missing categories as zero', () => {
        const progress = { English: {} };
        expect(findUnderrepresentedSlots(progress)).toEqual({
            English: { ownClass: 5, lowerClass: 2, higherClass: 3 },
        });
    });
});

describe('determineQuestionCategory', () => {
    test('returns ownClass for matching class', () => {
        expect(determineQuestionCategory('S.3', 'S.3')).toBe('ownClass');
    });

    test('returns lowerClass for an earlier class', () => {
        expect(determineQuestionCategory('S.4', 'S.2')).toBe('lowerClass');
    });

    test('returns higherClass for a later class', () => {
        expect(determineQuestionCategory('S.2', 'S.5')).toBe('higherClass');
    });
});
