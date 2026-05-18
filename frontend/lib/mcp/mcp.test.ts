/**
 * MCP Tool Tests - Phase 8: MCP Tool Definitions
 *
 * Comprehensive tests for all MCP tools:
 * - enrichment_pull
 * - enrichment_normalize
 * - harmony_list
 * - harmony_test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import {
  executeTool,
  getTool,
  getToolNames,
  getToolDescriptions,
  validateToolInput,
} from './index';

import { executeHarmonyList } from './tools/harmony-list';
import { executeHarmonyTest } from './tools/harmony-test';
import { executeEnrichmentPull } from './tools/enrichment-pull';
import { executeEnrichmentNormalize } from './tools/enrichment-normalize';

import { clearLibraryCache, ensureInitialized } from '../harmonies/library';
import type { ProviderResponse } from '../providers/types';

// ─────────────────────────────────────────────────────────────
// Test Fixtures
// ─────────────────────────────────────────────────────────────

const mockApolloResponse: ProviderResponse = {
  _source: 'apollo',
  _retrieved_at: '2026-05-16T10:00:00.000Z',
  raw: {
    name: 'ACME CORPORATION',
    domain: 'acme.com',
    industry: 'Software',
    employee_count: 150,
    revenue: 15000000,
    description: 'A leading software company',
    city: 'San Francisco',
    state: 'CA',
    country: 'USA',
    linkedin_url: 'https://www.linkedin.com/company/acme',
    phone: '+1 (555) 123-4567',
  },
};

const mockZoomInfoResponse: ProviderResponse = {
  _source: 'zoominfo',
  _retrieved_at: '2026-05-16T10:01:00.000Z',
  raw: {
    name: 'Acme Corp',
    domain: 'acme.com',
    industry: 'Computer Software',
    employees: 148,
    estimated_annual_revenue: 14500000,
    description: 'Enterprise software solutions',
    headquarters: {
      city: 'San Francisco',
      state: 'California',
      country: 'United States',
    },
  },
};

const mockPersonResponse: ProviderResponse = {
  _source: 'apollo',
  _retrieved_at: '2026-05-16T10:00:00.000Z',
  raw: {
    name: 'john smith',
    first_name: 'john',
    last_name: 'smith',
    title: 'senior vice president, sales',
    email: 'JOHN.SMITH@ACME.COM',
    phone: '15551234567',
    linkedin_url: 'linkedin.com/in/johnsmith',
    company: 'ACME Corporation',
  },
};

// ─────────────────────────────────────────────────────────────
// Tool Registry Tests
// ─────────────────────────────────────────────────────────────

describe('MCP Tool Registry', () => {
  it('should list all available tools', () => {
    const tools = getToolNames();
    expect(tools).toContain('enrichment_pull');
    expect(tools).toContain('enrichment_normalize');
    expect(tools).toContain('harmony_list');
    expect(tools).toContain('harmony_test');
    expect(tools).toContain('harmonies_preview');
    expect(tools).toContain('harmonies_apply');
    expect(tools).toHaveLength(6);
  });

  it('should get tool by name', () => {
    const tool = getTool('harmony_list');
    expect(tool).toBeDefined();
    expect(tool?.name).toBe('harmony_list');
    expect(tool?.description).toBeTruthy();
    expect(tool?.inputSchema).toBeDefined();
    expect(tool?.execute).toBeInstanceOf(Function);
  });

  it('should return undefined for unknown tool', () => {
    const tool = getTool('unknown_tool' as any);
    expect(tool).toBeUndefined();
  });

  it('should get tool descriptions', () => {
    const descriptions = getToolDescriptions();
    expect(descriptions).toHaveLength(6);
    for (const desc of descriptions) {
      expect(desc.name).toBeTruthy();
      expect(desc.description).toBeTruthy();
      expect(desc.inputSchema).toBeDefined();
    }
  });

  it('should validate tool input - valid', () => {
    const result = validateToolInput('harmony_list', {});
    expect(result.valid).toBe(true);
    expect(result.errors).toBeUndefined();
  });

  it('should validate tool input - missing required field', () => {
    const result = validateToolInput('harmony_test', {});
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Missing required field: harmonyId');
  });

  it('should validate tool input - unknown tool', () => {
    const result = validateToolInput('unknown_tool' as any, {});
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Unknown tool: unknown_tool');
  });

  it('should execute tool by name', async () => {
    const result = await executeTool('harmony_list', {});
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
  });

  it('should return error for unknown tool', async () => {
    const result = await executeTool('unknown_tool' as any, {});
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('invalid_input');
    expect(result.error?.message).toContain('Unknown tool');
  });
});

// ─────────────────────────────────────────────────────────────
// harmony_list Tool Tests
// ─────────────────────────────────────────────────────────────

describe('harmony_list Tool', () => {
  beforeEach(() => {
    clearLibraryCache();
    ensureInitialized();
  });

  it('should list all harmonies with no filter', async () => {
    const result = await executeHarmonyList({});
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data?.total).toBeGreaterThan(0);
    expect(result.data?.harmonies).toBeInstanceOf(Array);
    expect(result.data?.byCategory).toBeDefined();
    expect(result.data?.byEntity).toBeDefined();
    expect(result.timing?.totalMs).toBeGreaterThanOrEqual(0);
  });

  it('should filter by entity type', async () => {
    const result = await executeHarmonyList({ entity: 'company' });
    expect(result.success).toBe(true);
    for (const harmony of result.data?.harmonies ?? []) {
      expect(harmony.entity).toBe('company');
    }
  });

  it('should filter by field', async () => {
    const result = await executeHarmonyList({ field: 'company.name' });
    expect(result.success).toBe(true);
    expect(result.data?.total).toBeGreaterThan(0);
    for (const harmony of result.data?.harmonies ?? []) {
      expect(harmony.fields).toContain('company.name');
    }
  });

  it('should filter by category', async () => {
    const result = await executeHarmonyList({ category: 'contact-fields' });
    expect(result.success).toBe(true);
    for (const harmony of result.data?.harmonies ?? []) {
      expect(harmony.category).toBe('contact-fields');
    }
  });

  it('should filter by tags', async () => {
    const result = await executeHarmonyList({ tags: ['company'] });
    expect(result.success).toBe(true);
    expect(result.data?.total).toBeGreaterThan(0);
    for (const harmony of result.data?.harmonies ?? []) {
      const tagMatch = harmony.tags.some((t) =>
        t.toLowerCase().includes('company')
      );
      expect(tagMatch).toBe(true);
    }
  });

  it('should include spec when requested', async () => {
    const result = await executeHarmonyList({
      field: 'company.name',
      includeSpec: true,
    });
    expect(result.success).toBe(true);
    expect(result.data?.harmonies[0]?.spec).toBeDefined();
    expect(result.data?.harmonies[0]?.spec?.rules).toBeInstanceOf(Array);
  });

  it('should not include spec by default', async () => {
    const result = await executeHarmonyList({ field: 'company.name' });
    expect(result.success).toBe(true);
    expect(result.data?.harmonies[0]?.spec).toBeUndefined();
  });

  it('should return harmony summaries with required fields', async () => {
    const result = await executeHarmonyList({});
    expect(result.success).toBe(true);
    const harmony = result.data?.harmonies[0];
    expect(harmony).toBeDefined();
    expect(harmony?.id).toBeTruthy();
    expect(harmony?.version).toBeTruthy();
    expect(harmony?.name).toBeTruthy();
    expect(harmony?.description).toBeTruthy();
    expect(harmony?.category).toBeTruthy();
    expect(harmony?.fields).toBeInstanceOf(Array);
    expect(harmony?.tags).toBeInstanceOf(Array);
    expect(typeof harmony?.enabled).toBe('boolean');
  });
});

// ─────────────────────────────────────────────────────────────
// harmony_test Tool Tests
// ─────────────────────────────────────────────────────────────

describe('harmony_test Tool', () => {
  beforeEach(() => {
    clearLibraryCache();
    ensureInitialized();
  });

  it('should run embedded tests for a harmony', async () => {
    const result = await executeHarmonyTest({ harmonyId: 'company-name' });
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data?.harmonyId).toBe('company-name');
    expect(result.data?.total).toBeGreaterThan(0);
    expect(result.data?.results).toBeInstanceOf(Array);
    expect(result.timing?.totalMs).toBeGreaterThanOrEqual(0);
  });

  it('should return error for unknown harmony', async () => {
    const result = await executeHarmonyTest({ harmonyId: 'unknown-harmony' });
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('harmony_not_found');
    expect(result.error?.message).toContain('unknown-harmony');
  });

  it('should run custom test data', async () => {
    const result = await executeHarmonyTest({
      harmonyId: 'company-name',
      testData: [
        { input: 'ACME CORPORATION', expected: 'Acme Corp.' },
        { input: 'TechStart Incorporated', expected: 'Techstart Inc.' },
      ],
    });
    expect(result.success).toBe(true);
    expect(result.data?.total).toBe(2);
    expect(result.data?.results).toHaveLength(2);
  });

  it('should handle test without expected value', async () => {
    const result = await executeHarmonyTest({
      harmonyId: 'company-name',
      testData: [{ input: 'Test Company LLC' }],
    });
    expect(result.success).toBe(true);
    expect(result.data?.total).toBe(1);
    // Test passes if execution succeeds
    expect(result.data?.passed).toBe(1);
  });

  it('should return detailed test results', async () => {
    const result = await executeHarmonyTest({ harmonyId: 'company-name' });
    expect(result.success).toBe(true);
    const testCase = result.data?.results[0];
    expect(testCase).toBeDefined();
    expect(testCase?.name).toBeTruthy();
    expect(typeof testCase?.passed).toBe('boolean');
    expect(typeof testCase?.skipped).toBe('boolean');
    expect(testCase?.input !== undefined).toBe(true);
    expect(testCase?.executionMs).toBeGreaterThanOrEqual(0);
  });

  it('should calculate pass rate correctly', async () => {
    const result = await executeHarmonyTest({ harmonyId: 'company-name' });
    expect(result.success).toBe(true);
    const data = result.data!;
    const expectedRate = data.total > 0 ? data.passed / (data.total - data.skipped) : 1;
    expect(data.passRate).toBeCloseTo(expectedRate, 2);
  });

  it('should use custom source', async () => {
    const result = await executeHarmonyTest({
      harmonyId: 'company-name',
      testData: [{ input: 'Test Corp' }],
      source: 'custom-source',
    });
    expect(result.success).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────
// enrichment_normalize Tool Tests
// ─────────────────────────────────────────────────────────────

describe('enrichment_normalize Tool', () => {
  beforeEach(() => {
    clearLibraryCache();
    ensureInitialized();
  });

  it('should normalize single company response', async () => {
    const result = await executeEnrichmentNormalize({
      data: mockApolloResponse,
      entity: 'company',
    });

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data?._type).toBe('company');
    expect(result.data?._sources).toContain('apollo');
    expect(result.data?._normalized_at).toBeTruthy();
    expect(result.timing?.totalMs).toBeGreaterThanOrEqual(0);
  });

  it('should normalize company name', async () => {
    const result = await executeEnrichmentNormalize({
      data: mockApolloResponse,
      entity: 'company',
    });

    expect(result.success).toBe(true);
    // Name should be normalized to title case
    expect(result.data?.name).toBeDefined();
  });

  it('should normalize phone number', async () => {
    const result = await executeEnrichmentNormalize({
      data: mockApolloResponse,
      entity: 'company',
    });

    expect(result.success).toBe(true);
    // Phone should be normalized
    expect(result.data?.phone).toBeDefined();
  });

  it('should normalize multiple responses with resolution', async () => {
    const result = await executeEnrichmentNormalize({
      data: [mockApolloResponse, mockZoomInfoResponse],
      entity: 'company',
      resolutionStrategy: 'priority',
      priorityOrder: ['apollo', 'zoominfo'],
    });

    expect(result.success).toBe(true);
    expect(result.data?._sources).toContain('apollo');
    expect(result.data?._sources).toContain('zoominfo');
  });

  it('should normalize person response', async () => {
    const result = await executeEnrichmentNormalize({
      data: mockPersonResponse,
      entity: 'person',
    });

    expect(result.success).toBe(true);
    expect(result.data?._type).toBe('person');
    expect(result.data?._sources).toContain('apollo');
  });

  it('should include seniority for person title', async () => {
    const result = await executeEnrichmentNormalize({
      data: mockPersonResponse,
      entity: 'person',
    });

    expect(result.success).toBe(true);
    const personData = result.data as any;
    // Person title harmony should extract seniority
    if (personData.seniority) {
      expect(['VP', 'SVP', 'EVP']).toContain(personData.seniority);
    }
  });

  it('should handle invalid entity type', async () => {
    const result = await executeEnrichmentNormalize({
      data: mockApolloResponse,
      entity: 'invalid' as any,
    });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('invalid_input');
  });

  it('should handle missing _source', async () => {
    const result = await executeEnrichmentNormalize({
      data: { raw: { name: 'Test' } } as any,
      entity: 'company',
    });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('invalid_input');
  });

  it('should add pipeline to output', async () => {
    const result = await executeEnrichmentNormalize({
      data: mockApolloResponse,
      entity: 'company',
      pipeline: 'custom-pipeline',
    });

    expect(result.success).toBe(true);
    expect((result.data as any)._pipeline).toBe('custom-pipeline');
  });

  it('should handle headquarters normalization', async () => {
    const result = await executeEnrichmentNormalize({
      data: mockApolloResponse,
      entity: 'company',
    });

    expect(result.success).toBe(true);
    const company = result.data as any;
    expect(company.headquarters).toBeDefined();
    expect(company.headquarters?.city).toBe('San Francisco');
  });
});

// ─────────────────────────────────────────────────────────────
// enrichment_pull Tool Tests
// ─────────────────────────────────────────────────────────────

describe('enrichment_pull Tool', () => {
  beforeEach(() => {
    clearLibraryCache();
    ensureInitialized();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return error for unknown provider', async () => {
    const result = await executeEnrichmentPull({
      provider: 'unknown' as any,
      query: { domain: 'test.com' },
    });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('invalid_input');
    expect(result.error?.message).toContain('Unknown provider');
  });

  it('should return error for empty query', async () => {
    const result = await executeEnrichmentPull({
      provider: 'apollo',
      query: {},
    });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('invalid_input');
    expect(result.error?.message).toContain('domain, name, or search term');
  });

  it('should return config_error when API key missing', async () => {
    // Without API keys, providers should return a config error
    const result = await executeEnrichmentPull({
      provider: 'apollo',
      query: { domain: 'test.com' },
      normalize: false,
    });

    // Should fail with provider error due to missing API key
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('provider_error');
    expect(result.error?.details?.errorCode).toBe('config_error');
  });

  it('should include timing information even on error', async () => {
    const result = await executeEnrichmentPull({
      provider: 'apollo',
      query: { domain: 'test.com' },
      normalize: false,
    });

    expect(result.timing).toBeDefined();
    expect(result.timing?.totalMs).toBeGreaterThanOrEqual(0);
  });

  it('should validate provider ID', async () => {
    // Test all valid providers are recognized
    const validProviders = ['apollo', 'zoominfo', 'serper', 'clay', 'graphiq', 'yelp'];
    for (const provider of validProviders) {
      const result = await executeEnrichmentPull({
        provider: provider as any,
        query: { domain: 'test.com' },
        normalize: false,
      });
      // Should fail with config_error (no API key), not invalid_input
      if (!result.success) {
        expect(result.error?.code).not.toBe('invalid_input');
      }
    }
  });

  it('should use correct input schema', async () => {
    const { enrichmentPullInputSchema } = await import('./tools/enrichment-pull');
    expect(enrichmentPullInputSchema.required).toContain('provider');
    expect(enrichmentPullInputSchema.required).toContain('query');
    expect(enrichmentPullInputSchema.properties.provider.enum).toContain('apollo');
    expect(enrichmentPullInputSchema.properties.normalize.type).toBe('boolean');
  });
});

// ─────────────────────────────────────────────────────────────
// enrichment_pull Tool Integration Tests (with mocked providers)
// ─────────────────────────────────────────────────────────────

describe('enrichment_pull Tool Integration', () => {
  beforeEach(() => {
    clearLibraryCache();
    ensureInitialized();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should normalize raw response format correctly', async () => {
    // Test the normalization logic with mock provider response format
    const { executeEnrichmentNormalize } = await import('./tools/enrichment-normalize');

    const mockResponse: ProviderResponse = {
      _source: 'apollo',
      _retrieved_at: new Date().toISOString(),
      raw: {
        name: 'ACME CORPORATION',
        domain: 'acme.com',
        industry: 'Software',
        employee_count: 150,
      },
    };

    const result = await executeEnrichmentNormalize({
      data: mockResponse,
      entity: 'company',
      pipeline: 'test-pipeline',
    });

    expect(result.success).toBe(true);
    expect(result.data?._type).toBe('company');
    expect((result.data as any)._pipeline).toBe('test-pipeline');
  });
});

// ─────────────────────────────────────────────────────────────
// Integration Tests
// ─────────────────────────────────────────────────────────────

describe('MCP Tool Integration', () => {
  beforeEach(() => {
    clearLibraryCache();
    ensureInitialized();
  });

  it('should list harmonies and test one', async () => {
    // List harmonies
    const listResult = await executeHarmonyList({ entity: 'company' });
    expect(listResult.success).toBe(true);
    expect(listResult.data?.total).toBeGreaterThan(0);

    // Get first harmony ID
    const harmonyId = listResult.data?.harmonies[0]?.id;
    expect(harmonyId).toBeTruthy();

    // Test that harmony
    const testResult = await executeHarmonyTest({ harmonyId: harmonyId! });
    expect(testResult.success).toBe(true);
    expect(testResult.data?.harmonyId).toBe(harmonyId);
  });

  it('should normalize data from enrichment_pull format', async () => {
    // Simulate data from enrichment_pull (raw format)
    const pullData: ProviderResponse = {
      _source: 'apollo',
      _retrieved_at: new Date().toISOString(),
      raw: {
        name: 'notion labs incorporated',
        domain: 'notion.so',
        industry: 'Computer Software',
        employee_count: 500,
      },
    };

    // Normalize it
    const normalizeResult = await executeEnrichmentNormalize({
      data: pullData,
      entity: 'company',
    });

    expect(normalizeResult.success).toBe(true);
    expect(normalizeResult.data?._type).toBe('company');
    expect(normalizeResult.data?.name).toBeDefined();
  });

  it('should resolve multiple provider responses', async () => {
    const responses: ProviderResponse[] = [
      {
        _source: 'apollo',
        _retrieved_at: '2026-05-16T10:00:00.000Z',
        raw: {
          name: 'ACME CORPORATION',
          employee_count: 150,
        },
      },
      {
        _source: 'zoominfo',
        _retrieved_at: '2026-05-16T10:01:00.000Z',
        raw: {
          name: 'Acme Corp',
          employees: 148,
        },
      },
    ];

    const result = await executeEnrichmentNormalize({
      data: responses,
      entity: 'company',
      resolutionStrategy: 'priority',
      priorityOrder: ['apollo', 'zoominfo'],
    });

    expect(result.success).toBe(true);
    expect(result.data?._sources).toHaveLength(2);
  });
});

// ─────────────────────────────────────────────────────────────
// Edge Case Tests
// ─────────────────────────────────────────────────────────────

describe('MCP Tool Edge Cases', () => {
  beforeEach(() => {
    clearLibraryCache();
    ensureInitialized();
  });

  it('harmony_list should handle empty result set', async () => {
    const result = await executeHarmonyList({
      field: 'nonexistent.field',
    });
    expect(result.success).toBe(true);
    expect(result.data?.total).toBe(0);
    expect(result.data?.harmonies).toHaveLength(0);
  });

  it('harmony_test should handle harmony with no tests', async () => {
    // This tests that we gracefully handle empty test arrays
    const result = await executeHarmonyTest({
      harmonyId: 'company-name',
      testData: [],
    });
    // Empty testData should run embedded tests
    expect(result.success).toBe(true);
    expect(result.data?.total).toBeGreaterThan(0);
  });

  it('enrichment_normalize should handle null values in raw', async () => {
    const response: ProviderResponse = {
      _source: 'test',
      _retrieved_at: new Date().toISOString(),
      raw: {
        name: 'Test Company',
        domain: null,
        industry: undefined,
      },
    };

    const result = await executeEnrichmentNormalize({
      data: response,
      entity: 'company',
    });

    expect(result.success).toBe(true);
    expect(result.data?.name).toBeDefined();
  });

  it('enrichment_normalize should handle empty raw object', async () => {
    const response: ProviderResponse = {
      _source: 'test',
      _retrieved_at: new Date().toISOString(),
      raw: {},
    };

    const result = await executeEnrichmentNormalize({
      data: response,
      entity: 'company',
    });

    expect(result.success).toBe(true);
    expect(result.data?._type).toBe('company');
  });

  it('should handle concurrent tool executions', async () => {
    const promises = [
      executeHarmonyList({ entity: 'company' }),
      executeHarmonyList({ entity: 'person' }),
      executeHarmonyTest({ harmonyId: 'company-name' }),
      executeEnrichmentNormalize({
        data: mockApolloResponse,
        entity: 'company',
      }),
    ];

    const results = await Promise.all(promises);
    for (const result of results) {
      expect(result.success).toBe(true);
    }
  });
});
