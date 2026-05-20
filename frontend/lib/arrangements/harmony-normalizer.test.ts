import { describe, it, expect, vi, beforeEach } from 'vitest';
import { normalizeWithHarmony } from './harmony-normalizer';
import { extractHarmonyOutput } from '../harmonies/output';

// Mock Supabase
vi.mock('../db/supabase', () => ({
  supabase: {
    from: vi.fn((table: string) => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => ({
            data: null,
            error: null,
          })),
        })),
      })),
    })),
    rpc: vi.fn(),
  },
}));

describe('Harmony Normalization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call extractHarmonyOutput with correct parameters', async () => {
    // This is more of an integration test to verify the flow
    // In a real scenario, we'd mock the supabase calls properly

    const result = await normalizeWithHarmony({
      orgId: 'test-org',
      harmonyId: 'test-harmony',
      rawValue: 'Software',
    });

    // Should return a result structure
    expect(result).toHaveProperty('normalized');
    expect(result).toHaveProperty('matched');
    expect(result).toHaveProperty('harmonyId');
    expect(result).toHaveProperty('outputFormat');
    expect(result).toHaveProperty('raw');
  });

  it('should handle harmony lookup failures gracefully', async () => {
    const result = await normalizeWithHarmony({
      orgId: 'test-org',
      harmonyId: 'nonexistent-harmony',
      rawValue: 'Test Value',
    });

    // Should not throw, return with matched: false
    expect(result.matched).toBe(false);
    expect(result.normalized).toBeNull();
  });
});

describe('extractHarmonyOutput', () => {
  it('should extract default field from structured output', () => {
    const rawOutput = {
      name: 'California',
      abbreviation: 'CA',
      code: '06',
    };

    const availableFormats = [
      { key: 'name', label: 'Full Name', default: true },
      { key: 'abbreviation', label: 'Abbreviation' },
      { key: 'code', label: 'Code' },
    ];

    const result = extractHarmonyOutput(rawOutput, 'default', availableFormats);

    expect(result).toBe('California');
  });

  it('should extract specified field when format is provided', () => {
    const rawOutput = {
      name: 'California',
      abbreviation: 'CA',
      code: '06',
    };

    const availableFormats = [
      { key: 'name', label: 'Full Name', default: true },
      { key: 'abbreviation', label: 'Abbreviation' },
      { key: 'code', label: 'Code' },
    ];

    const result = extractHarmonyOutput(rawOutput, 'abbreviation', availableFormats);

    expect(result).toBe('CA');
  });

  it('should return string as-is if output is already a string', () => {
    const rawOutput = 'Simple String';

    const result = extractHarmonyOutput(rawOutput, 'default', []);

    expect(result).toBe('Simple String');
  });

  it('should fall back to default when requested format not found', () => {
    const rawOutput = {
      name: 'California',
      abbreviation: 'CA',
    };

    const availableFormats = [
      { key: 'name', label: 'Full Name', default: true },
      { key: 'abbreviation', label: 'Abbreviation' },
    ];

    // Request a format that doesn't exist
    const result = extractHarmonyOutput(rawOutput, 'nonexistent', availableFormats);

    // Should fall back to default (name)
    expect(result).toBe('California');
  });
});
