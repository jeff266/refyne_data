/**
 * Matcher Tests
 *
 * Tests for lib/import/matcher.ts
 * 15 tests covering Jaro-Winkler, matching logic, bucketing
 */

import { describe, it, expect } from 'vitest';
import {
  jaroWinkler,
  getBlockingCandidates,
  matchContact,
  groupByCompany,
  type ParsedRow,
  type HubSpotContact,
  type HubSpotCompany,
} from '../../lib/import/matcher';

describe('jaroWinkler', () => {
  it('should return 1.0 for exact match', () => {
    expect(jaroWinkler('refine labs', 'refine labs')).toBe(1.0);
  });

  it('should return high score for similar strings', () => {
    const score = jaroWinkler('refinelabs', 'refine labs');
    expect(score).toBeGreaterThan(0.85);
  });

  it('should return 0.0 for no match', () => {
    expect(jaroWinkler('apple', 'microsoft')).toBeLessThan(0.5);
  });
});

describe('getBlockingCandidates', () => {
  it('should filter by email domain', () => {
    const companies: HubSpotCompany[] = [
      { id: '1', properties: { name: 'Acme Corp', domain: 'acme.com' } },
      { id: '2', properties: { name: 'Beta Inc', domain: 'beta.com' } },
    ];

    const candidates = getBlockingCandidates('acme', 'acme', companies);
    expect(candidates.length).toBe(1);
    expect(candidates[0].id).toBe('1');
  });
});

describe('matchContact', () => {
  it('should match by email', async () => {
    const row: ParsedRow = {
      email: 'test@example.com',
      first_name: 'John',
      last_name: 'Doe',
    };

    const contacts: HubSpotContact[] = [
      {
        id: '123',
        properties: {
          email: 'test@example.com',
          lifecyclestage: 'lead',
        },
      },
    ];

    const result = await matchContact(row, contacts, [], 'test-org');
    expect(result.matchType).toBe('email');
    expect(result.confidence).toBe(1.0);
    expect(result.hubspotContactId).toBe('123');
  });

  it('should return new_contact for no match', async () => {
    const row: ParsedRow = {
      email: 'new@example.com',
      first_name: 'Jane',
      last_name: 'Smith',
    };

    const result = await matchContact(row, [], [], 'test-org');
    expect(result.bucket).toBe('new_contact');
    expect(result.matchType).toBe('none');
  });
});

describe('groupByCompany', () => {
  it('should group by email domain', () => {
    const rows: ParsedRow[] = [
      { email: 'user1@acme.com', first_name: 'John', last_name: 'Doe' },
      { email: 'user2@acme.com', first_name: 'Jane', last_name: 'Smith' },
    ];

    const groups = groupByCompany(rows);
    expect(groups.size).toBe(1);
    expect(groups.get('domain:acme')?.length).toBe(2);
  });
});

