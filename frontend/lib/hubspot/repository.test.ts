/**
 * HubSpot Repository Tests
 *
 * Tests for database operations with mocked Supabase client.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DEFAULT_FIELD_MAPPINGS } from './types';

// Mock the supabase module
vi.mock('../db/supabase', () => ({
  supabase: null,
  isSupabaseConfigured: () => false,
}));

// Import after mocking
import {
  getConnection,
  getConnectionByPortalId,
  getFieldMappings,
} from './repository';

describe('repository with Supabase not configured', () => {
  describe('getConnection', () => {
    it('returns null when Supabase is not configured', async () => {
      const result = await getConnection('test-org');
      expect(result).toBeNull();
    });
  });

  describe('getConnectionByPortalId', () => {
    it('returns null when Supabase is not configured', async () => {
      const result = await getConnectionByPortalId('12345678');
      expect(result).toBeNull();
    });
  });

  describe('getFieldMappings', () => {
    it('returns default mappings when Supabase is not configured', async () => {
      const mappings = await getFieldMappings('test-org');

      expect(mappings).toHaveLength(DEFAULT_FIELD_MAPPINGS.length);

      // Check that all default mappings are present
      const canonicalFields = mappings.map(m => m.canonicalField);
      expect(canonicalFields).toContain('company.name');
      expect(canonicalFields).toContain('company.domain');
      expect(canonicalFields).toContain('company.industry');
      expect(canonicalFields).toContain('company.revenue');
      expect(canonicalFields).toContain('company.employees');
      expect(canonicalFields).toContain('company.phone');
      expect(canonicalFields).toContain('company.address.country');
      expect(canonicalFields).toContain('company.address.state');
      expect(canonicalFields).toContain('company.address.city');
      expect(canonicalFields).toContain('company.address.street');
      expect(canonicalFields).toContain('company.address.postal_code');
      expect(canonicalFields).toContain('company.linkedin_url');
    });

    it('default mappings have correct HubSpot properties', async () => {
      const mappings = await getFieldMappings('test-org');

      const nameMapping = mappings.find(m => m.canonicalField === 'company.name');
      expect(nameMapping?.hubspotProperty).toBe('name');

      const domainMapping = mappings.find(m => m.canonicalField === 'company.domain');
      expect(domainMapping?.hubspotProperty).toBe('domain');

      const revenueMapping = mappings.find(m => m.canonicalField === 'company.revenue');
      expect(revenueMapping?.hubspotProperty).toBe('annualrevenue');

      const employeesMapping = mappings.find(m => m.canonicalField === 'company.employees');
      expect(employeesMapping?.hubspotProperty).toBe('numberofemployees');

      const postalCodeMapping = mappings.find(m => m.canonicalField === 'company.address.postal_code');
      expect(postalCodeMapping?.hubspotProperty).toBe('zip');
    });

    it('default mappings have correct defaults for direction and policy', async () => {
      const mappings = await getFieldMappings('test-org');

      for (const mapping of mappings) {
        expect(mapping.direction).toBe('bidirectional');
        expect(mapping.writePolicy).toBe('overwrite_if_blank_or_ours');
        expect(mapping.isActive).toBe(true);
        expect(mapping.validValues).toBeNull();
      }
    });
  });
});

describe('DEFAULT_FIELD_MAPPINGS', () => {
  it('covers all required canonical fields', () => {
    const canonicalFields = DEFAULT_FIELD_MAPPINGS.map(m => m.canonicalField);

    // Core identifiers
    expect(canonicalFields).toContain('company.name');
    expect(canonicalFields).toContain('company.domain');

    // Firmographics
    expect(canonicalFields).toContain('company.industry');
    expect(canonicalFields).toContain('company.revenue');
    expect(canonicalFields).toContain('company.employees');

    // Contact
    expect(canonicalFields).toContain('company.phone');

    // Location
    expect(canonicalFields).toContain('company.address.country');
    expect(canonicalFields).toContain('company.address.state');
    expect(canonicalFields).toContain('company.address.city');
    expect(canonicalFields).toContain('company.address.street');
    expect(canonicalFields).toContain('company.address.postal_code');

    // Additional
    expect(canonicalFields).toContain('company.linkedin_url');
    expect(canonicalFields).toContain('company.description');
    expect(canonicalFields).toContain('company.website');
    expect(canonicalFields).toContain('company.founded_year');
  });

  it('maps to correct HubSpot properties', () => {
    const mappingLookup = Object.fromEntries(
      DEFAULT_FIELD_MAPPINGS.map(m => [m.canonicalField, m.hubspotProperty])
    );

    expect(mappingLookup['company.name']).toBe('name');
    expect(mappingLookup['company.domain']).toBe('domain');
    expect(mappingLookup['company.industry']).toBe('industry');
    expect(mappingLookup['company.revenue']).toBe('annualrevenue');
    expect(mappingLookup['company.employees']).toBe('numberofemployees');
    expect(mappingLookup['company.phone']).toBe('phone');
    expect(mappingLookup['company.address.country']).toBe('country');
    expect(mappingLookup['company.address.state']).toBe('state');
    expect(mappingLookup['company.address.city']).toBe('city');
    expect(mappingLookup['company.address.street']).toBe('address');
    expect(mappingLookup['company.address.postal_code']).toBe('zip');
    expect(mappingLookup['company.linkedin_url']).toBe('linkedin_company_page');
    expect(mappingLookup['company.description']).toBe('description');
    expect(mappingLookup['company.website']).toBe('website');
    expect(mappingLookup['company.founded_year']).toBe('founded_year');
  });
});
