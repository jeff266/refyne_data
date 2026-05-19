/**
 * AI Summary Cache
 *
 * Upstash Redis cache layer for AI-generated summaries.
 * Reduces redundant API calls and improves response times.
 */

import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_URL || '',
  token: process.env.UPSTASH_REDIS_REST_TOKEN || '',
});

/**
 * Get cached AI summary from Redis.
 */
export async function getCachedSummary<T>(key: string): Promise<T | null> {
  try {
    return await redis.get<T>(key);
  } catch (err) {
    console.error('Cache read error:', err);
    return null;
  }
}

/**
 * Set cached AI summary in Redis with TTL.
 */
export async function setCachedSummary<T>(
  key: string,
  value: T,
  ttlSeconds: number
): Promise<void> {
  try {
    await redis.setex(key, ttlSeconds, value);
  } catch (err) {
    console.error('Cache write error:', err);
  }
}

/**
 * Invalidate (delete) a cached summary.
 */
export async function invalidateSummary(key: string): Promise<void> {
  try {
    await redis.del(key);
  } catch (err) {
    console.error('Cache delete error:', err);
  }
}

/**
 * Cache key patterns:
 *
 * ai:compliance:{orgId}              TTL: 3600 (1 hour)
 * ai:quarantine:{quarantineRecordId} TTL: 86400 (24 hours)
 * ai:rehearsal:{runId}               TTL: 3600 (1 hour)
 */
