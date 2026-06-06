import { NextRequest, NextResponse } from 'next/server';
import { requireOperatorOrAbove, authError } from '@/lib/auth/clerk-helpers';
import { supabaseAdmin } from '@/lib/db/admin-client';
import { captureWithOrgContext } from '@/lib/monitoring/sentry';
import { buildCSV } from '@/lib/utils/csv';

const MAX_EXPORT_RECORDS = 10000;

// Simple rate limiter: track last export time per org
const exportLocks = new Map<string, number>();

function checkExportRateLimit(orgId: string): boolean {
  const lastExport = exportLocks.get(orgId);
  const now = Date.now();

  if (lastExport && now - lastExport < 5000) {
    // 5 second cooldown
    return false;
  }

  exportLocks.set(orgId, now);
  return true;
}

/**
 * GET /api/settings/activity/export
 *
 * Exports activity log events as CSV.
 * Applies same filters as main API route.
 * Limited to 10,000 records to prevent memory issues.
 *
 * Query params: Same as /api/settings/activity (action, actor, date_from, date_to)
 *
 * Auth: Operators and admins only (viewers cannot export)
 */
export async function GET(request: NextRequest) {
  let ctx;
  try {
    ctx = await requireOperatorOrAbove();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  try {
    // Rate limiting: 5 second cooldown per org
    if (!checkExportRateLimit(ctx.orgId)) {
      return NextResponse.json(
        { error: 'Export rate limit exceeded. Please wait 5 seconds.' },
        { status: 429 }
      );
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const actor = searchParams.get('actor');
    const dateFrom = searchParams.get('date_from');
    const dateTo = searchParams.get('date_to');

    // Build query with filters (same logic as main route)
    let query = supabaseAdmin
      .from('audit_log')
      .select('*')
      .eq('org_id', ctx.orgId)
      .order('created_at', { ascending: false })
      .limit(MAX_EXPORT_RECORDS);

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

    const { data: events, error } = await query;

    if (error) {
      captureWithOrgContext(error, ctx.orgId, { route: '/api/settings/activity/export' });
      console.error('[Activity Export] Failed to fetch events:', error);
      return NextResponse.json(
        { error: 'Failed to export activity log' },
        { status: 500 }
      );
    }

    // Warn if hit max limit
    if (events && events.length >= MAX_EXPORT_RECORDS) {
      console.warn(`[Activity Export] Hit ${MAX_EXPORT_RECORDS} record limit for org ${ctx.orgId}`);
    }

    // Build CSV
    const headers = [
      'Timestamp',
      'Action',
      'User',
      'Object Type',
      'Object Label',
      'Before State',
      'After State',
    ];

    const rows = (events ?? []).map((event) => [
      event.created_at,
      event.action,
      event.actor_email || event.actor_id,
      event.object_type || '',
      event.object_label || '',
      event.before_state ? JSON.stringify(event.before_state) : '',
      event.after_state ? JSON.stringify(event.after_state) : '',
    ]);

    const csvContent = buildCSV(headers, rows);
    const filename = `activity-log-${new Date().toISOString().split('T')[0]}.csv`;

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    captureWithOrgContext(error, ctx.orgId, { route: '/api/settings/activity/export' });
    console.error('[Activity Export] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Failed to export activity log' },
      { status: 500 }
    );
  }
}
