# SchoolByte - Educational Platform

## Overview

SchoolByte is a comprehensive educational platform designed to motivate student learning through a gamified "bytes" reward system. It caters to Students, Teachers, and Administrators, offering quizzes, interactive content, and progress tracking. Key features include AI-powered interactive storytelling (Preader Games), subject-specific dashboards, a sophisticated quiz system with personalized question generation, and an AI-driven career guidance system. The platform's business vision is to enhance student engagement and academic performance through innovative, gamified learning experiences, with ambitions to expand content and AI capabilities.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Backend Architecture
- **Framework**: Node.js with Express.js for RESTful API.
- **Database**: MongoDB with Mongoose ODM.
- **Authentication**: JWT with bcrypt for password hashing.
- **Security**: Helmet, CORS, Morgan for logging.
- **File Handling**: Multer for uploads.
- **Email**: Nodemailer for verification and notifications.
- **Input Validation**: Express-validator.

### Database Design
- **Student Schema**: Tracks progress, bytes, quiz history, achievements (embedded), notifications (embedded), and streak data.
- **Teacher/Administrator Schemas**: Manage profiles and privileges.
- **Quiz Questions**: Supports multiple types (MCQ, short-answer, fill-in-the-blank, problem-solving).
- **Activities**: Long-answer tasks with keyword-based grading.
- **Work Files**: PDF storage and management.
- **Teams**: Private study groups with chat and share tokens.

### Frontend Architecture
- **Multiple Interface Types**: Static HTML/CSS/JavaScript dashboards, React SPA components (Preader Games), Vite build system.
- **Responsive Design**: CSS Grid and Flexbox with custom color palette and gradient system.
- **Subject-Specific Dashboards**: Dedicated interfaces for various subjects.
- **Dynamic Content Loading**: AJAX for real-time updates.
- **Widget System**: Real-time notification dropdown (`notifications-widget.js`) and PIP chat widgets (`bytenexus-chat-widget.js`, `ai-buddy-widget.js`, `bytenexus-support-widget.js`) with auto-injection.

### AI Integration
- **AI Engine**: TinyLlama model running locally via Ollama (no cloud dependencies).
- **Ollama Service**: Background workflow on port 11434.
- **AI Wrapper Service**: Centralized `callOllamaAI` function with retry logic, timeout, and validation.
- **JSON Extraction Helper**: `extractJSON` for robust parsing of AI responses.
- **AI Features**:
    - **Preader Games**: Interactive storytelling with ethical decision-making.
    - **Quiz Generation**: AI-powered quiz creation for students and teachers.
    - **Career Guidance**: Personalized counseling.
    - **AI Buddy**: General study assistance chat.
    - **ByteNexus Support**: Platform-specific help chat.
- **AI Endpoints**: Dedicated API endpoints for student/teacher quiz generation, career guidance, AI Buddy, and ByteNexus Support.
- **Comprehensive Validation**: Multi-layer validation for AI-generated questions to ensure quality and correct formatting.

### Authentication & Authorization
- **Multi-Role System**: Student, Teacher, Administrator roles.
- **Token-Based Security**: JWT tokens.
- **Email Verification**: Required for new student accounts.
- **Role-Based Access Control**: Protected routes based on user roles.

### UI/UX Decisions
- **Branding**: ByteNexus PIP widget uses SchoolByte gradient branding (#1a2a6c to #b21f1f to #fdbb2d). AI Buddy uses purple gradient branding (#667eea to #764ba2).
- **Widgets**: Floating icons for AI Buddy and ByteNexus Support, bell icon for notifications.

### Feature Specifications
- **Achievement System**: Tracks Quiz Master, Streak Champion, and Byte Collector badges, with embedded schema in Student model.
- **Notification System**: Real-time notifications (achievement, message, quiz, team, system) with embedded schema and a dropdown widget.
- **Quiz System Logic**: Personalized question selection based on class, subjects, and history; anti-repetition; fallback system; byte rewards; class-based question distribution.

## External Dependencies

### Third-Party Services
- **Cloudinary**: Cloud-based media management for file storage (PDFs) and optimization.

### NPM Packages
- **Core**: Express.js, Mongoose.
- **Security**: bcrypt, helmet, jsonwebtoken.
- **Utilities**: cors, dotenv, morgan.
- **File Processing**: multer, body-parser.
- **Validation**: express-validator.
- **Email**: nodemailer.
- **AI Integration**: ollama (for local TinyLlama).
- **Real-time**: socket.io.

### Development Tools
- **Build System**: Vite.
- **Styling**: TailwindCSS, PostCSS.

### Email Service
- **SMTP Integration**: Via Nodemailer for account verification and notifications.

### File Storage
- **Cloudinary**: For educational PDFs.
- **Local Storage**: For JWT tokens and user sessions.