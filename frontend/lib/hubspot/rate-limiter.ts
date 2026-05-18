/**
 * HubSpot Rate Limiter
 *
 * Intelligent rate limiting with:
 * - Dynamic limits from response headers
 * - Separate limiter for CRM Search API (4 req/sec)
 * - Daily limit monitoring and alerts
 * - Jitter on retry delays
 */

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

/**
 * Rate limit headers from HubSpot API responses.
 */
export interface RateLimitHeaders {
  /** Burst window maximum (requests per 10 seconds) */
  max: number | null;
  /** Requests remaining in current window */
  remaining: number | null;
  /** Daily allowance (private apps only) */
  daily: number | null;
  /** Daily remaining (private apps only) */
  dailyRemaining: number | null;
}

/**
 * Rate limit status for a portal.
 */
export interface RateLimitStatus {
  portalId: string;
  burstMax: number;
  burstRemaining: number | null;
  dailyMax: number | null;
  dailyRemaining: number | null;
  dailyPercentRemaining: number | null;
  isPaused: boolean;
  pauseReason: string | null;
}

/**
 * Daily limit alert levels.
 */
export type DailyLimitAlertLevel = 'ok' | 'warning' | 'critical';

/**
 * Callback for daily limit alerts.
 */
export type DailyLimitAlertCallback = (
  portalId: string,
  level: DailyLimitAlertLevel,
  remaining: number,
  total: number
) => void;

// ─────────────────────────────────────────────────────────────
// Header Parsing
// ─────────────────────────────────────────────────────────────

/**
 * Parse rate limit headers from a HubSpot API response.
 */
export function parseRateLimitHeaders(headers: Headers): RateLimitHeaders {
  const max = headers.get('X-HubSpot-RateLimit-Max');
  const remaining = headers.get('X-HubSpot-RateLimit-Remaining');
  const daily = headers.get('X-HubSpot-RateLimit-Daily');
  const dailyRemaining = headers.get('X-HubSpot-RateLimit-Daily-Remaining');

  return {
    max: max ? parseInt(max, 10) : null,
    remaining: remaining ? parseInt(remaining, 10) : null,
    daily: daily ? parseInt(daily, 10) : null,
    dailyRemaining: dailyRemaining ? parseInt(dailyRemaining, 10) : null,
  };
}

// ─────────────────────────────────────────────────────────────
// Jitter Calculation
// ─────────────────────────────────────────────────────────────

/**
 * Calculate retry delay with exponential backoff and jitter.
 *
 * @param attempt - Retry attempt number (0-indexed)
 * @param baseDelayMs - Base delay in milliseconds
 * @returns Delay in milliseconds with jitter
 */
export function calculateRetryDelay(attempt: number, baseDelayMs: number = 1000): number {
  // Exponential backoff: baseDelay * 2^attempt
  const exponentialDelay = baseDelayMs * Math.pow(2, attempt);
  // Add random jitter: 0-1000ms
  const jitter = Math.random() * 1000;
  return exponentialDelay + jitter;
}

/**
 * Calculate delay from Retry-After header with jitter.
 *
 * @param retryAfterSeconds - Value from Retry-After header
 * @returns Delay in milliseconds with jitter
 */
export function calculateRetryAfterDelay(retryAfterSeconds: number): number {
  // Convert to ms and add small jitter (0-500ms)
  return retryAfterSeconds * 1000 + Math.random() * 500;
}

// ─────────────────────────────────────────────────────────────
// Sliding Window Rate Limiter
// ─────────────────────────────────────────────────────────────

/**
 * In-memory sliding window rate limiter.
 */
export class SlidingWindowRateLimiter {
  private timestamps: number[] = [];
  private windowMs: number;
  private maxRequests: number;

