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
      // Search in hubspot_company_id only (company_name not stored in table)
      query = query.ilike('hubspot_company_id', `%${search}%`);
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

    // Transform column names to match component expectations
    // field_key → field_name, previous_value → value_before, new_value → value_after
    const transformedChanges = (changes || []).map((change: any) => ({
      id: change.id,
      run_id: change.run_id,
      hubspot_company_id: change.hubspot_company_id,
      field_name: change.field_key,
      value_before: change.previous_value,
      value_after: change.new_value,
      status: change.status,
      written_at: change.written_at,
      company_name: null, // Not stored in table, component will use hubspot_company_id as fallback
    }));

    return NextResponse.json({
      changes: transformedChanges,
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
