const express = require('express');
const path = require('path');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');

const Administrator = require('../../models/Administrator');
const Teacher = require('../../models/Teacher');
const TeacherNotification = require('../../models/TeacherNotification');
const VerificationCode = require('../../models/VerificationCode');

const { authenticateAdminToken, JWT_SECRET } = require('../middleware/auth');
const { transporter } = require('../services/email');
const { generateRandomPassword } = require('../utils/password');

const router = express.Router();

// GET list of administrators
router.get('/admin/admins', authenticateAdminToken, async (req, res) => {
    try {
        const admins = await Administrator.find({ deletedAt: null }).select('-password').lean();
        res.json({ admins });
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch admins', error: err.message });
    }
});

// POST create new admin — auto-generates password, emails it
router.post('/admin/admins', authenticateAdminToken, [
    body('adminName').notEmpty().trim().withMessage('Admin name is required.'),
    body('email').isEmail().normalizeEmail().withMessage('Valid email required.'),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
        const { adminName, email } = req.body;
        const existing = await Administrator.findOne({ email: email.toLowerCase() });
        if (existing) return res.status(409).json({ message: 'An administrator with this email already exists.' });

        const rawPassword = generateRandomPassword(10);
        const hashed = await bcrypt.hash(rawPassword, 10);
        const creatorEmail = req.admin.email || 'system';

        const newAdmin = new Administrator({
            adminName: adminName.trim(),
            email: email.toLowerCase(),
            password: hashed,
            isPasswordSet: false,
            createdBy: creatorEmail,
        });
        await newAdmin.save();

        const mailHtml = `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#f4f7f9;border-radius:12px;">
          <h2 style="color:#2c3e50;text-align:center;">Welcome to SchoolByte Admin Portal</h2>
          <p>Hello <strong>${adminName}</strong>,</p>
          <p>You have been added as an administrator of SchoolByte by <strong>${creatorEmail}</strong>.</p>
          <div style="background:#fff;border-radius:8px;padding:20px;margin:20px 0;border-left:4px solid #3498db;">
            <p style="margin:0;font-size:13px;color:#666;">Your initial login credentials:</p>
            <p style="margin:8px 0;"><strong>Email:</strong> ${email}</p>
            <p style="margin:8px 0;"><strong>Temporary Password:</strong>
              <code style="background:#eef2ff;padding:4px 10px;border-radius:4px;font-size:16px;font-weight:bold;letter-spacing:2px;">${rawPassword}</code>
            </p>
          </div>
          <p style="color:#e74c3c;font-weight:bold;">You will be required to change this password on your first login.</p>
          <p>After logging in and completing 2FA, you will be directed to set your own permanent password.</p>
          <hr style="border:none;border-top:1px solid #eee;margin:20px 0;">
          <p style="font-size:12px;color:#999;text-align:center;">SchoolByte Administration System</p>
        </div>`;

        transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'SchoolByte Admin Account Created — Your Temporary Password',
            html: mailHtml,
        }).catch(e => console.error('Admin welcome email failed:', e.message));

        res.status(201).json({ message: 'Administrator created. Login credentials emailed.', admin: { id: newAdmin._id, adminName: newAdmin.adminName, email: newAdmin.email } });
    } catch (err) {
        console.error('Create admin error:', err);
        res.status(500).json({ message: 'Failed to create administrator', error: err.message });
    }
});

