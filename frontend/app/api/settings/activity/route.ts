import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { supabaseAdmin } from '@/lib/db/admin-client';
import { captureWithOrgContext } from '@/lib/monitoring/sentry';
import type { AuditLogEvent, ActivityLogResponse } from '@/types/audit';

/**
 * GET /api/settings/activity
 *
 * Returns activity log events for the organization with filtering and pagination.
 *
 * Query params:
 * - action: Filter by action type (optional)
 * - actor: Filter by actor_id (optional)
 * - date_from: Filter by start date ISO string (optional)
 * - date_to: Filter by end date ISO string (optional)
 * - page: Page number (default 1)
 * - limit: Items per page (default 50, max 100)
 *
 * Auth: All authenticated users (viewers can read audit log)
 */
export async function GET(request: NextRequest) {
  let ctx;
  try {
    ctx = await getOrgContext();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const actor = searchParams.get('actor');
    const dateFrom = searchParams.get('date_from');
    const dateTo = searchParams.get('date_to');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);
    const offset = (page - 1) * limit;

    // Build query with filters
    let query = supabaseAdmin
      .from('audit_log')
      .select('*', { count: 'exact' })
      .eq('org_id', ctx.orgId);

    // Apply filters
    if (action && action !== 'all') {
      query = query.eq('action', action);
    }

    if (actor && actor !== 'all') {
      query = query.eq('actor_id', actor);
    }

    if (dateFrom) {
      query = query.gte('created_at', dateFrom);
    }

    if (dateTo) {
      query = query.lte('created_at', dateTo);
    }

    // Execute query with pagination
    const { data: events, error, count } = await query
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      captureWithOrgContext(error, ctx.orgId, { route: '/api/settings/activity' });
      console.error('[Activity API] Failed to fetch events:', error);
      return NextResponse.json(
        { error: 'Failed to fetch activity log' },
        { status: 500 }
      );
    }

    const total = count ?? 0;
    const hasNextPage = offset + limit < total;

    const response: ActivityLogResponse = {
      events: events ?? [],
      pagination: {
        page,
        limit,
        total,
        hasNextPage,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    captureWithOrgContext(error, ctx.orgId, { route: '/api/settings/activity' });
    console.error('[Activity API] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch activity log' },
      { status: 500 }
    );
  }
}
