import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { supabase, isSupabaseConfigured } from '@/lib/db/supabase';

/**
 * GET /api/harmonies/[id]/stats
 *
 * Returns 30-day aggregate stats for a harmony from normalization_run_progress.
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

    // First, get the harmony's HubSpot property from field assignments
    const { data: assignments } = await supabase
      .from('harmony_field_assignments')
      .select('hubspot_property')
      .eq('harmony_id', id)
      .or(`org_id.is.null,org_id.eq.${ctx.orgId}`)
      .limit(1);

    if (!assignments || assignments.length === 0) {
      return NextResponse.json({
        recordsProcessed: 0,
        changesApplied: 0,
        skipped: 0,
        changeRate: 0,
        lastRunAt: null,
      });
    }

    const hubspotProperty = assignments[0].hubspot_property;

    // Query normalization_run_progress for last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data, error } = await supabase
      .from('normalization_run_progress')
      .select('status, written_at, normalization_runs!inner(org_id)')
      .eq('field_key', hubspotProperty)
      .eq('normalization_runs.org_id', ctx.orgId)
      .gte('written_at', thirtyDaysAgo.toISOString());

    if (error) {
      console.error('[Harmony Stats] Query failed:', error);
      return NextResponse.json(
        { error: 'Failed to fetch stats' },
        { status: 500 }
      );
    }

    const records = data || [];
    const recordsProcessed = records.length;
    const changesApplied = records.filter(r => r.status === 'written').length;
    const skipped = records.filter(r => r.status === 'skipped').length;
    const changeRate = recordsProcessed > 0 ? changesApplied / recordsProcessed : 0;

    // Get most recent written_at
    const lastRunAt = records.length > 0
      ? records.reduce((latest, r) => {
          const ts = new Date(r.written_at);
          return ts > new Date(latest) ? r.written_at : latest;
        }, records[0].written_at)
      : null;

    return NextResponse.json({
      recordsProcessed,
      changesApplied,
      skipped,
      changeRate,
      lastRunAt,
    });
  } catch (error) {
    console.error('[Harmony Stats] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}
