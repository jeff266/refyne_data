/**
 * HubSpot Field Mapper Tests
 */

import { describe, it, expect } from 'vitest';
import {
  hubspotToRawRecord,
  hubspotToRawRecords,
  getPropertiesToFetch,
  getMappingSummary,
} from './field-mapper';
import type { HubSpotCompany, FieldMapping } from './types';
import { DEFAULT_FIELD_MAPPINGS } from './types';

// Sample HubSpot company data (similar to Frontera portal data)
const sampleHubSpotCompany: HubSpotCompany = {
  id: '123456789',
  properties: {
    name: 'Acme Corporation',
    domain: 'acme.com',
    industry: 'Software',
    annualrevenue: '5000000',
    numberofemployees: '150',
    phone: '+1-555-123-4567',
    city: 'San Francisco',
    state: 'CA',
    country: 'US',
    zip: '94105',
    address: '123 Main St',
    linkedin_company_page: 'https://linkedin.com/company/acme',
    description: 'Leading provider of widgets',
    website: 'https://acme.com',
    founded_year: '2015',
  },
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-06-01T00:00:00Z',
};

const defaultMappings: FieldMapping[] = DEFAULT_FIELD_MAPPINGS.map((m, i) => ({
  id: `default-${i}`,
  canonicalField: m.canonicalField,
  hubspotProperty: m.hubspotProperty,
  direction: 'bidirectional' as const,
  writePolicy: 'overwrite_if_blank_or_ours' as const,
  validValues: null,
  isActive: true,
}));

describe('hubspotToRawRecord', () => {
  it('maps HubSpot company to RawRecord with default mappings', () => {
    const record = hubspotToRawRecord(sampleHubSpotCompany, defaultMappings);

    expect(record._id).toBe('123456789');
    expect(record._hubspot_id).toBe('123456789');
    expect(record._label).toBe('Acme Corporation');
    expect(record.name).toBe('Acme Corporation');
    expect(record.domain).toBe('acme.com');
    expect(record.industry).toBe('Software');
    expect(record.annual_revenue).toBe(5000000);
    expect(record.employee_count).toBe(150);
    expect(record.phone).toBe('+1-555-123-4567');
    expect(record.hq_city).toBe('San Francisco');
    expect(record.hq_state).toBe('CA');
    expect(record.hq_country).toBe('US');
    expect(record.hq_postal_code).toBe('94105');
    expect(record.hq_address).toBe('123 Main St');
    expect(record.linkedin_url).toBe('https://linkedin.com/company/acme');
    expect(record.description).toBe('Leading provider of widgets');
    expect(record.website).toBe('https://acme.com');
    expect(record.founded_year).toBe(2015);
  });

  it('handles null properties gracefully', () => {
    const companyWithNulls: HubSpotCompany = {
      id: '999',
      properties: {
        name: 'Minimal Corp',
        domain: 'minimal.com',
        industry: null,
        annualrevenue: null,
        numberofemployees: null,
      },
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    };

    const record = hubspotToRawRecord(companyWithNulls, defaultMappings);

    expect(record._id).toBe('999');
    expect(record.name).toBe('Minimal Corp');
    expect(record.domain).toBe('minimal.com');
    expect(record.industry).toBeUndefined();
    expect(record.annual_revenue).toBeUndefined();
    expect(record.employee_count).toBeUndefined();
  });

  it('parses numeric values from strings', () => {
    const companyWithStringNumbers: HubSpotCompany = {
      id: '888',
      properties: {
        name: 'Numbers Inc',
        domain: 'numbers.com',
        annualrevenue: '$10,000,000',
        numberofemployees: '500',
        founded_year: '2010',
      },
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    };

    const record = hubspotToRawRecord(companyWithStringNumbers, defaultMappings);

    expect(record.annual_revenue).toBe(10000000);
    expect(record.employee_count).toBe(500);
    expect(record.founded_year).toBe(2010);
  });

  it('uses domain as label when name is missing', () => {
    const companyWithoutName: HubSpotCompany = {
      id: '777',
      properties: {
        name: null,
        domain: 'noname.com',
      },
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    };

    const record = hubspotToRawRecord(companyWithoutName, defaultMappings);

    expect(record._label).toBe('noname.com');
  });

  it('includes unmapped properties with hubspot_ prefix', () => {
    const companyWithCustomProps: HubSpotCompany = {
      id: '666',
      properties: {
        name: 'Custom Corp',
        domain: 'custom.com',
        custom_score: '85',
        my_custom_field: 'custom value',
      },
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    };

    const record = hubspotToRawRecord(companyWithCustomProps, defaultMappings);

    expect(record.hubspot_custom_score).toBe('85');
    expect(record.hubspot_my_custom_field).toBe('custom value');
  });
});

