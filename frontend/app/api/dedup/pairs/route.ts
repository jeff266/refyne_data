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

/**
 * GET /api/dedup/pairs
 *
 * Returns list of dedup pairs with filtering and pagination.
 */
export async function GET(request: NextRequest) {
  // Add auth check
  let ctx;
  try { ctx = getOrgContext(); }
  catch (e) { return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 }); }

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
      console.error('Failed to get dedup pairs:', error);
      return NextResponse.json(
        { error: 'Failed to get pairs' },
        { status: 500 }
      );
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
      pairs: (pairs as DedupPairRow[]).map(rowToPair),
      total: count || 0,
      counts: { byGrade, byStatus },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Failed to get dedup pairs:', error);
    return NextResponse.json(
      { error: 'Failed to get pairs' },
      { status: 500 }
    );
  }
}
