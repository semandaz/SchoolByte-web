// Centralized authentication middleware.
//
// Token payload shape (signed by signXxxToken below):
//   Student token: { id: <studentId> }
//   Teacher token: { id: <teacherId>, role: 'teacher', email }
//   Admin   token: { id: <adminId>,   role: 'admin'   }
//
// Historical note: earlier code signed student tokens with `studentId` instead
// of `id`. The verify path keeps a `decoded.id || decoded.studentId` fallback
// for grandfathered tokens. After JWT_SECRET is rotated all old tokens are
// invalidated and the fallback can be removed in a follow-up.

const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/env');

const DEFAULT_EXPIRY = '7d';

function signStudentToken(studentId, extra = {}, options = {}) {
    return jwt.sign(
        { id: String(studentId), ...extra },
        JWT_SECRET,
        { expiresIn: options.expiresIn || DEFAULT_EXPIRY }
    );
}

function signTeacherToken(teacher, options = {}) {
    return jwt.sign(
        { id: String(teacher._id || teacher.id), email: teacher.email, role: 'teacher' },
        JWT_SECRET,
        { expiresIn: options.expiresIn || DEFAULT_EXPIRY }
    );
}

function signAdminToken(admin, options = {}) {
    return jwt.sign(
        { id: String(admin._id || admin.id), role: 'admin' },
        JWT_SECRET,
        { expiresIn: options.expiresIn || DEFAULT_EXPIRY }
    );
}

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'Access token required' });
    }

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(403).json({ message: 'Invalid or expired token' });
        }
        // Grandfathered fallback for legacy `studentId` payloads — remove
        // after JWT_SECRET rotation invalidates all old tokens.
        req.student = { id: decoded.id || decoded.studentId };
        next();
    });
};

const authenticateTeacherToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        console.error('No authentication token provided in teacher request');
        return res.status(401).json({ message: 'Access Denied: No authentication token provided.' });
    }

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
            console.error('JWT verification error (Teacher):', {
                error: err.message,
                token: token.substring(0, 20) + '...',
                headers: req.headers.authorization ? 'present' : 'missing',
            });
            return res.status(403).json({ message: 'Access Denied: Invalid or expired teacher token.' });
        }
        if (decoded.role !== 'teacher') {
            console.error('Token role mismatch:', decoded.role);
            return res.status(403).json({ message: 'Access Denied: Teacher access required.' });
        }
        req.teacher = decoded;
        next();
    });
};

const authenticateAdminToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'Access Denied: No authentication token provided.' });
    }

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
            console.error('JWT verification error (Admin):', err.message);
            return res.status(403).json({ message: 'Access Denied: Invalid or expired admin token.' });
        }
        req.admin = decoded;
        next();
    });
};

module.exports = {
    JWT_SECRET,
    authenticateToken,
    authenticateTeacherToken,
    authenticateAdminToken,
    signStudentToken,
    signTeacherToken,
    signAdminToken,
};
