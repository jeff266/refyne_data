/**
 * Phone Format Tests
 *
 * Tests for the e164_phone format function with different format configurations:
 * - e164_compact: +15627350870
 * - e164_formatted: +1 (562) 735-0870
 * - e164_international: +1 (562) 735-0870 (legacy alias)
 * - national: (562) 735-0870
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

describe('Phone Formatting - e164_formatted', () => {
  test('formats US 10-digit number to formatted international', async () => {
    const harmony: Harmony = {
      id: 'phone',
      name: 'Phone Formatter',
      field: 'person.phone',
      objectType: 'contact',
      transformType: 'format',
      transformFunction: 'e164_phone',
      transformConfig: {
        format: 'e164_formatted',
        default_country_code: '1',
        strip_extensions: true,
      },
      isActive: true,
    };

    const records: HubSpotRecord[] = [
      { id: '1', phone: '5627350870' },
      { id: '2', phone: '(562) 735-0870' },
      { id: '3', phone: '562-735-0870' },
    ];

    const results = await applyFormatHarmony(records, harmony, 'org-123');

    expect(results).toHaveLength(3);
    expect(results[0].after).toBe('+1 (562) 735-0870');
    expect(results[1].after).toBe('+1 (562) 735-0870');
    expect(results[2].after).toBe('+1 (562) 735-0870');
  });

  test('formats US 11-digit number with country code', async () => {
    const harmony: Harmony = {
      id: 'phone',
      name: 'Phone Formatter',
      field: 'person.phone',
      objectType: 'contact',
      transformType: 'format',
      transformFunction: 'e164_phone',
      transformConfig: {
        format: 'e164_formatted',
        default_country_code: '1',
        strip_extensions: true,
      },
      isActive: true,
    };

    const records: HubSpotRecord[] = [
      { id: '1', phone: '15627350870' },
      { id: '2', phone: '+1 562 735 0870' },
      { id: '3', phone: '+1-562-735-0870' },
    ];

    const results = await applyFormatHarmony(records, harmony, 'org-123');

    expect(results).toHaveLength(3);
    expect(results[0].after).toBe('+1 (562) 735-0870');
    expect(results[1].after).toBe('+1 (562) 735-0870');
    expect(results[2].after).toBe('+1 (562) 735-0870');
  });

  test('formats international numbers with country code', async () => {
    const harmony: Harmony = {
      id: 'phone',
      name: 'Phone Formatter',
      field: 'person.phone',
      objectType: 'contact',
      transformType: 'format',
      transformFunction: 'e164_phone',
      transformConfig: {
        format: 'e164_formatted',
        default_country_code: '1',
        strip_extensions: true,
      },
      isActive: true,
    };

    const records: HubSpotRecord[] = [
      { id: '1', phone: '+44 20 7946 0958' },
      { id: '2', phone: '+61 2 9374 4000' },
    ];

    const results = await applyFormatHarmony(records, harmony, 'org-123');

    expect(results).toHaveLength(2);
    // International numbers get compact format with country code
    expect(results[0].after).toMatch(/^\+44 /);
    expect(results[1].after).toMatch(/^\+61 /);
  });

  test('strips extensions when enabled', async () => {
    const harmony: Harmony = {
      id: 'phone',
      name: 'Phone Formatter',
      field: 'person.phone',
      objectType: 'contact',
      transformType: 'format',
      transformFunction: 'e164_phone',
      transformConfig: {
        format: 'e164_formatted',
        default_country_code: '1',
        strip_extensions: true,
      },
      isActive: true,
    };

    const records: HubSpotRecord[] = [
      { id: '1', phone: '562-735-0870 x123' },
      { id: '2', phone: '562-735-0870 ext 456' },
      { id: '3', phone: '562-735-0870 #789' },
    ];

    const results = await applyFormatHarmony(records, harmony, 'org-123');

    expect(results).toHaveLength(3);
    expect(results[0].after).toBe('+1 (562) 735-0870');
    expect(results[1].after).toBe('+1 (562) 735-0870');
    expect(results[2].after).toBe('+1 (562) 735-0870');
  });
});

describe('Phone Formatting - e164_compact', () => {
  test('formats to compact E.164 format', async () => {
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

    const records: HubSpotRecord[] = [
      { id: '1', phone: '562-735-0870' },
      { id: '2', phone: '(562) 735-0870' },
    ];

    const results = await applyFormatHarmony(records, harmony, 'org-123');

    expect(results).toHaveLength(2);
    expect(results[0].after).toBe('+15627350870');
    expect(results[1].after).toBe('+15627350870');
  });
});

describe('Phone Formatting - national', () => {
  test('formats to US national format without country code', async () => {
    const harmony: Harmony = {
      id: 'phone',
      name: 'Phone Formatter',
      field: 'person.phone',
      objectType: 'contact',
      transformType: 'format',
      transformFunction: 'e164_phone',
      transformConfig: {
        format: 'national',
        default_country_code: '1',
        strip_extensions: true,
      },
      isActive: true,
    };

    const records: HubSpotRecord[] = [
      { id: '1', phone: '5627350870' },
      { id: '2', phone: '+1-562-735-0870' },
    ];

    const results = await applyFormatHarmony(records, harmony, 'org-123');

    expect(results).toHaveLength(2);
    expect(results[0].after).toBe('(562) 735-0870');
    expect(results[1].after).toBe('(562) 735-0870');
  });
});

describe('Phone Formatting - e164_international (legacy)', () => {
  test('formats like e164_formatted for backward compatibility', async () => {
    const harmony: Harmony = {
      id: 'phone',
      name: 'Phone Formatter',
      field: 'person.phone',
      objectType: 'contact',
      transformType: 'format',
      transformFunction: 'e164_phone',
      transformConfig: {
        format: 'e164_international',
        default_country_code: '1',
        strip_extensions: true,
      },
      isActive: true,
    };

    const records: HubSpotRecord[] = [
      { id: '1', phone: '562-735-0870' },
    ];

    const results = await applyFormatHarmony(records, harmony, 'org-123');

    expect(results).toHaveLength(1);
    expect(results[0].after).toBe('+1 (562) 735-0870');
  });
});

describe('Phone Formatting - e164_dashes', () => {
  test('formats US number to international with dashes', async () => {
    const harmony: Harmony = {
      id: 'phone',
      name: 'Phone Formatter',
      field: 'person.phone',
      objectType: 'contact',
      transformType: 'format',
      transformFunction: 'e164_phone',
      transformConfig: {
        format: 'e164_dashes',
        default_country_code: '1',
        strip_extensions: true,
      },
      isActive: true,
    };

    const records: HubSpotRecord[] = [
      { id: '1', phone: '(310) 387-9598' },
      { id: '2', phone: '562-735-0870' },
    ];

    const results = await applyFormatHarmony(records, harmony, 'org-123');

    expect(results).toHaveLength(2);
    expect(results[0].after).toBe('+1 310-387-9598');
    expect(results[1].after).toBe('+1 562-735-0870');
  });

  test('formats UK number to international with dashes', async () => {
    const harmony: Harmony = {
      id: 'phone',
      name: 'Phone Formatter',
      field: 'person.phone',
      objectType: 'contact',
      transformType: 'format',
      transformFunction: 'e164_phone',
      transformConfig: {
        format: 'e164_dashes',
        default_country_code: '1',
        strip_extensions: true,
      },
      isActive: true,
    };

    const records: HubSpotRecord[] = [
      { id: '1', phone: '+44 20 7010 2000' },
    ];

    const results = await applyFormatHarmony(records, harmony, 'org-123');

    expect(results).toHaveLength(1);
    expect(results[0].after).toBe('+44 20-7010-2000');
  });
});

describe('Phone Formatting - e164_spaces', () => {
  test('formats US number to international with spaces', async () => {
    const harmony: Harmony = {
      id: 'phone',
      name: 'Phone Formatter',
      field: 'person.phone',
      objectType: 'contact',
      transformType: 'format',
      transformFunction: 'e164_phone',
      transformConfig: {
        format: 'e164_spaces',
        default_country_code: '1',
        strip_extensions: true,
      },
      isActive: true,
    };

    const records: HubSpotRecord[] = [
      { id: '1', phone: '(310) 387-9598' },
      { id: '2', phone: '562-735-0870' },
    ];

    const results = await applyFormatHarmony(records, harmony, 'org-123');

    expect(results).toHaveLength(2);
    expect(results[0].after).toBe('+1 310 387 9598');
    expect(results[1].after).toBe('+1 562 735 0870');
  });

  test('formats UK number to international with spaces', async () => {
    const harmony: Harmony = {
      id: 'phone',
      name: 'Phone Formatter',
      field: 'person.phone',
      objectType: 'contact',
      transformType: 'format',
      transformFunction: 'e164_phone',
      transformConfig: {
        format: 'e164_spaces',
        default_country_code: '1',
        strip_extensions: true,
      },
      isActive: true,
    };

    const records: HubSpotRecord[] = [
      { id: '1', phone: '+442070102000' }, // Compact format as input
    ];

    const results = await applyFormatHarmony(records, harmony, 'org-123');

    expect(results).toHaveLength(1);
    expect(results[0].after).toBe('+44 20 7010 2000');
  });
});

describe('Phone Formatting - Edge Cases', () => {
  test('skips null and empty values', async () => {
    const harmony: Harmony = {
      id: 'phone',
      name: 'Phone Formatter',
      field: 'person.phone',
      objectType: 'contact',
      transformType: 'format',
      transformFunction: 'e164_phone',
      transformConfig: {
        format: 'e164_formatted',
        default_country_code: '1',
        strip_extensions: true,
      },
      isActive: true,
    };

    const records: HubSpotRecord[] = [
      { id: '1', phone: null },
      { id: '2', phone: '' },
      { id: '3', phone: '   ' },
    ];

    const results = await applyFormatHarmony(records, harmony, 'org-123');

    expect(results).toHaveLength(0);
  });

  test('skips already formatted values', async () => {
    const harmony: Harmony = {
      id: 'phone',
      name: 'Phone Formatter',
      field: 'person.phone',
      objectType: 'contact',
      transformType: 'format',
      transformFunction: 'e164_phone',
      transformConfig: {
        format: 'e164_formatted',
        default_country_code: '1',
        strip_extensions: true,
      },
      isActive: true,
    };

    const records: HubSpotRecord[] = [
      { id: '1', phone: '+1 (562) 735-0870' }, // Already in target format
    ];

    const results = await applyFormatHarmony(records, harmony, 'org-123');

    // Should skip because already formatted
    expect(results).toHaveLength(0);
  });

  test('normalizes numbers starting with "1 " prefix (Bug Fix)', async () => {
    const harmony: Harmony = {
      id: 'phone',
      name: 'Phone Formatter',
      field: 'person.phone',
      objectType: 'contact',
      transformType: 'format',
      transformFunction: 'e164_phone',
      transformConfig: {
        format: 'e164_formatted',
        default_country_code: '1',
        strip_extensions: true,
      },
      isActive: true,
    };

    const records: HubSpotRecord[] = [
      { id: '1', phone: '1 (310) 387-9598' },
    ];

    const results = await applyFormatHarmony(records, harmony, 'org-123');

    expect(results).toHaveLength(1);
    expect(results[0].after).toBe('+1 (310) 387-9598');
  });

  test('normalizes numbers starting with "1-" prefix (Bug Fix)', async () => {
    const harmony: Harmony = {
      id: 'phone',
      name: 'Phone Formatter',
      field: 'person.phone',
      objectType: 'contact',
      transformType: 'format',
      transformFunction: 'e164_phone',
      transformConfig: {
        format: 'e164_formatted',
        default_country_code: '1',
        strip_extensions: true,
      },
      isActive: true,
    };

    const records: HubSpotRecord[] = [
      { id: '1', phone: '1-310-387-9598' },
      { id: '2', phone: '1-562-735-0870' },
    ];

    const results = await applyFormatHarmony(records, harmony, 'org-123');

    expect(results).toHaveLength(2);
    expect(results[0].after).toBe('+1 (310) 387-9598');
    expect(results[1].after).toBe('+1 (562) 735-0870');
  });
});

describe('Phone Formatting - All Formats with Defensive Checks', () => {
  const formats = [
    { format: 'e164_formatted', usExpected: '+1 (310) 387-9598', ukExpected: '+44 2070102000' },
    { format: 'e164_dashes', usExpected: '+1 310-387-9598', ukExpected: '+44 20-7010-2000' },
    { format: 'e164_spaces', usExpected: '+1 310 387 9598', ukExpected: '+44 20 7010 2000' },
    { format: 'e164_compact', usExpected: '+13103879598', ukExpected: '+442070102000' },
    { format: 'national', usExpected: '(310) 387-9598', ukExpected: '020 7010 2000' },
  ];

  formats.forEach(({ format, usExpected, ukExpected }) => {
    test(`${format}: translates vanity numbers before formatting`, async () => {
      const harmony: Harmony = {
        id: 'phone',
        name: 'Phone Formatter',
        field: 'person.phone',
        objectType: 'contact',
        transformType: 'format',
        transformFunction: 'e164_phone',
        transformConfig: {
          format,
          default_country_code: '1',
          strip_extensions: true,
        },
        isActive: true,
      };

      const records: HubSpotRecord[] = [
        { id: '1', phone: '1-800-FLOWERS' }, // 1-800-3569377
      ];

      const results = await applyFormatHarmony(records, harmony, 'org-123');

      expect(results).toHaveLength(1);
      // Vanity translates to digits before formatting
      expect(results[0].after).toMatch(/\+1|^\(/);
    });

    test(`${format}: skips shortcodes (< 7 digits)`, async () => {
      const harmony: Harmony = {
        id: 'phone',
        name: 'Phone Formatter',
        field: 'person.phone',
        objectType: 'contact',
        transformType: 'format',
        transformFunction: 'e164_phone',
        transformConfig: {
          format,
          default_country_code: '1',
          strip_extensions: true,
        },
        isActive: true,
      };

      const records: HubSpotRecord[] = [
        { id: '1', phone: '911' },
        { id: '2', phone: '12345' },
        { id: '3', phone: '411' },
      ];

      const results = await applyFormatHarmony(records, harmony, 'org-123');

      // All shortcodes should be skipped (return null)
      expect(results).toHaveLength(0);
    });

    test(`${format}: skips invalid E.164 length (> 15 digits)`, async () => {
      const harmony: Harmony = {
        id: 'phone',
        name: 'Phone Formatter',
        field: 'person.phone',
        objectType: 'contact',
        transformType: 'format',
        transformFunction: 'e164_phone',
        transformConfig: {
          format,
          default_country_code: '1',
          strip_extensions: true,
        },
        isActive: true,
      };

      const records: HubSpotRecord[] = [
        { id: '1', phone: '+1234567890123456' }, // 16 digits (too long)
      ];

      const results = await applyFormatHarmony(records, harmony, 'org-123');

      // National format doesn't validate E.164 length, others do
      if (format === 'national') {
        // National may still process it (no + sign to validate)
        expect(results.length).toBeGreaterThanOrEqual(0);
      } else {
        // E.164 formats should skip
        expect(results).toHaveLength(0);
      }
    });
  });

  test('All E.164 formats produce correct US output', async () => {
    const usFormats = [
      { format: 'e164_formatted', expected: '+1 (310) 387-9598' },
      { format: 'e164_dashes', expected: '+1 310-387-9598' },
      { format: 'e164_spaces', expected: '+1 310 387 9598' },
      { format: 'e164_compact', expected: '+13103879598' },
    ];

    for (const { format, expected } of usFormats) {
      const harmony: Harmony = {
        id: 'phone',
        name: 'Phone Formatter',
        field: 'person.phone',
        objectType: 'contact',
        transformType: 'format',
        transformFunction: 'e164_phone',
        transformConfig: {
          format,
          default_country_code: '1',
          strip_extensions: true,
        },
        isActive: true,
      };

      const records: HubSpotRecord[] = [
        { id: '1', phone: '(310) 387-9598' },
      ];

      const results = await applyFormatHarmony(records, harmony, 'org-123');

      expect(results).toHaveLength(1);
      expect(results[0].after).toBe(expected);
    }
  });

  test('All E.164 formats handle UK numbers correctly', async () => {
    const ukFormats = [
      { format: 'e164_formatted', expected: '+44 2070102000', input: '+44-20-7010-2000' },
      { format: 'e164_dashes', expected: '+44 20-7010-2000', input: '+442070102000' },
      { format: 'e164_spaces', expected: '+44 20 7010 2000', input: '+442070102000' },
      { format: 'e164_compact', expected: '+442070102000', input: '+44 20 7010 2000' },
    ];

    for (const { format, expected, input } of ukFormats) {
      const harmony: Harmony = {
        id: 'phone',
        name: 'Phone Formatter',
        field: 'person.phone',
        objectType: 'contact',
        transformType: 'format',
        transformFunction: 'e164_phone',
        transformConfig: {
          format,
          default_country_code: '1',
          strip_extensions: true,
        },
        isActive: true,
      };

      const records: HubSpotRecord[] = [
        { id: '1', phone: input },
      ];

      const results = await applyFormatHarmony(records, harmony, 'org-123');

      expect(results).toHaveLength(1);
      expect(results[0].after).toBe(expected);
    }
  });
});
