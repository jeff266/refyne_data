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
    const redis = new IORedis(redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      // Upstash requires TLS
      tls: redisUrl.startsWith('rediss://') ? {} : undefined,
      // Connection resilience for Railway
      retryStrategy(times) {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      reconnectOnError(err) {
        const targetError = 'READONLY';
        if (err.message.includes(targetError)) {
          return true;
        }
        return false;
      },
      // Keep connections alive
      keepAlive: 30000,
      // Longer connect timeout for Railway
      connectTimeout: 10000,
      // Enable offline queue
      enableOfflineQueue: true,
    });

    // Add error handlers to prevent crashes
    redis.on('error', (err) => {
      console.warn('[Redis] Connection error:', err.message);
    });

    redis.on('connect', () => {
      console.log('[Redis] Connected successfully');
    });

    redis.on('ready', () => {
      console.log('[Redis] Ready to accept commands');
    });

    redis.on('close', () => {
      console.log('[Redis] Connection closed');
    });

    redis.on('reconnecting', () => {
      console.log('[Redis] Reconnecting...');
    });

    return redis;
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
