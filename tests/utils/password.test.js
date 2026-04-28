const { generateRandomPassword } = require('../../src/utils/password');

describe('generateRandomPassword', () => {
    test('default length is 10', () => {
        expect(generateRandomPassword()).toHaveLength(10);
    });

    test('respects requested length', () => {
        for (const len of [4, 8, 16, 32, 64]) {
            expect(generateRandomPassword(len)).toHaveLength(len);
        }
    });

    test('contains at least one upper, lower, digit and special char', () => {
        for (let i = 0; i < 50; i++) {
            const p = generateRandomPassword(12);
            expect(p).toMatch(/[A-Z]/);
            expect(p).toMatch(/[a-z]/);
            expect(p).toMatch(/[0-9]/);
            expect(p).toMatch(/[!@#$%^&*]/);
        }
    });

    test('two consecutive calls return different passwords', () => {
        const a = generateRandomPassword(16);
        const b = generateRandomPassword(16);
        expect(a).not.toBe(b);
    });

    test('avoids easily-confused chars (I, O, l, 0, 1)', () => {
        for (let i = 0; i < 200; i++) {
            const p = generateRandomPassword(20);
            expect(p).not.toMatch(/[IOl01]/);
        }
    });
});
