/**
 * Centralized environment variable checks with friendly error messages.
 * Require this early in server.js (or app entry) so missing config fails fast.
 */

function requireEnv(name, friendlyMessage) {
    const value = process.env[name];
    if (value === undefined || value === '') {
        const msg = friendlyMessage || `${name} is required. Set it in your environment or .env.`;
        throw new Error(`Config error: ${msg}`);
    }
    return value;
}

function checkEnv() {
    requireEnv('MONGODB_URI', 'MONGODB_URI is required for database connection.');
    requireEnv('JWT_SECRET', 'JWT_SECRET is required for authentication.');
    // Optional but recommended
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        console.warn('WARNING: EMAIL_USER or EMAIL_PASS not set. Email (verification, reset) will not work.');
    }
    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
        console.warn('WARNING: Cloudinary env vars not set. File uploads may fail.');
    }
}

module.exports = { requireEnv, checkEnv };
