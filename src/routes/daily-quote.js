const express = require('express');
const mongoose = require('mongoose');
const DailyQuote = require('../../models/DailyQuote');
const { authenticateToken } = require('../middleware/auth');
const { callGroqAI } = require('../services/ai');

const router = express.Router();

// GET /student/daily-quote — return an unseen quote; AI-generate if pool exhausted
router.get('/student/daily-quote', authenticateToken, async (req, res) => {
    try {
        const studentId = req.student.id;

        // Find the most-liked unseen quote first
        const unseen = await DailyQuote.aggregate([
            { $match: { seenBy: { $nin: [new mongoose.Types.ObjectId(studentId)] } } },
            { $addFields: { likeCount: { $size: { $ifNull: ['$likedBy', []] } } } },
            { $sort: { likeCount: -1, createdAt: 1 } },
            { $limit: 1 },
        ]);

        if (unseen.length > 0) {
            const quote = unseen[0];
            await DailyQuote.updateOne({ _id: quote._id }, { $addToSet: { seenBy: studentId } });
            return res.json({
                _id: quote._id,
                text: quote.text,
                author: quote.author,
                category: quote.category,
                context: quote.context,
                likeCount: quote.likeCount || 0,
                likedByMe: (quote.likedBy || []).some(id => id.toString() === studentId),
            });
        }

        // Pool exhausted for this student — generate a fresh one via Groq
        const systemPrompt = `You are a motivational quote curator for SchoolByte, an educational platform serving Ugandan secondary school students (ages 13-19, Senior 1 to Senior 6). Your task is to generate an original, deeply meaningful motivational or educational quote with rich context. The quote must be suitable for young African students navigating academic challenges, personal growth, and building their futures.`;

        const userPrompt = `Generate a unique motivational quote for a secondary school student. Return ONLY a valid JSON object (no markdown, no code fences) with exactly these fields:
{
  "text": "the quote text itself (original or attributed to a real person)",
  "author": "the person who said it (use a real historical or contemporary figure, or 'Unknown')",
  "category": "one of: Leadership, Education, Perseverance, Character, Resilience, Excellence, Wisdom, Courage, Vision, Growth, Determination",
  "context": "a deeply detailed, 5-8 sentence explanation of: who the author is and their background, what the quote means philosophically and practically, why it is particularly relevant to students, and how a student can apply this wisdom in their daily academic and personal life. Be rich, specific, and engaging."
}`;

        let raw = '';
        try {
            raw = await callGroqAI(userPrompt, systemPrompt, { max_tokens: 900, temperature: 0.85, retries: 2 });
            raw = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
            const parsed = JSON.parse(raw);
            if (!parsed.text || !parsed.author) throw new Error('Missing fields');

            const newQuote = await DailyQuote.create({
                text: parsed.text,
                author: parsed.author,
                category: parsed.category || 'Motivation',
                context: parsed.context || '',
                seenBy: [studentId],
                aiGenerated: true,
            });

            return res.json({
                _id: newQuote._id,
                text: newQuote.text,
                author: newQuote.author,
                category: newQuote.category,
                context: newQuote.context,
                likeCount: 0,
                likedByMe: false,
            });
        } catch (aiError) {
            console.error('AI quote generation failed:', aiError.message, '| raw:', raw.slice(0, 200));
            const fallback = await DailyQuote.findOne({}).sort({ createdAt: 1 });
            if (fallback) {
                await DailyQuote.updateOne({ _id: fallback._id }, { $addToSet: { seenBy: studentId } });
                return res.json({
                    _id: fallback._id,
                    text: fallback.text,
                    author: fallback.author,
                    category: fallback.category,
                    context: fallback.context,
                    likeCount: (fallback.likedBy || []).length,
                    likedByMe: (fallback.likedBy || []).some(id => id.toString() === studentId),
                });
            }
            return res.status(503).json({ message: 'Quote service temporarily unavailable.' });
        }
    } catch (error) {
        console.error('Daily quote error:', error);
        res.status(500).json({ message: 'Failed to fetch daily quote.' });
    }
});

router.post('/student/daily-quote/:id/like', authenticateToken, async (req, res) => {
    try {
        const studentId = req.student.id;
        const quote = await DailyQuote.findById(req.params.id);
        if (!quote) return res.status(404).json({ error: 'Quote not found' });

        const alreadyLiked = (quote.likedBy || []).some(id => id.toString() === studentId);
        if (alreadyLiked) {
            await DailyQuote.updateOne({ _id: quote._id }, { $pull: { likedBy: new mongoose.Types.ObjectId(studentId) } });
        } else {
            await DailyQuote.updateOne({ _id: quote._id }, { $addToSet: { likedBy: new mongoose.Types.ObjectId(studentId) } });
        }
        const updated = await DailyQuote.findById(req.params.id, { likedBy: 1 });
        res.json({
            likeCount: (updated.likedBy || []).length,
            likedByMe: !alreadyLiked,
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
