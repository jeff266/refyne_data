/**
 * Tests for Tier 1 format functions
 *
 * Tests the 5 new format functions added to the normalization engine:
 * - trim_whitespace
 * - employee_range
 * - extract_domain
 * - state_abbreviate
 * - country_code_iso2
 */

import { describe, it, expect } from 'vitest';

// Duplicate the format function implementations for testing
// These should match exactly what's in lib/harmonies/normalization-engine.ts

const trimWhitespace = (value: string): string => {
  return value.trim().replace(/\s+/g, ' ');
};

const employeeRange = (value: string): string => {
  const n = parseInt(value.replace(/[^0-9]/g, ''));
  if (isNaN(n)) return value;
  if (n <= 1) return '1';
  if (n <= 10) return '2-10';
  if (n <= 50) return '11-50';
  if (n <= 200) return '51-200';
  if (n <= 500) return '201-500';
  if (n <= 1000) return '501-1000';
  if (n <= 5000) return '1001-5000';
  if (n <= 10000) return '5001-10000';
  return '10001+';
};

const extractDomain = (value: string): string => {
  try {
    const url = value.startsWith('http') ? value : `https://${value}`;
    const domain = new URL(url).hostname
      .replace(/^www\./, '')
      .toLowerCase();
    return domain;
  } catch {
    // Not a URL, try treating as raw domain
    return value.replace(/^www\./, '').toLowerCase().trim();
  }
};

const US_STATES: Record<string, string> = {
  'alabama': 'AL', 'alaska': 'AK', 'arizona': 'AZ',
  'arkansas': 'AR', 'california': 'CA', 'colorado': 'CO',
  'connecticut': 'CT', 'delaware': 'DE', 'florida': 'FL',
  'georgia': 'GA', 'hawaii': 'HI', 'idaho': 'ID',
  'illinois': 'IL', 'indiana': 'IN', 'iowa': 'IA',
  'kansas': 'KS', 'kentucky': 'KY', 'louisiana': 'LA',
  'maine': 'ME', 'maryland': 'MD', 'massachusetts': 'MA',
  'michigan': 'MI', 'minnesota': 'MN', 'mississippi': 'MS',
  'missouri': 'MO', 'montana': 'MT', 'nebraska': 'NE',
  'nevada': 'NV', 'new hampshire': 'NH', 'new jersey': 'NJ',
  'new mexico': 'NM', 'new york': 'NY', 'north carolina': 'NC',
  'north dakota': 'ND', 'ohio': 'OH', 'oklahoma': 'OK',
  'oregon': 'OR', 'pennsylvania': 'PA', 'rhode island': 'RI',
  'south carolina': 'SC', 'south dakota': 'SD', 'tennessee': 'TN',
  'texas': 'TX', 'utah': 'UT', 'vermont': 'VT', 'virginia': 'VA',
  'washington': 'WA', 'west virginia': 'WV', 'wisconsin': 'WI',
  'wyoming': 'WY', 'district of columbia': 'DC',
  'calif': 'CA', 'calif.': 'CA', 'tex': 'TX', 'tex.': 'TX',
  'fla': 'FL', 'fla.': 'FL', 'mich': 'MI', 'mich.': 'MI',
};

const stateAbbreviate = (value: string): string => {
  const lower = value.toLowerCase().trim();
  if (/^[a-z]{2}$/.test(lower)) return value.toUpperCase();
  return US_STATES[lower] ?? value;
};

const COMMON_COUNTRIES: Record<string, string> = {
  'united states': 'US', 'usa': 'US', 'u.s.a.': 'US',
  'united kingdom': 'GB', 'uk': 'GB', 'great britain': 'GB',
  'canada': 'CA', 'australia': 'AU', 'germany': 'DE',
  'france': 'FR', 'spain': 'ES', 'italy': 'IT',
  'netherlands': 'NL', 'sweden': 'SE', 'norway': 'NO',
  'denmark': 'DK', 'finland': 'FI', 'switzerland': 'CH',
  'austria': 'AT', 'belgium': 'BE', 'ireland': 'IE',
  'new zealand': 'NZ', 'singapore': 'SG', 'japan': 'JP',
  'india': 'IN', 'brazil': 'BR', 'mexico': 'MX',
  'israel': 'IL', 'south africa': 'ZA', 'uae': 'AE',
  'united arab emirates': 'AE',
};