describe('hubspotToRawRecords', () => {
  it('maps multiple companies', () => {
    const companies: HubSpotCompany[] = [
      sampleHubSpotCompany,
      {
        id: '222',
        properties: {
          name: 'Beta Inc',
          domain: 'beta.com',
        },
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      },
    ];

    const records = hubspotToRawRecords(companies, defaultMappings);

    expect(records).toHaveLength(2);
    expect(records[0]._id).toBe('123456789');
    expect(records[0].name).toBe('Acme Corporation');
    expect(records[1]._id).toBe('222');
    expect(records[1].name).toBe('Beta Inc');
  });
});

describe('getPropertiesToFetch', () => {
  it('returns all active read/bidirectional properties', () => {
    const properties = getPropertiesToFetch(defaultMappings);

    expect(properties).toContain('name');
    expect(properties).toContain('domain');
    expect(properties).toContain('industry');
    expect(properties).toContain('annualrevenue');
    expect(properties).toContain('numberofemployees');
    expect(properties).toContain('phone');
    expect(properties).toContain('city');
    expect(properties).toContain('state');
    expect(properties).toContain('country');
    expect(properties).toContain('zip');
    expect(properties).toContain('address');
    expect(properties).toContain('linkedin_company_page');
    expect(properties).toContain('description');
  });

  it('excludes inactive mappings', () => {
    const mappingsWithInactive = [
      ...defaultMappings.slice(0, 3),
      {
        ...defaultMappings[3],
        isActive: false,
      },
      ...defaultMappings.slice(4),
    ];

    const properties = getPropertiesToFetch(mappingsWithInactive);

    // The inactive mapping (company.revenue -> annualrevenue) should be excluded
    expect(properties).not.toContain('annualrevenue');
  });

  it('excludes write-only mappings', () => {
    const mappingsWithWriteOnly = [
      ...defaultMappings.slice(0, 2),
      {
        ...defaultMappings[2],
        direction: 'write' as const,
      },
      ...defaultMappings.slice(3),
    ];

    const properties = getPropertiesToFetch(mappingsWithWriteOnly);

    // The write-only mapping (company.industry -> industry) should be excluded
    expect(properties).not.toContain('industry');
  });
});

describe('getMappingSummary', () => {
  it('returns summary of mapping operation', () => {
    const companies = [sampleHubSpotCompany];
    const summary = getMappingSummary(companies, defaultMappings);

    expect(summary.totalRecords).toBe(1);
    expect(summary.mappedFields).toContain('name');
    expect(summary.mappedFields).toContain('domain');
    expect(summary.mappedFields).toContain('industry');
    expect(summary.sampleRecord).toBeDefined();
    expect(summary.sampleRecord?._id).toBe('123456789');
  });

  it('identifies unmapped HubSpot properties', () => {
    const companyWithCustomProps: HubSpotCompany = {
      id: '555',
      properties: {
        name: 'Test Corp',
        domain: 'test.com',
        custom_field_1: 'value1',
        custom_field_2: 'value2',
      },
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    };

    const summary = getMappingSummary([companyWithCustomProps], defaultMappings);

    expect(summary.unmappedHubSpotProperties).toContain('custom_field_1');
    expect(summary.unmappedHubSpotProperties).toContain('custom_field_2');
  });

  it('handles empty companies array', () => {
    const summary = getMappingSummary([], defaultMappings);

    expect(summary.totalRecords).toBe(0);
    expect(summary.mappedFields).toHaveLength(0);
    expect(summary.unmappedHubSpotProperties).toHaveLength(0);
    expect(summary.sampleRecord).toBeNull();
  });
});
