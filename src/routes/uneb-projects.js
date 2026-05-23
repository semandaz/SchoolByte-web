const express = require('express');
const { body, validationResult } = require('express-validator');

const Student = require('../../models/Student');
const UnebProject = require('../../models/UnebProject');

const { authenticateToken, authenticateAdminToken } = require('../middleware/auth');
const { uploadImage } = require('../middleware/upload');
const cloudinary = require('../services/cloudinary');
const { createNotification, trackAchievementProgress } = require('../services/achievements');

const router = express.Router();

function formatUnebProject(p, currentUserId) {
    const doc = p.toObject ? p.toObject() : p;
    const student = doc.student_id;
    return {
        id: doc._id.toString(),
        _id: doc._id.toString(),
        photoUrl: doc.photoUrl,
        title: doc.title,
        subject: doc.subject,
        year: doc.year,
        category: doc.category,
        methodology: doc.methodology,
        abstract: doc.abstract,
        findings: doc.findings,
        conclusion: doc.conclusion,
        keywords: doc.keywords || [],
        likesCount: (doc.likes || []).length,
        likedByMe: (doc.likes || []).some(id => id.toString() === currentUserId),
        helpfulCount: (doc.helpfulVotes || []).filter(v => v.helpful).length,
        notHelpfulCount: (doc.helpfulVotes || []).filter(v => !v.helpful).length,
        myHelpfulVote: (doc.helpfulVotes || []).find(v => v.studentId.toString() === currentUserId)?.helpful ?? null,
        student: student ? { id: student._id.toString(), studentName: student.studentName, class: student.class, stream: student.stream } : null,
        createdAt: doc.createdAt,
    };
}

function formatUnebProjectLean(doc, currentUserId) {
    const student = doc.student_id;
    return {
        id: doc._id.toString(),
        _id: doc._id.toString(),
        photoUrl: doc.photoUrl,
        title: doc.title,
        subject: doc.subject,
        year: doc.year,
        category: doc.category,
        methodology: doc.methodology,
        abstract: doc.abstract,
        findings: doc.findings,
        conclusion: doc.conclusion,
        keywords: doc.keywords || [],
        likesCount: (doc.likes || []).length,
        likedByMe: (doc.likes || []).some(id => id.toString() === currentUserId),
        helpfulCount: (doc.helpfulVotes || []).filter(v => v.helpful).length,
        notHelpfulCount: (doc.helpfulVotes || []).filter(v => !v.helpful).length,
        myHelpfulVote: (doc.helpfulVotes || []).find(v => v.studentId.toString() === currentUserId)?.helpful ?? null,
        student: student ? { id: student._id.toString(), studentName: student.studentName, class: student.class, stream: student.stream } : null,
        createdAt: doc.createdAt,
    };
}

router.post('/api/uneb-projects', authenticateToken, uploadImage.single('photo'), [
    body('title').notEmpty().trim().withMessage('Project title is required'),
    body('subject').notEmpty().trim().withMessage('Subject is required'),
    body('year').notEmpty().trim().withMessage('Year is required'),
    body('category').notEmpty().trim().withMessage('Category is required'),
    body('methodology').notEmpty().trim().withMessage('Methodology is required'),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    if (!req.file) return res.status(400).json({ error: 'Project photo is required (student with report)' });

    try {
        const result = await new Promise((resolve, reject) => {
            cloudinary.uploader.upload_stream(
                { resource_type: 'image', folder: 'schoolbyte/uneb-projects' },
                (err, r) => err ? reject(err) : resolve(r),
            ).end(req.file.buffer);
        });

        const student = await Student.findById(req.student.id);
        if (!student) return res.status(404).json({ error: 'Student not found' });

        const project = new UnebProject({
            student_id: req.student.id,
            photoUrl: result.secure_url,
            photoPublicId: result.public_id,
            title: req.body.title.trim(),
            subject: req.body.subject.trim(),
            year: req.body.year.trim(),
            category: req.body.category.trim(),
            methodology: req.body.methodology.trim(),
            abstract: (req.body.abstract || '').trim(),
            findings: (req.body.findings || '').trim(),
            conclusion: (req.body.conclusion || '').trim(),
            keywords: (req.body.keywords || '').split(',').map(k => k.trim()).filter(Boolean),
        });
        await project.save();

        // Award XP and increment counter
        const uploadXP = student.totalProjectsUploaded === 0 ? 50 : 25;
        student.xp = (student.xp || 0) + uploadXP;
        student.totalProjectsUploaded = (student.totalProjectsUploaded || 0) + 1;
        await student.save();

        // Background gallery achievement checks
        const projCount = student.totalProjectsUploaded;
        const sid = req.student.id;
        Promise.allSettled([
            trackAchievementProgress(sid, 'gallery_first_upload', projCount, 1),
            trackAchievementProgress(sid, 'gallery_5_uploads', projCount, 5),
            trackAchievementProgress(sid, 'gallery_10_uploads', projCount, 10),
        ]).catch(() => {});

        const populated = await UnebProject.findById(project._id).populate('student_id', 'studentName class stream');
        res.status(201).json({
            message: 'Project published successfully!',
            xpEarned: uploadXP,
            project: formatUnebProject(populated, req.student.id),
        });
    } catch (err) {
        console.error('UNEB project upload error:', err);
        res.status(500).json({ error: 'Failed to upload project', detail: err.message });
    }
});

