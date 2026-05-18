/**
 * Insight Generator Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Create hoisted mock for supabase
const mockSupabase = vi.hoisted(() => ({
  from: vi.fn(),
}));

vi.mock('../db/supabase', () => ({
  supabase: mockSupabase,
  isSupabaseConfigured: () => true,
}));

import { generateInsights, getActiveInsights } from './insight-generator';

describe('insight-generator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateInsights()', () => {
    it('generates pattern gap insight when raw_value appears > 5 times', async () => {
      // Mock records query - same raw_value appears 10 times
      const mockRecords = Array(10).fill(null).map(() => ({
        harmony_id: 'company-industry',
        field: 'industry',
        raw_value: 'HOSPITAL_HEALTH_CARE',
      }));

      const selectMock = vi.fn().mockReturnThis();
      const eqMock = vi.fn().mockReturnThis();
      const inMock = vi.fn().mockReturnThis();
      const notMock = vi.fn().mockResolvedValue({ data: mockRecords, error: null });

      mockSupabase.from.mockReturnValueOnce({
        select: selectMock,
        eq: eqMock,
        in: inMock,
        not: notMock,
      });

      // Mock check for existing insight (return empty)
      const existsSelectMock = vi.fn().mockReturnThis();
      const existsEqMock = vi.fn().mockReturnThis();
      const existsIsMock = vi.fn().mockReturnThis();
      const existsContainsMock = vi.fn().mockReturnThis();
      const existsLimitMock = vi.fn().mockResolvedValue({ data: [], error: null });

      mockSupabase.from.mockReturnValueOnce({
        select: existsSelectMock,
        eq: existsEqMock,
        is: existsIsMock,
        contains: existsContainsMock,
        limit: existsLimitMock,
      });

      // Mock insert for new insight
      const insertMock = vi.fn().mockResolvedValue({ error: null });
      mockSupabase.from.mockReturnValueOnce({
        insert: insertMock,
      });

      // Mock source query (return empty for this test)
      mockSupabase.from.mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        not: vi.fn().mockResolvedValue({ data: [], error: null }),
      });

      const count = await generateInsights('org-123');

      expect(count).toBe(1);
      expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({
        org_id: 'org-123',
        harmony_id: 'company-industry',
        field: 'industry',
        insight_type: 'pattern_gap',
        record_count: 10,
      }));
    });

    it('generates new source insight when provider has 0% match rate', async () => {
      // Mock pattern gap query (return empty)
      mockSupabase.from.mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        not: vi.fn().mockResolvedValue({ data: [], error: null }),
      });

      // Mock source records - all unprocessed from same source
      const mockRecords = Array(10).fill(null).map(() => ({
        source: 'new-provider',
        field: 'industry',
        status: 'unprocessed',
      }));

      mockSupabase.from.mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        not: vi.fn().mockResolvedValue({ data: mockRecords, error: null }),
      });

      // Mock check for existing insight
      mockSupabase.from.mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        contains: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: [], error: null }),
      });

      // Mock insert
      const insertMock = vi.fn().mockResolvedValue({ error: null });
      mockSupabase.from.mockReturnValueOnce({
        insert: insertMock,
      });

      const count = await generateInsights('org-123');

      expect(count).toBe(1);
      expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({
        org_id: 'org-123',
        insight_type: 'new_source',
        field: 'industry',
      }));
    });
  });

  describe('getActiveInsights()', () => {
    it('returns non-dismissed insights', async () => {
      const mockInsights = [
        {
          id: 'insight-1',
          org_id: 'org-123',
          harmony_id: 'company-industry',
          field: 'industry',
          insight_type: 'pattern_gap',
          message: 'Test insight',
          record_count: 10,
          sample_values: ['value1'],
          created_at: '2024-01-01T00:00:00Z',
          dismissed_at: null,
        },
      ];

      const selectMock = vi.fn().mockReturnThis();
      const eqMock = vi.fn().mockReturnThis();
      const isMock = vi.fn().mockReturnThis();
      const orderMock = vi.fn().mockReturnThis();
      const limitMock = vi.fn().mockResolvedValue({ data: mockInsights, error: null });

      mockSupabase.from.mockReturnValue({
        select: selectMock,
        eq: eqMock,
        is: isMock,
        order: orderMock,
        limit: limitMock,
      });

      const insights = await getActiveInsights('org-123');

      expect(insights.length).toBe(1);
      expect(insights[0].type).toBe('pattern_gap');
      expect(insights[0].recordCount).toBe(10);
    });
  });
});
