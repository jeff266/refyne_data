/**
 * Schema Sync Tests
 *
 * Tests for HubSpot schema discovery and enum field validation.
 */

import { describe, it, expect, vi } from 'vitest';
import { canonicalToHubSpotProperties, buildWriteMappings } from './inverse-mapper';
import type { FieldMapping } from './types';

describe('buildWriteMappings', () => {
  it('includes validValues and canonicalToHubspotMap in mapping', () => {
    const mappings: FieldMapping[] = [{
      id: '1',
      canonicalField: 'company.industry',
      hubspotProperty: 'industry',
      direction: 'bidirectional',
      writePolicy: 'always_overwrite',
      validValues: [
        { value: 'HOSPITAL_HEALTH_CARE', label: 'Healthcare' },
        { value: 'MENTAL_HEALTH_CARE', label: 'Mental Health Care' },
      ],
      fieldType: 'select',
      canonicalToHubspotMap: {
        'Healthcare': 'HOSPITAL_HEALTH_CARE',
        'Mental Health Care': 'MENTAL_HEALTH_CARE',
      },
      isActive: true,
    }];

    const result = buildWriteMappings(mappings);

    expect(result.get('company.industry')).toEqual({
      property: 'industry',
      policy: 'always_overwrite',
      validValues: [
        { value: 'HOSPITAL_HEALTH_CARE', label: 'Healthcare' },
        { value: 'MENTAL_HEALTH_CARE', label: 'Mental Health Care' },
      ],
      fieldType: 'select',
      canonicalToHubspotMap: {
        'Healthcare': 'HOSPITAL_HEALTH_CARE',
        'Mental Health Care': 'MENTAL_HEALTH_CARE',
      },
    });
  });
});

describe('enum validation in canonicalToHubSpotProperties', () => {
  it('allows write when value is directly in valid_values', () => {
    const mappings: FieldMapping[] = [{
      id: '1',
      canonicalField: 'company.industry',
      hubspotProperty: 'industry',
      direction: 'bidirectional',
      writePolicy: 'always_overwrite',
      validValues: [
        { value: 'HOSPITAL_HEALTH_CARE', label: 'Healthcare' },
        { value: 'TECHNOLOGY', label: 'Technology' },
      ],
      fieldType: 'select',
      canonicalToHubspotMap: null,
      isActive: true,
    }];

    const record = { industry: 'HOSPITAL_HEALTH_CARE' };
    const { properties, decisions } = canonicalToHubSpotProperties(
      record,
      mappings,
      {}
    );

    expect(properties.industry).toBe('HOSPITAL_HEALTH_CARE');
    expect(decisions[0].action).toBe('write');
    expect(decisions[0].reason).toBe('always_overwrite');
  });

  it('blocks write with enum_mismatch when value not in valid_values', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const mappings: FieldMapping[] = [{
      id: '1',
      canonicalField: 'company.industry',
      hubspotProperty: 'industry',
      direction: 'bidirectional',
      writePolicy: 'always_overwrite',
      validValues: [
        { value: 'HOSPITAL_HEALTH_CARE', label: 'Healthcare' },
        { value: 'TECHNOLOGY', label: 'Technology' },
      ],
      fieldType: 'select',
      canonicalToHubspotMap: null,
      isActive: true,
    }];

    const record = { industry: 'INVALID_INDUSTRY' };
    const { properties, decisions } = canonicalToHubSpotProperties(
      record,
      mappings,
      {}
    );

    expect(properties.industry).toBeUndefined();
    expect(decisions[0].action).toBe('skip');
    expect(decisions[0].reason).toBe('enum_mismatch');
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('enum_mismatch')
    );

    warnSpy.mockRestore();
  });

  it('translates value using canonicalToHubspotMap', () => {
    const mappings: FieldMapping[] = [{
      id: '1',
      canonicalField: 'company.industry',
      hubspotProperty: 'industry',
      direction: 'bidirectional',
      writePolicy: 'always_overwrite',
      validValues: [
        { value: 'HOSPITAL_HEALTH_CARE', label: 'Healthcare' },
        { value: 'MENTAL_HEALTH_CARE', label: 'Mental Health Care' },
      ],
      fieldType: 'select',
      canonicalToHubspotMap: {
        'Healthcare': 'HOSPITAL_HEALTH_CARE',
        'Mental Health Care': 'MENTAL_HEALTH_CARE',
      },
      isActive: true,
    }];

    const record = { industry: 'Healthcare' };
    const { properties, decisions } = canonicalToHubSpotProperties(
      record,
      mappings,
      {}
    );

    expect(properties.industry).toBe('HOSPITAL_HEALTH_CARE');
    expect(decisions[0].action).toBe('write');
    expect(decisions[0].reason).toBe('enum_translated');
    expect(decisions[0].translatedValue).toBe('HOSPITAL_HEALTH_CARE');
  });

  it('translates value by matching label (case-insensitive)', () => {
    const mappings: FieldMapping[] = [{
      id: '1',
      canonicalField: 'company.industry',
      hubspotProperty: 'industry',
      direction: 'bidirectional',
      writePolicy: 'always_overwrite',
      validValues: [
        { value: 'HOSPITAL_HEALTH_CARE', label: 'Healthcare' },
        { value: 'TECHNOLOGY', label: 'Technology' },
      ],
      fieldType: 'select',
      canonicalToHubspotMap: null,
      isActive: true,
    }];

    // Canonical value matches label (different case)
    const record = { industry: 'healthcare' };
    const { properties, decisions } = canonicalToHubSpotProperties(
      record,
      mappings,
      {}
    );

    expect(properties.industry).toBe('HOSPITAL_HEALTH_CARE');
    expect(decisions[0].action).toBe('write');
    expect(decisions[0].reason).toBe('enum_translated');
    expect(decisions[0].translatedValue).toBe('HOSPITAL_HEALTH_CARE');
  });

  it('respects write policy even with enum translation', () => {
    const mappings: FieldMapping[] = [{
      id: '1',
      canonicalField: 'company.industry',
      hubspotProperty: 'industry',
      direction: 'bidirectional',
      writePolicy: 'never_overwrite',
      validValues: [
        { value: 'HOSPITAL_HEALTH_CARE', label: 'Healthcare' },
      ],
      fieldType: 'select',
      canonicalToHubspotMap: {
        'Healthcare': 'HOSPITAL_HEALTH_CARE',
      },
      isActive: true,
    }];

    const record = { industry: 'Healthcare' };
    const { properties, decisions } = canonicalToHubSpotProperties(
      record,
      mappings,
      { industry: 'TECHNOLOGY' } // HubSpot has a different value
    );

    expect(properties.industry).toBeUndefined();
    expect(decisions[0].action).toBe('skip');
    expect(decisions[0].reason).toBe('never_overwrite');
  });

  it('blocks write when canonicalToHubspotMap value not in valid_values', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const mappings: FieldMapping[] = [{
      id: '1',
      canonicalField: 'company.industry',
      hubspotProperty: 'industry',
      direction: 'bidirectional',
      writePolicy: 'always_overwrite',
      validValues: [
        { value: 'HOSPITAL_HEALTH_CARE', label: 'Healthcare' },
      ],
      fieldType: 'select',
      canonicalToHubspotMap: {
        // Map exists but points to invalid value
        'Healthcare': 'INVALID_MAPPED_VALUE',
      },
      isActive: true,
    }];

    const record = { industry: 'Healthcare' };
    const { properties, decisions } = canonicalToHubSpotProperties(
      record,
      mappings,
      {}
    );

    // Should fall through to enum_mismatch since mapped value isn't valid
    expect(properties.industry).toBeUndefined();
    expect(decisions[0].action).toBe('skip');
    expect(decisions[0].reason).toBe('enum_mismatch');

    warnSpy.mockRestore();
  });

  it('allows write without enum check when validValues is null', () => {
    const mappings: FieldMapping[] = [{
      id: '1',
      canonicalField: 'company.industry',
      hubspotProperty: 'industry',
      direction: 'bidirectional',
      writePolicy: 'always_overwrite',
      validValues: null, // No enum validation
      fieldType: null,
      canonicalToHubspotMap: null,
      isActive: true,
    }];

    const record = { industry: 'Any Value' };
    const { properties, decisions } = canonicalToHubSpotProperties(
      record,
      mappings,
      {}
    );

    expect(properties.industry).toBe('Any Value');
    expect(decisions[0].action).toBe('write');
    expect(decisions[0].reason).toBe('always_overwrite');
  });

  it('allows write when validValues is empty array', () => {
    const mappings: FieldMapping[] = [{
      id: '1',
      canonicalField: 'company.industry',
      hubspotProperty: 'industry',
      direction: 'bidirectional',
      writePolicy: 'always_overwrite',
      validValues: [], // Empty array - no enum validation
      fieldType: 'select',
      canonicalToHubspotMap: null,
      isActive: true,
    }];

    const record = { industry: 'Any Value' };
    const { properties, decisions } = canonicalToHubSpotProperties(
      record,
      mappings,
      {}
    );

    expect(properties.industry).toBe('Any Value');
    expect(decisions[0].action).toBe('write');
    expect(decisions[0].reason).toBe('always_overwrite');
  });
});