router.get('/api/uneb-projects', authenticateToken, async (req, res) => {
    try {
        const { sort = 'likes', subject, year, category, q, limit = 20, skip = 0 } = req.query;
        const query = { deletedAt: null, isPublished: true };
        if (subject) query.subject = new RegExp(subject, 'i');
        if (year) query.year = year;
        if (category) query.category = new RegExp(category, 'i');
        if (q && q.trim()) {
            const re = new RegExp(q.trim(), 'i');
            query.$or = [{ title: re }, { methodology: re }, { abstract: re }, { keywords: re }];
        }

        let projects = await UnebProject.find(query).populate('student_id', 'studentName class stream').lean();

        if (sort === 'recent') projects.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        else if (sort === 'likes') projects.sort((a, b) => (b.likes?.length || 0) - (a.likes?.length || 0) || new Date(b.createdAt) - new Date(a.createdAt));
        else if (sort === 'helpful') projects.sort((a, b) => {
            const hA = (a.helpfulVotes || []).filter(v => v.helpful).length;
            const hB = (b.helpfulVotes || []).filter(v => v.helpful).length;
            return hB - hA || new Date(b.createdAt) - new Date(a.createdAt);
        });
        else projects.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        const skipN = parseInt(skip, 10) || 0;
        const limitN = parseInt(limit, 10) || 20;
        projects = projects.slice(skipN, skipN + limitN);

        const formatted = projects.map(p => formatUnebProjectLean(p, req.student.id));
        res.json({ projects: formatted });
    } catch (err) {
        console.error('UNEB projects list error:', err);
        res.status(500).json({ error: 'Failed to fetch projects', detail: err.message });
    }
});

router.get('/api/uneb-projects/:id', authenticateToken, async (req, res) => {
    try {
        const project = await UnebProject.findOne({ _id: req.params.id, deletedAt: null }).populate('student_id', 'studentName email class stream');
        if (!project) return res.status(404).json({ error: 'Project not found' });
        res.json(formatUnebProjectLean(project.toObject ? project.toObject() : project, req.student.id));
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch project' });
    }
});

router.post('/api/uneb-projects/:id/like', authenticateToken, async (req, res) => {
    try {
        const project = await UnebProject.findOne({ _id: req.params.id, deletedAt: null });
        if (!project) return res.status(404).json({ error: 'Project not found' });
        const idx = (project.likes || []).findIndex(id => id.toString() === req.student.id);
        if (idx >= 0) project.likes.splice(idx, 1);
        else project.likes.push(req.student.id);
        await project.save();

        // Award like achievements to the project owner
        if (idx < 0 && project.student_id) {
            const ownerId = project.student_id.toString();
            const allProjects = await UnebProject.find({ student_id: ownerId, deletedAt: null }).lean();
            const totalLikes = allProjects.reduce((sum, p) => sum + (p.likes?.length || 0), 0);
            const thisLikes = project.likes.length;
            Promise.allSettled([
                trackAchievementProgress(ownerId, 'gallery_first_like', totalLikes, 1),
                trackAchievementProgress(ownerId, 'gallery_10_likes_single', thisLikes, 10),
                trackAchievementProgress(ownerId, 'gallery_50_likes_total', totalLikes, 50),
            ]).catch(() => {});
        }

        res.json({ likedByMe: idx < 0, likesCount: project.likes.length });
    } catch (err) {
        res.status(500).json({ error: 'Failed to update like' });
    }
});

