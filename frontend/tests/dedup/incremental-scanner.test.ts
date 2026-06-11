/**
 * Incremental Scanner Tests
 *
 * Tests for dedup incremental scanning functionality
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock supabase with hoisted function
const mockSupabase = vi.hoisted(() => ({
  from: vi.fn(),
}));

vi.mock('@/lib/db/supabase', () => ({
  supabase: mockSupabase,
}));

import { recordScanCompletion } from '@/lib/dedup/incremental-scanner';

describe('Incremental Scanner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('recordScanCompletion', () => {
    it('1. updates by org_id only (no portal_id)', async () => {
      const mockUpdate = vi.fn().mockReturnThis();
      const mockEq = vi.fn().mockResolvedValue({ error: null });

      mockSupabase.from.mockReturnValue({
        update: mockUpdate,
      });

      mockUpdate.mockReturnValue({
        eq: mockEq,
      });

      await recordScanCompletion('org_test123', 'portal_456', 'full', 100);

      // Verify from() was called with dedup_config
      expect(mockSupabase.from).toHaveBeenCalledWith('dedup_config');

      // Verify update() was called with correct data
      expect(mockUpdate).toHaveBeenCalledWith({
        last_full_scan_at: expect.any(String),
        total_companies_last_scan: 100,
      });

      // Verify eq() was called only once with org_id (no portal_id)
      expect(mockEq).toHaveBeenCalledTimes(1);
      expect(mockEq).toHaveBeenCalledWith('org_id', 'org_test123');

      // Verify portal_id was NOT used
      expect(mockEq).not.toHaveBeenCalledWith('portal_id', expect.anything());
    });

    it('2. records incremental scan with correct fields', async () => {
      const mockUpdate = vi.fn().mockReturnThis();
      const mockEq = vi.fn().mockResolvedValue({ error: null });

      mockSupabase.from.mockReturnValue({
        update: mockUpdate,
      });

      mockUpdate.mockReturnValue({
        eq: mockEq,
      });

      await recordScanCompletion('org_test123', 'portal_456', 'incremental', 50);

      // Verify update data for incremental scan
      expect(mockUpdate).toHaveBeenCalledWith({
        last_incremental_scan_at: expect.any(String),
        incremental_companies_last_scan: 50,
      });

      // Verify only org_id filter
      expect(mockEq).toHaveBeenCalledTimes(1);
      expect(mockEq).toHaveBeenCalledWith('org_id', 'org_test123');
    });
  });
});
