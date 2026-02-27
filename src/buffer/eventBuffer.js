import { EventEmitter } from 'events';
import { config } from '../config.js';

export class EventBuffer extends EventEmitter {
    #buffer = [];
    #timer = null;
    #isFlushing = false;

    constructor({
        maxSize = config.buffer.maxSize,
        flushIntervalMs = config.buffer.flushIntervalMs,
        backpressureThreshold = config.buffer.backpressureThreshold,
    } = {}) {
        super();
        this.maxSize = maxSize;
        this.flushIntervalMs = flushIntervalMs;
        this.backpressureThreshold = backpressureThreshold;

        this.#timer = setInterval(() => this.#flush(), this.flushIntervalMs);
        this.#timer.unref();
    }

    add(event) {
        if (this.#buffer.length >= this.maxSize) {
            return { accepted: false };
        }

        this.#buffer.push(event);

        const utilization = this.#buffer.length / this.maxSize;

        if (utilization >= this.backpressureThreshold) {
            this.emit('backpressure', { utilization, size: this.#buffer.length });
        }

        if (this.#buffer.length >= this.maxSize) {
            this.#flush();
        }

        return { accepted: true };
    }

    #flush() {
        if (this.#isFlushing || this.#buffer.length === 0) return;
        this.#isFlushing = true;

        const batch = this.#buffer.splice(0);
        this.emit('flush', batch);

        this.#isFlushing = false;
    }

    async drain() {
        clearInterval(this.#timer)
        this.#flush();               
        return new Promise((resolve) => setImmediate(resolve));
    }

    get size() { return this.#buffer.length; }
    get utilization() { return this.#buffer.length / this.maxSize; }
}