import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { requireAdmin } from '@/lib/auth/roles';
import {
  getFeatureFlags,
  enableFlag,
  disableFlag,
  FEATURE_FLAGS,
  type FeatureFlag
} from '@/lib/features/flags';
import { supabase } from '@/lib/db/supabase';

/**
 * GET /api/features/flags
 *
 * Get feature flag states for the current org.
 * Query: flags (comma-separated list of flag names)
 */
export async function GET(request: NextRequest) {
  let ctx;
  try {
    ctx = await getOrgContext();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const flagsParam = searchParams.get('flags');

    if (!flagsParam) {
      return NextResponse.json({ error: 'flags parameter required' }, { status: 400 });
    }

    const requestedFlags = flagsParam.split(',') as FeatureFlag[];

    // Validate each flag name against FEATURE_FLAGS enum
    // Return false for unknown flags (don't error)
    const validFlags = requestedFlags.filter(flag =>
      Object.values(FEATURE_FLAGS).includes(flag)
    );

    const flags = await getFeatureFlags(ctx.orgId, validFlags);

    // Add false for any unknown flags
    requestedFlags.forEach(flag => {
      if (!validFlags.includes(flag)) {
        flags[flag] = false;
      }
    });

    return NextResponse.json({ flags });
  } catch (error: any) {
    console.error('[Feature Flags] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch feature flags' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/features/flags
 *
 * Enable or disable a feature flag for the current org.
 * Body: { flag: FeatureFlag, enabled: boolean }
 */
export async function POST(request: NextRequest) {
  let ctx;
  try {
    ctx = await getOrgContext();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  requireAdmin(ctx.orgRole);

  try {
    const body = await request.json();
    const { flag, enabled } = body;

    // Validate flag is in FEATURE_FLAGS enum
    if (!Object.values(FEATURE_FLAGS).includes(flag)) {
      return NextResponse.json({ error: 'Invalid flag name' }, { status: 400 });
    }

    // Special case for beta_features master toggle
    // When enabling, auto-provision all known flags for this org
    if (flag === FEATURE_FLAGS.BETA_FEATURES && enabled && supabase) {
      const allFlags = Object.values(FEATURE_FLAGS);

      await supabase.from('org_feature_flags').upsert(
        allFlags.map(f => ({
          org_id: ctx.orgId,
          flag: f,
          enabled: f === FEATURE_FLAGS.BETA_FEATURES, // Only beta_features starts enabled
        })),
        { onConflict: 'org_id,flag', ignoreDuplicates: true }
      );
    }

    if (enabled) {
      await enableFlag(ctx.orgId, flag, ctx.userId);
    } else {
      await disableFlag(ctx.orgId, flag, ctx.userId);
    }

    return NextResponse.json({ success: true, flag, enabled });
  } catch (error: any) {
    console.error('[Feature Flags] Error:', error);
    return NextResponse.json(
      { error: 'Failed to update feature flag' },
      { status: 500 }
    );
  }
}
