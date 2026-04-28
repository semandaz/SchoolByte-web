// Stub Groq SDK so importing src/services/ai.js does not actually try to
// reach the Groq API on test startup.
jest.mock('groq-sdk', () => {
    return jest.fn().mockImplementation(() => ({
        chat: { completions: { create: jest.fn().mockResolvedValue({ choices: [{ message: { content: '' } }] }) } },
    }));
});

const { extractJSON } = require('../../src/services/ai');

describe('extractJSON', () => {
    test('parses raw JSON object', () => {
        expect(extractJSON('{"a":1,"b":"two"}')).toEqual({ a: 1, b: 'two' });
    });

    test('strips ```json fences', () => {
        const input = '```json\n{"x":42}\n```';
        expect(extractJSON(input)).toEqual({ x: 42 });
    });

    test('strips bare ``` fences', () => {
        const input = '```\n{"x":42}\n```';
        expect(extractJSON(input)).toEqual({ x: 42 });
    });

    test('extracts JSON embedded in a chatty preamble/postamble', () => {
        const input = 'Sure! Here is the JSON you requested:\n{"foo":"bar","n":3}\nLet me know if you need more.';
        expect(extractJSON(input)).toEqual({ foo: 'bar', n: 3 });
    });

    test('throws a descriptive error on invalid JSON', () => {
        expect(() => extractJSON('not json at all')).toThrow(/Failed to extract valid JSON/);
    });
});
