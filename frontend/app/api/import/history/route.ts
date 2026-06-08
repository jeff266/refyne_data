import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { isBetaFeatureEnabled } from '@/lib/features/flags';
import { FEATURE_FLAGS } from '@/lib/features/flags';
import { supabaseAdmin } from '@/lib/db/admin-client';

/**
 * GET /api/import/history
 * Get import history for current org (last 20)
 */
export async function GET(request: NextRequest) {
  // Auth
  let ctx;
  try {
    ctx = await getOrgContext();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  // Beta gate
  const betaEnabled = await isBetaFeatureEnabled(ctx.orgId, FEATURE_FLAGS.EVENT_LIST_IMPORT);
  if (!betaEnabled) {
    return NextResponse.json({ error: 'feature_not_enabled' }, { status: 403 });
  }

  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  try {
    // Load last 20 imports for org
    const { data: imports, error: importsError } = await supabaseAdmin
      .from('event_imports')
      .select('*')
      .eq('org_id', ctx.orgId)
      .order('created_at', { ascending: false })
      .limit(20);

    if (importsError) {
      console.error('[Import History] Failed to load imports:', importsError);
      return NextResponse.json({ error: 'Failed to load import history' }, { status: 500 });
    }

    // Return list
    return NextResponse.json({
      imports: imports || [],
    });
  } catch (error) {
    console.error('[Import History] Unexpected error:', error);
    return NextResponse.json({ error: 'Failed to load import history' }, { status: 500 });
  }
}
