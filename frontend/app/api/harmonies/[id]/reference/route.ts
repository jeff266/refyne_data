import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { supabase, isSupabaseConfigured } from '@/lib/db/supabase';

/**
 * GET /api/harmonies/[id]/reference
 *
 * Returns paginated reference data for a lookup harmony.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const { id } = params;
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = 50;
    const offset = (page - 1) * limit;

    // Get harmony's reference table
    const { data: harmony } = await supabase
      .from('harmonies')
      .select('reference_table')
      .eq('id', id)
      .or(`org_id.is.null,org_id.eq.${ctx.orgId}`)
      .single();

    if (!harmony || !harmony.reference_table) {
      return NextResponse.json({
        data: [],
        total: 0,
        page,
        hasMore: false,
      });
    }

    // Query reference data
    let query = supabase
      .from('harmony_reference_data')
      .select('*', { count: 'exact' })
      .eq('table_name', harmony.reference_table)
      .or(`org_id.is.null,org_id.eq.${ctx.orgId}`);

    if (search) {
      query = query.or(`input_value.ilike.%${search}%,canonical_value.ilike.%${search}%`);
    }

    const { data, error, count } = await query
      .order('input_value')
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('[Harmony Reference] Query failed:', error);
      return NextResponse.json(
        { error: 'Failed to fetch reference data' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      data: (data || []).map(row => ({
        id: row.id,
        inputValue: row.input_value,
        canonicalValue: row.canonical_value,
        source: row.source,
        isActive: row.is_active,
      })),
      total: count || 0,
      page,
      hasMore: (count || 0) > offset + limit,
    });
  } catch (error) {
    console.error('[Harmony Reference] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch reference data' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/harmonies/[id]/reference
 *
 * Adds a new reference data row.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const { id } = params;
    const body = await req.json();
    const { inputValue, canonicalValue } = body;

    if (!inputValue || !canonicalValue) {
      return NextResponse.json(
        { error: 'Missing required fields: inputValue, canonicalValue' },
        { status: 400 }
      );
    }

    // Get harmony's reference table
    const { data: harmony } = await supabase
      .from('harmonies')
      .select('reference_table')
      .eq('id', id)
      .or(`org_id.is.null,org_id.eq.${ctx.orgId}`)
      .single();

    if (!harmony || !harmony.reference_table) {
      return NextResponse.json(
        { error: 'Harmony not found or does not have reference data' },
        { status: 404 }
      );
    }

    // Insert reference data row
    const { data: newRow, error: insertError } = await supabase
      .from('harmony_reference_data')
      .insert({
        table_name: harmony.reference_table,
        input_value: inputValue,
        canonical_value: canonicalValue,
        language: 'en',
        source: 'user',
        fuzzy_eligible: true,
        org_id: ctx.orgId,
        is_active: true,
      })
      .select()
      .single();

    if (insertError) {
      console.error('[Harmony Reference] Insert failed:', insertError);
      return NextResponse.json(
        { error: 'Failed to add reference data' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      id: newRow.id,
      inputValue: newRow.input_value,
      canonicalValue: newRow.canonical_value,
    });
  } catch (error) {
    console.error('[Harmony Reference] Error:', error);
    return NextResponse.json(
      { error: 'Failed to add reference data' },
      { status: 500 }
    );
  }
}
