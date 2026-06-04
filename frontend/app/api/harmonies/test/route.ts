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
