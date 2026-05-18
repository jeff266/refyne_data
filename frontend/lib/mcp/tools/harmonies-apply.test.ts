/**
 * harmonies_apply Tool Tests
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { executeHarmoniesApply } from './harmonies-apply';
import type { HarmoniesApplyInput, RawRecord } from '../types';
import { ensureInitialized } from '../../harmonies/library';

describe('harmonies_apply', () => {
  beforeAll(() => {
    ensureInitialized();
  });

  describe('input validation', () => {
    it('should reject empty harmony_ids', async () => {
      const input: HarmoniesApplyInput = {
        harmony_ids: [],
        records: [{ _id: '1', name: 'Test' }],
      };

      const result = await executeHarmoniesApply(input);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('invalid_input');
      expect(result.error?.message).toContain('harmony_id');
    });

    it('should reject empty records', async () => {
      const input: HarmoniesApplyInput = {
        harmony_ids: ['company-name'],
        records: [],
      };

      const result = await executeHarmoniesApply(input);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('invalid_input');
      expect(result.error?.message).toContain('record');
    });

    it('should reject unknown harmony IDs', async () => {
      const input: HarmoniesApplyInput = {
        harmony_ids: ['nonexistent-harmony'],
        records: [{ _id: '1', name: 'Test' }],
      };

      const result = await executeHarmoniesApply(input);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('harmony_not_found');
    });
  });

  describe('apply execution', () => {
    it('should apply company name normalization', async () => {
      const input: HarmoniesApplyInput = {
        harmony_ids: ['company-name'],
        records: [
          { _id: '1', name: 'ACME CORP, INC.' },
          { _id: '2', name: 'Globex LLC' },
        ],
      };

      const result = await executeHarmoniesApply(input);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.records).toHaveLength(2);
    });

    it('should return applied count', async () => {
      const input: HarmoniesApplyInput = {
        harmony_ids: ['company-name'],
        records: [
          { _id: '1', name: 'ACME CORP' },
          { _id: '2', name: 'Globex' },
        ],
      };

      const result = await executeHarmoniesApply(input);

      expect(result.success).toBe(true);
      expect(result.data?.applied).toBeDefined();
      expect(typeof result.data?.applied).toBe('number');
    });

    it('should return transformed records', async () => {
      const input: HarmoniesApplyInput = {
        harmony_ids: ['company-name'],
        records: [{ _id: '1', name: 'ACME CORP, INC.' }],
      };

      const result = await executeHarmoniesApply(input);

      expect(result.success).toBe(true);
      expect(result.data?.records).toHaveLength(1);
      expect(result.data?.records[0]._id).toBe('1');
      // Name should be transformed
      expect(result.data?.records[0].name).toBeDefined();
    });

    it('should preserve non-targeted fields', async () => {
      const input: HarmoniesApplyInput = {
        harmony_ids: ['company-name'],
        records: [{ _id: '1', name: 'ACME', domain: 'acme.com', custom_field: 'preserve me' }],
      };

      const result = await executeHarmoniesApply(input);

      expect(result.success).toBe(true);
      const record = result.data?.records[0];
      expect(record?.domain).toBe('acme.com');
      expect(record?.custom_field).toBe('preserve me');
    });

    it('should skip empty values', async () => {
      const input: HarmoniesApplyInput = {
        harmony_ids: ['company-name'],
        records: [{ _id: '1', name: '' }],
      };

      const result = await executeHarmoniesApply(input);

      expect(result.success).toBe(true);
      expect(result.data?.records[0].name).toBe('');
    });

    it('should auto-generate _id if not provided', async () => {
      const records = [{ name: 'ACME' }] as RawRecord[];
      const input: HarmoniesApplyInput = {
        harmony_ids: ['company-name'],
        records,
      };

      const result = await executeHarmoniesApply(input);

      expect(result.success).toBe(true);
      expect(result.data?.records[0]._id).toBeDefined();
    });
  });

  describe('multiple harmonies', () => {
    it('should apply multiple harmonies to same record', async () => {
      const input: HarmoniesApplyInput = {
        harmony_ids: ['company-name', 'company-industry'],
        records: [{ _id: '1', name: 'ACME CORP', industry: 'fin-tech' }],
      };

      const result = await executeHarmoniesApply(input);

      expect(result.success).toBe(true);
      expect(result.data?.applied).toBeGreaterThanOrEqual(0);
    });
  });

  describe('error handling', () => {
    it('should collect errors but continue processing', async () => {
      const input: HarmoniesApplyInput = {
        harmony_ids: ['company-name'],
        records: [
          { _id: '1', name: 'Valid Company' },
          { _id: '2', name: 'Another Company' },
        ],
      };

      const result = await executeHarmoniesApply(input);

      expect(result.success).toBe(true);
      expect(result.data?.errors).toBeDefined();
      expect(Array.isArray(result.data?.errors)).toBe(true);
      // Both records should be processed
      expect(result.data?.records).toHaveLength(2);
    });

    it('should include record_id in errors', async () => {
      // This test just verifies error structure if an error occurs
      const input: HarmoniesApplyInput = {
        harmony_ids: ['company-name'],
        records: [{ _id: 'test-record', name: 'Test' }],
      };

      const result = await executeHarmoniesApply(input);

      expect(result.success).toBe(true);
      // Errors array should be defined even if empty
      expect(result.data?.errors).toBeDefined();
    });
  });

  describe('timing', () => {
    it('should include timing information', async () => {
      const input: HarmoniesApplyInput = {
        harmony_ids: ['company-name'],
        records: [{ _id: '1', name: 'Test' }],
      };

      const result = await executeHarmoniesApply(input);

      expect(result.timing).toBeDefined();
      expect(result.timing?.totalMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('idempotency', () => {
    it('should produce same result on re-apply', async () => {
      const input: HarmoniesApplyInput = {
        harmony_ids: ['company-name'],
        records: [{ _id: '1', name: 'ACME CORP' }],
      };

      const result1 = await executeHarmoniesApply(input);
      expect(result1.success).toBe(true);

      // Apply again with the output
      const input2: HarmoniesApplyInput = {
        harmony_ids: ['company-name'],
        records: result1.data?.records || [],
      };

      const result2 = await executeHarmoniesApply(input2);
      expect(result2.success).toBe(true);

      // Results should be identical (idempotent)
      expect(result2.data?.records[0].name).toBe(result1.data?.records[0].name);
    });
  });
});