router.post('/api/uneb-projects/:id/helpful', authenticateToken, async (req, res) => {
    try {
        const { helpful } = req.body;
        if (typeof helpful !== 'boolean') return res.status(400).json({ error: 'helpful (boolean) required' });
        const project = await UnebProject.findOne({ _id: req.params.id, deletedAt: null });
        if (!project) return res.status(404).json({ error: 'Project not found' });
        project.helpfulVotes = project.helpfulVotes || [];
        const existing = project.helpfulVotes.findIndex(v => v.studentId.toString() === req.student.id);
        if (existing >= 0) project.helpfulVotes[existing].helpful = helpful;
        else project.helpfulVotes.push({ studentId: req.student.id, helpful });
        await project.save();

        const hCount = project.helpfulVotes.filter(v => v.helpful).length;
        const nCount = project.helpfulVotes.filter(v => !v.helpful).length;

        // Award helpful achievements to the project owner
        if (helpful && project.student_id) {
            const ownerId = project.student_id.toString();
            Promise.allSettled([
                trackAchievementProgress(ownerId, 'gallery_helpful_1', hCount, 1),
                trackAchievementProgress(ownerId, 'gallery_helpful_10', hCount, 10),
            ]).catch(() => {});
        }

        res.json({ myHelpfulVote: helpful, helpfulCount: hCount, notHelpfulCount: nCount });
    } catch (err) {
        res.status(500).json({ error: 'Failed to update helpful vote' });
    }
});

router.delete('/api/uneb-projects/:id', authenticateToken, async (req, res) => {
    try {
        const project = await UnebProject.findOne({ _id: req.params.id });
        if (!project) return res.status(404).json({ error: 'Project not found' });
        if (project.student_id.toString() !== req.student.id) return res.status(403).json({ error: 'You can only delete your own projects' });
        project.deletedAt = new Date();
        project.isPublished = false;
        await project.save();
        if (project.photoPublicId) {
            try { await cloudinary.uploader.destroy(project.photoPublicId); } catch (e) { console.warn('Cloudinary delete failed:', e); }
        }
        res.json({ message: 'Project removed from gallery' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete project' });
    }
});

// ===== ADMIN: UNEB Project Gallery Management =====
router.get('/admin/uneb-projects', authenticateAdminToken, async (req, res) => {
    try {
        const projects = await UnebProject.find({ deletedAt: null })
            .populate('student_id', 'studentName class stream indexNumber')
            .lean();
        projects.sort((a, b) => {
            const aUnhelpful = (a.helpfulVotes || []).filter(v => !v.helpful).length;
            const bUnhelpful = (b.helpfulVotes || []).filter(v => !v.helpful).length;
            return bUnhelpful - aUnhelpful || new Date(b.createdAt) - new Date(a.createdAt);
        });
        const formatted = projects.map(p => ({
            _id: p._id,
            title: p.title,
            subject: p.subject,
            year: p.year,
            photoUrl: p.photoUrl,
            methodology: p.methodology,
            abstract: p.abstract || '',
            category: p.category,
            studentName: p.student_id ? p.student_id.studentName : 'Unknown',
            studentClass: p.student_id ? p.student_id.class : '',
            likesCount: (p.likes || []).length,
            helpfulCount: (p.helpfulVotes || []).filter(v => v.helpful).length,
            notHelpfulCount: (p.helpfulVotes || []).filter(v => !v.helpful).length,
            createdAt: p.createdAt,
        }));
        res.json({ projects: formatted });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch projects', detail: err.message });
    }
});

router.delete('/admin/uneb-projects/:id', authenticateAdminToken, async (req, res) => {
    try {
        const project = await UnebProject.findById(req.params.id).lean();
        if (!project) return res.status(404).json({ error: 'Project not found' });
        await UnebProject.deleteOne({ _id: req.params.id });
        if (project.photoPublicId) {
            cloudinary.uploader.destroy(project.photoPublicId).catch(e => console.warn('Cloudinary delete skipped:', e.message));
        } else if (project.photoUrl && project.photoUrl.includes('cloudinary')) {
            const urlParts = project.photoUrl.split('/');
            const fileWithExt = urlParts[urlParts.length - 1];
            const publicId = 'schoolbyte/uneb-projects/' + fileWithExt.replace(/\.\w+$/, '');
            cloudinary.uploader.destroy(publicId).catch(() => {});
        }
        if (project.student_id) {
            createNotification(project.student_id, 'system', 'Project Removed', `Your project "${project.title}" has been removed from the gallery by an administrator.`, { projectId: project._id }).catch(() => {});
        }
        res.json({ message: 'Project deleted successfully' });
    } catch (err) {
        console.error('Admin UNEB project delete error:', err);
        res.status(500).json({ error: 'Failed to delete project', detail: err.message });
    }
});

module.exports = router;
