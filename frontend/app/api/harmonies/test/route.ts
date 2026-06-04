/**
 * POST /api/harmonies/test
 *
 * Tests a harmony transformation on a single value.
 * Used by the format function live tester in the New Harmony wizard.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';

type FormatFn = (value: string, config?: Record<string, any>) => string | null;

// Simplified format functions for testing
// Full implementations are in lib/harmonies/normalization-engine.ts

function normalizePhoneE164(phone: string): string | null {
  const digits = phone.replace(/\D/g, '');

  if (digits.length === 10) {
    return `+1${digits}`;
  }

  if (digits.length === 11 && digits[0] === '1') {
    return `+${digits}`;
  }

  if (phone.trim().startsWith('+') && digits.length >= 7 && digits.length <= 15) {
    return `+${digits}`;
  }

  return null;
}

function normalizeLinkedInUrl(url: string): string | null {
  const match = url.match(/linkedin\.com\/(?:in|company)\/([^/?]+)/i);
  if (!match) return null;
  const slug = match[1];
  return url.includes('/company/')
    ? `https://www.linkedin.com/company/${slug}`
    : `https://www.linkedin.com/in/${slug}`;
}

function normalizeNumeric(value: string): string | null {
  const cleaned = value.replace(/[$,\s]/g, '');

  // Handle K/M/B suffixes
  const suffixMatch = cleaned.match(/^(\d+(?:\.\d+)?)(k|m|b)$/i);
  if (suffixMatch) {
    const num = parseFloat(suffixMatch[1]);
    const suffix = suffixMatch[2].toLowerCase();
    const multiplier = suffix === 'k' ? 1000 : suffix === 'm' ? 1000000 : 1000000000;
    return String(Math.round(num * multiplier));
  }

  // Handle plain numbers
  const numMatch = cleaned.match(/^(\d+(?:\.\d+)?)$/);
  if (numMatch) {
    return String(Math.round(parseFloat(numMatch[1])));
  }

  return null;
}

function applySmartTitleCase(name: string): string {
  if (!name) return name;

  // Simple title case implementation for testing
  // Full implementation with brand tokens is in normalization-engine.ts
  return name
    .toLowerCase()
    .split(/\s+/)
    .map(word => {
      // Keep small words lowercase unless first word
      const lowerWords = ['and', 'or', 'the', 'of', 'in', 'for', 'with', 'at', 'by', 'to', 'a', 'an'];
      if (lowerWords.includes(word.toLowerCase())) {
        return word.toLowerCase();
      }
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ')
    .replace(/^./, (c) => c.toUpperCase()); // Capitalize first letter
}

// US States mapping for state_abbreviate function
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

// Common countries mapping for country_code_iso2 function
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

const FORMAT_FUNCTIONS: Record<string, FormatFn> = {
  'e164_phone': normalizePhoneE164,
  'email_lowercase': (v) => v.toLowerCase().trim(),
  'linkedin_url': normalizeLinkedInUrl,
  'smart_title_case': applySmartTitleCase,
  'numeric_parse': normalizeNumeric,
  'url_canonical': (v: string) => {
    try {
      const url = new URL(v.startsWith('http') ? v : `https://${v}`);
      return url.toString();
    } catch {
      return null;
    }
  },
  // Tier 1 format functions
  'trim_whitespace': (v: string) => v.trim().replace(/\s+/g, ' '),
  'employee_range': (v: string) => {
    const n = parseInt(v.replace(/[^0-9]/g, ''));
    if (isNaN(n)) return v;
    if (n <= 1) return '1';
    if (n <= 10) return '2-10';
    if (n <= 50) return '11-50';
    if (n <= 200) return '51-200';
    if (n <= 500) return '201-500';
    if (n <= 1000) return '501-1000';
    if (n <= 5000) return '1001-5000';
    if (n <= 10000) return '5001-10000';
    return '10001+';
  },
  'extract_domain': (v: string) => {
    try {
      const url = v.startsWith('http') ? v : `https://${v}`;
      const domain = new URL(url).hostname
        .replace(/^www\./, '')
        .toLowerCase();
      return domain;
    } catch {
      // Not a URL, try treating as raw domain
      return v.replace(/^www\./, '').toLowerCase().trim();
    }
  },
  'state_abbreviate': (v: string) => {
    const lower = v.toLowerCase().trim();
    // Already a 2-letter code
    if (/^[a-z]{2}$/.test(lower)) return v.toUpperCase();
    return US_STATES[lower] ?? v;
  },
  'country_code_iso2': (v: string) => {
    const lower = v.toLowerCase().trim();
    // Check map first (handles both full names and common abbreviations like 'uk' -> 'GB')
    const mapped = COMMON_COUNTRIES[lower];
    if (mapped) return mapped;
    // If already 2 letters and not in map, assume it's already ISO2
    if (/^[a-z]{2}$/.test(lower)) return v.toUpperCase();
    // Unrecognized country, return as-is
    return v;
  },
};

export async function POST(request: NextRequest) {
  let ctx;
  try {
    ctx = await getOrgContext();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  try {
    const body = await request.json();
    const { transformType, transformFunction, testValue } = body;

    if (!transformType || !testValue) {
      return NextResponse.json(
        { error: 'transformType and testValue are required' },
        { status: 400 }
      );
    }

    if (transformType === 'format') {
      if (!transformFunction) {
        return NextResponse.json(
          { error: 'transformFunction is required for format type' },
          { status: 400 }
        );
      }

      const formatFn = FORMAT_FUNCTIONS[transformFunction];
      if (!formatFn) {
        return NextResponse.json(
          { error: `Unknown format function: ${transformFunction}` },
          { status: 400 }
        );
      }

      const result = formatFn(testValue);
      return NextResponse.json({ result });
    }

    // For lookup type, would test against reference data
    // Not implemented in this PR since we're only adding format support
    return NextResponse.json(
      { error: 'Only format transform type is supported for testing' },
      { status: 400 }
    );
  } catch (error) {
    console.error('[POST /api/harmonies/test] Error:', error);
    return NextResponse.json(
      { error: 'Failed to test transformation' },
      { status: 500 }
    );
  }
}
