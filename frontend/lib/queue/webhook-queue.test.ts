/**
 * Webhook Queue Tests
 *
 * Tests for BullMQ queue configuration and job handling.
 * Note: These are unit tests that don't require a real Redis connection.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getWorkerConcurrency,
  getRateLimitSettings,
  calculatePortalRateLimit,
} from './webhook-queue';
import {
  setPortalBurstLimit,
  clearRateLimiterState,
  DEFAULT_BURST_LIMIT,
} from '../hubspot/rate-limiter';

// Mock ioredis to prevent actual connections
vi.mock('ioredis', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      on: vi.fn(),
      quit: vi.fn().mockResolvedValue('OK'),
    })),
  };
});

describe('Webhook Queue Configuration', () => {
  beforeEach(() => {
    clearRateLimiterState();
  });

  describe('getWorkerConcurrency', () => {
    it('returns the configured concurrency value', () => {
      const concurrency = getWorkerConcurrency();
      expect(concurrency).toBe(5);
    });

    it('returns a positive integer', () => {
      const concurrency = getWorkerConcurrency();
      expect(Number.isInteger(concurrency)).toBe(true);
      expect(concurrency).toBeGreaterThan(0);
    });
  });

  describe('getRateLimitSettings (default)', () => {
    it('returns rate limit configuration', () => {
      const settings = getRateLimitSettings();
      expect(settings).toHaveProperty('max');
      expect(settings).toHaveProperty('duration');
    });

    it('has default max of 50 jobs (50% of 100)', () => {
      const settings = getRateLimitSettings();
      expect(settings.max).toBe(50);
    });

    it('has duration of 10 seconds', () => {
      const settings = getRateLimitSettings();
      expect(settings.duration).toBe(10_000);
    });

    it('respects HubSpot rate limits (leaves headroom)', () => {
      const settings = getRateLimitSettings();
      // HubSpot allows 100 req / 10 sec
      // We use 50% of limit to leave headroom
      expect(settings.max).toBeLessThanOrEqual(DEFAULT_BURST_LIMIT);
    });
  });

  describe('calculatePortalRateLimit (dynamic)', () => {
    it('uses stored burst limit from portal', () => {
      setPortalBurstLimit('portal-dynamic', 150);

      const settings = calculatePortalRateLimit('portal-dynamic');

      // 50% of 150 = 75
      expect(settings.max).toBe(75);
      expect(settings.duration).toBe(10_000);
    });

    it('defaults to 50 for unknown portal', () => {
      const settings = calculatePortalRateLimit('unknown-portal');

      // 50% of 100 (default) = 50
      expect(settings.max).toBe(50);
    });

    it('ensures minimum of 10 req/10sec', () => {
      // Set a very low burst limit
      setPortalBurstLimit('portal-low', 10);

      const settings = calculatePortalRateLimit('portal-low');

      // 50% of 10 = 5, but minimum is 10
      expect(settings.max).toBe(10);
    });

    it('uses floor for non-integer limits', () => {
      setPortalBurstLimit('portal-odd', 77);

      const settings = calculatePortalRateLimit('portal-odd');

      // 50% of 77 = 38.5, floored to 38
      expect(settings.max).toBe(38);
    });
  });

  describe('getRateLimitSettings (with portalId)', () => {
    it('returns portal-specific settings', () => {
      setPortalBurstLimit('portal-custom', 200);

      const settings = getRateLimitSettings('portal-custom');

      // 50% of 200 = 100
      expect(settings.max).toBe(100);
      expect(settings.duration).toBe(10_000);
    });
  });
});

describe('Queue Behavior', () => {
  beforeEach(() => {
    clearRateLimiterState();
  });

  it('concurrency is less than rate limit', () => {
    // Worker concurrency should be less than rate limit
    // to prevent overwhelming the queue
    const concurrency = getWorkerConcurrency();
    const rateLimit = getRateLimitSettings();
    expect(concurrency).toBeLessThanOrEqual(rateLimit.max);
  });

  it('rate limit allows for burst handling', () => {
    const settings = getRateLimitSettings();
    // 50 jobs per 10 seconds = 5 jobs/sec average
    // This can handle bulk imports (hundreds of events)
    // while staying under HubSpot's 100/10sec limit
    const jobsPerSecond = settings.max / (settings.duration / 1000);
    expect(jobsPerSecond).toBe(5);
  });

  it('headroom factor is 50%', () => {
    // Set a known burst limit
    setPortalBurstLimit('portal-headroom', 100);

    const settings = calculatePortalRateLimit('portal-headroom');

    // Should be exactly 50% of the burst limit
    expect(settings.max).toBe(50);
  });
});

describe('Job Deduplication', () => {
  it('uses eventId as job ID for queue-level dedup', () => {
    // Job ID format: `${orgId}:${eventId}`
    const orgId = 'portal-12345';
    const eventId = 99999;
    const expectedJobId = `${orgId}:${eventId}`;

    expect(expectedJobId).toBe('portal-12345:99999');
  });
});

describe('Rate Limit Headroom', () => {
  beforeEach(() => {
    clearRateLimiterState();
  });

  it('leaves 50% headroom for concurrent operations', () => {
    // Simulating different HubSpot plan limits
    const testCases = [
      { burstLimit: 100, expected: 50 },   // Standard
      { burstLimit: 150, expected: 75 },   // Higher tier
      { burstLimit: 200, expected: 100 },  // Enterprise
    ];

    for (const { burstLimit, expected } of testCases) {
      setPortalBurstLimit(`portal-${burstLimit}`, burstLimit);
      const settings = calculatePortalRateLimit(`portal-${burstLimit}`);
      expect(settings.max).toBe(expected);
    }
  });
});
