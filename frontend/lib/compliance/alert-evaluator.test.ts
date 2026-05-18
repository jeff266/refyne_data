/**
 * Alert Evaluator Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Create hoisted mock for supabase
const mockSupabase = vi.hoisted(() => ({
  from: vi.fn(),
}));

vi.mock('../db/supabase', () => ({
  supabase: mockSupabase,
  isSupabaseConfigured: () => true,
}));

// Mock compliance-score
const mockGetScore = vi.fn();
const mockGetBreakdownByHarmony = vi.fn();
const mockGetPreviousScore = vi.fn();

vi.mock('./compliance-score', () => ({
  getScore: () => mockGetScore(),
  getBreakdownByHarmony: () => mockGetBreakdownByHarmony(),
  getPreviousScore: () => mockGetPreviousScore(),
}));

import {
  evaluateAlerts,
  getAlertConfig,
  saveAlertConfig,
  registerAlertCallback,
  clearAlertCallbacks,
} from './alert-evaluator';

describe('alert-evaluator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearAlertCallbacks();
  });

  afterEach(() => {
    clearAlertCallbacks();
  });

  describe('evaluateAlerts()', () => {
    it('fires alert when score < threshold', async () => {
      // Mock alert config
      mockSupabase.from.mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            score_threshold: 80,
            harmony_threshold: null,
            unprocessed_threshold: null,
            notify_email: true,
            notify_slack_webhook: null,
          },
          error: null,
        }),
      });

      // Mock score (below threshold)
      mockGetScore.mockResolvedValue({
        score: 70,
        compliant: 70,
        stale: 20,
        unprocessed: 10,
        total: 100,
        lastComputedAt: '2024-01-01T00:00:00Z',
      });

      mockGetPreviousScore.mockResolvedValue(75);
      mockGetBreakdownByHarmony.mockResolvedValue([]);

      const result = await evaluateAlerts('org-123');

      expect(result.triggered).toBe(true);
      expect(result.reasons.length).toBe(1);
      expect(result.reasons[0].type).toBe('score_below');
      expect(result.reasons[0].threshold).toBe(80);
      expect(result.reasons[0].actual).toBe(70);
    });

    it('fires alert when any Harmony < harmony_threshold', async () => {
      // Mock alert config
      mockSupabase.from.mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            score_threshold: null,
            harmony_threshold: 70,
            unprocessed_threshold: null,
            notify_email: false,
            notify_slack_webhook: null,
          },
          error: null,
        }),
      });

      mockGetScore.mockResolvedValue({
        score: 85,
        compliant: 85,
        stale: 10,
        unprocessed: 5,
        total: 100,
        lastComputedAt: null,
      });

      mockGetPreviousScore.mockResolvedValue(null);

      // One harmony below threshold
      mockGetBreakdownByHarmony.mockResolvedValue([
        { harmonyId: 'company-industry', rate: 60 },
        { harmonyId: 'company-name', rate: 90 },
      ]);

      const result = await evaluateAlerts('org-123');

      expect(result.triggered).toBe(true);
      expect(result.reasons.length).toBe(1);
      expect(result.reasons[0].type).toBe('harmony_below');
      expect(result.reasons[0].harmonyId).toBe('company-industry');
      expect(result.reasons[0].actual).toBe(60);
    });

    it('fires alert when unprocessed exceeds threshold', async () => {
      // Mock alert config
      mockSupabase.from.mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            score_threshold: null,
            harmony_threshold: null,
            unprocessed_threshold: 50,
            notify_email: false,
            notify_slack_webhook: null,
          },
          error: null,
        }),
      });

      mockGetScore.mockResolvedValue({
        score: 80,
        compliant: 80,
        stale: 10,
        unprocessed: 100, // Exceeds threshold of 50
        total: 190,
        lastComputedAt: null,
      });

      mockGetPreviousScore.mockResolvedValue(null);
      mockGetBreakdownByHarmony.mockResolvedValue([]);

      const result = await evaluateAlerts('org-123');

      expect(result.triggered).toBe(true);
      expect(result.reasons.length).toBe(1);
      expect(result.reasons[0].type).toBe('unprocessed_exceeded');
      expect(result.reasons[0].actual).toBe(100);
    });

    it('does not fire alert when all thresholds pass', async () => {
      // Mock alert config with thresholds
      mockSupabase.from.mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            score_threshold: 70,
            harmony_threshold: 60,
            unprocessed_threshold: 100,
            notify_email: true,
            notify_slack_webhook: null,
          },
          error: null,
        }),
      });

      // Score above threshold
      mockGetScore.mockResolvedValue({
        score: 85,
        compliant: 85,
        stale: 10,
        unprocessed: 5,
        total: 100,
        lastComputedAt: null,
      });

      mockGetPreviousScore.mockResolvedValue(80);

      // All harmonies above threshold
      mockGetBreakdownByHarmony.mockResolvedValue([
        { harmonyId: 'company-industry', rate: 80 },
        { harmonyId: 'company-name', rate: 90 },
      ]);

      const result = await evaluateAlerts('org-123');

      expect(result.triggered).toBe(false);
      expect(result.reasons.length).toBe(0);
    });

    it('does not fire when no alert config exists', async () => {
      // Mock no alert config
      mockSupabase.from.mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { code: 'PGRST116' },
        }),
      });

      const result = await evaluateAlerts('org-123');

      expect(result.triggered).toBe(false);
      expect(result.reasons.length).toBe(0);
    });

    it('calls registered callbacks when alert fires', async () => {
      const callback = vi.fn();
      registerAlertCallback(callback);

      // Mock alert config
      mockSupabase.from.mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            score_threshold: 90,
            harmony_threshold: null,
            unprocessed_threshold: null,
            notify_email: false,
            notify_slack_webhook: null,
          },
          error: null,
        }),
      });

      mockGetScore.mockResolvedValue({
        score: 70,
        compliant: 70,
        stale: 20,
        unprocessed: 10,
        total: 100,
        lastComputedAt: null,
      });

      mockGetPreviousScore.mockResolvedValue(null);
      mockGetBreakdownByHarmony.mockResolvedValue([]);

      await evaluateAlerts('org-123');

      expect(callback).toHaveBeenCalledWith(
        'org-123',
        expect.objectContaining({ score: 70 }),
        expect.arrayContaining([expect.objectContaining({ type: 'score_below' })]),
        null
      );
    });
  });

  describe('saveAlertConfig()', () => {
    it('upserts alert configuration', async () => {
      const upsertMock = vi.fn().mockResolvedValue({ error: null });

      mockSupabase.from.mockReturnValue({
        upsert: upsertMock,
      });

      await saveAlertConfig('org-123', {
        scoreThreshold: 80,
        harmonyThreshold: 70,
        unprocessedThreshold: 100,
        notifyEmail: true,
        notifySlackWebhook: 'https://hooks.slack.com/xxx',
      });

      expect(upsertMock).toHaveBeenCalledWith(
        expect.objectContaining({
          org_id: 'org-123',
          score_threshold: 80,
          harmony_threshold: 70,
          unprocessed_threshold: 100,
          notify_email: true,
          notify_slack_webhook: 'https://hooks.slack.com/xxx',
        }),
        { onConflict: 'org_id' }
      );
    });
  });
});
