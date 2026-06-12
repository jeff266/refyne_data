/**
 * Nightly Context Rebuild - Cron Job
 *
 * GET: Trigger nightly context rebuild for all orgs (2am UTC)
 *
 * Authenticated via CRON_SECRET environment variable
 */

import { NextRequest, NextResponse } from 'next/server';
import { runNightlyContextRebuild } from '@/lib/assistant/nightly-rebuild';

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  const expectedAuth = `Bearer ${process.env.CRON_SECRET}`;

  if (!process.env.CRON_SECRET || authHeader !== expectedAuth) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    await runNightlyContextRebuild();

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Nightly Context Cron] Error:', error);
    return NextResponse.json(
      { error: 'Failed to run nightly rebuild' },
      { status: 500 }
    );
  }
}
