import Fastify from "fastify";
import helmet from "@fastify/helmet";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { config } from "./config.js";
import { getRedisClient } from "./redis/client.js";
import { EventBuffer } from "./buffer/eventBuffer.js";
import { publishBatch } from "./kafka/producer.js";

export async function buildApp({buffer, logger } = {}) {
    const app = Fastify({
        logger: logger ?? {
            level: config.server.logLevel,
            transport: config.isDevelopment ? {
                target: 'pino-pretty',
                options: {
                    translateTime: 'HH:MM:ss Z',
                    colorize: true,
                }
            } : undefined,
        },
        trustProxy: true,
        bodyLimit: 1048576,
    });

    await app.register(helmet);
    await app.register(cors);
    await app.register(rateLimit, {
        max: config.redis.rateLimitMax,
        timeWindow: config.redis.rateLimitWindowMs,
        redis: getRedisClient(),
    });

    await app.register(import('./plugins/requestId.js'));
    await app.register(import('./plugins/auth.js'));
    await app.register(import('./plugins/metrics.js'));

    const eventBuffer = buffer ?? new EventBuffer();
    eventBuffer.on('flush', async (batch) => {
        await publishBatch(batch, app.log);
    });
    eventBuffer.on('backpressure', ({ utilization }) => {
        app.log.warn({ utilization }, 'Buffer backpressure');
    });
    app.decorate('eventBuffer', eventBuffer); 

    await app.register(import('./routes/health.js'));
    await app.register(import('./routes/events.js'), { buffer: eventBuffer });

    app.setErrorHandler((error, request, reply) => {
        const statusCode = error.statusCode ?? 500;
        if (statusCode >= 500) request.log.error({ err: error }, 'Server error');
        reply.code(statusCode).send({
            error: statusCode >= 500 && config.isProduction ? 'Internal server error' : error.message,
            requestId: request.id,
        });
    });

    return app;
}