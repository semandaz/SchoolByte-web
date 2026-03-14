ByteNexus Chat Application
Overview
ByteNexus is a real-time chat application designed for personal and group communication with specialized support for mathematical notation and multi-language symbols. It features JWT-based authentication, a MongoDB database, byte-based message boosting, and WebSocket-powered real-time messaging. The application aims to provide a robust platform for secure and efficient communication, particularly for technical and academic users.

User Preferences
Preferred communication style: Simple, everyday language.

System Architecture
Frontend Architecture
The frontend is built with React 18.3 and TypeScript, using Vite for development and building. TailwindCSS provides utility-first styling. The application follows a component-based architecture with App.tsx as the root, AuthProvider.tsx for authentication context, and dedicated components for UI elements like LeftSidebar.tsx, ChatArea.tsx, MathInput.tsx, and SymbolsPicker.tsx. State management primarily uses React Context API for authentication and local component state with React hooks. Real-time communication is handled by a Socket.io client with JWT-based authentication and room-based messaging.

Backend Architecture
The backend utilizes Express.js (v5.1) and Node.js HTTP server for its framework, with Socket.io for real-time WebSocket communication. CORS is configured to allow cross-origin requests. Data persistence is managed by MongoDB via Mongoose ODM. Authentication is JWT-based with bcrypt for password hashing, and tokens have a 7-day expiration. The API provides RESTful HTTP endpoints for data operations (e.g., user management, message fetching) and WebSocket events for real-time messaging and presence. A key feature is the "Bytes System" where users can spend bytes to boost messages in group chats, with byte deductions handled atomically.

Data Architecture
The application uses MongoDB with Mongoose ODM for schema validation and querying. Key data models include User, PersonalMessage, GroupMessage, DiscussionGroup, GroupMember, and Team. These models define attributes such as user details, message content, group information, and relationships between entities. GroupMessage includes fields for is_boosted and boost_cost to support the byte system. Indexes are applied to optimize query performance. Data flows involve initial loading via REST APIs, real-time updates via Socket.io, and atomic operations for critical updates like byte deductions.

Authentication & Authorization
Authentication is JWT-based, using bcrypt for secure password hashing. JWTs are generated upon signup/signin, stored in localStorage on the client, and verified for both HTTP requests and WebSocket connections. Authorization is handled through user-based and group-level access controls, with specific checks for boosted messages requiring sufficient byte balance. Security considerations include using environment variables for sensitive data, CORS configuration, and robust token verification.

External Dependencies
Database & Authentication
MongoDB (via Mongoose v8.8.2): NoSQL database for flexible and scalable data storage.
jsonwebtoken (v9.0.2): Used for JWT creation and verification.
bcrypt: Password hashing for secure user authentication.
Real-time Communication
Socket.io (v4.8.1): Enables real-time bidirectional communication between clients and the server.
UI Libraries
Lucide React (v0.344.0): Icon library for consistent UI iconography.
Runtime Dependencies
Express (v5.1.0): Web server framework.
CORS (v2.8.5): Middleware for handling cross-origin requests.
dotenv (v17.2.3): Manages environment variables.
Mongoose (v8.8.2): MongoDB Object Data Modeling (ODM) for Node.js.
Build System
Vite (v5.4.2): Fast development server and optimized production builds.