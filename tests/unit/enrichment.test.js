import { jest } from '@jest/globals';

jest.unstable_mockModule('../../src/config.js', () => ({
    config: {
        server: { version: '1.0.0' },
    },
}));

const { enrichEvent, getIdempotencyKey } = await import('../../src/services/enrichment.js');

describe('enrichEvent()', () => {
    const baseEvent = {
        type: 'page_view',
        timestamp: '2026-03-04T00:00:00.000Z',
        payload: { url: '/home' },
    };

    const meta = { requestId: 'req-abc', sourceIp: '1.2.3.4' };

    test('preserves all original event fields', () => {
        const result = enrichEvent(baseEvent, meta);
        expect(result.type).toBe('page_view');
        expect(result.timestamp).toBe('2026-03-04T00:00:00.000Z');
        expect(result.payload).toEqual({ url: '/home' });
    });

    test('adds server-side metadata fields', () => {
        const result = enrichEvent(baseEvent, meta);
        expect(result.sourceIp).toBe('1.2.3.4');
        expect(result.requestId).toBe('req-abc');
        expect(result.gatewayVersion).toBeDefined();
        expect(result.receivedAt).toBeDefined();
    });

    test('uses requestId as messageId when event has no messageId', () => {
        const result = enrichEvent(baseEvent, meta);
        expect(result.messageId).toBe('req-abc');
    });

    test('preserves existing messageId on the event', () => {
        const event = { ...baseEvent, messageId: 'client-uuid-123' };
        const result = enrichEvent(event, meta);
        expect(result.messageId).toBe('client-uuid-123');
    });

    test('receivedAt is a valid ISO timestamp', () => {
        const result = enrichEvent(baseEvent, meta);
        expect(() => new Date(result.receivedAt)).not.toThrow();
        expect(new Date(result.receivedAt).toISOString()).toBe(result.receivedAt);
    });

    test('does not mutate the original event object', () => {
        const original = { ...baseEvent };
        enrichEvent(baseEvent, meta);
        expect(baseEvent).toEqual(original);
    });
});

describe('getIdempotencyKey()', () => {
    test('returns messageId when present', () => {
        expect(getIdempotencyKey({ messageId: 'msg-1' })).toBe('msg-1');
    });

    test('returns composite key when userId, type, and timestamp are present', () => {
        const event = { userId: 'user-1', type: 'click', timestamp: '2026-01-01T00:00:00Z' };
        expect(getIdempotencyKey(event)).toBe('user-1:click:2026-01-01T00:00:00Z');
    });

    test('returns null when only type is present (no userId or timestamp)', () => {
        expect(getIdempotencyKey({ type: 'click' })).toBeNull();
    });

    test('returns null for empty event', () => {
        expect(getIdempotencyKey({})).toBeNull();
    });

    test('messageId takes priority over composite key', () => {
        const event = {
            messageId: 'explicit-id',
            userId: 'user-1',
            type: 'click',
            timestamp: '2026-01-01T00:00:00Z',
        };
        expect(getIdempotencyKey(event)).toBe('explicit-id');
    });
});
