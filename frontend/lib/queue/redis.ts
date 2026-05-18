/**
 * Redis Connection
 *
 * Provides a shared Redis connection for BullMQ queues.
 * Uses Upstash Redis in production, local Redis in development.
 */

import IORedis, { RedisOptions } from 'ioredis';

// Singleton connection
let redisConnection: IORedis | null = null;

/**
 * Get Redis connection options from environment.
 */
export function getRedisOptions(): RedisOptions {
  // Upstash Redis URL format: rediss://default:xxx@xxx.upstash.io:6379
  const redisUrl = process.env.UPSTASH_REDIS_URL || process.env.REDIS_URL;

  if (redisUrl) {
    return {
      // ioredis can parse the URL directly
      maxRetriesPerRequest: null, // Required for BullMQ
      enableReadyCheck: false,    // Faster startup
    };
  }

  // Local Redis fallback
  return {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  };
}

/**
 * Create a new Redis connection.
 * Each BullMQ queue/worker needs its own connection.
 */
export function createRedisConnection(): IORedis {
  const redisUrl = process.env.UPSTASH_REDIS_URL || process.env.REDIS_URL;

  if (redisUrl) {
    return new IORedis(redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      // Upstash requires TLS
      tls: redisUrl.startsWith('rediss://') ? {} : undefined,
    });
  }

  const options = getRedisOptions();
  return new IORedis(options);
}

/**
 * Get a shared Redis connection (singleton).
 * Use this for quick operations, not for BullMQ workers.
 */
export function getRedisConnection(): IORedis {
  if (!redisConnection) {
    redisConnection = createRedisConnection();
  }
  return redisConnection;
}

/**
 * Check if Redis is configured.
 */
export function isRedisConfigured(): boolean {
  return !!(process.env.UPSTASH_REDIS_URL || process.env.REDIS_URL);
}

/**
 * Close the shared Redis connection.
 */
export async function closeRedisConnection(): Promise<void> {
  if (redisConnection) {
    await redisConnection.quit();
    redisConnection = null;
  }
}
