import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin, getSuperAdminUserId } from '@/lib/auth/super-admin';
import { supabaseAdmin } from '@/lib/db/admin-client';

/**
 * POST /api/admin/orgs/[orgId]/credits
 *
 * Grant additional credits to an org.
 * Creates record in admin_credit_grants table.
 *
 * Auth: Requires super admin
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { orgId: string } }
) {
  try {
    await requireSuperAdmin();
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }

  const adminUserId = await getSuperAdminUserId();
  if (!adminUserId) {
    return NextResponse.json(
      { error: 'Failed to get admin user ID' },
      { status: 500 }
    );
  }

  try {
    const { credits, reason } = await req.json();
    const { orgId } = params;

    // Validate input
    if (typeof credits !== 'number' || credits <= 0) {
      return NextResponse.json(
        { error: 'credits must be a positive number' },
        { status: 400 }
      );
    }

    if (!reason || typeof reason !== 'string') {
      return NextResponse.json(
        { error: 'reason is required' },
        { status: 400 }
      );
    }

    // Insert credit grant
    const { data, error } = await supabaseAdmin
      .from('admin_credit_grants')
      .insert({
        org_id: orgId,
        granted_by: adminUserId,
        credits,
        reason,
      })
      .select()
      .single();

    if (error) {
      console.error('[POST /api/admin/orgs/credits] Error:', error);
      return NextResponse.json(
        { error: 'Failed to grant credits' },
        { status: 500 }
      );
    }

    // Calculate new balance (sum of all grants for this org)
    const { data: grants } = await supabaseAdmin
      .from('admin_credit_grants')
      .select('credits')
      .eq('org_id', orgId);

    const totalGranted = grants?.reduce((sum, g) => sum + g.credits, 0) || 0;

    return NextResponse.json({
      success: true,
      grant: data,
      total_granted: totalGranted,
    });
  } catch (error) {
    console.error('[POST /api/admin/orgs/credits] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
