/**
 * Phone Normalizer Defensive Checks Tests
 *
 * Tests for three defensive checks added to normalizePhoneE164():
 * 1. Vanity Number Translation (1-800-FLOWERS → 1-800-356-9377)
 * 2. Shortcode Detection (skip numbers < 7 digits)
 * 3. E.164 Length Validation (skip numbers > 16 chars after normalization)
 */

import { describe, test, expect, vi } from 'vitest';
import { applyFormatHarmony, type Harmony, type HubSpotRecord } from './normalization-engine';

// Mock Supabase
vi.mock('@/lib/db/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve({ data: null, error: null })),
        })),
      })),
    })),
  },
}));

// Mock field assignments
vi.mock('./field-assignments', () => ({
  getFieldAssignments: vi.fn(() => Promise.resolve([])),
}));

describe('CHECK 1: Vanity Number Translation', () => {
  const harmony: Harmony = {
    id: 'phone',
    name: 'Phone Formatter',
    field: 'person.phone',
    objectType: 'contact',
    transformType: 'format',
    transformFunction: 'e164_phone',
    transformConfig: {
      format: 'e164_compact',
      default_country_code: '1',
      strip_extensions: true,
    },
    isActive: true,
  };

  test('1-800-FLOWERS → +18003569377', async () => {
    const records: HubSpotRecord[] = [
      { id: '1', phone: '1-800-FLOWERS' },
    ];

    const results = await applyFormatHarmony(records, harmony, 'org-123');

    expect(results).toHaveLength(1);
    expect(results[0].after).toBe('+18003569377');
  });

  test('1-800-CALL-ATT → +18002255288', async () => {
    const records: HubSpotRecord[] = [
      { id: '1', phone: '1-800-CALL-ATT' },
    ];

    const results = await applyFormatHarmony(records, harmony, 'org-123');

    expect(results).toHaveLength(1);
    expect(results[0].after).toBe('+18002255288');
  });

  test('case insensitive (1-800-flowers works too)', async () => {
    const records: HubSpotRecord[] = [
      { id: '1', phone: '1-800-flowers' },
      { id: '2', phone: '1-800-FLOWERS' },
      { id: '3', phone: '1-800-FlOwErS' },
    ];

    const results = await applyFormatHarmony(records, harmony, 'org-123');

    expect(results).toHaveLength(3);
    expect(results[0].after).toBe('+18003569377');
    expect(results[1].after).toBe('+18003569377');
    expect(results[2].after).toBe('+18003569377');
  });

  test('mixed (1800FLOWERs → translates letters only)', async () => {
    const records: HubSpotRecord[] = [
      { id: '1', phone: '1800FLOWERs' },
    ];

    const results = await applyFormatHarmony(records, harmony, 'org-123');

    expect(results).toHaveLength(1);
    expect(results[0].after).toBe('+18003569377');
  });

  test('vanity with formatting: 1 (800) FLOWERS', async () => {
    const records: HubSpotRecord[] = [
      { id: '1', phone: '1 (800) FLOWERS' },
    ];

    const results = await applyFormatHarmony(records, harmony, 'org-123');

    expect(results).toHaveLength(1);
    expect(results[0].after).toBe('+18003569377');
  });
});

describe('CHECK 2: Shortcode Detection', () => {
  const harmony: Harmony = {
    id: 'phone',
    name: 'Phone Formatter',
    field: 'person.phone',
    objectType: 'contact',
    transformType: 'format',
    transformFunction: 'e164_phone',
    transformConfig: {
      format: 'e164_compact',
      default_country_code: '1',
      strip_extensions: true,
    },
    isActive: true,
  };

  test('12345 → null (skipped)', async () => {
    const records: HubSpotRecord[] = [
      { id: '1', phone: '12345' },
    ];

    const results = await applyFormatHarmony(records, harmony, 'org-123');

    // Should be skipped (no change)
    expect(results).toHaveLength(0);
  });

  test('911 → null (skipped)', async () => {
    const records: HubSpotRecord[] = [
      { id: '1', phone: '911' },
    ];

    const results = await applyFormatHarmony(records, harmony, 'org-123');

    // Should be skipped (no change)
    expect(results).toHaveLength(0);
  });

  test('1234567 → NOT skipped (7 digits = valid)', async () => {
    const records: HubSpotRecord[] = [
      { id: '1', phone: '1234567' },
    ];

    const results = await applyFormatHarmony(records, harmony, 'org-123');

    // 7 digits should NOT be skipped
    expect(results).toHaveLength(1);
    expect(results[0].after).toBe('+11234567');
  });

  test('shortcode with formatting: (123) 45 → skipped', async () => {
    const records: HubSpotRecord[] = [
      { id: '1', phone: '(123) 45' },
    ];

    const results = await applyFormatHarmony(records, harmony, 'org-123');

    // Only 5 digits after stripping formatting
    expect(results).toHaveLength(0);
  });

  test('exactly 6 digits → skipped', async () => {
    const records: HubSpotRecord[] = [
      { id: '1', phone: '123456' },
    ];

    const results = await applyFormatHarmony(records, harmony, 'org-123');

    // 6 digits should be skipped (< 7)
    expect(results).toHaveLength(0);
  });
});

