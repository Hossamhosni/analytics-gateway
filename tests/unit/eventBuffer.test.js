import { jest } from '@jest/globals';
import { EventBuffer } from '../../src/buffer/eventBuffer.js';

const makeBuffer = (opts = {}) =>
    new EventBuffer({ maxSize: 10, flushIntervalMs: 10000, backpressureThreshold: 0.8, ...opts });

describe('EventBuffer', () => {
    describe('add()', () => {
        test('accepts an event and returns { accepted: true }', () => {
            const buf = makeBuffer();
            expect(buf.add({ type: 'click' })).toEqual({ accepted: true });
            expect(buf.size).toBe(1);
        });

        test('returns { accepted: false } when buffer is at max capacity', () => {
            const buf = makeBuffer({ maxSize: 2 });
            // During the flush triggered by the 2nd add, refill the buffer.
            // Inner auto-flush is suppressed by the #isFlushing guard, so the
            // buffer stays full after the outer flush completes.
            buf.on('flush', () => {
                buf.add({ type: 'fill-1' });
                buf.add({ type: 'fill-2' });
            });

            buf.add({ type: 'a' });
            buf.add({ type: 'b' }); // triggers flush → refills buffer inside handler

            expect(buf.add({ type: 'c' })).toEqual({ accepted: false });
            expect(buf.size).toBe(2);
        });

        test('emits backpressure event when utilization >= threshold', () => {
            const buf = makeBuffer({ maxSize: 10, backpressureThreshold: 0.5 });
            const onBackpressure = jest.fn();
            buf.on('backpressure', onBackpressure);

            // Fill to exactly 50% (5/10)
            for (let i = 0; i < 5; i++) buf.add({ type: 'ev' });

            expect(onBackpressure).toHaveBeenCalled();
            const { utilization } = onBackpressure.mock.calls[0][0];
            expect(utilization).toBeGreaterThanOrEqual(0.5);
        });

        test('does not emit backpressure below threshold', () => {
            const buf = makeBuffer({ maxSize: 10, backpressureThreshold: 0.8 });
            const onBackpressure = jest.fn();
            buf.on('backpressure', onBackpressure);

            buf.add({ type: 'ev' }); // 10% utilization
            expect(onBackpressure).not.toHaveBeenCalled();
        });
    });

    describe('#flush()', () => {
        test('emits flush event with all buffered events', async () => {
            const buf = makeBuffer();
            const onFlush = jest.fn();
            buf.on('flush', onFlush);

            buf.add({ type: 'a' });
            buf.add({ type: 'b' });
            await buf.drain();

            expect(onFlush).toHaveBeenCalledWith([{ type: 'a' }, { type: 'b' }]);
        });

        test('clears the buffer after flushing', async () => {
            const buf = makeBuffer();
            buf.add({ type: 'a' });
            buf.on('flush', jest.fn());
            await buf.drain();

            expect(buf.size).toBe(0);
        });

        test('does not emit flush when buffer is empty', async () => {
            const buf = makeBuffer();
            const onFlush = jest.fn();
            buf.on('flush', onFlush);
            await buf.drain();

            expect(onFlush).not.toHaveBeenCalled();
        });
    });

    describe('drain()', () => {
        test('resolves after flushing remaining events', async () => {
            const buf = makeBuffer();
            const flushed = [];
            buf.on('flush', (batch) => flushed.push(...batch));

            buf.add({ type: 'x' });
            await buf.drain();

            expect(flushed).toEqual([{ type: 'x' }]);
        });
    });

    describe('getters', () => {
        test('size returns current buffer length', () => {
            const buf = makeBuffer();
            expect(buf.size).toBe(0);
            buf.add({ type: 'a' });
            expect(buf.size).toBe(1);
        });

        test('utilization returns fraction of max size', () => {
            const buf = makeBuffer({ maxSize: 4 });
            buf.add({ type: 'a' });
            buf.add({ type: 'b' });
            expect(buf.utilization).toBeCloseTo(0.5);
        });
    });
});
