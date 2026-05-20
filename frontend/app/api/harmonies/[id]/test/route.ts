import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/db/supabase';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { captureWithOrgContext } from '@/lib/monitoring/sentry';

/**
 * POST /api/harmonies/:id/test
 *
 * Tests a harmony transformation with a given input value.
 * Uses the new fuzzy matching engine for lookup harmonies.
 * Returns the transformed output, match type, confidence, and matched input value.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // Auth check
  let ctx;
  try {
    ctx = await getOrgContext();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  try {
    if (!isSupabaseConfigured() || !supabase) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 503 }
      );
    }

    const harmonyId = params.id;
    const body = await request.json();
    const { input } = body;

    if (input === undefined || input === null || input === '') {
      return NextResponse.json({ error: 'Input is required' }, { status: 400 });
    }

    // Fetch harmony from database
    const { data: harmony, error: harmonyError } = await supabase
      .from('harmonies')
      .select('*')
      .eq('id', harmonyId)
      .single();

    if (harmonyError || !harmony) {
      return NextResponse.json({ error: 'Harmony not found' }, { status: 404 });
    }

    const transformType = harmony.transform_type || 'lookup';

    // Handle lookup harmonies with fuzzy matching
    if (transformType === 'lookup' && harmony.reference_table) {
      const { data, error } = await supabase.rpc('lookup_harmony_value', {
        p_table_name: harmony.reference_table,
        p_input_value: input,
        p_org_id: ctx.orgId,
        p_fuzzy_threshold: harmony.fuzzy_threshold || 0.8,
        p_phonetic_enabled: harmony.phonetic_enabled || false,
      });

      if (error) {
        console.error('[Harmony Test] Lookup failed:', error);
        return NextResponse.json({
          matched: false,
          output: null,
          matchType: 'none',
          confidence: 0,
          explanation: `Error: ${error.message}`,
        });
      }

      const result = data?.[0];

      if (!result || !result.canonical_value || result.match_type === 'none') {
        return NextResponse.json({
          matched: false,
          output: input,
          matchType: 'none',
          confidence: 0,
          explanation: 'No matching value found in reference data',
        });
      }

      // Build explanation based on match type
      let explanation = '';
      if (result.match_type === 'exact') {
        explanation = 'Exact match found in reference data';
      } else if (result.match_type === 'fuzzy') {
        explanation = `Fuzzy match (${result.confidence}% similarity via trigram matching)`;
      } else if (result.match_type === 'phonetic') {
        explanation = `Phonetic match (${result.confidence}% confidence - sounds similar)`;
      }

      return NextResponse.json({
        matched: true,
        output: result.canonical_value,
        matchType: result.match_type,
        confidence: result.confidence,
        explanation,
      });
    }

    // Handle format harmonies with algorithmic transformations
    if (transformType === 'format') {
      const formatResult = applyFormatTransform(harmonyId, input);

      if (!formatResult || formatResult === input) {
        return NextResponse.json({
          matched: false,
          output: input,
          matchType: 'none',
          confidence: 0,
          explanation: 'No transformation applied',
        });
      }

      return NextResponse.json({
        matched: true,
        output: formatResult,
        matchType: 'exact',
        confidence: 100,
        explanation: 'Algorithmic transformation applied',
      });
    }

    return NextResponse.json({
      matched: false,
      output: input,
      matchType: 'none',
      confidence: 0,
      explanation: 'Unknown harmony type',
    });
  } catch (error) {
    captureWithOrgContext(error, ctx.orgId, {
      route: '/api/harmonies/[id]/test',
      harmonyId: params.id,
    });
    console.error('Failed to test harmony:', error);
    return NextResponse.json({ error: 'Failed to test harmony' }, { status: 500 });
  }
}

// Format transformation functions
function applyFormatTransform(harmonyId: string, value: string): string | null {
  if (harmonyId === 'phone-e164') {
    const digits = value.replace(/\D/g, '');
    if (digits.length === 10) {
      return `+1${digits}`;
    } else if (digits.length === 11 && digits[0] === '1') {
      return `+${digits}`;
    }
    return null;
  }

  if (harmonyId === 'email-lowercase') {
    return value.toLowerCase().trim();
  }

  if (harmonyId === 'linkedin-url') {
    const match = value.match(/linkedin\.com\/(?:in|company)\/([^/?]+)/i);
    if (!match) return null;
    const slug = match[1];
    return value.includes('/company/')
      ? `https://linkedin.com/company/${slug}`
      : `https://linkedin.com/in/${slug}`;
  }

  if (harmonyId === 'company-name') {
    const words = value.toLowerCase().split(' ');
    const titleCased = words.map((word) => {
      if (['llc', 'inc', 'corp', 'ltd', 'plc', 'lp', 'llp'].includes(word)) {
        return word.toUpperCase();
      }
      return word.charAt(0).toUpperCase() + word.slice(1);
    });
    return titleCased.join(' ');
  }

  return null;
}