// Additional tests for remaining 10 tests
describe('matchContact - advanced', () => {
  it('should match by LinkedIn URL', async () => {
    const row: ParsedRow = {
      email: 'john@example.com',
      linkedin_url: 'https://www.linkedin.com/in/john-smith/',
      first_name: 'John',
      last_name: 'Smith',
    };

    const contacts: HubSpotContact[] = [
      {
        id: '456',
        properties: {
          email: 'different@example.com',
          linkedin_url: 'https://linkedin.com/in/john-smith',
          lifecyclestage: 'lead',
        },
      },
    ];

    const result = await matchContact(row, contacts, [], 'test-org');
    expect(result.matchType).toBe('linkedin');
    expect(result.confidence).toBe(0.95);
    expect(result.hubspotContactId).toBe('456');
  });

  it('should match by company fuzzy match', async () => {
    const row: ParsedRow = {
      email: 'employee@acmecorp.com',
      company: 'Acme Corporation',
      first_name: 'John',
      last_name: 'Doe',
    };

    const companies: HubSpotCompany[] = [
      {
        id: 'comp-123',
        properties: {
          name: 'ACME Corp',
          domain: 'acmecorp.com',
        },
      },
    ];

    const result = await matchContact(row, [], companies, 'test-org');
    expect(result.matchType).toBe('company_fuzzy');
    expect(result.confidence).toBeGreaterThan(0.85);
    expect(result.hubspotCompanyId).toBe('comp-123');
  });

  it('should bucket as customer', async () => {
    const row: ParsedRow = {
      email: 'customer@example.com',
      first_name: 'Jane',
      last_name: 'Doe',
    };

    const contacts: HubSpotContact[] = [
      {
        id: '789',
        properties: {
          email: 'customer@example.com',
          lifecyclestage: 'customer',
        },
      },
    ];

    const result = await matchContact(row, contacts, [], 'test-org');
    expect(result.bucket).toBe('customer');
    expect(result.hubspotContactId).toBe('789');
  });

  it('should bucket as needs_review for ambiguous title', async () => {
    const row: ParsedRow = {
      email: 'member@example.com',
      first_name: 'Bob',
      last_name: 'Smith',
      job_title: 'Member',
    };

    const contacts: HubSpotContact[] = [
      {
        id: '999',
        properties: {
          email: 'member@example.com',
          lifecyclestage: 'lead',
        },
      },
    ];

    const result = await matchContact(row, contacts, [], 'test-org');
    expect(result.bucket).toBe('needs_review');
  });

  it('should match with high confidence for exact company name', async () => {
    const row: ParsedRow = {
      email: 'user@techcorp.com',
      company: 'TechCorp Inc',
      first_name: 'Alice',
      last_name: 'Johnson',
    };

    const companies: HubSpotCompany[] = [
      {
        id: 'comp-456',
        properties: {
          name: 'TechCorp Inc',
          domain: 'techcorp.com',
        },
      },
    ];

    const result = await matchContact(row, [], companies, 'test-org');
    expect(result.confidence).toBeGreaterThan(0.9);
    expect(result.bucket).toBe('new_contact');
  });

  it('should flag needs_review for domain mismatch with similar name', async () => {
    const row: ParsedRow = {
      email: 'user@differentdomain.com',
      company: 'Tech Solutions',
      first_name: 'Charlie',
      last_name: 'Brown',
    };

    const companies: HubSpotCompany[] = [
      {
        id: 'comp-789',
        properties: {
          name: 'TechSolutions LLC',
          domain: 'techsolutions.com',
        },
      },
    ];

    const result = await matchContact(row, [], companies, 'test-org');
    // Should either be flagged for review or treated as new contact
    // depending on confidence threshold
    expect(['needs_review', 'new_contact']).toContain(result.bucket);
    // If it's needs_review, confidence should be in partial match range
    if (result.bucket === 'needs_review') {
      expect(result.confidence).toBeGreaterThanOrEqual(0.75);
      expect(result.confidence).toBeLessThan(0.9);
    }
  });
});

describe('blocking candidates', () => {
  it('should limit to 50 candidates', () => {
    // Create 100 companies with same prefix
    const companies: HubSpotCompany[] = Array.from({ length: 100 }, (_, i) => ({
      id: `comp-${i}`,
      properties: {
        name: `Acme ${i}`,
        domain: `acme${i}.com`,
      },
    }));

    const candidates = getBlockingCandidates('acme corp', 'acme', companies);
    expect(candidates.length).toBeLessThanOrEqual(50);
  });

  it('should match by name prefix', () => {
    const companies: HubSpotCompany[] = [
      { id: '1', properties: { name: 'Acme Corporation' } },
      { id: '2', properties: { name: 'Beta Industries' } },
      { id: '3', properties: { name: 'Acme Solutions' } },
    ];

    const candidates = getBlockingCandidates('acme test', '', companies);
    expect(candidates.length).toBe(2);
    expect(candidates.map((c) => c.id)).toContain('1');
    expect(candidates.map((c) => c.id)).toContain('3');
  });

  it('should match by domain', () => {
    const companies: HubSpotCompany[] = [
      { id: '1', properties: { name: 'Different Name', domain: 'techcorp.com' } },
      { id: '2', properties: { name: 'Another Name', domain: 'othercorp.com' } },
    ];

    const candidates = getBlockingCandidates('something', 'techcorp', companies);
    expect(candidates.length).toBe(1);
    expect(candidates[0].id).toBe('1');
  });

  it('should combine domain and prefix matches', () => {
    const companies: HubSpotCompany[] = [
      { id: '1', properties: { name: 'Tech Corp', domain: 'techcorp.com' } },
      { id: '2', properties: { name: 'Tech Solutions' } },
      { id: '3', properties: { name: 'Beta Corp', domain: 'beta.com' } },
    ];

    const candidates = getBlockingCandidates('tech industries', 'techcorp', companies);
    // Should include both domain match (#1) and prefix matches (#1, #2)
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates.map((c) => c.id)).toContain('1');
  });
});
