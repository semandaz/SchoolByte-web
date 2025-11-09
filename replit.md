# SchoolByte - Educational Platform

## Overview

SchoolByte is a comprehensive educational platform designed to motivate student learning through a gamified "bytes" reward system. The platform serves three primary user types: Students, Teachers, and Administrators. Students engage with quizzes, activities, and interactive content to earn bytes and track their academic progress. Teachers can upload educational content, create assessments, and manage their subject areas. Administrators oversee the entire platform with comprehensive dashboard controls and user management capabilities.

The platform includes specialized features like Preader Games (AI-powered interactive storytelling for ethical decision-making), subject-specific dashboards, and a sophisticated quiz system with personalized question generation based on student class levels and enrolled subjects.

## Recent Changes

### November 9, 2025 - Complete Migration to TinyLlama AI (Ollama)

**AI Infrastructure Overhaul:**
- **Removed all Google Gemini AI dependencies** and migrated to locally-run TinyLlama model via Ollama
- **Installed and configured Ollama service** as a background workflow running TinyLlama model (637MB)
- **Created robust AI service wrapper** (`callOllamaAI`) with:
  - Retry logic with exponential backoff (configurable retries)
  - Timeout handling (60-90 second timeouts per request)
  - Proper parameter validation (only passes valid Ollama options, not wrapper metadata)
  - Response structure validation
  - Error recovery and fallback mechanisms
- **Created JSON extraction helper** (`extractJSON`) for robust parsing since TinyLlama is less reliable than Gemini at formatting

**Complete AI Feature Migration:**
- ✅ **Preader Games**: Story generation now uses TinyLlama for ethical decision-making narratives
- ✅ **Student Quiz Generation**: Both fallback and AI endpoint migrated to TinyLlama
- ✅ **Teacher Quiz Generation**: AI-powered quiz creation now uses TinyLlama
- ✅ **Career Guidance**: Personalized career counseling powered by TinyLlama with student profile integration

