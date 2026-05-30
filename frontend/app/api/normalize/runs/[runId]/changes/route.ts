/**
 * GET /api/normalize/runs/:runId/changes
 *
 * Get paginated list of changes for a normalization run.
 * Supports filtering by field name and searching by company name/ID.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db/supabase';
import { transformArray } from '@/lib/utils/transform';

export async function GET(
  request: NextRequest,
  { params }: { params: { runId: string } }
) {
  const runId = params.runId;
  const searchParams = request.nextUrl.searchParams;

  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = parseInt(searchParams.get('limit') || '100', 10);
  const field = searchParams.get('field');
  const search = searchParams.get('search');

  if (!supabase) {
    return NextResponse.json(
      { error: 'Database not configured' },
      { status: 500 }
    );
  }

  try {
    // Build query
    let query = supabase
      .from('normalization_run_progress')
      .select('*', { count: 'exact' })
      .eq('run_id', runId);

    // Apply field filter
    if (field && field !== 'all') {
      query = query.eq('field_key', field);
    }

    // Apply search filter
    if (search) {
      // Search in company_name or hubspot_company_id
      query = query.or(`company_name.ilike.%${search}%,hubspot_company_id.ilike.%${search}%`);
    }

    // Apply pagination
    const offset = (page - 1) * limit;
    query = query
      .order('written_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data: changes, count, error } = await query;

    if (error) {
      throw error;
    }

    return NextResponse.json({
      changes: transformArray(changes || []),
      total: count || 0,
      page,
      limit,
    });

  } catch (error) {
    console.error('Failed to fetch changes:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
