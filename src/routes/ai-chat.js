const express = require('express');
const Student = require('../../models/Student');
const { authenticateToken } = require('../middleware/auth');
const { groq, GROQ_MODEL, callGroqAI } = require('../services/ai');

const router = express.Router();

// AI Study Buddy Chat Endpoint (Server-Sent Events streaming)
router.post('/api/ai-buddy/chat', authenticateToken, async (req, res) => {
    const message = req.body.message;
    const context = req.body.context || null;
    if (!message || typeof message !== 'string' || !message.trim()) {
        return res.status(400).json({ error: 'Message is required' });
    }
    if (!process.env.GROQ_API_KEY) {
        return res.status(503).json({ error: 'AI service not configured.' });
    }
    try {
        const student = await Student.findById(req.student.id);
        if (!student) return res.status(404).json({ error: 'Student not found' });
        let systemPrompt;
        if (context && context.type === 'counselling') {
            const topicLabels = { academic: 'academic stress, study challenges, and time management', emotional: 'emotional wellbeing, relationships, and personal challenges', crisis: 'urgent mental health and crisis support' };
            const topicDesc = topicLabels[context.topic] || context.topic || 'general support';
            systemPrompt = 'You are a caring, professional school counsellor for ' + student.studentName + '. Focus on: ' + topicDesc + '. Be warm, empathetic, and supportive. Ask follow-up questions when needed. Keep responses under 120 words. Never give medical diagnoses.';
        } else if (context && context.type === 'career') {
            const careerLabels = { stem: 'Science, Technology, Engineering & Mathematics', arts: 'Arts, Design & Creative fields', business: 'Business, Economics & Entrepreneurship', health: 'Healthcare, Medicine & Allied Health' };
            const careerDesc = careerLabels[context.topic] || context.topic || 'various careers';
            systemPrompt = 'You are an enthusiastic career advisor for ' + student.studentName + ', a ' + student.class + ' student. Focus specifically on: ' + careerDesc + '. Discuss qualifications, university options, skills, and career prospects. Be direct and practical. Under 150 words.';
        } else {
            systemPrompt = 'You are a helpful AI Study Buddy for ' + student.studentName + ', a ' + student.class + ' student studying: ' + student.subjectsEnrolled.join(', ') + '. Give accurate, clear, concise answers. No preamble. Under 150 words unless genuinely needed. Be encouraging.';
        }
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');
        res.flushHeaders();
        const stream = await groq.chat.completions.create({
            model: GROQ_MODEL,
            messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: message.trim() }],
            stream: true,
            temperature: 0.7,
            max_tokens: 350,
        });
        for await (const chunk of stream) {
            const token = (chunk.choices[0] && chunk.choices[0].delta && chunk.choices[0].delta.content) || '';
            if (token) res.write('data: ' + JSON.stringify({ token }) + '\n\n');
        }
        res.write('data: ' + JSON.stringify({ done: true }) + '\n\n');
        res.end();
    } catch (error) {
        console.error('AI Study Buddy error:', error);
        try { res.write('data: ' + JSON.stringify({ error: 'AI service error. Please try again.' }) + '\n\n'); res.end(); } catch (e) {}
    }
});

