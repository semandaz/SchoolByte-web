const crypto = require('crypto');

// Cryptographically-strong random password generator.
function generateRandomPassword(length = 10) {
    const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const lower = 'abcdefghjkmnpqrstuvwxyz';
    const digits = '23456789';
    const special = '!@#$%^&*';
    const all = upper + lower + digits + special;
    const pick = (set) => set[crypto.randomInt(set.length)];
    const pass = [pick(upper), pick(lower), pick(digits), pick(special)];
    for (let i = pass.length; i < length; i++) {
        pass.push(pick(all));
    }
    // Cryptographically-shuffle (Fisher–Yates) so the position of each guaranteed-class
    // character is not biased.
    for (let i = pass.length - 1; i > 0; i--) {
        const j = crypto.randomInt(i + 1);
        [pass[i], pass[j]] = [pass[j], pass[i]];
    }
    return pass.join('');
}

module.exports = { generateRandomPassword };
