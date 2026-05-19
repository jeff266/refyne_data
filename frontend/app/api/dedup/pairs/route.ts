import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/db/supabase';
import {
  rowToPair,
  type DedupPairRow,
  type PairGrade,
  type PairStatus,
  type PairsListResponse,
} from '@/lib/dedup/types';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { requireFeature, parseFeatureGateError } from '@/lib/billing/check-feature';
import { captureWithOrgContext } from '@/lib/monitoring/sentry';
import { getAccessToken } from '@/lib/hubspot/get-access-token';
import { HubSpotClient } from '@/lib/hubspot/client';

/**
 * GET /api/dedup/pairs
 *
 * Returns list of dedup pairs with filtering and pagination.
 */
export async function GET(request: NextRequest) {
  // Add auth check
  let ctx;
  try { ctx = await getOrgContext(); }
  catch (e) { return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 }); }

  // Feature gate: dedup
  try {
    await requireFeature(ctx.orgId, 'dedup');
  } catch (error) {
    const gateError = parseFeatureGateError(error);
    if (gateError) {
      return NextResponse.json(
        { error: 'feature_gated', feature: gateError.feature, currentPlan: gateError.currentPlan },
        { status: 403 }
      );
    }
    throw error;
  }

  try {
    if (!isSupabaseConfigured() || !supabase) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 503 }
      );
    }

    const { searchParams } = new URL(request.url);
    const orgId = ctx.orgId;

    // Parse query params
    const grade = searchParams.get('grade') || 'all';
    const status = searchParams.get('status') || 'pending';
    const signal = searchParams.get('signal');
    const sort = searchParams.get('sort') || 'confidence_desc';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const perPage = Math.min(200, Math.max(1, parseInt(searchParams.get('per_page') || '50', 10)));

    // Build base query
    let query = supabase
      .from('dedup_pairs')
      .select('*', { count: 'exact' })
      .eq('org_id', orgId);

    // Apply grade filter
    if (grade !== 'all') {
      query = query.eq('grade', grade);
    }

    // Apply status filter
    if (status !== 'all') {
      query = query.eq('status', status);
    }

    // Apply signal filter (search in signals_fired JSONB)
    if (signal) {
      query = query.contains('signals_fired', [{ type: signal }]);
    }

    // Apply sorting
    switch (sort) {
      case 'confidence_asc':
        query = query.order('confidence', { ascending: true });
        break;
      case 'detected_asc':
        query = query.order('detected_at', { ascending: true });
        break;
      case 'confidence_desc':
      default:
        query = query.order('confidence', { ascending: false });
        break;
    }

    // Apply pagination
    const offset = (page - 1) * perPage;
    query = query.range(offset, offset + perPage - 1);

    const { data: pairs, count, error } = await query;

    if (error) {
      captureWithOrgContext(error, ctx.orgId, { route: '/api/dedup/pairs' });
      console.error('Failed to get dedup pairs:', error);
      return NextResponse.json(
        { error: 'Failed to get pairs' },
        { status: 500 }
      );
    }

    // Fetch company names from HubSpot for all record IDs
    let companyNames: Record<string, string> = {};
    if (pairs && pairs.length > 0) {
      try {
        // Collect all unique record IDs
        const allRecordIds = new Set<string>();
        for (const pair of pairs as DedupPairRow[]) {
          allRecordIds.add(pair.record_a_id);
          allRecordIds.add(pair.record_b_id);
        }
        const recordIdArray = Array.from(allRecordIds);

        // LONG-TERM: Use portal_id from dedup_pairs if available (requires migration 027)
        const pairsWithPortal = (pairs as DedupPairRow[]).filter(p => p.portal_id);
        const knownPortalId = pairsWithPortal.length > 0 ? pairsWithPortal[0].portal_id : null;

        if (knownPortalId) {
          console.log(`[Dedup] Using known portal ${knownPortalId} from dedup_pairs table`);

          const accessToken = await getAccessToken(ctx.orgId);
          if (accessToken) {
            const client = new HubSpotClient(accessToken, knownPortalId);
            const companies = await client.getCompaniesByIds(recordIdArray, ['name', 'domain']);

            for (const company of companies) {
              companyNames[company.id] = company.properties.name || company.id;
            }

            console.log(`[Dedup] Fetched ${companies.length} names from known portal`);
          }
        } else {
          // SHORT-TERM FIX: Try all active connections since pairs may be from different portals
          console.log('[Dedup] No portal_id in pairs, trying all active connections...');

          const { data: connections } = await supabase
            .from('hubspot_connections')
            .select('id, portal_id')
            .eq('org_id', ctx.orgId)
            .eq('connection_status', 'active');

          console.log('[Dedup] Starting multi-portal lookup, connections count:', connections?.length ?? 0);

          if (connections && connections.length > 0) {
            for (const connection of connections) {
              console.log(`[Dedup] Trying portal ${connection.portal_id}...`);

              const accessToken = await getAccessToken(ctx.orgId);
              if (!accessToken) continue;

              const client = new HubSpotClient(accessToken, connection.portal_id);

              try {
                const companies = await client.getCompaniesByIds(recordIdArray, ['name', 'domain']);

                if (companies.length > 0) {
                  console.log(`[Dedup] ✅ Portal ${connection.portal_id} returned ${companies.length} companies`);

                  for (const company of companies) {
                    companyNames[company.id] = company.properties.name || company.id;
                  }

                  break; // Found the right portal
                } else {
                  console.log(`[Dedup] ⚠️  Portal ${connection.portal_id} returned 0 companies, trying next...`);
                }
              } catch (batchErr: any) {
                console.error(`[Dedup] Error with portal ${connection.portal_id}:`, batchErr.message);
              }
            }
          }
        }

        console.log(`[Dedup] Final: ${Object.keys(companyNames).length} company names fetched`);
      } catch (err: any) {
        console.error('[Dedup] Error fetching company names:', err.message);
      }
    }

    // Get counts for sidebar
    const [gradeCountsResult, statusCountsResult] = await Promise.all([
      supabase
        .from('dedup_pairs')
        .select('grade')
        .eq('org_id', orgId),
      supabase
        .from('dedup_pairs')
        .select('status')
        .eq('org_id', orgId),
    ]);

    // Aggregate counts
    const byGrade: Record<PairGrade, number> = { A: 0, B: 0, C: 0, D: 0 };
    const byStatus: Record<PairStatus, number> = {
      pending: 0,
      approved: 0,
      rejected: 0,
      suppressed: 0,
      merged: 0,
      reversed: 0,
    };

    if (gradeCountsResult.data) {
      for (const row of gradeCountsResult.data) {
        if (row.grade in byGrade) {
          byGrade[row.grade as PairGrade]++;
        }
      }
    }

    if (statusCountsResult.data) {
      for (const row of statusCountsResult.data) {
        if (row.status in byStatus) {
          byStatus[row.status as PairStatus]++;
        }
      }
    }

    const response: PairsListResponse = {
      pairs: (pairs as DedupPairRow[]).map(row => ({
        ...rowToPair(row),
        recordAName: companyNames[row.record_a_id] || row.record_a_id,
        recordBName: companyNames[row.record_b_id] || row.record_b_id,
      })),
      total: count || 0,
      counts: { byGrade, byStatus },
    };

    return NextResponse.json(response);
  } catch (error) {
    captureWithOrgContext(error, ctx.orgId, { route: '/api/dedup/pairs' });
    console.error('Failed to get dedup pairs:', error);
    return NextResponse.json(
      { error: 'Failed to get pairs' },
      { status: 500 }
    );
  }
}