  constructor(windowMs: number, maxRequests: number) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
  }

  /**
   * Update the max requests limit dynamically.
   */
  setMaxRequests(max: number): void {
    this.maxRequests = max;
  }

  /**
   * Get current limit.
   */
  getMaxRequests(): number {
    return this.maxRequests;
  }

  /**
   * Acquire a slot in the rate limiter.
   * Waits if necessary.
   */
  async acquire(): Promise<void> {
    const now = Date.now();

    // Remove timestamps outside the window
    this.timestamps = this.timestamps.filter(t => now - t < this.windowMs);

    if (this.timestamps.length >= this.maxRequests) {
      // Wait until the oldest request falls outside the window
      const oldestInWindow = this.timestamps[0];
      const waitTime = this.windowMs - (now - oldestInWindow) + 100; // +100ms buffer
      await new Promise(resolve => setTimeout(resolve, waitTime));
      return this.acquire();
    }

    this.timestamps.push(now);
  }

  /**
   * Check if a slot is available without waiting.
   */
  canAcquire(): boolean {
    const now = Date.now();
    const activeTimestamps = this.timestamps.filter(t => now - t < this.windowMs);
    return activeTimestamps.length < this.maxRequests;
  }

  /**
   * Get current status.
   */
  getStatus(): { used: number; max: number; windowMs: number } {
    const now = Date.now();
    const used = this.timestamps.filter(t => now - t < this.windowMs).length;
    return { used, max: this.maxRequests, windowMs: this.windowMs };
  }
}

// ─────────────────────────────────────────────────────────────
// Portal Rate Limiter Manager
// ─────────────────────────────────────────────────────────────

/**
 * Default burst rate limit (safe for all plan types).
 */
export const DEFAULT_BURST_LIMIT = 100;

/**
 * CRM Search API rate limit (4 requests per second).
 */
export const SEARCH_API_LIMIT = 4;
export const SEARCH_API_WINDOW_MS = 1000; // 1 second

/**
 * Daily limit alert thresholds.
 */
export const DAILY_LIMIT_WARNING_THRESHOLD = 0.10; // 10%
export const DAILY_LIMIT_CRITICAL_THRESHOLD = 0.02; // 2%

/**
 * Per-portal rate limiter state.
 */
interface PortalLimiterState {
  /** General API rate limiter (100 req / 10 sec default) */
  generalLimiter: SlidingWindowRateLimiter;
  /** Search API rate limiter (4 req / 1 sec) */
  searchLimiter: SlidingWindowRateLimiter;
  /** Observed burst limit from headers */
  observedBurstLimit: number | null;
  /** Daily limit from headers */
  dailyLimit: number | null;
  /** Daily remaining from headers */
  dailyRemaining: number | null;
  /** Is processing paused due to daily limit */
  isPaused: boolean;
  /** Reason for pause */
  pauseReason: string | null;
  /** Last update timestamp */
  lastUpdated: number;
}

/**
 * Global store for portal rate limiters.
 */
const portalLimiters = new Map<string, PortalLimiterState>();

/**
 * Alert callback for daily limit warnings.
 */
let dailyLimitAlertCallback: DailyLimitAlertCallback | null = null;

/**
 * Set the callback for daily limit alerts.
 */
export function setDailyLimitAlertCallback(callback: DailyLimitAlertCallback | null): void {
  dailyLimitAlertCallback = callback;
}

/**
 * Get or create rate limiter state for a portal.
 */
function getPortalState(portalId: string, initialBurstLimit?: number): PortalLimiterState {
  let state = portalLimiters.get(portalId);

  if (!state) {
    const burstLimit = initialBurstLimit || DEFAULT_BURST_LIMIT;
    state = {
      generalLimiter: new SlidingWindowRateLimiter(10_000, burstLimit),
      searchLimiter: new SlidingWindowRateLimiter(SEARCH_API_WINDOW_MS, SEARCH_API_LIMIT),
      observedBurstLimit: null,
      dailyLimit: null,
      dailyRemaining: null,
      isPaused: false,
      pauseReason: null,
      lastUpdated: Date.now(),
    };
    portalLimiters.set(portalId, state);
  }

  return state;
}

/**
 * Acquire a general API rate limit slot for a portal.
 */
export async function acquireGeneralSlot(portalId: string): Promise<void> {
  const state = getPortalState(portalId);

  if (state.isPaused) {
    throw new Error(`Rate limiting paused for portal ${portalId}: ${state.pauseReason}`);
  }

  await state.generalLimiter.acquire();
}

/**
 * Acquire a search API rate limit slot for a portal.
 */
export async function acquireSearchSlot(portalId: string): Promise<void> {
  const state = getPortalState(portalId);

  if (state.isPaused) {
    throw new Error(`Rate limiting paused for portal ${portalId}: ${state.pauseReason}`);
  }

  await state.searchLimiter.acquire();
}

