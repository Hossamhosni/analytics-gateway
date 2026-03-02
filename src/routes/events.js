import { eventsReceivedTotal, bufferUtilization, eventsDroppedTotal, eventsDuplicateTotal } from "../plugins/metrics.js";
import { config } from "../config.js";
import { enrichEvent, getIdempotencyKey } from "../services/enrichment.js";
import { isDuplicate } from "../services/deduplication.js";


const eventSchema = {
    type: 'object',
    required: ['type', 'timestamp', 'payload'],
    additionalProperties: false,
    properties: {
        type:      { type: 'string', minLength: 1, maxLength: 128 },
        messageId: { type: 'string', maxLength: 256 },
        timestamp: { type: 'string', format: 'date-time' },
        userId:    { type: 'string' },
        sessionId: { type: 'string' },
        payload:   { type: 'object' },
    },
};

export async function eventRoutes(fastify, opts) {
    const { buffer } = opts;
    fastify.post("/v1/events", { schema: { body: eventSchema } }, async (request, reply) => {
        const sourceIp = request.headers['x-forwarded-for'];
        const event = request.body;
        const idempotencyKey = getIdempotencyKey(event);
        eventsReceivedTotal.inc({ event_type : event.type });
        if (await isDuplicate(idempotencyKey)) {
            eventsDuplicateTotal.inc();
            return reply.code(202).send({ accepted: true, duplicate: true});
        }
    
        const enriched = enrichEvent(event, { requestId: request.id, sourceIp });
        const result = buffer.add(enriched);
        if (result.accepted) {
            bufferUtilization.set(buffer.utilization);
            return reply.code(202).send({ accepted: true, requestId: request.id });
        }
        eventsDroppedTotal.inc();
        return reply.code(429).send({ accepted: false, error: 'Too many requests' });
    });
    
    fastify.post("/v1/events/batch", { schema: { body: { type: 'array', maxItems: config.buffer.batchMaxEvents, items: eventSchema } } }, async (request, reply) => {
        const sourceIp = request.headers['x-forwarded-for'];
        const events = request.body;
        let acceptedCount = 0;
        let duplicateCount = 0;
        let droppedCount = 0;
        const results = await Promise.all(events.map(async (event) => {
            const idempotencyKey = getIdempotencyKey(event);
            eventsReceivedTotal.inc({ event_type : event.type });
            if (await isDuplicate(idempotencyKey)) {
                eventsDuplicateTotal.inc();
                duplicateCount++;
                return;
            }
            const enriched = enrichEvent(event, { requestId: request.id, sourceIp });
            const result = buffer.add(enriched);
            if (result.accepted) {
                bufferUtilization.set(buffer.utilization);
                acceptedCount++;
            } else {
                eventsDroppedTotal.inc();
                droppedCount++;
            }
        }));
        return reply.code(202).send({ accepted: acceptedCount, duplicate: duplicateCount, dropped: droppedCount });
    });
    
    fastify.post("/v1/auth/token", { config: { skipAuth: true } }, async (request, reply) => {
        const { apiKey } = request.body;
        if (!apiKey || !config.auth.apiKeys.has(apiKey)) {
            return reply.code(401).send({ error: 'Invalid API key' });
        }
        const token = fastify.jwt.sign({ sub: apiKey });
        return reply.code(200).send({ token, expiresIn: config.auth.jwt.expiresIn });
    });
}