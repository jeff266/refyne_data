import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/admin-client';
import { getOrgContext, requireAdmin, authError } from '@/lib/auth/clerk-helpers';
import { captureWithOrgContext } from '@/lib/monitoring/sentry';

/**
 * GET /api/name-registry/queue
 *
 * Returns list of pending review items from the name registry queue (admin only).
 */
export async function GET(request: Request) {
  let ctx;
  try {
    ctx = await requireAdmin();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  try {
    const { data: items, error } = await supabaseAdmin
      .from('name_registry_queue')
      .select('*')
      .eq('org_id', ctx.orgId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) {
      captureWithOrgContext(error, ctx.orgId, { route: '/api/name-registry/queue' });
      console.error('Failed to fetch queue items:', error);
      return NextResponse.json({ error: 'Failed to fetch queue items' }, { status: 500 });
    }

    return NextResponse.json({
      items: items || [],
      total: items?.length || 0,
    });
  } catch (error) {
    captureWithOrgContext(error, ctx.orgId, { route: '/api/name-registry/queue' });
    console.error('Failed to get queue items:', error);
    return NextResponse.json({ error: 'Failed to get queue items' }, { status: 500 });
  }
}