/**
 * Update rate limits from response headers.
 * Call this after every HubSpot API response.
 *
 * @returns The observed burst limit if this is the first observation
 */
export function updateFromHeaders(
  portalId: string,
  headers: RateLimitHeaders
): { firstObservation: boolean; burstLimit: number | null } {
  const state = getPortalState(portalId);
  let firstObservation = false;

  // Update burst limit if observed
  if (headers.max !== null && state.observedBurstLimit === null) {
    state.observedBurstLimit = headers.max;
    state.generalLimiter.setMaxRequests(headers.max);
    firstObservation = true;
    console.log(`Portal ${portalId}: observed burst limit = ${headers.max}`);
  }

  // Update daily limits
  if (headers.daily !== null) {
    state.dailyLimit = headers.daily;
  }
  if (headers.dailyRemaining !== null) {
    state.dailyRemaining = headers.dailyRemaining;

    // Check daily limit thresholds
    if (state.dailyLimit !== null) {
      const percentRemaining = headers.dailyRemaining / state.dailyLimit;

      if (percentRemaining < DAILY_LIMIT_CRITICAL_THRESHOLD) {
        // Critical: pause and alert
        state.isPaused = true;
        state.pauseReason = `Daily limit critical: ${headers.dailyRemaining}/${state.dailyLimit} (${(percentRemaining * 100).toFixed(1)}%)`;
        console.error(`[CRITICAL] Portal ${portalId}: ${state.pauseReason}`);

        if (dailyLimitAlertCallback) {
          dailyLimitAlertCallback(portalId, 'critical', headers.dailyRemaining, state.dailyLimit);
        }
      } else if (percentRemaining < DAILY_LIMIT_WARNING_THRESHOLD) {
        // Warning: log but don't pause
        console.warn(`[WARNING] Portal ${portalId}: Daily limit low: ${headers.dailyRemaining}/${state.dailyLimit} (${(percentRemaining * 100).toFixed(1)}%)`);

        if (dailyLimitAlertCallback) {
          dailyLimitAlertCallback(portalId, 'warning', headers.dailyRemaining, state.dailyLimit);
        }
      }
    }
  }

  state.lastUpdated = Date.now();

  return {
    firstObservation,
    burstLimit: state.observedBurstLimit,
  };
}

/**
 * Get rate limit status for a portal.
 */
export function getRateLimitStatus(portalId: string): RateLimitStatus {
  const state = getPortalState(portalId);
  const generalStatus = state.generalLimiter.getStatus();

  let dailyPercentRemaining: number | null = null;
  if (state.dailyLimit !== null && state.dailyRemaining !== null) {
    dailyPercentRemaining = (state.dailyRemaining / state.dailyLimit) * 100;
  }

  return {
    portalId,
    burstMax: generalStatus.max,
    burstRemaining: generalStatus.max - generalStatus.used,
    dailyMax: state.dailyLimit,
    dailyRemaining: state.dailyRemaining,
    dailyPercentRemaining,
    isPaused: state.isPaused,
    pauseReason: state.pauseReason,
  };
}

/**
 * Get the configured burst limit for a portal.
 * Returns the observed limit or default.
 */
export function getPortalBurstLimit(portalId: string): number {
  const state = portalLimiters.get(portalId);
  return state?.observedBurstLimit || DEFAULT_BURST_LIMIT;
}

/**
 * Set the burst limit for a portal (used when loading from database).
 */
export function setPortalBurstLimit(portalId: string, limit: number): void {
  const state = getPortalState(portalId, limit);
  state.observedBurstLimit = limit;
  state.generalLimiter.setMaxRequests(limit);
}

/**
 * Resume processing for a paused portal.
 */
export function resumePortal(portalId: string): void {
  const state = portalLimiters.get(portalId);
  if (state) {
    state.isPaused = false;
    state.pauseReason = null;
    console.log(`Portal ${portalId}: processing resumed`);
  }
}

/**
 * Check if a portal is paused.
 */
export function isPortalPaused(portalId: string): boolean {
  const state = portalLimiters.get(portalId);
  return state?.isPaused || false;
}

/**
 * Clear rate limiter state (for testing).
 */
export function clearRateLimiterState(): void {
  portalLimiters.clear();
  dailyLimitAlertCallback = null;
}
