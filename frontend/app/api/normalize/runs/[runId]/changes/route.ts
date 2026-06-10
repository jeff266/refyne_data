/**
 * GET /api/normalize/runs/:runId/changes
 *
 * Get paginated list of changes for a normalization run.
 * Supports filtering by field name and searching by company name/ID.
 *
 * SECURITY: Requires authentication and run ownership verification.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { supabaseAdmin } from '@/lib/db/admin-client';
import { transformArray } from '@/lib/utils/transform';

export async function GET(
  request: NextRequest,
  { params }: { params: { runId: string } }
) {
  // SECURITY: Require authentication
  let ctx;
  try {
    ctx = await getOrgContext();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const runId = params.runId;
  const searchParams = request.nextUrl.searchParams;

  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = parseInt(searchParams.get('limit') || '100', 10);
  const field = searchParams.get('field');
  const search = searchParams.get('search');

  try {
    // SECURITY: Verify run belongs to this organization
    const { data: run, error: runError } = await supabaseAdmin
      .from('normalization_runs')
      .select('org_id')
      .eq('id', runId)
      .single();

    if (runError || !run || run.org_id !== ctx.orgId) {
      // Return 404 (not 403) to avoid confirming run existence
      return NextResponse.json(
        { error: 'Run not found' },
        { status: 404 }
      );
    }
    // Build query
    let query = supabaseAdmin
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

    // Transform column names to match component expectations
    // field_key → field_name, previous_value → value_before, new_value → value_after
    const transformedChanges = (changes || []).map((change: any) => ({
      id: change.id,
      run_id: change.run_id,
      hubspot_company_id: change.hubspot_company_id,
      company_name: change.company_name || change.hubspot_company_id, // Fall back to ID if name not available
      field_name: change.field_key,
      value_before: change.previous_value,
      value_after: change.new_value,
      status: change.status,
      written_at: change.written_at,
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
