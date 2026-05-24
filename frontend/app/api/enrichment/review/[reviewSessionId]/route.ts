import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { supabase, isSupabaseConfigured } from '@/lib/db/supabase';

/**
 * GET /api/enrichment/review/[reviewSessionId]
 *
 * Returns review session with field results and harmony mappings.
 * Clerk auth required, org scoped.
 */
export async function GET(
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

    // Get review session
    const { data: session, error: sessionError } = await supabase
      .from('enrichment_review_sessions')
      .select('*')
      .eq('id', reviewSessionId)
      .eq('org_id', ctx.orgId) // Ensure org ownership
      .single();

    if (sessionError || !session) {
      return NextResponse.json(
        { error: 'Review session not found' },
        { status: 404 }
      );
    }

    // Get pending enrichment values grouped by field
    const { data: pendingValues, error: valuesError } = await supabase
      .from('pending_enrichment_values')
      .select('*')
      .eq('review_session_id', reviewSessionId);

    if (valuesError) {
      return NextResponse.json(
        { error: 'Failed to fetch pending values' },
        { status: 500 }
      );
    }

    // Group by field_key
    const fieldGroups: Record<string, any[]> = {};
    for (const value of pendingValues || []) {
      if (!fieldGroups[value.field_key]) {
        fieldGroups[value.field_key] = [];
      }
      fieldGroups[value.field_key].push(value);
    }

    // Get harmony mappings for each field
    const { data: fieldMappings } = await supabase
      .from('field_mappings')
      .select('canonical_field, canonical_to_hubspot_map, valid_values')
      .eq('org_id', ctx.orgId);

    const harmonies: Record<string, any> = {};
    for (const mapping of fieldMappings || []) {
      harmonies[mapping.canonical_field] = {
        mappings: mapping.canonical_to_hubspot_map || {},
        validValues: mapping.valid_values || [],
      };
    }

    return NextResponse.json({
      session,
      fieldGroups,
      harmonies,
    });
  } catch (error) {
    console.error('[Review API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch review session' },
      { status: 500 }
    );
  }
}