describe('canonical_to_hubspot_map lookup', () => {
  it('uses exact match from canonical_to_hubspot_map first', () => {
    const mappings: FieldMapping[] = [{
      id: '1',
      canonicalField: 'company.industry',
      hubspotProperty: 'industry',
      direction: 'bidirectional',
      writePolicy: 'always_overwrite',
      validValues: [
        { value: 'HOSPITAL_HEALTH_CARE', label: 'Hospital & Health Care' },
        { value: 'Healthcare', label: 'Healthcare' }, // Both exist
      ],
      fieldType: 'select',
      canonicalToHubspotMap: {
        'Healthcare': 'HOSPITAL_HEALTH_CARE', // Map to internal value
      },
      isActive: true,
    }];

    const record = { industry: 'Healthcare' };
    const { properties } = canonicalToHubSpotProperties(
      record,
      mappings,
      {}
    );

    // Should use the mapped value, not the direct match
    expect(properties.industry).toBe('HOSPITAL_HEALTH_CARE');
  });

  it('falls back to direct value match if not in canonicalToHubspotMap', () => {
    const mappings: FieldMapping[] = [{
      id: '1',
      canonicalField: 'company.industry',
      hubspotProperty: 'industry',
      direction: 'bidirectional',
      writePolicy: 'always_overwrite',
      validValues: [
        { value: 'TECHNOLOGY', label: 'Technology' },
        { value: 'HOSPITAL_HEALTH_CARE', label: 'Healthcare' },
      ],
      fieldType: 'select',
      canonicalToHubspotMap: {
        'Healthcare': 'HOSPITAL_HEALTH_CARE', // Only Healthcare is mapped
      },
      isActive: true,
    }];

    const record = { industry: 'TECHNOLOGY' }; // Not in map, but direct value match
    const { properties, decisions } = canonicalToHubSpotProperties(
      record,
      mappings,
      {}
    );

    expect(properties.industry).toBe('TECHNOLOGY');
    expect(decisions[0].action).toBe('write');
    expect(decisions[0].reason).toBe('always_overwrite'); // No translation needed
  });
});
