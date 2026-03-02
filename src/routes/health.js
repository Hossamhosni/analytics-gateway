import { checkRedisHealth } from '../redis/client.js';
import { checkKafkaHealth } from '../kafka/producer.js';
import { config } from '../config.js';

export default async function healthRoutes(fastify, _opts) {
    fastify.get('/health', { config: { skipAuth: true } }, async (request, reply) => {
        const [redisHealthy, kafkaHealthy] = await Promise.all([
            checkRedisHealth(),
            checkKafkaHealth()
        ]);
        const status = redisHealthy && kafkaHealthy ? 'ok' : 'degraded';
        return reply.code(status === 'ok' ? 200 : 503).send({
            status,
            services: {
                redis: redisHealthy ? 'connected' : 'degraded',
                kafka: kafkaHealthy ? 'connected' : 'degraded',
            },
            uptime: Math.floor(process.uptime()),
            version: config.server.version,
        });
    })

    fastify.get('/health/live', { config : { skipAuth: true }}, async (request, reply) => {
        return { status: 'live' };
    })

    fastify.get('/health/ready', { config : { skipAuth: true }}, async (request, reply) => {
        const [redisHealthy, kafkaHealthy] = await Promise.all([
            checkRedisHealth(),
            checkKafkaHealth()
        ]);
        if (!redisHealthy || !kafkaHealthy) {
            reply.code(503).send({ ready: false });
            return;
        }
        reply.code(200).send({ ready: true });
    })
}

