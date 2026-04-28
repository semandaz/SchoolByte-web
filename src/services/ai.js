// AI Service — Groq (LLM) wrapper used by quiz generation, AI buddy chat,
// career guidance, counselling, and ByteNexus support.

const Groq = require('groq-sdk');

const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.1-8b-instant';
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || '' });

// Test Groq connection on startup.
(async () => {
    if (!process.env.GROQ_API_KEY) {
        console.warn('\u26a0 GROQ_API_KEY not set. AI features will not work. Set GROQ_API_KEY in your environment.');
        return;
    }
    try {
        await groq.chat.completions.create({
            model: GROQ_MODEL,
            messages: [{ role: 'user', content: 'hi' }],
            max_tokens: 1,
        });
        console.log('\u2713 Groq AI service connected successfully.');
    } catch (error) {
        console.warn('\u26a0 Groq AI service not available:', error.message);
    }
})();

// Helper function to extract JSON from AI response.
function extractJSON(text) {
    try {
        let cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const jsonStart = cleaned.indexOf('{');
        const jsonEnd = cleaned.lastIndexOf('}');
        if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
            cleaned = cleaned.substring(jsonStart, jsonEnd + 1);
        }
        return JSON.parse(cleaned);
    } catch (error) {
        throw new Error(`Failed to extract valid JSON from AI response: ${error.message}`);
    }
}

// Groq AI wrapper -- fast LLM inference with retry/backoff.
async function callGroqAI(userPrompt, systemPrompt, options) {
    systemPrompt = systemPrompt || '';
    options = options || {};
    if (!process.env.GROQ_API_KEY) throw new Error('GROQ_API_KEY not configured.');
    const maxRetries = options.retries !== undefined ? options.retries : 1;
    const maxTokens = options.max_tokens || options.num_predict || 350;
    const temperature = options.temperature !== undefined ? options.temperature : 0.7;
    const messages = [];
    if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
    messages.push({ role: 'user', content: userPrompt });
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            const response = await groq.chat.completions.create({
                model: GROQ_MODEL,
                messages,
                temperature,
                max_tokens: maxTokens,
            });
            return (response.choices[0] && response.choices[0].message && response.choices[0].message.content) || '';
        } catch (error) {
            if (attempt === maxRetries) throw new Error('Groq AI error: ' + error.message);
            await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 500));
        }
    }
}

module.exports = {
    groq,
    GROQ_MODEL,
    extractJSON,
    callGroqAI,
};
