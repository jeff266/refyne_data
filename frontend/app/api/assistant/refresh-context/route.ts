/**
 * Assistant Context - Manual Refresh
 *
 * POST: Force immediate context rebuild (admin only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, authError } from '@/lib/auth/clerk-helpers';
import { buildWorkspaceContext } from '@/lib/assistant/context-builder';

export async function POST(request: NextRequest) {
  let ctx;
  try {
    ctx = await requireAdmin();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  try {
    await buildWorkspaceContext(ctx.orgId, `manual_${ctx.userId}`);

    return NextResponse.json({
      success: true,
      message: 'Context refreshed successfully',
    });
  } catch (error) {
    console.error('[Refresh Context] Error:', error);
    return NextResponse.json(
      { error: 'Failed to refresh context' },
      { status: 500 }
    );
  }
}
