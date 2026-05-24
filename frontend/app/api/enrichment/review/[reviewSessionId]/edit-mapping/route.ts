import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { supabase, isSupabaseConfigured } from '@/lib/db/supabase';

/**
 * POST /api/enrichment/review/[reviewSessionId]/edit-mapping
 *
 * Updates a single value mapping before approval.
 * Body: { fieldKey: string, rawValue: string, mappedValue: string }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ reviewSessionId: string }> }
) {
  let ctx;
  try {
    ctx = await getOrgContext();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  const { reviewSessionId } = await params;

  try {
    if (!isSupabaseConfigured() || !supabase) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 503 }
      );
    }

    const body = await request.json();
    const { fieldKey, rawValue, mappedValue } = body;

    if (!fieldKey || !rawValue || mappedValue === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Verify session belongs to this org
    const { data: session } = await supabase
      .from('enrichment_review_sessions')
      .select('org_id, status')
      .eq('id', reviewSessionId)
      .single();

    if (!session || session.org_id !== ctx.orgId) {
      return NextResponse.json(
        { error: 'Review session not found' },
        { status: 404 }
      );
    }

    if (session.status !== 'pending_review') {
      return NextResponse.json(
        { error: `Cannot edit mapping for ${session.status} session` },
        { status: 400 }
      );
    }

    // Update harmony mapping in field_mappings table
    const { data: existingMapping } = await supabase
      .from('field_mappings')
      .select('canonical_to_hubspot_map')
      .eq('org_id', ctx.orgId)
      .eq('canonical_field', fieldKey)
      .maybeSingle();

    const currentMap = (existingMapping?.canonical_to_hubspot_map || {}) as Record<string, string>;

    // Update or remove mapping
    if (mappedValue === null || mappedValue === '') {
      delete currentMap[rawValue];
    } else {
      currentMap[rawValue] = mappedValue;
    }

    // Upsert the updated mapping
    await supabase
      .from('field_mappings')
      .upsert(
        {
          org_id: ctx.orgId,
          canonical_field: fieldKey,
          canonical_to_hubspot_map: currentMap,
        },
        {
          onConflict: 'org_id,canonical_field',
        }
      );

    // Update pending enrichment values to use new mapped value
    await supabase
      .from('pending_enrichment_values')
      .update({
        hubspot_value: mappedValue,
        harmony_applied: true,
        confidence: mappedValue ? 'high' : 'no_match',
      })
      .eq('review_session_id', reviewSessionId)
      .eq('field_key', fieldKey)
      .eq('raw_value', rawValue);

    console.log(`[EditMapping] Updated mapping for ${fieldKey}: "${rawValue}" -> "${mappedValue}"`);

    return NextResponse.json({
      success: true,
      fieldKey,
      rawValue,
      mappedValue,
    });
  } catch (error) {
    console.error('[EditMapping API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to update mapping' },
      { status: 500 }
    );
  }
}
