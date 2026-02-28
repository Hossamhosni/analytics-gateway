import { getRedisClient } from "../redis/client.js";
import { config } from "../config.js";

export async function isDuplicate(idempotencyKey) {
    if (!idempotencyKey) return false;

    const redis = getRedisClient();
    const key = `dedup:${idempotencyKey}`;
    const result = await redis.set(key, '1', 'NX', 'PX', config.redis.dedupTtlSeconds * 1000);
    return result === null;
}