# Fats and Beef Schema & SchoolByte Backend Spec

## Curriculum

- **Lower school**: S1–S2, 12 subjects (one chosen by student).
- **Middle school**: S3–S4, 9 subjects (two chosen).
- **Upper school**: S5–S6, 5 subjects: four from combination (a,b,c,d with d dependent on a,b,c) plus **General Paper (e)**. General Paper is compulsory and **excluded from quizzes** (no short-answer quizzes). So quiz subjects in upper school = 4 (a–d).

---

## Quizzes

- Each quiz has **10 questions** (short answers).
- **Fats and beef** mix per quiz:
  - **Usual (own class)**: 7 questions
  - **Revision (lower class)**: 2 questions
  - **Stretch (upper class)**: 1 question
- Questions are taken from a **pool**; each question is uploaded **one at a time** by teachers.
- Selection is **not random by subject**: it follows a **fixture** so that over a **cycle** every enrolled subject is covered in usual, revision, and stretch.
- **Randomness** is only in which concrete question is chosen from the pool for a given (subject, class category); students in the same class do not necessarily get the same questions at a given quiz serial number (sn).
- Once a question is used in a submitted quiz, it is **flagged as done** (excluded from future selection) unless a **contingency** unflags it.

---

## Cycles

A **cycle** = one full pass through all enrolled subjects in all three contexts (usual, revision, stretch).

| Division    | Subjects | Usual | Revision | Stretch | **Cycle total** |
|------------|----------|--------|----------|---------|------------------|
| Lower (lcycle) | 12       | 7×12=84 | 2×12=24 | 1×12=12 | **120**          |
| Middle (mcycle) | 9        | 7×9=63  | 2×9=18  | 1×9=9   | **90**           |
| Upper (ucycle) | 4        | 7×4=28  | 2×4=8   | 1×4=4   | **40**           |

- **Quiz serial number (sn)**: 1-based index of the quiz within the current cycle (e.g. sn 1 … 12 for lower, 1 … 9 for middle, 1 … 4 for upper).
- Fixture tables define **which subject** is used in **which slot** (1–10) for each **sn**. Slot 1 = stretch, 2–8 = usual, 9–10 = revision.

---

## Fixtures (subject indices per sn and slot)

Subject names are mapped to indices (A=0, B=1, …) by **enrolled subject order** for that division. The fixture is a 2D grid: `fixture[sn - 1][slot - 1]` = subject index.

- **Lower**: 12 subjects (A–L), 12 rows (sn 1–12), 10 columns (slots 1–10).
- **Middle**: 9 subjects (A–I), 9 rows (sn 1–9), 10 columns.
- **Upper**: 4 subjects (A–D), 4 rows (sn 1–4), 10 columns.

(See `config/fatsAndBeef.js` for the exact numeric fixture arrays.)

---

## Contingency (outgrowth)

When there are **not enough questions** in the pool to build even one full 10-question quiz (e.g. student has done more quizzes than teachers have uploaded), the **contingency cycle (ccycle)** runs:

1. **If the student is at least ¾ through the current cycle**  
   Unflag (return to pool) **all questions used in the current cycle** only.

2. **If the student is less than ¾ through the current cycle**  
   Unflag **all questions from the current cycle and the previous cycle**.

3. **If contingency has already run 10 times in a row**  
   Unflag questions from the **last two quiz cycles** (last two sessions).

After unflagging, question selection for the next quiz remains **random** from the pool (including the restored questions); they may or may not appear again.

---

## Activities

- **5 questions** per activity; longer, more complex answers.
- Uploaded with a **mother file (notes)** for reference after failure or for revision.
- Teacher uploads **positive** and **negative** keywords per question.
- **Minimum 30 words** per answer.

### Activity grading (per question)

- \( P \) = total positive keywords (teacher), \( N \) = total negative keywords (teacher).
- \( p \) = positive keywords found in student answer, \( n \) = negative keywords found.
- \( w \) = word count of student answer; **cap**: \( w \leq 30 \) for the first term (if \( w \geq 31 \), use \( w = 30 \) for that term only).

\[
\text{score} = \left(\frac{\min(w,30)}{30} \times 5\right) + \left(\frac{p}{P} \times 10\right) - \left(\frac{n}{N} \times 5\right)
\]

- **Activity score** = average of per-question scores; bytes awarded from activity use this score (e.g. proportional to `maxBytesReward`).

---

## Quiz grading & bytes

- **Quizzes**: 1 byte per **correct** question; 0 for wrong. No partial bytes per question.
- **Activities**: Grading as above; bytes for the activity set (e.g. proportional to average score and `maxBytesReward`).

---

## Energy

- **Starting energy**: 25 per day.
- **Refill**: 1 energy per hour (automatic).
- Used so that timed quizzes/activities are unnecessary; a typical user can do about **2 quizzes and 1 activity** per day without running out.
- **Games** consume energy but are not counted as “active learning” for this target.

---

## Games (Byte games)

- **Cost**: 2 bytes to start a new game.
- **Reward**: 7 bytes if performed well → **net +5 bytes**.
- Examples: Sudoku, Geography quiz.

---

## Admin & promotion

- Admins can **promote** students (e.g. yearly). On promotion, **S6 accounts are deleted**.

---

## Notes

- Fats and beef schema is **only for quiz question fetching** (which subject in which slot, and which class category: usual/revision/stretch).
- Activities are delivered as uploaded (backend does not restructure them); they can be a set of separate questions or one scenario split into sub-questions with a mother question.