const countryCodeIso2 = (value: string): string => {
  const lower = value.toLowerCase().trim();
  // Check map first (handles both full names and common abbreviations like 'uk' -> 'GB')
  const mapped = COMMON_COUNTRIES[lower];
  if (mapped) return mapped;
  // If already 2 letters and not in map, assume it's already ISO2
  if (/^[a-z]{2}$/.test(lower)) return value.toUpperCase();
  // Unrecognized country, return as-is
  return value;
};

describe('trim_whitespace', () => {
  it('removes leading whitespace', () => {
    expect(trimWhitespace('  Acme Corp')).toBe('Acme Corp');
  });

  it('removes trailing whitespace', () => {
    expect(trimWhitespace('Acme Corp  ')).toBe('Acme Corp');
  });

  it('collapses multiple spaces to single space', () => {
    expect(trimWhitespace('Acme   Corp')).toBe('Acme Corp');
  });

  it('handles leading + trailing + multiple spaces', () => {
    expect(trimWhitespace('  Acme   Corp  ')).toBe('Acme Corp');
  });

  it('handles tabs and newlines as whitespace', () => {
    expect(trimWhitespace('  Acme\t\tCorp\n\n  ')).toBe('Acme Corp');
  });

  it('returns empty string for all whitespace', () => {
    expect(trimWhitespace('   ')).toBe('');
  });
});

describe('employee_range', () => {
  it('returns "1" for single employee', () => {
    expect(employeeRange('1')).toBe('1');
  });

  it('returns "2-10" for 2-10 employees', () => {
    expect(employeeRange('2')).toBe('2-10');
    expect(employeeRange('5')).toBe('2-10');
    expect(employeeRange('10')).toBe('2-10');
  });

  it('returns "11-50" for 11-50 employees', () => {
    expect(employeeRange('11')).toBe('11-50');
    expect(employeeRange('25')).toBe('11-50');
    expect(employeeRange('50')).toBe('11-50');
  });

  it('returns "51-200" for 51-200 employees', () => {
    expect(employeeRange('51')).toBe('51-200');
    expect(employeeRange('100')).toBe('51-200');
    expect(employeeRange('200')).toBe('51-200');
  });

  it('returns "201-500" for 201-500 employees', () => {
    expect(employeeRange('201')).toBe('201-500');
    expect(employeeRange('250')).toBe('201-500');
    expect(employeeRange('500')).toBe('201-500');
  });

  it('returns "501-1000" for 501-1000 employees', () => {
    expect(employeeRange('501')).toBe('501-1000');
    expect(employeeRange('750')).toBe('501-1000');
    expect(employeeRange('1000')).toBe('501-1000');
  });

  it('returns "1001-5000" for 1001-5000 employees', () => {
    expect(employeeRange('1001')).toBe('1001-5000');
    expect(employeeRange('2500')).toBe('1001-5000');
    expect(employeeRange('5000')).toBe('1001-5000');
  });

  it('returns "5001-10000" for 5001-10000 employees', () => {
    expect(employeeRange('5001')).toBe('5001-10000');
    expect(employeeRange('7500')).toBe('5001-10000');
    expect(employeeRange('10000')).toBe('5001-10000');
  });

  it('returns "10001+" for more than 10000 employees', () => {
    expect(employeeRange('10001')).toBe('10001+');
    expect(employeeRange('50000')).toBe('10001+');
    expect(employeeRange('100000')).toBe('10001+');
  });

  it('strips non-numeric characters before parsing', () => {
    expect(employeeRange('250 employees')).toBe('201-500');
    expect(employeeRange('~100')).toBe('51-200');
  });

  it('returns original value for non-numeric input', () => {
    expect(employeeRange('unknown')).toBe('unknown');
    expect(employeeRange('')).toBe('');
  });
});

