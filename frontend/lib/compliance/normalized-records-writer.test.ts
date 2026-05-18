/**
 * Normalized Records Writer Tests
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

// Mock harmonies
vi.mock('../harmonies/library', () => ({
  loadLibraryHarmonies: vi.fn(),
  getHarmoniesByEntity: () => [
    {
      spec: {
        id: 'company-industry',
        version: '1.0.0',
        name: 'Industry',
        applies_to: { entity: 'company', fields: ['company.industry'] },
      },
    },
    {
      spec: {
        id: 'company-name',
        version: '1.0.0',
        name: 'Name',
        applies_to: { entity: 'company', fields: ['company.name'] },
      },
    },
  ],
  getLibraryHarmonies: () => [
    {
      spec: { id: 'company-industry', version: '1.0.0' },
    },
    {
      spec: { id: 'company-name', version: '1.0.0' },
    },
  ],
}));

// Mock normalizer
vi.mock('../harmonies/pipeline/normalizer', () => ({
  Normalizer: class {
    normalize = vi.fn().mockResolvedValue({
      success: true,
      candidate: {
        value: 'Healthcare',
        raw_value: 'HOSPITAL_HEALTH_CARE',
        source: 'hubspot',
        harmony_applied: 'company-industry@1.0.0',
      },
    });
  },
}));

import {
  normalizeFieldValue,
  writeNormalizedRecord,
  writeNormalizedRecordsBatch,
  getCurrentHarmonyVersions,
} from './normalized-records-writer';

describe('normalized-records-writer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('normalizeFieldValue()', () => {
    it('returns compliant status when harmony transforms value', async () => {
      const result = await normalizeFieldValue(
        'industry',
        'HOSPITAL_HEALTH_CARE',
        { industry: 'HOSPITAL_HEALTH_CARE' }
      );

      expect(result.field).toBe('industry');
      expect(result.rawValue).toBe('HOSPITAL_HEALTH_CARE');
      expect(result.normalizedValue).toBe('Healthcare');
      expect(result.harmonyId).toBe('company-industry');
      expect(result.harmonyVersion).toBe('1.0.0');
      expect(result.status).toBe('compliant');
    });

    it('returns unprocessed status for field without harmony', async () => {
      const result = await normalizeFieldValue(
        'unknown_field',
        'some value',
        {}
      );

      expect(result.field).toBe('unknown_field');
      expect(result.harmonyId).toBeNull();
      expect(result.status).toBe('unprocessed');
    });

    it('returns compliant status for null/empty values', async () => {
      const result = await normalizeFieldValue(
        'industry',
        null,
        {}
      );

      expect(result.rawValue).toBeNull();
      expect(result.normalizedValue).toBeNull();
      expect(result.status).toBe('compliant');
    });
  });

  describe('writeNormalizedRecord()', () => {
    it('upserts record with correct status', async () => {
      const upsertMock = vi.fn().mockResolvedValue({ error: null });

      mockSupabase.from.mockReturnValue({
        upsert: upsertMock,
      });

      await writeNormalizedRecord({
        orgId: 'org-123',
        recordId: 'hs-456',
        recordType: 'company',
        source: 'hubspot',
        field: 'industry',
        rawValue: 'HOSPITAL_HEALTH_CARE',
        normalizedValue: 'Healthcare',
        harmonyId: 'company-industry',
        harmonyVersion: '1.0.0',
      });

      expect(upsertMock).toHaveBeenCalledWith(
        expect.objectContaining({
          org_id: 'org-123',
          record_id: 'hs-456',
          record_type: 'company',
          field: 'industry',
          raw_value: 'HOSPITAL_HEALTH_CARE',
          normalized_value: 'Healthcare',
          harmony_id: 'company-industry',
          harmony_version: '1.0.0',
          status: 'compliant',
        }),
        { onConflict: 'org_id,record_id,field' }
      );
    });

    it('sets status to unprocessed when harmony_id is null', async () => {
      const upsertMock = vi.fn().mockResolvedValue({ error: null });

      mockSupabase.from.mockReturnValue({
        upsert: upsertMock,
      });

      await writeNormalizedRecord({
        orgId: 'org-123',
        recordId: 'hs-456',
        recordType: 'company',
        field: 'custom_field',
        rawValue: 'some value',
        normalizedValue: null,
        harmonyId: null,
        harmonyVersion: null,
      });

      expect(upsertMock).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'unprocessed',
          normalized_at: null,
        }),
        expect.any(Object)
      );
    });
  });

  describe('writeNormalizedRecordsBatch()', () => {
    it('batches multiple records in single upsert', async () => {
      const upsertMock = vi.fn().mockResolvedValue({ error: null });

      mockSupabase.from.mockReturnValue({
        upsert: upsertMock,
      });

      writeNormalizedRecordsBatch([
        {
          orgId: 'org-123',
          recordId: 'hs-1',
          recordType: 'company',
          field: 'industry',
          rawValue: 'tech',
          normalizedValue: 'Technology',
          harmonyId: 'company-industry',
          harmonyVersion: '1.0.0',
        },
        {
          orgId: 'org-123',
          recordId: 'hs-2',
          recordType: 'company',
          field: 'industry',
          rawValue: 'healthcare',
          normalizedValue: 'Healthcare',
          harmonyId: 'company-industry',
          harmonyVersion: '1.0.0',
        },
      ]);

      // Wait for fire-and-forget to complete
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(upsertMock).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ record_id: 'hs-1' }),
          expect.objectContaining({ record_id: 'hs-2' }),
        ]),
        { onConflict: 'org_id,record_id,field' }
      );
    });
  });

  describe('getCurrentHarmonyVersions()', () => {
    it('returns map of harmony ID to version', () => {
      const versions = getCurrentHarmonyVersions();

      expect(versions.get('company-industry')).toBe('1.0.0');
      expect(versions.get('company-name')).toBe('1.0.0');
    });
  });
});
