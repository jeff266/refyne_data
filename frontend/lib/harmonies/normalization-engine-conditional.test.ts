/**
 * Integration Tests for Conditional Harmonies
 *
 * Tests that the normalization engine correctly:
 * - Filters records by conditions before processing
 * - Maintains backward compatibility (NULL conditionGroups = all records)
 * - Collects required properties (write targets + condition fields)
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import {
  applyLookupHarmony,
  applyFormatHarmony,
  getRequiredProperties,
  type Harmony,
  type HubSpotRecord,
} from './normalization-engine';
import type { ConditionGroups } from './condition-evaluator';

// Mock Supabase
vi.mock('@/lib/db/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve({ data: null, error: null })),
          single: vi.fn(() => Promise.resolve({ data: null, error: null })),
        })),
      })),
    })),
    rpc: vi.fn(() => Promise.resolve({ data: [], error: null })),
  },
}));

// Mock field assignments
vi.mock('./field-assignments', () => ({
  getFieldAssignments: vi.fn(() => Promise.resolve([])),
}));

describe('getRequiredProperties', () => {
  test('collects write target fields', () => {
    const harmonies: Harmony[] = [
      {
        id: 'h1',
        name: 'Country Normalizer',
        field: 'canonical.country',
        objectType: 'company',
        transformType: 'lookup',
        referenceTable: 'country_ref',
        isActive: true,
        conditionGroups: null,
      },
      {
        id: 'h2',
        name: 'Industry Normalizer',
        field: 'canonical.industry',
        objectType: 'company',
        transformType: 'lookup',
        referenceTable: 'industry_ref',
        isActive: true,
        conditionGroups: null,
      },
    ];

    const properties = getRequiredProperties(harmonies);
    expect(properties.has('country')).toBe(true);
    expect(properties.has('industry')).toBe(true);
    expect(properties.size).toBe(2);
  });

  test('collects condition source fields', () => {
    const harmonies: Harmony[] = [
      {
        id: 'h1',
        name: 'Country Normalizer',
        field: 'canonical.country',
        objectType: 'company',
        transformType: 'lookup',
        referenceTable: 'country_ref',
        isActive: true,
        conditionGroups: {
          match: 'all',
          groups: [
            {
              match: 'all',
              conditions: [
                {
                  field: 'lifecyclestage',
                  fieldLabel: 'Lifecycle Stage',
                  fieldType: 'enumeration',
                  operator: 'equals',
                  value: 'customer',
                },
                {
                  field: 'hs_lead_status',
                  fieldLabel: 'Lead Status',
                  fieldType: 'string',
                  operator: 'is_not_empty',
                  value: null,
                },
              ],
            },
          ],
        },
      },
    ];

    const properties = getRequiredProperties(harmonies);
    expect(properties.has('country')).toBe(true); // Write target
    expect(properties.has('lifecyclestage')).toBe(true); // Condition field
    expect(properties.has('hs_lead_status')).toBe(true); // Condition field
    expect(properties.size).toBe(3);
  });

  test('handles multiple harmonies with overlapping condition fields', () => {
    const harmonies: Harmony[] = [
      {
        id: 'h1',
        name: 'Harmony 1',
        field: 'canonical.field1',
        objectType: 'company',
        transformType: 'lookup',
        referenceTable: 'ref1',
        isActive: true,
        conditionGroups: {
          match: 'all',
          groups: [
            {
              match: 'all',
              conditions: [
                {
                  field: 'country',
                  fieldLabel: 'Country',
                  fieldType: 'string',
                  operator: 'equals',
                  value: 'US',
                },
              ],
            },
          ],
        },
      },
      {
        id: 'h2',
        name: 'Harmony 2',
        field: 'canonical.field2',
        objectType: 'company',
        transformType: 'lookup',
        referenceTable: 'ref2',
        isActive: true,
        conditionGroups: {
          match: 'all',
          groups: [
            {
              match: 'all',
              conditions: [
                {
                  field: 'country',
                  fieldLabel: 'Country',
                  fieldType: 'string',
                  operator: 'equals',
                  value: 'UK',
                },
              ],
            },
          ],
        },
      },
    ];

    const properties = getRequiredProperties(harmonies);
    expect(properties.has('field1')).toBe(true);
    expect(properties.has('field2')).toBe(true);
    expect(properties.has('country')).toBe(true); // Deduped
    expect(properties.size).toBe(3); // Not 4
  });
});

describe('Conditional Harmonies - Backward Compatibility', () => {
  test('NULL conditionGroups processes all records (lookup)', async () => {
    const harmony: Harmony = {
      id: 'test-harmony-lookup',
      name: 'Test Lookup Harmony',
      field: 'canonical.industry',
      objectType: 'company',
      transformType: 'lookup',
      referenceTable: 'industry_ref',
      isActive: true,
      conditionGroups: null, // NULL = run on all records
    };

    const records: HubSpotRecord[] = [
      { id: '1', industry: 'Tech' },
      { id: '2', industry: 'Finance' },
      { id: '3', industry: 'Healthcare' },
    ];

    // Mock Supabase RPC to return empty results (no changes)
    const supabase = (await import('@/lib/db/supabase')).supabase;
    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      data: [],
      error: null,
    } as any);

    const results = await applyLookupHarmony(records, harmony, 'org-123');

    // Should process all records (even though no changes were made in this mock)
    // Verify by checking that RPC was called with all 3 unique values
    expect(supabase.rpc).toHaveBeenCalledWith('batch_lookup_harmony', {
      p_table_name: 'industry_ref',
      p_input_values: ['Tech', 'Finance', 'Healthcare'],
      p_org_id: 'org-123',
      p_fuzzy_threshold: 0.8,
      p_phonetic_enabled: false,
    });
  });

  test('NULL conditionGroups processes all records (format)', async () => {
    const harmony: Harmony = {
      id: 'test-harmony-format',
      name: 'Test Format Harmony',
      field: 'person.phone',
      objectType: 'contact',
      transformType: 'format',
      transformFunction: 'e164_phone', // Use correct function key
      isActive: true,
      conditionGroups: null, // NULL = run on all records
    };

    const records: HubSpotRecord[] = [
      { id: '1', phone: '555-867-5309' },
      { id: '2', phone: '555-123-4567' },
      { id: '3', phone: null },
    ];

    const results = await applyFormatHarmony(records, harmony, 'org-123');

    // Should process records 1 and 2 (record 3 has no phone)
    // Record 3 skipped because phone is null (write policy: fill_empty)
    expect(results).toHaveLength(2);
    expect(results[0].hubspotRecordId).toBe('1');
    expect(results[1].hubspotRecordId).toBe('2');
  });
});

describe('Conditional Harmonies - Filtering', () => {
  test('only processes records matching conditions (lookup)', async () => {
    const harmony: Harmony = {
      id: 'test-harmony-conditional',
      name: 'US Industry Normalizer',
      field: 'canonical.industry',
      objectType: 'company',
      transformType: 'lookup',
      referenceTable: 'industry_ref',
      isActive: true,
      conditionGroups: {
        match: 'all',
        groups: [
          {
            match: 'all',
            conditions: [
              {
                field: 'country',
                fieldLabel: 'Country',
                fieldType: 'string',
                operator: 'equals',
                value: 'US',
              },
            ],
          },
        ],
      },
    };

    const records: HubSpotRecord[] = [
      { id: '1', industry: 'Tech', country: 'US' },
      { id: '2', industry: 'Finance', country: 'UK' },
      { id: '3', industry: 'Healthcare', country: 'US' },
    ];

    const supabase = (await import('@/lib/db/supabase')).supabase;
    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      data: [],
      error: null,
    } as any);

    const results = await applyLookupHarmony(records, harmony, 'org-123');

    // Should only process records 1 and 3 (country = US)
    // Verify by checking RPC was called with only 2 values
    expect(supabase.rpc).toHaveBeenCalledWith('batch_lookup_harmony', {
      p_table_name: 'industry_ref',
      p_input_values: ['Tech', 'Healthcare'], // Only US records
      p_org_id: 'org-123',
      p_fuzzy_threshold: 0.8,
      p_phonetic_enabled: false,
    });
  });

  test('returns empty array when no records match conditions', async () => {
    const harmony: Harmony = {
      id: 'test-harmony-no-match',
      name: 'CA Industry Normalizer',
      field: 'canonical.industry',
      objectType: 'company',
      transformType: 'lookup',
      referenceTable: 'industry_ref',
      isActive: true,
      conditionGroups: {
        match: 'all',
        groups: [
          {
            match: 'all',
            conditions: [
              {
                field: 'country',
                fieldLabel: 'Country',
                fieldType: 'string',
                operator: 'equals',
                value: 'CA',
              },
            ],
          },
        ],
      },
    };

    const records: HubSpotRecord[] = [
      { id: '1', industry: 'Tech', country: 'US' },
      { id: '2', industry: 'Finance', country: 'UK' },
    ];

    const results = await applyLookupHarmony(records, harmony, 'org-123');

    // Should return empty array (no records matched)
    expect(results).toEqual([]);
  });

  test('complex conditions - multiple groups with AND/OR', async () => {
    const harmony: Harmony = {
      id: 'test-complex-conditions',
      name: 'Complex Conditions',
      field: 'canonical.industry',
      objectType: 'company',
      transformType: 'lookup',
      referenceTable: 'industry_ref',
      isActive: true,
      conditionGroups: {
        match: 'all', // AND between groups
        groups: [
          {
            match: 'any', // OR within group
            conditions: [
              {
                field: 'country',
                fieldLabel: 'Country',
                fieldType: 'string',
                operator: 'equals',
                value: 'US',
              },
              {
                field: 'country',
                fieldLabel: 'Country',
                fieldType: 'string',
                operator: 'equals',
                value: 'CA',
              },
            ],
          },
          {
            match: 'all', // AND within group
            conditions: [
              {
                field: 'lifecyclestage',
                fieldLabel: 'Lifecycle Stage',
                fieldType: 'enumeration',
                operator: 'equals',
                value: 'customer',
              },
            ],
          },
        ],
      },
    };

    const records: HubSpotRecord[] = [
      { id: '1', industry: 'Tech', country: 'US', lifecyclestage: 'customer' }, // ✓ Match
      { id: '2', industry: 'Finance', country: 'UK', lifecyclestage: 'customer' }, // ✗ Group 1 fails
      { id: '3', industry: 'Healthcare', country: 'US', lifecyclestage: 'lead' }, // ✗ Group 2 fails
      { id: '4', industry: 'Retail', country: 'CA', lifecyclestage: 'customer' }, // ✓ Match
    ];

    const supabase = (await import('@/lib/db/supabase')).supabase;
    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      data: [],
      error: null,
    } as any);

    const results = await applyLookupHarmony(records, harmony, 'org-123');

    // Should only process records 1 and 4
    expect(supabase.rpc).toHaveBeenCalledWith('batch_lookup_harmony', {
      p_table_name: 'industry_ref',
      p_input_values: ['Tech', 'Retail'],
      p_org_id: 'org-123',
      p_fuzzy_threshold: 0.8,
      p_phonetic_enabled: false,
    });
  });
});
