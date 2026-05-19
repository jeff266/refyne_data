/**
 * Per-Org Rate Limiting for HubSpot API Routes
 *
 * Prevents abuse by limiting requests per organization.
 * Uses Upstash Redis for distributed rate limiting across multiple instances.
 */

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// Initialize Redis client for rate limiting
const redis = process.env.UPSTASH_REDIS_URL
  ? new Redis({
      url: process.env.UPSTASH_REDIS_URL,
      token: process.env.UPSTASH_REDIS_TOKEN || '',
    })
  : null;

// Rate limiter instance - 100 requests per 10 seconds per org
const rateLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(100, '10 s'),
      analytics: true,
      prefix: 'org_hubspot_rate_limit',
    })
  : null;

/**
 * Check if an org has exceeded their rate limit for HubSpot API calls.
 *
 * @param orgId - Organization ID
 * @param endpoint - API endpoint (for logging/analytics)
 * @returns { allowed: boolean, resetAt?: Date, remaining?: number }
 */
export async function checkOrgRateLimit(
  orgId: string,
  endpoint: string
): Promise<{
  allowed: boolean;
  resetAt?: Date;
  remaining?: number;
  limit?: number;
}> {
  // If rate limiter not configured, allow all requests
  if (!rateLimiter) {
    console.warn('[Org Rate Limit] Redis not configured, skipping rate limit check');
    return { allowed: true };
  }

  const identifier = `org:${orgId}`;

  try {
    const { success, limit, remaining, reset } = await rateLimiter.limit(identifier);

    if (!success) {
      console.warn(
        `[Org Rate Limit] Org ${orgId} exceeded limit on ${endpoint} - ` +
        `${remaining}/${limit} remaining, resets at ${new Date(reset).toISOString()}`
      );
    }

    return {
      allowed: success,
      resetAt: new Date(reset),
      remaining,
      limit,
    };
  } catch (error) {
    console.error('[Org Rate Limit] Failed to check rate limit:', error);
    // Fail open - allow request if rate limit check fails
    return { allowed: true };
  }
}

/**
 * Format rate limit error response for API routes.
 */
export function rateLimitErrorResponse(resetAt: Date, remaining: number) {
  return {
    error: 'Rate limit exceeded',
    message: 'Too many requests. Please try again later.',
    resetAt: resetAt.toISOString(),
    remaining,
  };
}
