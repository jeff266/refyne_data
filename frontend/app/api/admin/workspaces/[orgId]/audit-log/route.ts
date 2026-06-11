import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { requireRefyneStaff } from '@/lib/auth/staff-helpers';
import { supabaseAdmin } from '@/lib/db/admin-client';

/**
 * GET /api/admin/workspaces/[orgId]/audit-log
 *
 * Returns last 20 admin audit log entries for workspace
 * Staff only
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const { orgId } = await params;

  // Auth check
  let ctx;
  try {
    ctx = await getOrgContext();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Staff check
  try {
    await requireRefyneStaff(ctx.userId);
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('admin_audit_log')
      .select('*')
      .eq('target_org_id', orgId)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      console.error('[Admin Audit Log] Fetch error:', error);
      return NextResponse.json({ error: 'Failed to fetch audit log' }, { status: 500 });
    }

    return NextResponse.json({ entries: data || [] });
  } catch (error) {
    console.error('[Admin Audit Log] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
