/**
 * Dedup Calibration Skip - Onboarding
 *
 * POST: Skip calibration step
 *
 * Admin only.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, authError } from '@/lib/auth/clerk-helpers';
import { supabaseAdmin } from '@/lib/db/admin-client';

export async function POST(request: NextRequest) {
  let ctx;
  try {
    ctx = await requireAdmin();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  try {
    const { error } = await supabaseAdmin
      .from('onboarding_progress')
      .update({
        dedup_calibration_skipped_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('org_id', ctx.orgId);

    if (error) {
      console.error('[Calibration Skip] Failed to update progress:', error);
      return NextResponse.json(
        { error: 'Failed to skip calibration' },
        { status: 500 }
      );
    }

    console.log(`[Calibration Skip] Skipped for org ${ctx.orgId}`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Calibration Skip] Error:', error);
    return NextResponse.json(
      { error: 'Failed to skip calibration' },
      { status: 500 }
    );
  }
}
