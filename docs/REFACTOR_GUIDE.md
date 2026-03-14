# SchoolByte Backend Refactor Guide

This document describes the target folder structure, what’s been done, and what to do next. Use it to split the large `server.js` into modules without breaking behavior.

---

## 1. Recommended folder structure (priority order)

Create and use these top-level folders:

| Folder | Purpose |
|--------|--------|
| **config/** | `fatsAndBeef.js` (done), `db.js`, `env.js` |
| **models/** | One file per Mongoose model (Student, Teacher, QuizQuestion, QuizSession, Activity, WorkFile, etc.) |
| **controllers/** | One controller per resource (auth, student, teacher, admin, quiz, achievements, ai, chat) |
| **routes/** | Express routers (auth.js, students.js, teachers.js, admin.js, achievements.js, workfiles.js, ai.js) |
| **services/** | `ollamaService.js`, `mailService.js`, `cloudinaryService.js`, `achievementService.js` |
| **middleware/** | `auth.js` (authenticateToken, authenticateTeacherToken, authenticateAdminToken), `rateLimiter.js`, `errorHandler.js`, `validateRequest.js` |
| **utils/** | `grading.js`, `energy.js`, `contingency.js`, `shuffle.js`, `extractJSON.js` |
| **jobs/** or **cron/** | Weekly resets, energy refills, `initializeSubjects`, `initializeAdmin` (or run via scripts) |
| **sockets/** | Socket.io setup and ByteNexus message handlers (move from server.js) |
| **validators/** | express-validator chains used by routes |
| **scripts/** | `seedSubjects.js`, `createAdmin.js`, `migrate.js` |
| **tests/** | Unit/integration tests (Jest or Mocha) |
| **docs/** | FATS_AND_BEEF_SPEC.md, this REFACTOR_GUIDE.md, teacher grading docs |
| **logs/** | App logs (e.g. winston, rotated) |

---

## 2. Done in this pass

- **Student signup (`public/studentsignup.html`)**  
  - Fixed `subjectsSection` reference error: added `const subjectsSection = document.getElementById('subjectsSection');` to the DOM elements block so it’s in scope when email is verified.

- **Student login (`public/studentlogin.html`)**  
  - Check `response.ok` before using `data.token` and `data.student`; show server error message and re-enable button on failure.  
  - Removed unused “Student’s Full Name” field; login uses email + password only.  
  - Validation and submit logic updated to match.

- **Duplicate leaderboard routes**  
  - Replaced two implementations (`GET /leaderboard` and `GET /api/leaderboard`) with a single `getLeaderboardHandler`.  
  - Both paths now use the same handler (consistent behavior, one place to change).  
  - Response includes `message`, `leaderboard`, and `totalPlayers`; uses `isEmailVerified: true` and a limit (default 200, max 500).

- **New files (no wiring yet)**  
  - `config/env.js` – `requireEnv`, `checkEnv` for centralized env validation.  
  - `config/db.js` – `connect(mongoose, uri)` for MongoDB (to be used from server.js).  
  - `utils/grading.js` – `gradeNLPAnswer` and `gradeActivityAnswer` (can replace in-server copies when you wire routes to utils).

---

## 3. Typos, duplicates, and fragile spots (from review)

- **Duplicate routes**  
  Leaderboard duplicate is fixed. Search for other repeated route paths (e.g. `app.get('/some-path'...)` in more than one place) and consolidate.

- **Contingency logic**  
  `runContingencyAndRetry()` mutates `student.recentQuizIds` and `contingencyRepeatCount`. Keep all DB updates in transactions where possible and add logging/metrics when contingency runs.

- **WorkFile.activity**  
  Schema has `activity` as required and unique (1:1). Confirm this is intentional; it blocks workfiles without an activity and one activity shared by multiple files.

- **Session/transaction usage**  
  When moving quiz/activity code to controllers or services, keep transaction boundaries clear and always abort/end sessions on error and early returns.

- **initializeAdmin()**  
  Do not hardcode admin password or emails. Use env vars and/or scripts (e.g. `scripts/createAdmin.js`) and document in README.

- **String formatting**  
  Unify truncation style (e.g. `lastMessage.substring(0, 50) + (len > 50 ? '...' : '')`) across the codebase for consistency.

---

## 4. Suggested next steps (practical order)

1. **Wire config**  
   In `server.js`: `require('./config/env').checkEnv()` after loading env; use `require('./config/db').connect(mongoose, MONGODB_URI)` instead of inline `mongoose.connect(...)`.

2. **Move models**  
   Extract each schema from `server.js` into `models/<Name>.js`; export the model. Require models in `server.js` (or in routes/controllers) so the app still runs. Keep indexes in the model files.

3. **Move auth middleware**  
   Put `authenticateToken`, `authenticateTeacherToken`, `authenticateAdminToken` in `middleware/auth.js` (use `process.env.JWT_SECRET`). Require and use them in `server.js` (or in route files) so behavior is unchanged.

4. **Use utils/grading.js**  
   In quiz submit and activity submit handlers, replace in-file `gradeNLPAnswer` (and activity formula) with `require('./utils/grading').gradeNLPAnswer` and `gradeActivityAnswer`. Run tests/manual checks.

5. **Extract sockets**  
   Move the large `io.on('connection', ...)` block to e.g. `sockets/byteNexus.js`; export a function `attachByteNexus(io)` and call it from `server.js` with the same `io` instance.

6. **Add tooling**  
   ESLint + Prettier, optional husky pre-commit; add a central error middleware and replace ad-hoc `console.log` with a logger (e.g. winston) and optional log rotation in `logs/`.

7. **Rate limiting**  
   Add express-rate-limit (or similar) for auth and AI endpoints.

8. **Tests**  
   Start with unit tests for `utils/grading.js`, then quiz generation and contingency logic.

---

## 5. Quick checklist (from your list)

- [x] Fix studentsignup.html (subjectsSection)
- [x] Fix studentlogin.html (response.ok, email+password only)
- [x] Deduplicate leaderboard routes
- [ ] Create `/models` and move Student, QuizQuestion, Activity, WorkFile, Teacher
- [ ] Create `/services/ollamaService.js` and move `callOllamaAI` + `extractJSON`
- [ ] Create `/routes/quiz.js` and `/controllers/quizController.js`; move `generateQuizQuestions` and related handlers
- [ ] Create `/sockets/byteNexus.js` and attach from server.js
- [ ] Remove any remaining duplicate route definitions
- [ ] Move admin init and secrets to env/scripts

---

## 6. Notes

- **Fats and Beef** config lives in `config/fatsAndBeef.js` and is required from `server.js`; keep it modular.  
- **Docs**: `docs/FATS_AND_BEEF_SPEC.md` for quiz/cycle/activity/grading; this file for refactor and fixes.
