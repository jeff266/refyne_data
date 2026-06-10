import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { NextResponse } from 'next/server';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_URL!,
  token: process.env.UPSTASH_REDIS_TOKEN!,
});

// Different limiters for different route types
export const rateLimiters = {
  // Invite endpoints - strict (prevent spam)
  invite: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, '1 h'),
    prefix: 'rl:invite',
    // 5 invitations per hour per org
  }),

  // Expensive operations - moderate
  expensive: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, '1 m'),
    prefix: 'rl:expensive',
    // 10 normalize/dedup runs per minute per org
  }),

  // File uploads - moderate
  upload: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(20, '1 h'),
    prefix: 'rl:upload',
    // 20 uploads per hour per org
  }),

  // Provider requests - loose (not spammable)
  requests: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, '24 h'),
    prefix: 'rl:requests',
    // 10 provider requests per day per org
  }),
};

export async function checkRateLimit(
  limiter: Ratelimit,
  identifier: string
): Promise<NextResponse | null> {
  try {
    const { success, limit, remaining, reset } = await limiter.limit(identifier);

    if (!success) {
      return NextResponse.json(
        {
          error: 'rate_limited',
          message: 'Too many requests. Please try again later.',
          reset: new Date(reset).toISOString(),
        },
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'X-RateLimit-Limit': limit.toString(),
            'X-RateLimit-Remaining': remaining.toString(),
            'X-RateLimit-Reset': reset.toString(),
            'Retry-After': Math.ceil((reset - Date.now()) / 1000).toString(),
          },
        }
      );
    }

    return null; // not rate limited
  } catch (err) {
    // Graceful fallback: if Redis is unavailable, log warning and allow request through
    console.warn('[RateLimit] Redis unavailable, allowing request:', err);
    return null;
  }
}