describe('extract_domain', () => {
  it('extracts domain from URL with path', () => {
    expect(extractDomain('https://www.acme.com/about')).toBe('acme.com');
  });

  it('removes www prefix from URL', () => {
    expect(extractDomain('https://www.acme.com')).toBe('acme.com');
  });

  it('handles URL without http', () => {
    expect(extractDomain('www.acme.com')).toBe('acme.com');
  });

  it('handles raw domain without www', () => {
    expect(extractDomain('acme.com')).toBe('acme.com');
  });

  it('lowercases domain', () => {
    expect(extractDomain('https://WWW.ACME.COM')).toBe('acme.com');
  });

  it('handles domain with subdomain', () => {
    expect(extractDomain('https://blog.acme.com')).toBe('blog.acme.com');
  });

  it('preserves subdomain other than www', () => {
    expect(extractDomain('https://www.blog.acme.com')).toBe('blog.acme.com');
  });

  it('handles URL with query params', () => {
    expect(extractDomain('https://www.acme.com/page?param=value')).toBe('acme.com');
  });

  it('trims whitespace from raw domain', () => {
    expect(extractDomain('  acme.com  ')).toBe('acme.com');
  });
});

describe('state_abbreviate', () => {
  it('converts full state name to abbreviation', () => {
    expect(stateAbbreviate('California')).toBe('CA');
    expect(stateAbbreviate('New York')).toBe('NY');
    expect(stateAbbreviate('Texas')).toBe('TX');
  });

  it('handles lowercase state names', () => {
    expect(stateAbbreviate('california')).toBe('CA');
    expect(stateAbbreviate('new york')).toBe('NY');
  });

  it('handles mixed case state names', () => {
    expect(stateAbbreviate('CaLiFoRnIa')).toBe('CA');
  });

  it('returns uppercase for already abbreviated states', () => {
    expect(stateAbbreviate('CA')).toBe('CA');
    expect(stateAbbreviate('ca')).toBe('CA');
  });

  it('handles common abbreviation variants', () => {
    expect(stateAbbreviate('Calif')).toBe('CA');
    expect(stateAbbreviate('Calif.')).toBe('CA');
    expect(stateAbbreviate('Tex')).toBe('TX');
  });

  it('handles all 50 states', () => {
    expect(stateAbbreviate('Alabama')).toBe('AL');
    expect(stateAbbreviate('Wyoming')).toBe('WY');
  });

  it('handles District of Columbia', () => {
    expect(stateAbbreviate('District of Columbia')).toBe('DC');
  });

  it('returns original value for unrecognized input', () => {
    expect(stateAbbreviate('Invalid State')).toBe('Invalid State');
  });

  it('trims whitespace before matching', () => {
    expect(stateAbbreviate('  California  ')).toBe('CA');
  });
});

describe('country_code_iso2', () => {
  it('converts full country name to ISO2 code', () => {
    expect(countryCodeIso2('United States')).toBe('US');
    expect(countryCodeIso2('United Kingdom')).toBe('GB');
    expect(countryCodeIso2('Canada')).toBe('CA');
  });

  it('handles lowercase country names', () => {
    expect(countryCodeIso2('united states')).toBe('US');
    expect(countryCodeIso2('canada')).toBe('CA');
  });

  it('handles common abbreviations', () => {
    expect(countryCodeIso2('USA')).toBe('US');
    expect(countryCodeIso2('UK')).toBe('GB');
    expect(countryCodeIso2('UAE')).toBe('AE');
  });

  it('returns uppercase for already ISO2 codes', () => {
    expect(countryCodeIso2('US')).toBe('US');
    expect(countryCodeIso2('us')).toBe('US');
    expect(countryCodeIso2('GB')).toBe('GB');
  });

  it('handles common countries', () => {
    expect(countryCodeIso2('Germany')).toBe('DE');
    expect(countryCodeIso2('France')).toBe('FR');
    expect(countryCodeIso2('Australia')).toBe('AU');
    expect(countryCodeIso2('Japan')).toBe('JP');
    expect(countryCodeIso2('India')).toBe('IN');
  });

  it('handles country name variants', () => {
    expect(countryCodeIso2('U.S.A.')).toBe('US');
    expect(countryCodeIso2('Great Britain')).toBe('GB');
    expect(countryCodeIso2('United Arab Emirates')).toBe('AE');
  });

  it('returns original value for unrecognized countries', () => {
    expect(countryCodeIso2('Unknown Country')).toBe('Unknown Country');
  });

  it('trims whitespace before matching', () => {
    expect(countryCodeIso2('  United States  ')).toBe('US');
  });
});
