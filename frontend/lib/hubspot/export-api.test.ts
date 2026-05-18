/**
 * Export API Tests
 *
 * Tests for HubSpot Export API functionality:
 * - parseExportFile() format handling
 * - exportCompanies() async job flow
 * - buildCompanyIndex() with hasExportScope flag
 * - Fallback behavior when Export API fails
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HubSpotClient, parseExportFile } from './client';
import { clearRateLimiterState } from './rate-limiter';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
  clearRateLimiterState();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('parseExportFile (CSV format)', () => {
  it('parses CSV format correctly', () => {
    const csv = `"Record ID","Company name","Company Domain Name"
"1","Acme Corp","acme.com"
"2","Globex","globex.com"`;

    const companies = parseExportFile(csv);

    expect(companies).not.toBeNull();
    expect(companies).toHaveLength(2);
    expect(companies![0].id).toBe('1');
    expect(companies![0].properties.name).toBe('Acme Corp');
    expect(companies![1].id).toBe('2');
    expect(companies![1].properties.domain).toBe('globex.com');
  });

  it('handles quoted fields with commas', () => {
    const csv = `"Record ID","Company name","Company Domain Name"
"1","Acme, Inc.","acme.com"`;

    const companies = parseExportFile(csv);

    expect(companies).not.toBeNull();
    expect(companies).toHaveLength(1);
    expect(companies![0].properties.name).toBe('Acme, Inc.');
  });

  it('handles escaped quotes in fields', () => {
    const csv = `"Record ID","Company name","Company Domain Name"
"1","Acme ""Best"" Corp","acme.com"`;

    const companies = parseExportFile(csv);

    expect(companies).not.toBeNull();
    expect(companies).toHaveLength(1);
    expect(companies![0].properties.name).toBe('Acme "Best" Corp');
  });

  it('returns empty array for empty string', () => {
    const companies = parseExportFile('');

    expect(companies).not.toBeNull();
    expect(companies).toHaveLength(0);
  });

  it('returns empty array for whitespace-only string', () => {
    const companies = parseExportFile('   \n\n  ');

    expect(companies).not.toBeNull();
    expect(companies).toHaveLength(0);
  });

  it('returns empty array for header-only CSV', () => {
    const csv = `"Record ID","Company name","Company Domain Name"`;

    const companies = parseExportFile(csv);

    expect(companies).not.toBeNull();
    expect(companies).toHaveLength(0);
  });

  it('returns null when Record ID column is missing', () => {
    const csv = `"Company name","Company Domain Name"
"Acme Corp","acme.com"`;

    const companies = parseExportFile(csv);

    expect(companies).toBeNull();
  });

  it('skips rows with missing Record ID value', () => {
    const csv = `"Record ID","Company name","Company Domain Name"
"1","Acme Corp","acme.com"
"","No ID Corp","noid.com"
"3","Has ID Corp","hasid.com"`;

    const companies = parseExportFile(csv);

    expect(companies).not.toBeNull();
    expect(companies).toHaveLength(2);
    expect(companies![0].id).toBe('1');
    expect(companies![1].id).toBe('3');
  });

  it('normalizes header names to property names', () => {
    const csv = `"Record ID","Company name","Company Domain Name","Annual Revenue","Number of Employees"
"1","Test","test.com","1000000","50"`;

    const companies = parseExportFile(csv);

    expect(companies).not.toBeNull();
    expect(companies![0].properties.name).toBe('Test');
    expect(companies![0].properties.domain).toBe('test.com');
    expect(companies![0].properties.annualrevenue).toBe('1000000');
    expect(companies![0].properties.numberofemployees).toBe('50');
  });

  it('handles empty field values as null', () => {
    const csv = `"Record ID","Company name","Company Domain Name"
"1","Acme Corp",""`;

    const companies = parseExportFile(csv);

    expect(companies).not.toBeNull();
    expect(companies![0].properties.domain).toBeNull();
  });

  it('extracts create and modified dates', () => {
    const csv = `"Record ID","Company name","Create Date","Last Modified Date"
"1","Acme Corp","2024-01-01 10:00","2024-06-15 14:30"`;

    const companies = parseExportFile(csv);

    expect(companies).not.toBeNull();
    expect(companies![0].createdAt).toBe('2024-01-01 10:00');
    expect(companies![0].updatedAt).toBe('2024-06-15 14:30');
  });
});

describe('exportCompanies', () => {
  it('triggers export job and polls for completion', async () => {
    const client = new HubSpotClient('test-token', 'portal-123');

    // 1. Trigger export - returns job ID
    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: new Headers({ 'X-HubSpot-RateLimit-Max': '100' }),
      json: async () => ({
        id: 'export-job-123',
      }),
    });

    // 2. First poll - still processing
    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: new Headers({ 'X-HubSpot-RateLimit-Max': '100' }),
      json: async () => ({
        status: 'PROCESSING',
      }),
    });

    // 3. Second poll - complete with download URL
    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: new Headers({ 'X-HubSpot-RateLimit-Max': '100' }),
      json: async () => ({
        status: 'COMPLETE',
        result: 'https://export-download.hubspot.com/file-123.csv',
      }),
    });

    // 4. Download CSV file
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => `"Record ID","Company name","Company Domain Name"
"1","Acme Corp","acme.com"
"2","Globex","globex.com"`,
    });

    const companies = await client.exportCompanies();

    expect(companies).not.toBeNull();
    expect(companies).toHaveLength(2);
    expect(companies![0].id).toBe('1');
    expect(companies![0].properties.name).toBe('Acme Corp');
    expect(companies![1].id).toBe('2');
    expect(companies![1].properties.domain).toBe('globex.com');
  });

  it('returns null when export job fails', async () => {
    const client = new HubSpotClient('test-token', 'portal-123');

    // Trigger export
    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: new Headers({ 'X-HubSpot-RateLimit-Max': '100' }),
      json: async () => ({
        id: 'export-job-fail',
      }),
    });

    // Poll returns FAILED status
    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: new Headers({ 'X-HubSpot-RateLimit-Max': '100' }),
      json: async () => ({
        status: 'FAILED',
      }),
    });

    const companies = await client.exportCompanies();

    expect(companies).toBeNull();
  });

  it('returns null when API call throws error', async () => {
    const client = new HubSpotClient('test-token', 'portal-123');

    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const companies = await client.exportCompanies();

    expect(companies).toBeNull();
  });

  it('handles empty export file', async () => {
    const client = new HubSpotClient('test-token', 'portal-123');

    // Trigger export
    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: new Headers({ 'X-HubSpot-RateLimit-Max': '100' }),
      json: async () => ({
        id: 'export-job-empty',
      }),
    });

    // Poll returns COMPLETE with download URL
    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: new Headers({ 'X-HubSpot-RateLimit-Max': '100' }),
      json: async () => ({
        status: 'COMPLETE',
        result: 'https://export-download.hubspot.com/empty-file.csv',
      }),
    });

    // Download empty file
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => '',
    });

    const companies = await client.exportCompanies();

    expect(companies).not.toBeNull();
    expect(companies).toHaveLength(0);
  });
});

describe('buildCompanyIndex with hasExportScope', () => {
  it('uses Export API when hasExportScope=true', async () => {
    const client = new HubSpotClient('test-token', 'portal-123');

    // Export API trigger
    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: new Headers({ 'X-HubSpot-RateLimit-Max': '100' }),
      json: async () => ({
        id: 'export-123',
      }),
    });

    // Poll returns COMPLETE with download URL
    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: new Headers({ 'X-HubSpot-RateLimit-Max': '100' }),
      json: async () => ({
        status: 'COMPLETE',
        result: 'https://export-download.hubspot.com/file.csv',
      }),
    });

    // Download CSV file
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => `"Record ID","Company name","Company Domain Name","LinkedIn Company Page"
"1","Company A","a.com","linkedin.com/company/a"`,
    });

    const index = await client.buildCompanyIndex(true);

    expect(index.totalCompanies).toBe(1);
    expect(index.domainIndex.get('a.com')).toBe('1');
    expect(index.linkedInIndex.get('linkedin.com/company/a')).toBe('1');
  });

  it('falls back to paginated when Export API fails', async () => {
    const client = new HubSpotClient('test-token', 'portal-123');

    // Export API fails
    mockFetch.mockRejectedValueOnce(new Error('Export API error'));

    // Fallback to paginated - first page
    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: new Headers({ 'X-HubSpot-RateLimit-Max': '100' }),
      json: async () => ({
        results: [
          {
            id: '1',
            properties: { name: 'Fallback Co', domain: 'fallback.com' },
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z',
          },
        ],
        paging: null,
      }),
    });

    const index = await client.buildCompanyIndex(true);

    expect(index.totalCompanies).toBe(1);
    expect(index.domainIndex.get('fallback.com')).toBe('1');
  });

  it('uses paginated approach when hasExportScope=false', async () => {
    const client = new HubSpotClient('test-token', 'portal-123');

    // Paginated API - single page
    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: new Headers({ 'X-HubSpot-RateLimit-Max': '100' }),
      json: async () => ({
        results: [
          {
            id: '1',
            properties: { name: 'Paginated Co', domain: 'paginated.com' },
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z',
          },
        ],
        paging: null,
      }),
    });

    const index = await client.buildCompanyIndex(false);

    expect(index.totalCompanies).toBe(1);
    expect(index.domainIndex.get('paginated.com')).toBe('1');

    // Verify Export API was NOT called (only paginated call)
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const callUrl = mockFetch.mock.calls[0][0];
    expect(callUrl).toContain('/crm/v3/objects/companies');
    expect(callUrl).not.toContain('/exports');
  });

  it('indexes parent-child relationships from Export API', async () => {
    const client = new HubSpotClient('test-token', 'portal-123');

    // Export API trigger
    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: new Headers({ 'X-HubSpot-RateLimit-Max': '100' }),
      json: async () => ({
        id: 'export-123',
      }),
    });

    // Poll returns COMPLETE
    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: new Headers({ 'X-HubSpot-RateLimit-Max': '100' }),
      json: async () => ({
        status: 'COMPLETE',
        result: 'https://export-download.hubspot.com/file.csv',
      }),
    });

    // Download CSV file with parent-child relationship
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => `"Record ID","Company name","Company Domain Name","Parent Company"
"1","Parent Corp","parent.com",""
"2","Child Inc","child.com","1"`,
    });

    const index = await client.buildCompanyIndex(true);

    expect(index.totalCompanies).toBe(2);
    expect(index.parentIndex.get('2')).toBe('1');
    expect(index.childSet.has('2')).toBe(true);
    expect(index.childSet.has('1')).toBe(false);
    expect(index.companiesWithParent).toBe(1);
  });
});