// Career Guidance AI Endpoint
router.post('/api/career-guidance/chat', authenticateToken, async (req, res) => {
    try {
        const studentId = req.student.id;
        const { message, chatHistory } = req.body;

        if (!message) {
            return res.status(400).json({ message: 'Message is required.' });
        }

        const student = await Student.findById(studentId);
        if (!student) {
            return res.status(404).json({ message: 'Student not found.' });
        }

        const studentContext = `
Student Profile:
- Name: ${student.preferredName || student.studentName}
- Current Tier: Level ${student.currentTier} (out of 10)
- Total XP Earned: ${student.xp}
- Bytes (Virtual Currency): ${student.bytes}
- Total Countries Identified (Geography): ${student.totalCountriesIdentified || 0}
- Total Sudoku Puzzles Completed: ${student.totalSudokuPuzzlesCompleted || 0}
- Geography Quiz Stats: ${JSON.stringify(student.geoQuizStats || {})}
- Sudoku Stats: ${JSON.stringify(student.sudokuStats || {})}

You are a professional career guidance counselor AI for SchoolByte, an educational platform in Uganda. Based on the student's academic performance, interests, and skills demonstrated through their gameplay and quiz results, provide personalized career advice, study tips, and motivational guidance.

Be encouraging, specific, and culturally relevant to Uganda and East Africa. Suggest careers that match their demonstrated skills (e.g., geography knowledge → cartography, tourism, geology; logical thinking from Sudoku → engineering, computer science, data analysis).

Keep responses concise (2-4 paragraphs), friendly, and actionable. Use their performance data to give specific feedback.
`;

        const fullPrompt = chatHistory && chatHistory.length > 0
            ? `${studentContext}\n\nConversation history:\n${chatHistory.map(msg => `${msg.role}: ${msg.content}`).join('\n')}\n\nStudent: ${message}\n\nCareer Counselor:`
            : `${studentContext}\n\nStudent: ${message}\n\nCareer Counselor:`;

        const aiReply = await callGroqAI(
            fullPrompt,
            'You are a professional career guidance counselor AI. Provide personalized, culturally relevant career advice for students in Uganda.',
            { temperature: 0.8, num_predict: 800, timeout: 60000, retries: 2 },
        );

        res.status(200).json({
            message: 'Career guidance response generated successfully.',
            reply: aiReply,
            studentStats: {
                tier: student.currentTier,
                xp: student.xp,
                bytes: student.bytes,
            },
        });
    } catch (error) {
        console.error('Error in career guidance chat:', error);
        res.status(500).json({
            message: 'Failed to generate career guidance response.',
            error: error.message,
        });
    }
});

// AI Buddy Endpoint — non-streaming variant (kept for backwards compatibility;
// Express picks the streaming one above first when both URLs match).
router.post('/api/ai-buddy/chat', authenticateToken, async (req, res) => {
    try {
        const studentId = req.student.id;
        const { message, chatHistory } = req.body;

        if (!message) {
            return res.status(400).json({ message: 'Message is required.' });
        }

        const student = await Student.findById(studentId);
        if (!student) {
            return res.status(404).json({ message: 'Student not found.' });
        }

        const systemPrompt = `You are AI Buddy, a helpful study assistant for students in Uganda. Answer questions clearly and accurately. Focus on the specific question asked. Keep responses under 100 words unless explaining a complex concept. Be factual and educational.`;

        let conversationContext = '';
        if (chatHistory && chatHistory.length > 0) {
            const recentHistory = chatHistory.slice(-4);
            conversationContext = recentHistory.map(msg => {
                const role = msg.role === 'user' ? 'Student' : 'AI Buddy';
                return `${role}: ${msg.content}`;
            }).join('\n');
            conversationContext += '\n\n';
        }

        const fullPrompt = `${conversationContext}Student: ${message}\n\nAI Buddy:`;

        const aiReply = await callGroqAI(
            fullPrompt,
            systemPrompt,
            { temperature: 0.5, num_predict: 350, timeout: 40000, retries: 1 },
        );

        res.status(200).json({
            message: 'AI Buddy response generated successfully.',
            reply: aiReply.trim(),
        });
    } catch (error) {
        console.error('Error in AI Buddy chat:', error);
        res.status(500).json({
            message: 'Failed to generate AI Buddy response.',
            error: error.message,
        });
    }
});

