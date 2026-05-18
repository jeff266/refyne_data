/**
 * Compliance Score Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ComplianceStatus } from './types';

// Create hoisted mock for supabase
const mockSupabase = vi.hoisted(() => ({
  from: vi.fn(),
}));

vi.mock('../db/supabase', () => ({
  supabase: mockSupabase,
  isSupabaseConfigured: () => true,
}));

// Mock harmonies library
vi.mock('../harmonies/library', () => ({
  getHarmonyById: (id: string) => ({
    spec: { id, name: `Harmony ${id}`, version: '1.0.0' },
  }),
  loadLibraryHarmonies: vi.fn(),
  getHarmoniesByEntity: () => [],
}));

import { getScore, getBreakdownByHarmony, getBreakdownByField, storeScoreHistory } from './compliance-score';

describe('compliance-score', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getScore()', () => {
    it('returns correct percentages from mocked table', async () => {
      // Mock normalized_records query
      const mockRecords = [
        { status: 'compliant' },
        { status: 'compliant' },
        { status: 'compliant' },
        { status: 'stale' },
        { status: 'unprocessed' },
      ];

      const selectMock = vi.fn().mockReturnThis();
      const eqMock = vi.fn().mockResolvedValue({ data: mockRecords, error: null });

      mockSupabase.from.mockReturnValueOnce({
        select: selectMock,
        eq: eqMock,
      });

      // Mock history query
      const historySelectMock = vi.fn().mockReturnThis();
      const historyEqMock = vi.fn().mockReturnThis();
      const historyOrderMock = vi.fn().mockReturnThis();
      const historyLimitMock = vi.fn().mockReturnThis();
      const historySingleMock = vi.fn().mockResolvedValue({
        data: { computed_at: '2024-01-01T00:00:00Z' },
        error: null,
      });

      mockSupabase.from.mockReturnValueOnce({
        select: historySelectMock,
        eq: historyEqMock,
        order: historyOrderMock,
        limit: historyLimitMock,
        single: historySingleMock,
      });

      const result = await getScore('org-123');

      expect(result.compliant).toBe(3);
      expect(result.stale).toBe(1);
      expect(result.unprocessed).toBe(1);
      expect(result.total).toBe(5);
      expect(result.score).toBe(60); // 3/5 = 60%
    });

    it('returns 0 score for empty results', async () => {
      const selectMock = vi.fn().mockReturnThis();
      const eqMock = vi.fn().mockResolvedValue({ data: [], error: null });

      mockSupabase.from.mockReturnValueOnce({
        select: selectMock,
        eq: eqMock,
      });

      // Mock history query
      mockSupabase.from.mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      });

      const result = await getScore('org-123');

      expect(result.score).toBe(0);
      expect(result.total).toBe(0);
    });
  });

  describe('getBreakdownByHarmony()', () => {
    it('groups correctly by harmony_id', async () => {
      const mockRecords = [
        { harmony_id: 'company-industry', status: 'compliant' },
        { harmony_id: 'company-industry', status: 'compliant' },
        { harmony_id: 'company-industry', status: 'stale' },
        { harmony_id: 'company-name', status: 'compliant' },
        { harmony_id: 'company-name', status: 'compliant' },
      ];

      const selectMock = vi.fn().mockReturnThis();
      const eqMock = vi.fn().mockResolvedValue({ data: mockRecords, error: null });

      mockSupabase.from.mockReturnValueOnce({
        select: selectMock,
        eq: eqMock,
      });

      // Mock history query for trend
      mockSupabase.from.mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: [], error: null }),
      });

      const result = await getBreakdownByHarmony('org-123');

      expect(result.length).toBe(2);

      const industryBreakdown = result.find(r => r.harmonyId === 'company-industry');
      expect(industryBreakdown).toBeDefined();
      expect(industryBreakdown!.compliant).toBe(2);
      expect(industryBreakdown!.stale).toBe(1);
      expect(industryBreakdown!.rate).toBeCloseTo(66.67, 1);

      const nameBreakdown = result.find(r => r.harmonyId === 'company-name');
      expect(nameBreakdown).toBeDefined();
      expect(nameBreakdown!.compliant).toBe(2);
      expect(nameBreakdown!.rate).toBe(100);
    });
  });

  describe('getBreakdownByField()', () => {
    it('groups correctly by field', async () => {
      const mockRecords = [
        { field: 'industry', status: 'compliant' },
        { field: 'industry', status: 'stale' },
        { field: 'name', status: 'compliant' },
        { field: 'domain', status: 'unprocessed' },
      ];

      const selectMock = vi.fn().mockReturnThis();
      const eqMock = vi.fn().mockResolvedValue({ data: mockRecords, error: null });

      mockSupabase.from.mockReturnValue({
        select: selectMock,
        eq: eqMock,
      });

      const result = await getBreakdownByField('org-123');

      expect(result.length).toBe(3);

      const industryBreakdown = result.find(r => r.field === 'industry');
      expect(industryBreakdown!.compliant).toBe(1);
      expect(industryBreakdown!.stale).toBe(1);
      expect(industryBreakdown!.rate).toBe(50);
    });
  });

  describe('storeScoreHistory()', () => {
    it('inserts score history row', async () => {
      const insertMock = vi.fn().mockResolvedValue({ error: null });

      mockSupabase.from.mockReturnValue({
        insert: insertMock,
      });

      await storeScoreHistory('org-123', {
        score: 75,
        compliant: 150,
        stale: 30,
        unprocessed: 20,
        total: 200,
        lastComputedAt: null,
      });

      expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({
        org_id: 'org-123',
        score: 75,
        compliant: 150,
        stale: 30,
        unprocessed: 20,
        total: 200,
      }));
    });
  });
});
