import { NextResponse } from 'next/server';
import { supabase } from '@/lib/db/supabase';
import { getOrgContext, requireAdmin, authError } from '@/lib/auth/clerk-helpers';
import { captureWithOrgContext } from '@/lib/monitoring/sentry';

/**
 * GET /api/quarantine
 *
 * Returns list of quarantined records (admin only).
 * Supports filtering by status.
 */
export async function GET(request: Request) {
  let ctx;
  try {
    ctx = await requireAdmin();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  try {
    if (!supabase) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status'); // pending, approved, rejected, or null (all)

    let query = supabase
      .from('quarantine_records')
      .select('*')
      .eq('org_id', ctx.orgId)
      .order('created_at', { ascending: false });

    if (status && ['pending', 'approved', 'rejected'].includes(status)) {
      query = query.eq('status', status);
    }

    const { data: records, error } = await query;

    if (error) {
      captureWithOrgContext(error, ctx.orgId, { route: '/api/quarantine' });
      console.error('Failed to fetch quarantine records:', error);
      return NextResponse.json({ error: 'Failed to fetch records' }, { status: 500 });
    }

    // Get stats
    const { data: statsData, error: statsError } = await supabase
      .from('quarantine_records')
      .select('status')
      .eq('org_id', ctx.orgId);

    const stats = {
      pending: statsData?.filter((r) => r.status === 'pending').length || 0,
      approved: statsData?.filter((r) => r.status === 'approved').length || 0,
      rejected: statsData?.filter((r) => r.status === 'rejected').length || 0,
      total: statsData?.length || 0,
    };

    return NextResponse.json({ records, stats });
  } catch (error) {
    captureWithOrgContext(error, ctx.orgId, { route: '/api/quarantine' });
    console.error('Failed to get quarantine records:', error);
    return NextResponse.json({ error: 'Failed to get records' }, { status: 500 });
  }
}