// ByteNexus Support Team Endpoint
router.post('/api/bytenexus-support/chat', authenticateToken, async (req, res) => {
    try {
        const studentId = req.student.id;
        const { message, chatHistory } = req.body;

        if (!message) {
            return res.status(400).json({ message: 'Message is required.' });
        }

        const student = await Student.findById(studentId);
        if (!student) {
            return res.status(404).json({ message: 'Student not found.' });
        }

        const platformContext = `
You are ByteNexus Support Team, the official technical support AI for SchoolByte educational platform. Your role is to:
- Answer questions about SchoolByte features and how to use them
- Help students navigate the platform (quizzes, career guidance, chat, notes, activities, etc.)
- Explain the XP system, Bytes currency, tier progression, and rewards
- Troubleshoot common issues students face on the platform
- Provide tips for getting the most out of SchoolByte features

SchoolByte Features:
- Quiz System: Subject-based quizzes with multiple question types
- Notes & Activities: Educational content upload/download with byte-based costs
- Career Guidance: AI-powered career counseling and advice
- AI Buddy: General study assistance (that's a different AI, not you)
- Chat System: Personal messaging and discussion groups with teachers/students
- XP & Tiers: Students earn XP by completing quizzes and activities, advancing through 10 tiers
- Bytes: Virtual currency earned through activities, used to download notes and access content

Be professional, helpful, and specific. Reference actual SchoolByte features accurately. Keep responses concise (2-3 paragraphs).`;

        const fullPrompt = chatHistory && chatHistory.length > 0
            ? `${platformContext}\n\nConversation history:\n${chatHistory.map(msg => `${msg.role}: ${msg.content}`).join('\n')}\n\nStudent (${student.preferredName || student.studentName}): ${message}\n\nByteNexus Support:`
            : `${platformContext}\n\nStudent (${student.preferredName || student.studentName}): ${message}\n\nByteNexus Support:`;

        const aiReply = await callGroqAI(
            fullPrompt,
            'You are ByteNexus Support Team, the official technical support AI for SchoolByte. Help students understand and use platform features effectively.',
            { temperature: 0.6, num_predict: 600, timeout: 60000, retries: 2 },
        );

        res.status(200).json({
            message: 'ByteNexus Support response generated successfully.',
            reply: aiReply,
        });
    } catch (error) {
        console.error('Error in ByteNexus Support chat:', error);
        res.status(500).json({
            message: 'Failed to generate ByteNexus Support response.',
            error: error.message,
        });
    }
});

// Counselling and Guidance Endpoint
router.post('/api/counselling/chat', authenticateToken, async (req, res) => {
    try {
        const studentId = req.student.id;
        const { message, chatHistory, counsellingType } = req.body;

        if (!message) {
            return res.status(400).json({ message: 'Message is required.' });
        }

        const student = await Student.findById(studentId);
        if (!student) {
            return res.status(404).json({ message: 'Student not found.' });
        }

        const typeContexts = {
            academic: 'You are providing academic counselling, helping with study stress, time management, exam anxiety, and academic challenges. Be supportive and provide practical study strategies.',
            emotional: 'You are providing emotional support counselling, helping students navigate feelings, relationships, peer pressure, and personal challenges. Be empathetic, non-judgmental, and encouraging.',
            crisis: 'You are providing crisis support counselling for urgent situations. Be calm, compassionate, and direct. Encourage professional help when needed. Focus on immediate coping strategies and safety.',
        };

        const counsellingContext = typeContexts[counsellingType] || typeContexts.academic;

        const systemPrompt = `You are a professional school counsellor in Uganda providing supportive guidance to students. ${counsellingContext} Keep responses caring, culturally sensitive, and under 120 words unless explaining important coping strategies. Be warm and encouraging.`;

        let conversationContext = '';
        if (chatHistory && chatHistory.length > 0) {
            const recentHistory = chatHistory.slice(-4);
            conversationContext = recentHistory.map(msg => {
                const role = msg.role === 'user' ? 'Student' : 'Counsellor';
                return `${role}: ${msg.content}`;
            }).join('\n');
            conversationContext += '\n\n';
        }

        const fullPrompt = `${conversationContext}Student: ${message}\n\nCounsellor:`;

        const aiReply = await callGroqAI(
            fullPrompt,
            systemPrompt,
            { temperature: 0.7, num_predict: 500, timeout: 50000, retries: 2 },
        );

        res.status(200).json({
            message: 'Counselling response generated successfully.',
            reply: aiReply.trim(),
        });
    } catch (error) {
        console.error('Error in counselling chat:', error);
        res.status(500).json({
            message: 'Failed to generate counselling response.',
            error: error.message,
        });
    }
});

module.exports = router;