**New AI-Powered Features:**
- **AI Buddy** - PIP-only chat widget for general study assistance
  - Helps with homework and explains difficult concepts
  - Provides study tips and learning strategies
  - Answers questions about all subjects
  - Purple gradient branding (#667eea to #764ba2)
  - Created: `/api/ai-buddy/chat` endpoint
  - Widget: `ai-buddy-widget.js` with auto-injection and PIP controls
  
- **ByteNexus Support Team** - PIP-only chat widget for SchoolByte platform help
  - Answers questions about SchoolByte features
  - Helps navigate platform (quizzes, games, career guidance, chat)
  - Explains XP system, Bytes currency, tier progression
  - SchoolByte gradient branding (#1a2a6c to #b21f1f to #fdbb2d)
  - Created: `/api/bytenexus-support/chat` endpoint
  - Widget: `bytenexus-support-widget.js` with auto-injection and PIP controls

**Chat System Improvements:**
- Updated `floating-icons.js` to support AI Buddy and ByteNexus Support icons
- Added Font Awesome headset icon for Support widget
- Both new widgets integrated into `studentdashboard.html` and `studentprofile.html`
- All widgets use the same robust Ollama service wrapper for consistency

**Technical Implementation:**
- Ollama client properly instantiated: `new Ollama({ host: 'http://localhost:11434' })`
- Connection test on server startup with graceful warning if unavailable
- No Gemini imports or API keys required anymore
- All AI responses use centralized error handling and retry logic
- Chat history maintained for context-aware responses

### November 8, 2025 - Achievement System, Notifications, and ByteNexus Branding Update

**Achievement System:**
- Implemented comprehensive achievement tracking system with three badge types:
  - Quiz Master: Awarded for completing 10, 25, 50, and 100 quizzes
  - Streak Champion: Awarded for maintaining 3, 7, 14, and 30-day study streaks
  - Byte Collector: Awarded for earning 100, 500, 1000, and 5000 bytes
- Added embedded achievement schema fields directly in Student model for optimal query performance
- Automatic achievement detection integrated into quiz submission flow
- Week-old achievements automatically filtered from "recent achievements" displays
- Backend API endpoints:
  - GET `/api/achievements/all` - Fetch all student achievements with metadata
  - GET `/api/achievements/recent` - Fetch achievements earned in the last 7 days

**Notification System:**
- Created embedded notification schema in Student model with support for multiple types (achievement, message, quiz, team, system)
- Built notifications-widget.js - a real-time notification dropdown widget with:
  - Bell icon with unread count badge in header
  - Dropdown panel showing recent notifications with icons and timestamps
  - Mark individual/all notifications as read functionality
  - Automatic polling every 30 seconds for new notifications
  - Type-specific icons and styling (achievements, messages, teams, system)
- Backend API endpoints:
  - GET `/api/notifications` - Fetch student notifications with unread count
  - PATCH `/api/notifications/:id/read` - Mark single notification as read
  - POST `/api/notifications/mark-all-read` - Mark all notifications as read
- Integrated notification widget into studentprofile.html

**ByteNexus PIP Widget Improvements:**
- Updated color scheme to match SchoolByte branding:
  - Removed purple/indigo colors completely
  - Primary gradient: Dark Blue (#1a2a6c) to Maroon (#b21f1f)
  - Accent color: Gold (#FFD700)
  - Updated all UI elements (header, buttons, chat bubbles, inputs, dropdowns)
- Enhanced PIP (Picture-in-Picture) controls with improved UI/UX
- Maintained all existing functionality (chats, discussion groups, teams, search)

**Student Profile Enhancements:**
- Updated studentprofile.html to load achievements dynamically from database
- Real-time achievement count display with progress indicators
- Loading states and error handling for API failures
- Displays up to 10 most recent achievements with badge icons and earned dates
- Empty state messaging when no achievements have been earned

**Teams Integration (Previously Implemented):**
- Fully functional team creation, joining, and management
- Team chat messaging with Socket.io real-time updates
- Share tokens for private team invitations
- Team member listing and management

### November 7, 2025 - ByteNexus Chat & Dashboard Improvements

**ByteNexus Chat Enhancements:**
- Fixed search bar CSS to prevent overflow and visual issues
- Added mobile menu toggle button to empty state for better initial accessibility
- Renamed "Groups" tab to "Discussion Groups" for clarity
- Implemented complete Teams feature with backend and frontend:
  - Private team creation with unique share tokens
  - Team listing and management
  - Share link functionality for inviting members
  - Team-to-group conversion flow
- Fixed public groups display by adding `/api/groups/public` endpoint
- Added `/api/students/suggestions` endpoint for student discovery

**Subject Dashboard Improvements:**
- Added `/api/workfiles/:workFileId/preview` endpoint for free PDF previews
- Implemented preview functionality in Biology, Food & Nutrition, and Geography dashboards
- Preview is free (no byte cost), download still deducts bytes
- Fixed download/preview button layout with proper flex containers
- Teacher upload verified working across all subjects

**Known Limitations:**
- 13 subject dashboards still need complete implementation (missing download/preview infrastructure)
- Only Biology, Food & Nutrition, and Geography have full preview/download functionality

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Backend Architecture
- **Framework**: Node.js with Express.js for RESTful API development
- **Database**: MongoDB with Mongoose ODM for data modeling and validation
- **Authentication**: JWT (JSON Web Tokens) with bcrypt for password hashing
- **Security**: Helmet middleware for security headers, CORS for cross-origin requests, Morgan for HTTP request logging
- **File Handling**: Multer for multipart form data and file uploads
- **Email**: Nodemailer for email verification and notifications
- **Input Validation**: Express-validator for comprehensive request validation

### Database Design
- **Student Schema**: Tracks academic progress, enrolled subjects, bytes earned, quiz history, and personalized learning data
  - **Achievements**: Embedded array tracking earned achievements with type, tier, badge info, and timestamps
  - **Notifications**: Embedded array for real-time notifications with type categorization, read status, and metadata
  - **Streak Tracking**: Current streak count and last quiz date for Streak Champion achievements
  - **Quiz Statistics**: Total quizzes completed for Quiz Master achievements
- **Teacher Schema**: Manages teacher profiles and subject specializations
- **Administrator Schema**: Handles admin accounts with elevated privileges
- **Quiz Questions**: Supports multiple question types (multiple-choice, short-answer, fill-in-the-blank, problem-solving)
- **Activities**: Long-answer tasks with automated keyword-based grading
- **Work Files**: PDF storage and management for educational materials
- **Verification Codes**: Time-limited codes for email verification
- **Teams**: Private study groups with share tokens, members, and team chat functionality

### Frontend Architecture
- **Multiple Interface Types**: 
  - Static HTML/CSS/JavaScript dashboards for different subjects
  - React SPA components for interactive features (Preader Games)
  - Vite build system for modern frontend tooling
- **Responsive Design**: CSS Grid and Flexbox with custom color palette and gradient system
- **Subject-Specific Dashboards**: Dedicated interfaces for Biology, Chemistry, Mathematics, English, Geography, History, Agriculture, and other subjects
- **Dynamic Content Loading**: AJAX requests for real-time data updates without page refreshes
- **Widget System**: 
  - notifications-widget.js: Real-time notification dropdown with polling and badge counter
  - bytenexus-chat-widget.js: PIP chat widget with SchoolByte branding and full ByteNexus integration
  - Both widgets inject themselves into pages automatically when included via script tags

### AI Integration
- **TinyLlama via Ollama**: All AI features now powered by locally-run TinyLlama model (no cloud dependencies)
- **Ollama Service**: Background workflow running on port 11434 with TinyLlama model loaded
- **AI Wrapper Service**: Centralized `callOllamaAI` function with retry logic, timeout handling, and parameter validation
- **JSON Extraction Helper**: `extractJSON` function for robust parsing of AI responses
- **AI Features**:
  - **Preader Games**: Interactive storytelling with ethical decision-making powered by TinyLlama
  - **Quiz Generation**: AI-powered quiz creation for both students and teachers
  - **Career Guidance**: Personalized career counseling based on student performance
  - **AI Buddy**: General study assistance chat (homework help, concept explanations, study tips)
  - **ByteNexus Support**: Platform-specific help (features, navigation, XP system, troubleshooting)
- **AI Endpoints**:
  - POST `/student/quizzes/generate-ai` - Students generate personalized quiz questions
  - POST `/teacher/quiz-questions/generate-ai` - Teachers generate and save questions to database
  - POST `/api/career-guidance/chat` - Career counseling chat with context
  - POST `/api/ai-buddy/chat` - General study assistance chat
  - POST `/api/bytenexus-support/chat` - SchoolByte platform help chat
- **Comprehensive Validation**: Multi-layer validation ensures AI-generated questions meet strict quality standards:
  - Multiple-choice questions: Exactly 4 options with proper formatting and correctAnswers array synchronization
  - True-false questions: Exact literal validation ("true" or "false" only, array length = 1)
  - Keyword-based questions: Minimum 2 keywords for NLP grading
  - Auto-correction: Automatically fixes or rejects malformed AI responses

### Authentication & Authorization
- **Multi-Role System**: Separate authentication flows for students, teachers, and administrators
- **Token-Based Security**: JWT tokens stored in localStorage with middleware validation
- **Email Verification**: Required verification process for new student accounts
- **Role-Based Access Control**: Protected routes and endpoints based on user roles

### Quiz System Logic
- **Personalized Question Selection**: Algorithm considers student's class level, enrolled subjects, and recent quiz history
- **Anti-Repetition Mechanism**: Sliding window system prevents immediate question repetition
- **Fallback System**: Resets question pool when student exhausts available unique questions
- **Byte Reward System**: Progressive scoring based on question difficulty and student performance
- **Class-Based Distribution**: Questions sourced from student's own class (70%), one level below (20%), and one level above (10%)

## External Dependencies

### Third-Party Services
- **Google Generative AI**: Powers the Preader Games AI storytelling feature and educational content generation
- **Cloudinary**: Cloud-based media management for file storage and image optimization
- **MongoDB Atlas** (implied): Cloud database hosting for scalable data storage

### NPM Packages
- **Core Framework**: Express.js for server framework, Mongoose for MongoDB integration
- **Security**: bcrypt for password hashing, helmet for security headers, jsonwebtoken for authentication
- **Utilities**: cors for cross-origin requests, dotenv for environment management, morgan for logging
- **File Processing**: multer for file uploads, body-parser for request parsing
- **Validation**: express-validator for input sanitization and validation
- **Email**: nodemailer for transactional emails and notifications
- **AI Integration**: ollama npm package for local TinyLlama model integration
- **Real-time Communication**: socket.io for chat and live updates

### Development Tools
- **Build System**: Vite for modern frontend development and hot module replacement
- **Styling**: TailwindCSS for utility-first CSS framework
- **PostCSS**: For CSS processing and optimization

### Email Service
- **SMTP Integration**: Configured through nodemailer for student verification emails and system notifications
- **Verification System**: Time-limited 6-digit codes for account activation

### File Storage
- **Cloudinary Integration**: Handles PDF uploads for educational materials and work files
- **Local Storage**: Browser localStorage for JWT token persistence and user session management