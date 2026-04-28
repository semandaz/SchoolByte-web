const express = require('express');
const Student = require('../../models/Student');

const router = express.Router();

// Public health check (no auth)
router.get('/api/health', async (req, res) => {
    const status = { api: 'ok', database: 'unknown', timestamp: new Date().toISOString() };
    try {
        await Student.findOne().select('_id').lean();
        status.database = 'ok';
    } catch (e) { status.database = 'error'; }
    res.json(status);
});

module.exports = router;
