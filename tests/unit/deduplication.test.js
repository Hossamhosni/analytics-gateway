import { jest } from '@jest/globals';

const mockSet = jest.fn();
jest.unstable_mockModule('../../src/redis/client.js', () => ({
    getRedisClient: () => ({ set: mockSet }),
}));

jest.unstable_mockModule('../../src/config.js', () => ({
    config: {
        redis: { dedupTtlSeconds: 86400 },
    },
}));

const { isDuplicate } = await import('../../src/services/deduplication.js');

describe('isDuplicate()', () => {
    beforeEach(() => {
        mockSet.mockReset();
    });

    test('returns false without calling Redis when key is null', async () => {
        const result = await isDuplicate(null);
        expect(result).toBe(false);
        expect(mockSet).not.toHaveBeenCalled();
    });

    test('returns false (not a duplicate) when Redis SET NX succeeds', async () => {
        mockSet.mockResolvedValue('OK');
        const result = await isDuplicate('unique-key-1');
        expect(result).toBe(false);
    });

    test('returns true (is a duplicate) when Redis SET NX returns null', async () => {
        mockSet.mockResolvedValue(null);
        const result = await isDuplicate('existing-key');
        expect(result).toBe(true);
    });

    test('calls Redis with correct NX and PX options', async () => {
        mockSet.mockResolvedValue('OK');
        await isDuplicate('my-event-id');

        expect(mockSet).toHaveBeenCalledWith(
            'dedup:my-event-id',
            '1',
            'NX',
            'PX',
            86400 * 1000,
        );
    });
});