// DELETE admin — requires reason, emails the deleted admin
router.delete('/admin/admins/:id', authenticateAdminToken, async (req, res) => {
    try {
        const { reason } = req.body;
        if (!reason || reason.trim().length < 5) return res.status(400).json({ message: 'A deletion reason of at least 5 characters is required.' });

        const targetAdmin = await Administrator.findOne({ _id: req.params.id, deletedAt: null });
        if (!targetAdmin) return res.status(404).json({ message: 'Administrator not found.' });
        if (targetAdmin._id.toString() === req.admin.id.toString()) return res.status(400).json({ message: 'You cannot delete your own admin account.' });

        const deleterEmail = req.admin.email;
        const deleterName = req.admin.adminName || 'An administrator';
        const now = new Date();

        await Administrator.updateOne({ _id: req.params.id }, {
            $set: { deletedAt: now, deletedBy: deleterName, deletedByEmail: deleterEmail, deletionReason: reason.trim() },
        });

        const mailHtml = `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#fff4f4;border-radius:12px;">
          <h2 style="color:#e74c3c;text-align:center;">Your SchoolByte Admin Access Has Been Revoked</h2>
          <p>Hello <strong>${targetAdmin.adminName}</strong>,</p>
          <p>Your administrator account on SchoolByte has been <strong>deleted</strong>.</p>
          <div style="background:#fff;border-radius:8px;padding:20px;margin:20px 0;border-left:4px solid #e74c3c;">
            <p style="margin:4px 0;"><strong>Deleted by:</strong> ${deleterName} (${deleterEmail})</p>
            <p style="margin:4px 0;"><strong>Date:</strong> ${now.toLocaleString()}</p>
            <p style="margin:4px 0;"><strong>Reason:</strong> ${reason.trim()}</p>
          </div>
          <p>If you believe this was done in error, please contact another system administrator.</p>
          <hr style="border:none;border-top:1px solid #eee;margin:20px 0;">
          <p style="font-size:12px;color:#999;text-align:center;">SchoolByte Administration System</p>
        </div>`;

        transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: targetAdmin.email,
            subject: 'SchoolByte: Your Admin Account Has Been Deleted',
            html: mailHtml,
        }).catch(e => console.error('Admin deletion email failed:', e.message));

        // Notify all teachers of the admin removal
        const allTeachers = await Teacher.find({}).select('_id').lean().catch(() => []);
        const teacherNotifs = allTeachers.map(t => new TeacherNotification({
            teacher: t._id,
            type: 'admin_deleted',
            title: 'Admin Account Removed',
            message: `Administrator ${targetAdmin.adminName} (${targetAdmin.email}) has been removed from the system.`,
            data: { adminName: targetAdmin.adminName, adminEmail: targetAdmin.email, deletedBy: deleterName },
        }));
        if (teacherNotifs.length > 0) {
            TeacherNotification.insertMany(teacherNotifs).catch(() => {});
        }

        res.json({ message: `Administrator ${targetAdmin.adminName} deleted successfully.` });
    } catch (err) {
        console.error('Delete admin error:', err);
        res.status(500).json({ message: 'Failed to delete administrator', error: err.message });
    }
});

// POST reset admin password
router.post('/admin/admins/:id/reset-password', authenticateAdminToken, async (req, res) => {
    try {
        const targetAdmin = await Administrator.findOne({ _id: req.params.id, deletedAt: null });
        if (!targetAdmin) return res.status(404).json({ message: 'Administrator not found.' });

        const rawPassword = generateRandomPassword(10);
        const hashed = await bcrypt.hash(rawPassword, 10);
        const requesterEmail = req.admin.email;
        const now = new Date();

        await Administrator.updateOne({ _id: req.params.id }, { $set: { password: hashed, isPasswordSet: false } });

        const mailHtml = `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#fff8e1;border-radius:12px;">
          <h2 style="color:#f39c12;text-align:center;">SchoolByte Admin Password Reset</h2>
          <p>Hello <strong>${targetAdmin.adminName}</strong>,</p>
          <p>Your SchoolByte administrator password has been reset.</p>
          <div style="background:#fff;border-radius:8px;padding:20px;margin:20px 0;border-left:4px solid #f39c12;">
            <p style="margin:4px 0;"><strong>Reset by:</strong> ${requesterEmail}</p>
            <p style="margin:4px 0;"><strong>Date &amp; Time:</strong> ${now.toLocaleString()}</p>
            <p style="margin:8px 0;"><strong>New temporary password:</strong><br>
              <code style="background:#eef2ff;padding:6px 14px;border-radius:4px;font-size:18px;font-weight:bold;letter-spacing:2px;display:inline-block;margin-top:6px;">${rawPassword}</code>
            </p>
          </div>
          <p style="color:#e74c3c;font-weight:bold;">You will be required to set a new password after your next login.</p>
          <p>If you did not request this reset, contact your system administrator immediately.</p>
          <hr style="border:none;border-top:1px solid #eee;margin:20px 0;">
          <p style="font-size:12px;color:#999;text-align:center;">SchoolByte Administration System</p>
        </div>`;

        transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: targetAdmin.email,
            subject: 'SchoolByte: Admin Password Reset',
            html: mailHtml,
        }).catch(e => console.error('Password reset email failed:', e.message));

        res.json({ message: `Password reset for ${targetAdmin.adminName}. New credentials emailed.` });
    } catch (err) {
        console.error('Reset admin password error:', err);
        res.status(500).json({ message: 'Failed to reset password', error: err.message });
    }
});