describe('CHECK 3: E.164 Length Validation', () => {
  const harmony: Harmony = {
    id: 'phone',
    name: 'Phone Formatter',
    field: 'person.phone',
    objectType: 'contact',
    transformType: 'format',
    transformFunction: 'e164_phone',
    transformConfig: {
      format: 'e164_compact',
      default_country_code: '1',
      strip_extensions: true,
    },
    isActive: true,
  };

  test('180027382558255 → null (too long after +1 prepended)', async () => {
    const records: HubSpotRecord[] = [
      // This would become +1180027382558255 (17 chars: + sign + 16 digits)
      { id: '1', phone: '180027382558255' },
    ];

    const results = await applyFormatHarmony(records, harmony, 'org-123');

    // Should be skipped because final result exceeds 16 chars
    expect(results).toHaveLength(0);
  });

  test('+13103879598 → passes (valid length)', async () => {
    const records: HubSpotRecord[] = [
      // Use a different format to avoid "already formatted" skip
      { id: '1', phone: '3103879598' },
    ];

    const results = await applyFormatHarmony(records, harmony, 'org-123');

    // Should pass (11 digits total: country code 1 + 10 digit number)
    expect(results).toHaveLength(1);
    expect(results[0].after).toBe('+13103879598');
  });

  test('exactly 15 digits total → passes', async () => {
    const records: HubSpotRecord[] = [
      // Max allowed: 15 digits total in E.164
      // Provide number with + prefix and 15 digits total to avoid country code logic
      // Format to ensure it's not "already formatted"
      { id: '1', phone: '+44 1234 567890123' }, // 44 (2) + 13 digits = 15 total, with spaces
    ];

    const results = await applyFormatHarmony(records, harmony, 'org-123');

    // Should pass (exactly 15 digits)
    expect(results).toHaveLength(1);
    expect(results[0].after).toBe('+441234567890123');
  });

  test('16 digits without country code → fails when +1 prepended', async () => {
    const records: HubSpotRecord[] = [
      // 16 digits alone, but +1 prepended = 17 chars total (too long)
      { id: '1', phone: '1234567890123456' },
    ];

    const results = await applyFormatHarmony(records, harmony, 'org-123');

    // Should be skipped (17 chars after +1 prepended)
    expect(results).toHaveLength(0);
  });

  test('national format bypasses E.164 length check', async () => {
    const harmonyNational: Harmony = {
      ...harmony,
      transformConfig: {
        format: 'national',
        default_country_code: '1',
        strip_extensions: true,
      },
    };

    const records: HubSpotRecord[] = [
      { id: '1', phone: '5627350870' },
    ];

    const results = await applyFormatHarmony(records, harmonyNational, 'org-123');

    // National format doesn't add + sign, so no E.164 validation
    expect(results).toHaveLength(1);
    expect(results[0].after).toBe('(562) 735-0870');
  });
});

describe('Integration: Multiple Defensive Checks', () => {
  const harmony: Harmony = {
    id: 'phone',
    name: 'Phone Formatter',
    field: 'person.phone',
    objectType: 'contact',
    transformType: 'format',
    transformFunction: 'e164_phone',
    transformConfig: {
      format: 'e164_compact',
      default_country_code: '1',
      strip_extensions: true,
    },
    isActive: true,
  };

  test('vanity shortcode: 800-AB → skipped (only 5 digits)', async () => {
    const records: HubSpotRecord[] = [
      { id: '1', phone: '800-AB' }, // Translates to 800-22 = 5 digits total (< 7)
    ];

    const results = await applyFormatHarmony(records, harmony, 'org-123');

    // Should be skipped because only 5 digits total (< 7)
    expect(results).toHaveLength(0);
  });

  test('valid vanity number with extension', async () => {
    const records: HubSpotRecord[] = [
      { id: '1', phone: '1-800-FLOWERS ext 123' },
    ];

    const results = await applyFormatHarmony(records, harmony, 'org-123');

    // Extension stripped, vanity translated, valid length
    expect(results).toHaveLength(1);
    expect(results[0].after).toBe('+18003569377');
  });

  test('mix of valid, shortcode, and too-long numbers', async () => {
    const records: HubSpotRecord[] = [
      { id: '1', phone: '911' },                    // Shortcode (skipped)
      { id: '2', phone: '1-800-FLOWERS' },          // Valid vanity
      { id: '3', phone: '180027382558255' },        // Too long (skipped)
      { id: '4', phone: '3103879598' },             // Valid (avoid "already formatted" skip)
      { id: '5', phone: '12345' },                  // Shortcode (skipped)
    ];

    const results = await applyFormatHarmony(records, harmony, 'org-123');

    // Only records 2 and 4 should produce results
    expect(results).toHaveLength(2);
    expect(results[0].hubspotRecordId).toBe('2');
    expect(results[0].after).toBe('+18003569377');
    expect(results[1].hubspotRecordId).toBe('4');
    expect(results[1].after).toBe('+13103879598');
  });
});
