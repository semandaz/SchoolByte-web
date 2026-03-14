/**
 * Fats and Beef schema config: divisions, cycle sizes, and fixture tables.
 * Fixture: fixture[sn - 1][slot - 1] = subject index (0-based) in enrolled subjects.
 * Slot 1 = stretch (upper class), Slots 2-8 = usual (own class), Slots 9-10 = revision (lower class).
 */

const CLASS_ORDER = ['S.1', 'S.2', 'S.3', 'S.4', 'S.5', 'S.6'];

const DIVISIONS = {
  LOWER: { classes: ['S.1', 'S.2'], subjectCount: 12, name: 'lower' },
  MIDDLE: { classes: ['S.3', 'S.4'], subjectCount: 9, name: 'middle' },
  UPPER: { classes: ['S.5', 'S.6'], subjectCount: 4, name: 'upper' }
};

const CYCLE_SIZES = {
  lower: 120,  // lcycle
  middle: 90,  // mcycle
  upper: 40    // ucycle
};

/** Quizzes per cycle (same as subject count for that division). */
const QUIZZES_PER_CYCLE = {
  lower: 12,
  middle: 9,
  upper: 4
};

/** Usual = 7, Revision = 2, Stretch = 1 per quiz. */
const SLOT_CATEGORY = {
  1: 'stretch',   // slot 1
  2: 'usual',
  3: 'usual',
  4: 'usual',
  5: 'usual',
  6: 'usual',
  7: 'usual',
  8: 'usual',
  9: 'revision',
  10: 'revision'
};

/**
 * Lower school fixture: 12 rows (sn 1-12), 10 columns (slots 1-10).
 * Subject indices A=0 .. L=11.
 */
const LOWER_SCHOOL_FIXTURE = [
  [0, 0, 1, 2, 3, 4, 5, 6, 0, 1],   // sn 1: A A B C D E F G A B
  [1, 7, 8, 9, 10, 11, 0, 1, 2, 3],
  [2, 2, 3, 4, 5, 6, 7, 8, 4, 5],
  [3, 9, 10, 11, 0, 1, 2, 3, 4, 5],
  [4, 4, 5, 6, 7, 8, 9, 10, 8, 9],
  [5, 11, 0, 1, 2, 3, 4, 5, 10, 11],
  [6, 6, 7, 8, 9, 10, 11, 0, 0, 1],
  [7, 1, 2, 3, 4, 5, 6, 7, 2, 3],
  [8, 8, 9, 10, 11, 0, 1, 2, 4, 5],
  [9, 3, 4, 5, 6, 7, 8, 9, 6, 7],
  [10, 10, 11, 0, 1, 2, 3, 4, 8, 9],
  [11, 5, 6, 7, 8, 9, 10, 11, 10, 11]
];

/**
 * Middle school fixture: 9 rows (sn 1-9), 10 columns.
 * Subject indices A=0 .. I=8.
 */
const MIDDLE_SCHOOL_FIXTURE = [
  [0, 0, 1, 2, 3, 4, 5, 6, 0, 1],   // sn 1
  [1, 7, 8, 0, 1, 2, 3, 4, 2, 3],
  [2, 5, 6, 7, 8, 0, 1, 2, 4, 5],
  [3, 3, 4, 5, 6, 7, 8, 0, 6, 7],
  [4, 1, 2, 3, 4, 5, 6, 7, 8, 0],
  [5, 8, 0, 1, 2, 3, 4, 5, 1, 2],
  [6, 6, 7, 8, 0, 1, 2, 3, 3, 4],
  [7, 4, 5, 6, 7, 8, 0, 1, 5, 6],
  [8, 2, 3, 4, 5, 6, 7, 8, 7, 8]
];

/**
 * Upper school fixture: 4 rows (sn 1-4), 10 columns. Subjects A-D only (General Paper excluded).
 */
const UPPER_SCHOOL_FIXTURE = [
  [0, 0, 1, 2, 3, 0, 1, 2, 0, 1],   // sn 1
  [1, 3, 0, 1, 2, 3, 0, 1, 2, 3],
  [2, 2, 3, 0, 1, 2, 3, 0, 0, 1],
  [3, 1, 2, 3, 0, 1, 2, 3, 2, 3]
];

function getDivision(studentClass) {
  if (DIVISIONS.LOWER.classes.includes(studentClass)) return 'lower';
  if (DIVISIONS.MIDDLE.classes.includes(studentClass)) return 'middle';
  if (DIVISIONS.UPPER.classes.includes(studentClass)) return 'upper';
  return null;
}

function getFixture(division) {
  if (division === 'lower') return LOWER_SCHOOL_FIXTURE;
  if (division === 'middle') return MIDDLE_SCHOOL_FIXTURE;
  if (division === 'upper') return UPPER_SCHOOL_FIXTURE;
  return null;
}

/** 1-based quiz serial number within current cycle from questionsCompletedCount. */
function getQuizSerialNumber(questionsCompletedInCycle, division) {
  const quizzesInCycle = QUIZZES_PER_CYCLE[division];
  if (!quizzesInCycle) return 1;
  const quizzesCompleted = Math.floor(questionsCompletedInCycle / 10);
  return (quizzesCompleted % quizzesInCycle) + 1;
}

/** Contingency: ¾ threshold for cycle (questions). */
function getThreeQuartersCycle(division) {
  const total = CYCLE_SIZES[division];
  return total ? Math.floor((3 * total) / 4) : 0;
}

module.exports = {
  CLASS_ORDER,
  DIVISIONS,
  CYCLE_SIZES,
  QUIZZES_PER_CYCLE,
  SLOT_CATEGORY,
  LOWER_SCHOOL_FIXTURE,
  MIDDLE_SCHOOL_FIXTURE,
  UPPER_SCHOOL_FIXTURE,
  getDivision,
  getFixture,
  getQuizSerialNumber,
  getThreeQuartersCycle
};