// POST admin set-password (first login — isPasswordSet: false)
router.post('/admin/set-password', authenticateAdminToken, [
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters.'),
    body('confirmPassword').notEmpty().withMessage('Please confirm password.'),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    try {
        const { password, confirmPassword } = req.body;
        if (password !== confirmPassword) return res.status(400).json({ message: 'Passwords do not match.' });
        const admin = await Administrator.findById(req.admin.id);
        if (!admin) return res.status(404).json({ message: 'Admin not found.' });
        admin.password = await bcrypt.hash(password, 10);
        admin.isPasswordSet = true;
        await admin.save();
        res.json({ message: 'Password set successfully. You can now use the admin portal.' });
    } catch (err) {
        console.error('Admin set-password error:', err);
        res.status(500).json({ message: 'Failed to set password', error: err.message });
    }
});

// Admin → teacher messaging (broadcast or targeted)
router.post('/admin/message-teachers', authenticateAdminToken, [
    body('message').notEmpty().trim().withMessage('Message content is required.'),
    body('title').notEmpty().trim().withMessage('Message title is required.'),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    try {
        const { title, message, teacherIds } = req.body;
        const senderName = req.admin.adminName || 'Administrator';
        const senderEmail = req.admin.email;

        let teachers;
        if (teacherIds && teacherIds.length > 0) {
            teachers = await Teacher.find({ _id: { $in: teacherIds } }).select('_id email teacherName').lean();
        } else {
            teachers = await Teacher.find({}).select('_id email teacherName').lean();
        }

        const notifDocs = teachers.map(t => ({
            teacher: t._id,
            type: 'admin_message',
            title: `Admin Message: ${title}`,
            message,
            data: { senderName, senderEmail },
        }));
        if (notifDocs.length > 0) await TeacherNotification.insertMany(notifDocs);

        // Email each teacher
        for (const teacher of teachers) {
            transporter.sendMail({
                from: process.env.EMAIL_USER,
                to: teacher.email,
                subject: `SchoolByte Admin: ${title}`,
                html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
                  <h2 style="color:#2c3e50;">Message from Administration</h2>
                  <p>Hello <strong>${teacher.teacherName}</strong>,</p>
                  <div style="background:#f4f7f9;border-radius:8px;padding:16px;margin:16px 0;border-left:4px solid #3498db;">
                    <h3 style="margin:0 0 8px;">${title}</h3>
                    <p style="margin:0;white-space:pre-wrap;">${message}</p>
                  </div>
                  <p style="font-size:12px;color:#999;">From: ${senderName} &lt;${senderEmail}&gt; — SchoolByte Admin</p>
                </div>`,
            }).catch(() => {});
        }

        res.json({ message: `Message sent to ${teachers.length} teacher(s).`, count: teachers.length });
    } catch (err) {
        console.error('Admin message-teachers error:', err);
        res.status(500).json({ message: 'Failed to send message', error: err.message });
    }
});

// POST signup-admin
router.post('/signup-admin', [
    body('adminName').notEmpty().trim().withMessage('Admin name is required.'),
    body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email address.'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long.'),
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                message: 'Validation failed',
                errors: errors.array(),
            });
        }

        const { adminName, email, password } = req.body;

        const existingAdmin = await Administrator.findOne({ email: email.toLowerCase() });
        if (existingAdmin) {
            return res.status(409).json({ message: 'An administrator with this email already exists.' });
        }

        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        const newAdmin = new Administrator({
            adminName: adminName.trim(),
            email: email.toLowerCase(),
            password: hashedPassword,
        });

        await newAdmin.save();

        res.status(201).json({
            message: 'Administrator account created successfully.',
            admin: {
                id: newAdmin._id,
                adminName: newAdmin.adminName,
                email: newAdmin.email,
            },
        });
    } catch (error) {
        console.error('Error during admin signup:', error);
        res.status(500).json({
            message: 'Server error during admin account creation.',
            error: error.message,
        });
    }
});

// POST login-admin (issues 2FA)
router.post('/login-admin', [
    body('email').notEmpty().withMessage('Email is required.'),
    body('password').notEmpty().withMessage('Password is required.'),
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        let { email, password } = req.body;

        const adminPrefix = 'admin: ';
        if (email.toLowerCase().startsWith(adminPrefix.toLowerCase())) {
            email = email.substring(adminPrefix.length).trim();
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ message: 'Please provide a valid email address.' });
        }

        const admin = await Administrator.findOne({ email: email.toLowerCase() });

        if (!admin) {
            return res.status(401).json({ message: 'Invalid email or password.' });
        }

        const isMatch = await bcrypt.compare(password, admin.password);

        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid email or password.' });
        }

        const code = Math.floor(100000 + Math.random() * 900000).toString();

        await VerificationCode.findOneAndUpdate(
            { email: email.toLowerCase() },
            { code, createdAt: Date.now() },
            { upsert: true, new: true, setDefaultsOnInsert: true },
        );

        if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
            const mailOptions = {
                from: process.env.EMAIL_USER,
                to: email,
                subject: 'SchoolByte Admin 2FA Code',
                html: `<p>Your SchoolByte Administrator 2FA code is: <strong>${code}</strong></p><p>This code is valid for 10 minutes.</p>`,
            };

            await transporter.sendMail(mailOptions);
        }

        res.status(200).json({
            message: 'Admin login successful. A 2FA code has been sent to your email.',
            requiresTwoFA: true,
        });
    } catch (error) {
        console.error('Error during admin login:', error);
        res.status(500).json({ message: 'Server error during admin login.', error: error.message });
    }
});

// POST verify-2fa (issues admin token)
router.post('/admin/verify-2fa', [
    body('email').isEmail().withMessage('Please provide a valid email address.'),
    body('code').notEmpty().withMessage('2FA code is required.'),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { email, code } = req.body;

    try {
        const storedCode = await VerificationCode.findOne({ email });

        if (!storedCode) {
            return res.status(400).json({ message: 'No 2FA code found for this email, or it has expired.' });
        }

        if (storedCode.code === code) {
            const admin = await Administrator.findOne({ email });
            if (!admin) {
                return res.status(404).json({ message: 'Administrator not found.' });
            }

            await VerificationCode.deleteOne({ email });

            const token = jwt.sign(
                { id: admin._id, email: admin.email, adminName: admin.adminName, role: 'admin' },
                JWT_SECRET,
                { expiresIn: '24h' },
            );

            res.status(200).json({
                message: 'Admin 2FA successful! You are now logged in.',
                token,
                isPasswordSet: admin.isPasswordSet !== false,
                admin: {
                    adminName: admin.adminName,
                    email: admin.email,
                },
            });
        } else {
            return res.status(400).json({ message: 'Invalid 2FA code.' });
        }
    } catch (error) {
        console.error('Error during admin 2FA verification:', error);
        res.status(500).json({ message: 'Server error during 2FA verification.', error: error.message });
    }
});

// Serve admin login page
router.get('/admin-login.html', (req, res) => {
    res.sendFile(path.join(__dirname, '..', '..', 'public', 'adminlogin.html'));
});

module.exports = router;
