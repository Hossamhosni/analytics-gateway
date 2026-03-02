import { register, collectDefaultMetrics, Counter, Histogram, Gauge } from 'prom-client';
import fp from 'fastify-plugin';

collectDefaultMetrics({ register });

export const httpRequestsTotal = new Counter({
    name: 'gateway_http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'route', 'status_code'],
    registers: [register]
});

export const httpRequestDurationMs  = new Histogram({
    name: 'gateway_http_requests_duration_ms',
    help: 'Duration of HTTP requests',
    labelNames: ['method', 'route', 'status_code'],
    buckets: [ 1, 5, 10, 25, 50, 100, 250, 500, 1000 ],
    registers: [register]
});

export const eventsReceivedTotal = new Counter({
    name: 'gateway_events_received_total',
    help: 'Total number of events received',
    labelNames: ['event_type'],
    registers: [register]
});

export const eventsDuplicateTotal = new Counter({
    name: 'gateway_events_duplicate_total',
    help: 'Total number of duplicate events',
    registers: [register]
});

export const eventsDroppedTotal = new Counter({
    name: 'gateway_events_dropped_total',
    help: 'Total number of dropped events',
    registers: [register]
});

export const bufferUtilization = new Gauge({
    name: 'gateway_buffer_utilization',
    help: 'Buffer utilization',
    registers: [register]
});

export const rateLimitHitsTotal = new Counter({
    name: 'gateway_rate_limit_hits_total',
    help: 'Total number of rate limit hits',
    registers: [register]
});

export default fp(async (fastify, _opts) => {
    fastify.get('/metrics', { config: {skipAuth: true}}, async (request, reply) => {
        reply.header('Content-Type', register.contentType);
        return register.metrics();
    });

    fastify.addHook('onRequest', async (request) => {
        request.startTime = Date.now();
    });

    fastify.addHook('onResponse', async (request, reply) => {
        const duration = Date.now() - request.startTime;
        const labels = {
            method: request.method,
            route: request.routeOptions?.url ?? request.url,
            status_code: reply.statusCode,
        };
        httpRequestsTotal.inc(labels);
        httpRequestDurationMs.observe(labels, duration);
    });
});