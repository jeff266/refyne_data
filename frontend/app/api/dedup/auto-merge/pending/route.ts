import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/db/supabase';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { getAccessToken } from '@/lib/hubspot/get-access-token';

/**
 * GET /api/dedup/auto-merge/pending
 *
 * Returns clusters scheduled for auto-merge with countdown timers.
 */
export async function GET(request: NextRequest) {
  // Auth check
  let ctx;
  try {
    ctx = await getOrgContext();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  try {
    if (!isSupabaseConfigured() || !supabase) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '20'), 100);

    // Find pending auto-merge clusters
    const { data: clusters, error: fetchError } = await supabase
      .from('dedup_clusters')
      .select('id, record_ids, grade, auto_merge_scheduled_at')
      .eq('org_id', ctx.orgId)
      .eq('status', 'pending')
      .not('auto_merge_scheduled_at', 'is', null)
      .is('auto_merge_cancelled_at', null)
      .order('auto_merge_scheduled_at', { ascending: true })
      .limit(limit);

    if (fetchError) {
      return NextResponse.json({ error: 'Failed to fetch pending merges' }, { status: 500 });
    }

    if (!clusters || clusters.length === 0) {
      return NextResponse.json({ clusters: [], total: 0 });
    }

    // Get access token to fetch company names
    const accessToken = await getAccessToken(ctx.orgId);
    if (!accessToken) {
      return NextResponse.json({ error: 'HubSpot not connected' }, { status: 400 });
    }

    // Fetch company names and confidence scores
    const enrichedClusters = await Promise.all(
      clusters.map(async (cluster) => {
        // Fetch company names
        const companyNames = await Promise.all(
          cluster.record_ids.slice(0, 3).map(async (recordId: string) => {
            try {
              const res = await fetch(
                `https://api.hubapi.com/crm/v3/objects/companies/${recordId}?properties=name`,
                {
                  headers: { Authorization: `Bearer ${accessToken}` },
                }
              );
              if (res.ok) {
                const data = await res.json();
                return data.properties.name || 'Unknown';
              }
              return 'Unknown';
            } catch {
              return 'Unknown';
            }
          })
        );

        // Fetch highest confidence from pairs
        const { data: topPair } = await supabase
          .from('dedup_pairs')
          .select('confidence, signals_fired')
          .eq('cluster_id', cluster.id)
          .order('confidence', { ascending: false })
          .limit(1)
          .single();

        const confidence = topPair?.confidence ?? 0;
        const signals = topPair?.signals_fired ?? [];

        // Calculate minutes remaining
        const scheduledTime = new Date(cluster.auto_merge_scheduled_at).getTime();
        const now = Date.now();
        const minutesRemaining = Math.max(0, Math.floor((scheduledTime - now) / 1000 / 60));

        return {
          id: cluster.id,
          companyNames,
          recordCount: cluster.record_ids.length,
          grade: cluster.grade,
          confidence,
          signals,
          scheduledAt: cluster.auto_merge_scheduled_at,
          minutesRemaining,
        };
      })
    );

    return NextResponse.json({
      clusters: enrichedClusters,
      total: enrichedClusters.length,
    });
  } catch (error) {
    console.error('[Pending Auto-merge] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch pending auto-merges',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
