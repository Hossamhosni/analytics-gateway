import Redis from 'ioredis';
import { config } from '../config.js';

let redisClient = null;

export async function connectRedis(logger) {
    if (redisClient) {
        return redisClient;
    }

    redisClient = new Redis(config.redis.url, {
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        retryStrategy: (times) => {
            if (times > 10) return null;
            return Math.min(times * 100, 3000);
        }
    });

    redisClient.on('error', (err) => {
        logger.error('Redis connection error:', err);
    });

    redisClient.on('ready', () => {
        logger.info('Redis connected');
    });

    redisClient.on("reconnecting", () => {
        logger.info('Redis reconnecting...');
    });

    await redisClient.ping();
    logger.info('Redis connected');

    return redisClient;
}

export function getRedisClient() {
    if (!redisClient) {
        throw new Error('Redis client not initialized. call connectRedis first');
    }
    return redisClient;
}

export async function checkRedisHealth() {
    try {
        const result = await redisClient?.ping();
        return result === 'PONG';
    } catch (error) {
        return false;
    }
}

export async function disconnectRedis(logger) {
    if (redisClient) {
        await redisClient.quit();
        redisClient = null;
        logger.info('Redis disconnected');
    }
}

