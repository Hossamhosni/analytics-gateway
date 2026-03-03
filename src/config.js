import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
    NODE_ENV: z.enum(['development', 'test', 'production']),
    PORT: z.coerce.number().default(3000),
    HOST: z.string().default('0.0.0.0'),
    LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
    GATEWAY_VERSION: z.string().default('1.0.0'),

    // Auth
    API_KEYS: z.string().min(1),
    JWT_SECRET: z.string().min(32),
    JWT_EXPIRES_IN: z.string().default('2h'),

    // Kafka
    KAFKA_BROKERS: z.string().min(1),
    KAFKA_CLIENT_ID: z.string(),
    KAFKA_TOPIC_PREFIX: z.string().default('events'),
    KAFKA_DLQ_TOPIC: z.string().default('events.dlq'),
    KAFKA_PRODUCER_RETRIES: z.coerce.number().default(3),

    // Redis
    REDIS_URL: z.string().url().default('redis://localhost:6379'),
    RATE_LIMIT_MAX: z.coerce.number().default(1000),
    RATE_LIMIT_WINDOW_MS: z.coerce.number().positive().default(60 * 1000),
    DEDUP_TTL_SECONDS: z.coerce.number().positive().default(60 * 60),

    // Buffer
    BUFFER_MAX_SIZE:               z.coerce.number().int().positive().default(500),
    BUFFER_FLUSH_INTERVAL_MS:      z.coerce.number().int().positive().default(200),
    BUFFER_BACKPRESSURE_THRESHOLD: z.coerce.number().min(0).max(1).default(0.8),
    BATCH_MAX_EVENTS:              z.coerce.number().int().positive().default(1000),

});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
    console.error('Invalid environment variables:', parsed.error.errors);
    for (const issue of parsed.error.issues) {
        console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
    }
    process.exit(1);
}

const env = parsed.data;

export const config = {
    env: env.NODE_ENV,
    isProduction: env.NODE_ENV === 'production',
    isDevelopment: env.NODE_ENV === 'development',
    isTest: env.NODE_ENV === 'test',
    
    server: {
        port: env.PORT,
        host: env.HOST,
        logLevel: env.LOG_LEVEL,
        version: env.GATEWAY_VERSION,
    },

    auth: {
        apiKeys: new Set(env.API_KEYS.split(',').map((k) => k.trim()).filter(Boolean)),
        jwt: {
            secret: env.JWT_SECRET,
            expiresIn: env.JWT_EXPIRES_IN,
        },
    },

    kafka: {
        brokers: env.KAFKA_BROKERS.split(',').map((b) => b.trim()),
        clientId: env.KAFKA_CLIENT_ID,
        topicPrefix: env.KAFKA_TOPIC_PREFIX,
        dlqTopic: env.KAFKA_DLQ_TOPIC,
        producerRetries: env.KAFKA_PRODUCER_RETRIES,
    },

    redis: {
        url: env.REDIS_URL,
        rateLimitMax: env.RATE_LIMIT_MAX,
        rateLimitWindowMs: env.RATE_LIMIT_WINDOW_MS,
        dedupTtlSeconds: env.DEDUP_TTL_SECONDS,
    },

    buffer: {
        maxSize: env.BUFFER_MAX_SIZE,
        flushIntervalMs: env.BUFFER_FLUSH_INTERVAL_MS,
        backpressureThreshold: env.BUFFER_BACKPRESSURE_THRESHOLD,
        batchMaxEvents: env.BATCH_MAX_EVENTS,
    },    

}
