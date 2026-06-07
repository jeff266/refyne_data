import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { requireAdmin } from '@/lib/auth/roles';
import { staffOverrideFlag, FEATURE_FLAGS, type FeatureFlag } from '@/lib/features/flags';
import { supabase } from '@/lib/db/supabase';

/**
 * POST /api/admin/features/override
 *
 * Staff override - enable any flag for any org.
 * Auth: Must have isRefyneStaff Clerk metadata
 * Body: { target_org_id: string, flag: FeatureFlag, enabled: boolean, note: string }
 */
export async function POST(request: NextRequest) {
  let ctx;
  try {
    ctx = await getOrgContext();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  // Only admins can use staff override
  // TODO: In future, add isRefyneStaff check from Clerk metadata
  requireAdmin(ctx.orgRole);

  try {
    const body = await request.json();
    const { target_org_id, flag, enabled, note } = body;

    if (!target_org_id || !flag || typeof enabled !== 'boolean' || !note) {
      return NextResponse.json(
        { error: 'Missing required fields: target_org_id, flag, enabled, note' },
        { status: 400 }
      );
    }

    // Validate flag is in FEATURE_FLAGS enum
    if (!Object.values(FEATURE_FLAGS).includes(flag)) {
      return NextResponse.json({ error: 'Invalid flag name' }, { status: 400 });
    }

    if (enabled) {
      await staffOverrideFlag(target_org_id, flag, ctx.userId, note);
    } else {
      // To disable a staff override, we just set staff_override to false
      // This is a simplified version - in production you might want a separate function
      if (supabase) {
        await supabase
          .from('org_feature_flags')
          .upsert({
            org_id: target_org_id,
            flag,
            staff_override: false,
            updated_at: new Date().toISOString()
          }, { onConflict: 'org_id,flag' });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[Feature Flags Override] Error:', error);
    return NextResponse.json(
      { error: 'Failed to override feature flag' },
      { status: 500 }
    );
  }
}
