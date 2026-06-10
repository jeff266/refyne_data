/**
 * Shared Per-Portal Rate Limiter
 *
 * Uses Upstash Redis to enforce 90 requests per 10 seconds per portal.
 * Shared across ALL workers - normalize, dedup, import, etc.
 *
 * Key format: rl:hubspot:{portalId}
 * Limit: 90/10s (leaves 10% buffer for HubSpot webhooks)
 */

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// Lazy-loaded instances
let redis: Redis | null = null;
let hubspotLimiter: Ratelimit | null = null;

function getHubSpotLimiter(): Ratelimit | null {
  // Skip rate limiting if Redis not configured (e.g., in tests)
  if (!process.env.UPSTASH_REDIS_URL || !process.env.UPSTASH_REDIS_TOKEN) {
    return null;
  }

  if (!hubspotLimiter) {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_URL,
      token: process.env.UPSTASH_REDIS_TOKEN,
    });

    // Shared across ALL workers via same Redis instance
    // Key format: rl:hubspot:{portalId}
    // 90/10s leaves 10% buffer for HubSpot webhooks
    hubspotLimiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(90, '10 s'),
      prefix: 'rl:hubspot',
    });
  }

  return hubspotLimiter;
}

export async function checkHubSpotRateLimit(
  portalId: string | number
): Promise<{ allowed: boolean; remaining: number; resetMs: number }> {
  const limiter = getHubSpotLimiter();

  // If rate limiter not configured, allow all requests
  if (!limiter) {
    return { allowed: true, remaining: 90, resetMs: Date.now() + 10000 };
  }

  const { success, remaining, reset } = await limiter.limit(String(portalId));

  if (!success) {
    console.warn(
      `[RateLimit] Portal ${portalId} rate limited. ` +
        `Reset in ${Math.ceil((reset - Date.now()) / 1000)}s`
    );
  }

  console.log(
    `[RateLimit] Consuming token for portal ${portalId} ` +
      `key: rl:hubspot:${portalId} remaining: ${remaining}`
  );

  return { allowed: success, remaining, resetMs: reset };
}

export async function withHubSpotRateLimit<T>(
  portalId: string | number,
  fn: () => Promise<T>,
  retries = 3
): Promise<T> {
  for (let attempt = 0; attempt < retries; attempt++) {
    const { allowed, resetMs } = await checkHubSpotRateLimit(portalId);

    if (allowed) return fn();

    // Wait until reset + jitter (avoid thundering herd)
    const waitMs = Math.max(0, resetMs - Date.now()) + Math.random() * 500;
    await new Promise((r) => setTimeout(r, waitMs));
  }

  throw new Error(
    `[RateLimit] Portal ${portalId} rate limited after ${retries} attempts`
  );
}
