const { refillEnergy } = require('../../src/services/energy');

describe('refillEnergy', () => {
    test('initialises lastEnergyRefillAt when missing and does not change energy', () => {
        const s = { energy: 10 };
        refillEnergy(s);
        expect(s.lastEnergyRefillAt).toBeInstanceOf(Date);
        expect(s.energy).toBe(10);
    });

    test('does nothing when less than an hour has passed', () => {
        const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000);
        const s = { energy: 10, lastEnergyRefillAt: tenMinAgo };
        refillEnergy(s);
        expect(s.energy).toBe(10);
        expect(s.lastEnergyRefillAt).toBe(tenMinAgo);
    });

    test('adds one energy per elapsed hour', () => {
        const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000 - 5 * 1000);
        const s = { energy: 10, lastEnergyRefillAt: threeHoursAgo };
        refillEnergy(s);
        expect(s.energy).toBe(13);
    });

    test('caps energy at 25', () => {
        const tenHoursAgo = new Date(Date.now() - 10 * 60 * 60 * 1000);
        const s = { energy: 24, lastEnergyRefillAt: tenHoursAgo };
        refillEnergy(s);
        expect(s.energy).toBe(25);
    });

    test('treats undefined energy as 25 (already full) and leaves it untouched', () => {
        const tenHoursAgo = new Date(Date.now() - 10 * 60 * 60 * 1000);
        const s = { lastEnergyRefillAt: tenHoursAgo };
        refillEnergy(s);
        // Function early-returns when nothing can be added, so it does not
        // materialise energy=25 on the object — callers that want a number
        // should default with `student.energy ?? 25` themselves.
        expect(s.energy).toBeUndefined();
        expect(s.lastEnergyRefillAt).toBe(tenHoursAgo);
    });

    test('advances lastEnergyRefillAt only by the energy actually granted', () => {
        // Student is at 24/25, 10 hours elapsed → only 1 energy can be granted.
        // The refill timestamp should advance by 1 hour, not 10, so the next
        // hour earns the next refill at the right moment.
        const start = new Date(Date.now() - 10 * 60 * 60 * 1000);
        const s = { energy: 24, lastEnergyRefillAt: start };
        refillEnergy(s);
        expect(s.energy).toBe(25);
        const advanced = new Date(s.lastEnergyRefillAt).getTime() - start.getTime();
        expect(advanced).toBe(60 * 60 * 1000);
    });
});
