import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { supabase, isSupabaseConfigured } from '@/lib/db/supabase';

/**
 * GET /api/harmonies/[id]/changes
 *
 * Returns the 10 most recent changes from the last normalization run.
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

    // Get the harmony's HubSpot property from field assignments
    const { data: assignments } = await supabase
      .from('harmony_field_assignments')
      .select('hubspot_property')
      .eq('harmony_id', id)
      .or(`org_id.is.null,org_id.eq.${ctx.orgId}`)
      .limit(1);

    if (!assignments || assignments.length === 0) {
      return NextResponse.json({
        changes: [],
        totalChanges: 0,
      });
    }

    const hubspotProperty = assignments[0].hubspot_property;

    // Get recent changes (limit 10)
    const { data, error } = await supabase
      .from('normalization_run_progress')
      .select('hubspot_company_id, company_name, field_key, previous_value, new_value, written_at, normalization_runs!inner(org_id)')
      .eq('field_key', hubspotProperty)
      .eq('normalization_runs.org_id', ctx.orgId)
      .eq('status', 'written')
      .order('written_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('[Harmony Changes] Query failed:', error);
      return NextResponse.json(
        { error: 'Failed to fetch changes' },
        { status: 500 }
      );
    }

    // Get total count of changes in last run
    const { count: totalChanges } = await supabase
      .from('normalization_run_progress')
      .select('*', { count: 'exact', head: true })
      .eq('field_key', hubspotProperty)
      .eq('status', 'written');

    const changes = (data || []).map(row => ({
      recordId: row.hubspot_company_id,
      recordName: row.company_name || row.hubspot_company_id,
      field: row.field_key,
      previousValue: row.previous_value || '',
      newValue: row.new_value || '',
      writtenAt: row.written_at,
    }));

    return NextResponse.json({
      changes,
      totalChanges: totalChanges || 0,
    });
  } catch (error) {
    console.error('[Harmony Changes] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch changes' },
      { status: 500 }
    );
  }
}
