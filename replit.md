# SchoolByte — Educational Platform

## Overview
Full-stack educational platform with student dashboards, teacher portals, quiz/activity systems, a project gallery, educational games, and AI features.

## Architecture
- **Backend**: Node.js / Express.js, running on port 3002
- **Database**: MongoDB (Mongoose ORM)
- **Auth**: JWT — always stored as `"token"` in localStorage for students, `"adminToken"` for admins
- **AI**: Groq API (`groq-sdk`, model: `llama-3.1-8b-instant`) via `GROQ_API_KEY` env var
- **File Uploads**: Cloudinary (photos for gallery, profile images)
- **Real-time**: Socket.io (chat system)

## Key Environment Variables
- `MONGODB_URI` — MongoDB connection string (required)
- `JWT_SECRET` — JWT signing secret (required)
- `GROQ_API_KEY` — Groq AI API key (required for AI features)
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` — Cloudinary credentials
- `EMAIL_USER`, `EMAIL_PASS` — Email for password reset OTPs
- `ADMIN_EMAIL`, `ADMIN_INITIAL_PASSWORD` — Admin account bootstrap

## User Roles
1. **Student** — auth via `/login-student`, token in `localStorage.getItem('token')`
2. **Teacher** — auth via `/login-teacher`
3. **Admin** — auth via `/login-admin` + 2FA, token in `localStorage.getItem('adminToken')`

## Important Files
| File | Purpose |
|------|---------|
| `server.js` | Main Express server (6500+ lines), all API routes |
| `models/Student.js` | Student schema (bytes, energy, achievements, etc.) |
| `models/UnebProject.js` | UNEB project gallery schema |
| `config/fatsAndBeef.js` | Fixture tables for quiz generation; `normalizeClass` helper |
| `config/subjectRules.js` | Single source of truth for subject-selection rules per division (lower 12, middle 9, upper 5 with GP compulsory) |
| `public/floating-icons.js` | Floating AI buddy, counselling, career widgets |
| `public/quizzesstudentdashboard.html` | Quiz page (energy-gated) |
| `public/unebprojectgallery.html` | Student-facing project gallery |
| `public/adminprojectgallery.html` | Admin project gallery with moderation |
| `public/gamesstudentdashboard.html` | Games hub (Elementium, Byte-Sudoku, Geography Quiz) |
| `public/admin.html` | Admin portal dashboard |

## AI System (Groq)
- **Study Buddy** (streaming SSE): `POST /api/ai-buddy/chat` — accepts `{ message, context }`
  - `context: null` → Study Buddy mode
  - `context: { type: 'counselling', topic: 'academic'|'emotional'|'crisis' }` → Counsellor mode
  - `context: { type: 'career', topic: 'stem'|'arts'|'business'|'health' }` → Career Advisor mode
- All other AI calls use `callGroqAI(prompt, systemPrompt, options)` helper

## Energy System
- Students have 25 max energy, refills 1/hour (`refillEnergy()` function)
- Quizzes and activities cost 1 energy each
- Games do NOT cost energy — they cost 2 bytes to play, earn 7 bytes for good performance
- Energy status: `GET /api/student/energy` → `{ energy, maxEnergy, nextRefillMs }`

## UNEB Project Gallery
- Upload: `POST /api/uneb-projects` (multipart, requires `photo`, `title`, `subject`, `category`, `year`, `methodology`, `abstract`)
- List: `GET /api/uneb-projects?sort=likes&subject=&year=&q=&limit=50`
- Like: `POST /api/uneb-projects/:id/like`
- Helpful vote: `POST /api/uneb-projects/:id/helpful` with `{ helpful: boolean }`
- Admin view: `GET /admin/uneb-projects` (sorted by most unhelpful votes)
- Admin delete: `DELETE /admin/uneb-projects/:id`

## Games
- **Elementium** (Chemistry/Periodic Table): `games/elementium/elementiumgame.html` — costs 2 bytes, earns 7
- **Byte-Sudoku**: `games/byte-sudoku/byte-sudoku.html`
- **Geography Quiz**: `games/geography quiz/geoquiz.html`

## Student Themes
- File: `public/student-theme.js` — shared script that reads `schoolbyte_student_theme` from localStorage and sets CSS variables (`--color-brand-primary`, `--color-brand-secondary`, `--color-brand-gold`, `--color-brand-orange`) on `document.documentElement` immediately on load (prevents flash of default colours).
- Four themes: **SchoolByte Classic** (default blue/maroon), **Cyber Scholar** (dark slate/cyan), **Botanical Mind** (forest green/amber), **Supernova** (indigo/coral).
- Theme picker UI lives in the **Settings** tab of `public/studentprofile.html` — visual swatches with gradient preview, dot accents, and an "Active" badge.
- `student-theme.js` is injected into all 50 student-facing HTML pages (all `*studentdashboard.html`, notes pages, games, bytenexus-chat, leaderboard, career-guidance, xp-to-bytes, activity-questions, etc.).
- `window.SchoolByteTheme.apply(key)` can be called from any page to switch themes programmatically.

## CRLF Note
`server.js` and some frontend files have Windows CRLF line endings. Always use Node.js scripts (not `sed`) for multi-line replacements in these files.

## Admin Routes
- Admin middleware: `authenticateAdminToken` at server.js line ~908
- Admin routes use `/admin/` prefix
- Admin gallery: `/admin/uneb-projects` (GET, DELETE)
- `POST /admin/trigger-yearly-upgrade` — bumps every student's class. When a student crosses a division boundary (S.2→S.3 or S.4→S.5) it sets `needsSubjectSelection: true`, clears `subjectsEnrolled`, and stores the old class in `previousClass`. Within-division promotions only update `class`/`previousClass`/`lastPromotedAt`.

## Subject Selection (post-promotion re-pick)
- Source of truth: `config/subjectRules.js` exports `RULES`, `validateSubjectSelection`, `getCycleSubjects`, `subjectsMatchClass`, `getDivisionForClass`, `getRulesForClass`.
- Division rules: lower (S.1/S.2) 7 compulsory + 5 electives = 12; middle (S.3/S.4) 7 compulsory + 2 electives = 9; upper (S.5/S.6) General Paper compulsory + 4 chosen = 5.
- Student model fields: `needsSubjectSelection: Boolean`, `previousClass: String`, `lastPromotedAt: Date`.
- Endpoints: `GET /student/subjects/options` (returns rules + current selection), `PUT /student/subjects` body `{ subjects: [...] }` (validates, saves, clears flag, deletes any active QuizSession so cycle indices reset).
- Quiz endpoint (`/student/quizzes/generate`) blocks with `code: 'NEEDS_SUBJECT_SELECTION'` when the flag is set OR the stored subjects don't match the current class. Frontend (`quizzesstudentdashboard.html`) handles both `NO_SUBJECTS` and `NEEDS_SUBJECT_SELECTION` by offering a redirect to the profile.
- Upper-school quiz cycle uses `getCycleSubjects(class, enrolled)` which filters out "General Paper" by name (case-insensitive) — replaces the old fragile `slice(0, 4)`.
- Profile UI (`public/studentprofile.html`): "My Subjects" card lists current subjects (compulsory pinned with lock icon), banner appears at top when `needsSubjectSelection=true`, modal editor enforces compulsory + exact elective count before enabling Save.
