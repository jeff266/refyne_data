import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext, authError, requireOperatorOrAbove } from '@/lib/auth/clerk-helpers';
import { captureWithOrgContext } from '@/lib/monitoring/sentry';
import { supabase, isSupabaseConfigured } from '@/lib/db/supabase';

/**
 * GET /api/providers/connections
 *
 * Returns list of configured provider connections for the org
 * Auth: org:operator or above
 */
export async function GET(request: NextRequest) {
  let ctx;
  try {
    ctx = await requireOperatorOrAbove();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  try {
    if (!isSupabaseConfigured() || !supabase) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 503 }
      );
    }

    // Query provider_connections table (if it exists)
    // For now, return empty array since we haven't created the table yet
    // This will be populated when BYOK providers are configured

    const connections: Array<{ provider: string; status: string }> = [
      // Placeholder - real implementation would query provider_connections table
      // { provider: 'apollo', status: 'active' },
      // { provider: 'zoominfo', status: 'error' },
    ];

    return NextResponse.json({ connections });

  } catch (error) {
    captureWithOrgContext(error, ctx.orgId, { route: '/api/providers/connections' });
    console.error('Failed to get provider connections:', error);
    return NextResponse.json(
      { error: 'Failed to get connections' },
      { status: 500 }
    );
  }
}
