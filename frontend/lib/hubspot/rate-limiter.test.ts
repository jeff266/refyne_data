/**
 * Rate Limiter Tests
 *
 * Tests for HubSpot rate limiting functionality:
 * - 429 with Retry-After header handling
 * - Exponential backoff with jitter
 * - Daily limit warnings
 * - Search API separate rate limiter
 * - Portal burst limit configuration
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  parseRateLimitHeaders,
  calculateRetryDelay,
  calculateRetryAfterDelay,
  SlidingWindowRateLimiter,
  updateFromHeaders,
  getPortalBurstLimit,
  setPortalBurstLimit,
  getRateLimitStatus,
  setDailyLimitAlertCallback,
  clearRateLimiterState,
  acquireGeneralSlot,
  acquireSearchSlot,
  isPortalPaused,
  resumePortal,
  DEFAULT_BURST_LIMIT,
  SEARCH_API_LIMIT,
  DAILY_LIMIT_WARNING_THRESHOLD,
  DAILY_LIMIT_CRITICAL_THRESHOLD,
} from './rate-limiter';

describe('parseRateLimitHeaders', () => {
  it('parses all rate limit headers', () => {
    const headers = new Headers({
      'X-HubSpot-RateLimit-Max': '100',
      'X-HubSpot-RateLimit-Remaining': '95',
      'X-HubSpot-RateLimit-Daily': '500000',
      'X-HubSpot-RateLimit-Daily-Remaining': '450000',
    });

    const result = parseRateLimitHeaders(headers);

    expect(result.max).toBe(100);
    expect(result.remaining).toBe(95);
    expect(result.daily).toBe(500000);
    expect(result.dailyRemaining).toBe(450000);
  });

  it('returns null for missing headers', () => {
    const headers = new Headers({
      'X-HubSpot-RateLimit-Max': '100',
    });

    const result = parseRateLimitHeaders(headers);

    expect(result.max).toBe(100);
    expect(result.remaining).toBeNull();
    expect(result.daily).toBeNull();
    expect(result.dailyRemaining).toBeNull();
  });

  it('handles empty headers', () => {
    const headers = new Headers();

    const result = parseRateLimitHeaders(headers);

    expect(result.max).toBeNull();
    expect(result.remaining).toBeNull();
    expect(result.daily).toBeNull();
    expect(result.dailyRemaining).toBeNull();
  });
});

describe('calculateRetryDelay', () => {
  it('calculates exponential backoff', () => {
    // Mock Math.random to return 0 for predictable testing
    const mockRandom = vi.spyOn(Math, 'random').mockReturnValue(0);

    expect(calculateRetryDelay(0, 1000)).toBe(1000); // 1s
    expect(calculateRetryDelay(1, 1000)).toBe(2000); // 2s
    expect(calculateRetryDelay(2, 1000)).toBe(4000); // 4s
    expect(calculateRetryDelay(3, 1000)).toBe(8000); // 8s

    mockRandom.mockRestore();
  });

  it('adds jitter (0-1000ms)', () => {
    const mockRandom = vi.spyOn(Math, 'random').mockReturnValue(0.5);

    const delay = calculateRetryDelay(0, 1000);

    // 1000 + (0.5 * 1000) = 1500
    expect(delay).toBe(1500);

    mockRandom.mockRestore();
  });

  it('jitter varies with random values', () => {
    // With random = 1.0, jitter = 1000ms
    const mockRandom = vi.spyOn(Math, 'random').mockReturnValue(1.0);

    const delay = calculateRetryDelay(0, 1000);
    expect(delay).toBe(2000); // 1000 + 1000

    mockRandom.mockRestore();
  });
});

describe('calculateRetryAfterDelay', () => {
  it('converts seconds to milliseconds with jitter', () => {
    const mockRandom = vi.spyOn(Math, 'random').mockReturnValue(0);

    const delay = calculateRetryAfterDelay(5);
    expect(delay).toBe(5000); // 5 seconds

    mockRandom.mockRestore();
  });

  it('adds small jitter (0-500ms)', () => {
    const mockRandom = vi.spyOn(Math, 'random').mockReturnValue(0.5);

    const delay = calculateRetryAfterDelay(5);
    expect(delay).toBe(5250); // 5000 + (0.5 * 500)

    mockRandom.mockRestore();
  });
});

describe('SlidingWindowRateLimiter', () => {
  it('allows requests within limit', async () => {
    const limiter = new SlidingWindowRateLimiter(1000, 5);

    // Should allow 5 requests
    for (let i = 0; i < 5; i++) {
      expect(limiter.canAcquire()).toBe(true);
      await limiter.acquire();
    }

    // 6th should be blocked
    expect(limiter.canAcquire()).toBe(false);
  });

  it('allows dynamic limit updates', () => {
    const limiter = new SlidingWindowRateLimiter(1000, 5);

    expect(limiter.getMaxRequests()).toBe(5);

    limiter.setMaxRequests(10);

    expect(limiter.getMaxRequests()).toBe(10);
  });

  it('reports status correctly', async () => {
    const limiter = new SlidingWindowRateLimiter(1000, 10);

    await limiter.acquire();
    await limiter.acquire();
    await limiter.acquire();

    const status = limiter.getStatus();

    expect(status.max).toBe(10);
    expect(status.used).toBe(3);
    expect(status.windowMs).toBe(1000);
  });
});

describe('Portal Rate Limiter', () => {
  beforeEach(() => {
    clearRateLimiterState();
  });

  describe('updateFromHeaders', () => {
    it('stores first observed burst limit', () => {
      const headers = {
        max: 150,
        remaining: 140,
        daily: null,
        dailyRemaining: null,
      };

      const result = updateFromHeaders('portal-1', headers);

      expect(result.firstObservation).toBe(true);
      expect(result.burstLimit).toBe(150);
      expect(getPortalBurstLimit('portal-1')).toBe(150);
    });

    it('does not overwrite existing burst limit', () => {
      // First observation
      updateFromHeaders('portal-1', { max: 150, remaining: 140, daily: null, dailyRemaining: null });

      // Second observation with different value
      const result = updateFromHeaders('portal-1', { max: 200, remaining: 190, daily: null, dailyRemaining: null });

      expect(result.firstObservation).toBe(false);
      expect(result.burstLimit).toBe(150); // Still the original
      expect(getPortalBurstLimit('portal-1')).toBe(150);
    });
  });

  describe('setPortalBurstLimit', () => {
    it('sets burst limit from stored value', () => {
      setPortalBurstLimit('portal-2', 120);

      expect(getPortalBurstLimit('portal-2')).toBe(120);
    });
  });

  describe('getRateLimitStatus', () => {
    it('returns complete status', () => {
      setPortalBurstLimit('portal-3', 100);
      updateFromHeaders('portal-3', {
        max: 100,
        remaining: 80,
        daily: 500000,
        dailyRemaining: 450000,
      });

      const status = getRateLimitStatus('portal-3');

      expect(status.portalId).toBe('portal-3');
      expect(status.burstMax).toBe(100);
      expect(status.dailyMax).toBe(500000);
      expect(status.dailyRemaining).toBe(450000);
      expect(status.dailyPercentRemaining).toBe(90);
      expect(status.isPaused).toBe(false);
    });
  });

  describe('Daily limit warnings', () => {
    it('fires warning callback at <10% daily remaining', () => {
      const alertCallback = vi.fn();
      setDailyLimitAlertCallback(alertCallback);

      // 8% remaining (below 10% warning threshold)
      updateFromHeaders('portal-4', {
        max: 100,
        remaining: 90,
        daily: 500000,
        dailyRemaining: 40000, // 8%
      });

      expect(alertCallback).toHaveBeenCalledWith(
        'portal-4',
        'warning',
        40000,
        500000
      );

      setDailyLimitAlertCallback(null);
    });

    it('fires critical callback and pauses at <2% daily remaining', () => {
      const alertCallback = vi.fn();
      setDailyLimitAlertCallback(alertCallback);

      // 1% remaining (below 2% critical threshold)
      updateFromHeaders('portal-5', {
        max: 100,
        remaining: 90,
        daily: 500000,
        dailyRemaining: 5000, // 1%
      });

      expect(alertCallback).toHaveBeenCalledWith(
        'portal-5',
        'critical',
        5000,
        500000
      );
      expect(isPortalPaused('portal-5')).toBe(true);

      setDailyLimitAlertCallback(null);
    });

    it('does not fire for >10% daily remaining', () => {
      const alertCallback = vi.fn();
      setDailyLimitAlertCallback(alertCallback);

      // 50% remaining
      updateFromHeaders('portal-6', {
        max: 100,
        remaining: 90,
        daily: 500000,
        dailyRemaining: 250000, // 50%
      });

      expect(alertCallback).not.toHaveBeenCalled();

      setDailyLimitAlertCallback(null);
    });
  });

  describe('Portal pause/resume', () => {
    it('pauses portal on critical daily limit', () => {
      updateFromHeaders('portal-7', {
        max: 100,
        remaining: 90,
        daily: 500000,
        dailyRemaining: 1000, // 0.2% - below critical
      });

      expect(isPortalPaused('portal-7')).toBe(true);
    });

    it('resumes paused portal', () => {
      updateFromHeaders('portal-8', {
        max: 100,
        remaining: 90,
        daily: 500000,
        dailyRemaining: 1000, // Triggers pause
      });

      expect(isPortalPaused('portal-8')).toBe(true);

      resumePortal('portal-8');

      expect(isPortalPaused('portal-8')).toBe(false);
    });
  });

  describe('Default burst limit', () => {
    it('returns default for unknown portal', () => {
      expect(getPortalBurstLimit('unknown-portal')).toBe(DEFAULT_BURST_LIMIT);
    });
  });
});

describe('Search API Rate Limiter', () => {
  beforeEach(() => {
    clearRateLimiterState();
  });

  it('has separate 4 req/sec limit', () => {
    // The SEARCH_API_LIMIT constant should be 4
    expect(SEARCH_API_LIMIT).toBe(4);
  });

  it('allows acquiring search slots', async () => {
    // Should not throw
    await expect(acquireSearchSlot('portal-search')).resolves.toBeUndefined();
  });

  it('allows acquiring general slots', async () => {
    // Should not throw
    await expect(acquireGeneralSlot('portal-general')).resolves.toBeUndefined();
  });

  it('throws when portal is paused', async () => {
    // Pause the portal by triggering critical daily limit
    updateFromHeaders('portal-paused', {
      max: 100,
      remaining: 90,
      daily: 500000,
      dailyRemaining: 100, // Very low - triggers pause
    });

    await expect(acquireSearchSlot('portal-paused')).rejects.toThrow(/paused/);
    await expect(acquireGeneralSlot('portal-paused')).rejects.toThrow(/paused/);
  });
});

describe('Threshold constants', () => {
  it('warning threshold is 10%', () => {
    expect(DAILY_LIMIT_WARNING_THRESHOLD).toBe(0.10);
  });

  it('critical threshold is 2%', () => {
    expect(DAILY_LIMIT_CRITICAL_THRESHOLD).toBe(0.02);
  });

  it('default burst limit is 100', () => {
    expect(DEFAULT_BURST_LIMIT).toBe(100);
  });

  it('search API limit is 4 req/sec', () => {
    expect(SEARCH_API_LIMIT).toBe(4);
  });
});
