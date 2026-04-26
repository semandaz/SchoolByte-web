/**
 * Single source of truth for subject selection rules across signup, profile
 * editing and quiz generation. All three layers (frontend signup form,
 * profile editor, quiz endpoint) must agree on these rules so the Fats &
 * Beef quiz schema always lines up with what the student is enrolled in.
 *
 * Division rules:
 *   - Lower (S.1, S.2): 7 compulsory + 5 electives = 12 total
 *   - Middle (S.3, S.4): 7 compulsory + 2 electives = 9 total
 *   - Upper (S.5, S.6): 1 compulsory (General Paper) + 4 chosen = 5 total
 *
 * The quiz cycle for upper school uses 4 subjects (General Paper is excluded
 * from the cycle but still recorded as enrolled).
 */

const { normalizeClass } = require('./fatsAndBeef');

const COMPULSORY_O_LEVEL = [
  'Mathematics',
  'English Language',
  'Physics',
  'Chemistry',
  'Biology',
  'History',
  'Geography'
];

const O_LEVEL_ELECTIVES = [
  'Computer Science',
  'Agriculture',
  'Literature in English',
  'French',
  'German',
  'Kiswahili',
  'Luganda',
  'Fine Art',
  'Performing Arts',
  'Physical Education',
  'Technology and Design'
];

const GENERAL_PAPER = 'General Paper';

const A_LEVEL_OPTIONAL = [
  'Mathematics',
  'English Language',
  'Biology',
  'Chemistry',
  'Physics',
  'History',
  'Geography',
  'Computer Science',
  'Agriculture',
  'Literature in English',
  'German',
  'Kiswahili',
  'Luganda',
  'Fine Art',
  'Performing Arts',
  'Physical Education',
  'Technology and Design',
  'Economics',
  'Subsidiary Mathematics'
];

const RULES = {
  lower: {
    division: 'lower',
    classes: ['S.1', 'S.2'],
    expectedCount: 12,
    compulsory: COMPULSORY_O_LEVEL.slice(),
    electives: O_LEVEL_ELECTIVES.slice(),
    electivesToPick: 5,
    description: '7 compulsory + 5 additional subjects (12 total)',
    electivesLabel: 'Choose exactly 5 additional subjects'
  },
  middle: {
    division: 'middle',
    classes: ['S.3', 'S.4'],
    expectedCount: 9,
    compulsory: COMPULSORY_O_LEVEL.slice(),
    electives: O_LEVEL_ELECTIVES.slice(),
    electivesToPick: 2,
    description: '7 compulsory + 2 additional subjects (9 total)',
    electivesLabel: 'Choose exactly 2 additional subjects'
  },
  upper: {
    division: 'upper',
    classes: ['S.5', 'S.6'],
    expectedCount: 5,
    compulsory: [GENERAL_PAPER],
    electives: A_LEVEL_OPTIONAL.slice(),
    electivesToPick: 4,
    description: 'General Paper (compulsory) + 4 chosen subjects (5 total)',
    electivesLabel: 'Choose exactly 4 subjects (General Paper is automatic)'
  }
};

function getDivisionForClass(studentClass) {
  const c = normalizeClass(studentClass);
  if (!c) return null;
  if (RULES.lower.classes.includes(c)) return 'lower';
  if (RULES.middle.classes.includes(c)) return 'middle';
  if (RULES.upper.classes.includes(c)) return 'upper';
  return null;
}

function getRulesForClass(studentClass) {
  const div = getDivisionForClass(studentClass);
  return div ? RULES[div] : null;
}

/** Returns { ok: true } or { ok: false, message } */
function validateSubjectSelection(studentClass, subjects) {
  const rules = getRulesForClass(studentClass);
  if (!rules) {
    return { ok: false, message: 'Unrecognized class. Please contact support.' };
  }
  if (!Array.isArray(subjects)) {
    return { ok: false, message: 'Subjects must be a list.' };
  }

  // Deduplicate while preserving order
  const seen = new Set();
  const cleaned = [];
  for (const raw of subjects) {
    if (typeof raw !== 'string') continue;
    const name = raw.trim();
    if (!name) continue;
    if (seen.has(name)) continue;
    seen.add(name);
    cleaned.push(name);
  }

  if (cleaned.length !== rules.expectedCount) {
    return {
      ok: false,
      message: `${rules.classes.join('/')} students must enroll in exactly ${rules.expectedCount} subjects (${rules.description}). You sent ${cleaned.length}.`
    };
  }

  // All compulsory must be present
  for (const name of rules.compulsory) {
    if (!cleaned.includes(name)) {
      return {
        ok: false,
        message: `${name} is compulsory for your class and must be included.`
      };
    }
  }

  // Every chosen subject must be either compulsory or in the elective list
  const allowed = new Set([...rules.compulsory, ...rules.electives]);
  const invalid = cleaned.filter(s => !allowed.has(s));
  if (invalid.length) {
    return {
      ok: false,
      message: `These subjects are not offered for your class: ${invalid.join(', ')}.`
    };
  }

  // Sort: compulsory first (in their canonical order), then electives in the order picked
  const ordered = [
    ...rules.compulsory.filter(s => cleaned.includes(s)),
    ...cleaned.filter(s => !rules.compulsory.includes(s))
  ];

  return { ok: true, subjects: ordered };
}

/**
 * Returns the subjects that the Fats & Beef quiz cycle should iterate over.
 * For upper school, General Paper is excluded from the cycle (still part of
 * enrolment, but not part of the 4-subject quiz rotation).
 */
function getCycleSubjects(studentClass, enrolledSubjects) {
  const div = getDivisionForClass(studentClass);
  const list = (enrolledSubjects || []).filter(Boolean);
  if (div === 'upper') {
    return list.filter(s => String(s).trim().toLowerCase() !== GENERAL_PAPER.toLowerCase());
  }
  return list;
}

/**
 * Returns true when the student's currently-stored subjects do not match the
 * rules for their current class (e.g. they were just promoted across a
 * division boundary). Use this to decide whether to flag the student.
 */
function subjectsMatchClass(studentClass, enrolledSubjects) {
  const result = validateSubjectSelection(studentClass, enrolledSubjects || []);
  return result.ok === true;
}

module.exports = {
  RULES,
  COMPULSORY_O_LEVEL,
  O_LEVEL_ELECTIVES,
  A_LEVEL_OPTIONAL,
  GENERAL_PAPER,
  getDivisionForClass,
  getRulesForClass,
  validateSubjectSelection,
  getCycleSubjects,
  subjectsMatchClass
};
