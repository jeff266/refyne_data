/**
 * harmonies_preview Tool Tests
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { executeHarmoniesPreview } from './harmonies-preview';
import type { HarmoniesPreviewInput, RawRecord } from '../types';
import { ensureInitialized } from '../../harmonies/library';

describe('harmonies_preview', () => {
  beforeAll(() => {
    ensureInitialized();
  });

  describe('input validation', () => {
    it('should reject empty harmony_ids', async () => {
      const input: HarmoniesPreviewInput = {
        harmony_ids: [],
        records: [{ _id: '1', name: 'Test' }],
      };

      const result = await executeHarmoniesPreview(input);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('invalid_input');
      expect(result.error?.message).toContain('harmony_id');
    });

    it('should reject empty records', async () => {
      const input: HarmoniesPreviewInput = {
        harmony_ids: ['company-name'],
        records: [],
      };

      const result = await executeHarmoniesPreview(input);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('invalid_input');
      expect(result.error?.message).toContain('record');
    });

    it('should reject unknown harmony IDs', async () => {
      const input: HarmoniesPreviewInput = {
        harmony_ids: ['nonexistent-harmony'],
        records: [{ _id: '1', name: 'Test' }],
      };

      const result = await executeHarmoniesPreview(input);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('harmony_not_found');
    });
  });

  describe('preview execution', () => {
    it('should preview company name normalization', async () => {
      const input: HarmoniesPreviewInput = {
        harmony_ids: ['company-name'],
        records: [
          { _id: '1', name: 'ACME CORP, INC.' },
          { _id: '2', name: 'Globex LLC' },
        ],
      };

      const result = await executeHarmoniesPreview(input);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.results).toHaveLength(2);
      expect(result.data?.summary.total).toBe(2);
    });

    it('should return summary with changed/unchanged/errors counts', async () => {
      const input: HarmoniesPreviewInput = {
        harmony_ids: ['company-name'],
        records: [
          { _id: '1', name: 'ACME CORP, INC.' },
          { _id: '2', name: '' }, // Empty - unchanged
        ],
      };

      const result = await executeHarmoniesPreview(input);

      expect(result.success).toBe(true);
      expect(result.data?.summary).toHaveProperty('changed');
      expect(result.data?.summary).toHaveProperty('unchanged');
      expect(result.data?.summary).toHaveProperty('errors');
      expect(result.data?.summary).toHaveProperty('total');
    });

    it('should return field-level diff for each record', async () => {
      const input: HarmoniesPreviewInput = {
        harmony_ids: ['company-name'],
        records: [{ _id: '1', name: 'ACME CORP, INC.' }],
      };

      const result = await executeHarmoniesPreview(input);

      expect(result.success).toBe(true);
      const record = result.data?.results[0];
      expect(record?.fields).toBeDefined();
      expect(record?.fields.length).toBeGreaterThan(0);

      const nameField = record?.fields.find(f => f.field.includes('name'));
      expect(nameField).toBeDefined();
      expect(nameField?.current).toBe('ACME CORP, INC.');
      expect(nameField?.projected).toBeDefined();
      expect(nameField?.status).toMatch(/changed|unchanged|error/);
    });

    it('should use record _label for display', async () => {
      const input: HarmoniesPreviewInput = {
        harmony_ids: ['company-name'],
        records: [{ _id: '1', _label: 'My Company', name: 'ACME' }],
      };

      const result = await executeHarmoniesPreview(input);

      expect(result.success).toBe(true);
      expect(result.data?.results[0].record_label).toBe('My Company');
    });

    it('should fallback to name field for label', async () => {
      const input: HarmoniesPreviewInput = {
        harmony_ids: ['company-name'],
        records: [{ _id: '1', name: 'ACME Corp' }],
      };

      const result = await executeHarmoniesPreview(input);

      expect(result.success).toBe(true);
      expect(result.data?.results[0].record_label).toBe('ACME Corp');
    });

    it('should auto-generate _id if not provided', async () => {
      const records = [{ name: 'ACME' }] as RawRecord[];
      const input: HarmoniesPreviewInput = {
        harmony_ids: ['company-name'],
        records,
      };

      const result = await executeHarmoniesPreview(input);

      expect(result.success).toBe(true);
      expect(result.data?.results[0].record_id).toBeDefined();
    });
  });

  describe('multiple harmonies', () => {
    it('should apply multiple harmonies to same record', async () => {
      const input: HarmoniesPreviewInput = {
        harmony_ids: ['company-name', 'company-industry'],
        records: [{ _id: '1', name: 'ACME CORP', industry: 'fin-tech' }],
      };

      const result = await executeHarmoniesPreview(input);

      expect(result.success).toBe(true);
      // Should have fields from both harmonies
      const record = result.data?.results[0];
      expect(record?.fields.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('error handling', () => {
    it('should mark individual fields as error without failing entire preview', async () => {
      const input: HarmoniesPreviewInput = {
        harmony_ids: ['company-name'],
        records: [
          { _id: '1', name: 'Valid Company' },
          { _id: '2', name: 'Another Company' },
        ],
      };

      const result = await executeHarmoniesPreview(input);

      expect(result.success).toBe(true);
      // Even if one field errors, the preview should complete
      expect(result.data?.results).toHaveLength(2);
    });
  });

  describe('timing', () => {
    it('should include timing information', async () => {
      const input: HarmoniesPreviewInput = {
        harmony_ids: ['company-name'],
        records: [{ _id: '1', name: 'Test' }],
      };

      const result = await executeHarmoniesPreview(input);

      expect(result.timing).toBeDefined();
      expect(result.timing?.totalMs).toBeGreaterThanOrEqual(0);
    });
  });
});
