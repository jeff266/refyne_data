import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { captureWithOrgContext } from '@/lib/monitoring/sentry';
import { supabase, isSupabaseConfigured } from '@/lib/db/supabase';

interface RouteContext {
  params: { id: string };
}

/**
 * GET /api/dedup/clusters/[id]/history
 *
 * Returns merge history for a cluster (audit trail with before/after snapshots)
 * Auth: any org member
 */
export async function GET(request: NextRequest, context: RouteContext) {
  let ctx;
  try {
    ctx = await getOrgContext();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  const clusterId = context.params.id;

  try {
    if (!isSupabaseConfigured() || !supabase) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 503 }
      );
    }

    // Get merge history for this cluster
    const { data: history, error } = await supabase
      .from('dedup_merge_history')
      .select('*')
      .eq('org_id', ctx.orgId)
      .eq('cluster_id', clusterId)
      .order('merged_at', { ascending: false });

    if (error) {
      console.error('[Dedup History] Query failed:', error);
      return NextResponse.json(
        { error: 'Failed to fetch merge history' },
        { status: 500 }
      );
    }

    // Transform snapshots for easier consumption
    const enrichedHistory = (history || []).map((entry) => {
      // Calculate field-level diff
      const fieldDiff = calculateFieldDiff(
        entry.survivor_snapshot,
        entry.merged_snapshot,
        entry.result_snapshot
      );

      return {
        ...entry,
        fieldDiff,
        humanReadableTime: new Date(entry.merged_at).toLocaleString('en-US', {
          dateStyle: 'medium',
          timeStyle: 'short',
        }),
      };
    });

    return NextResponse.json({
      history: enrichedHistory,
      count: enrichedHistory.length,
    });
  } catch (error) {
    captureWithOrgContext(error, ctx.orgId, {
      route: '/api/dedup/clusters/[id]/history',
      clusterId,
    });
    console.error('[Dedup History] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch merge history' },
      { status: 500 }
    );
  }
}

/**
 * Calculate field-level diff showing:
 * - Which fields changed
 * - Source of each field (survivor vs merged)
 * - Before/after values
 */
function calculateFieldDiff(
  survivorSnapshot: any,
  mergedSnapshot: any,
  resultSnapshot: any
) {
  const allFields = new Set([
    ...Object.keys(survivorSnapshot || {}),
    ...Object.keys(mergedSnapshot || {}),
    ...Object.keys(resultSnapshot || {}),
  ]);

  const diff: Record<string, any> = {};

  for (const field of Array.from(allFields)) {
    const survivorValue = survivorSnapshot?.[field];
    const mergedValue = mergedSnapshot?.[field];
    const resultValue = resultSnapshot?.[field];

    // Skip internal HubSpot fields
    if (field.startsWith('hs_')) continue;

    // Determine source
    let source = 'unknown';
    if (resultValue === survivorValue && resultValue !== mergedValue) {
      source = 'survivor';
    } else if (resultValue === mergedValue && resultValue !== survivorValue) {
      source = 'merged';
    } else if (resultValue === survivorValue && resultValue === mergedValue) {
      source = 'same';
    } else {
      source = 'custom'; // User may have edited during merge
    }

    diff[field] = {
      survivorValue,
      mergedValue,
      resultValue,
      source,
      changed: survivorValue !== mergedValue,
    };
  }

  return diff;
}
