import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { requireAdmin } from '@/lib/auth/roles';
import { supabase } from '@/lib/db/supabase';
import { isRedisConfigured, getRedisConnection } from '@/lib/queue/redis';

// Whitelist of allowed fields for PATCH
const ALLOWED_FIELDS = [
  'workspace_name',
  'user_role',
  'use_cases',
  'use_case_selected_at',
  'welcome_completed_at',
  'invited_team_at',
  'onboarding_flow_completed_at',
  'onboarding_flow_skipped_at',
  'calibration_completed',
  'calibration_completed_at',
  'ran_normalize',
  'connected_hubspot',
  'viewed_dedup',
  'applied_harmony',
  'first_normalize_at',
  'first_merge_at',
  'viewed_dashboard',
];

/**
 * GET /api/onboarding/progress
 *
 * Returns onboarding progress for current org
 * Auth: Any authenticated user
 * Cache: 60 seconds in Redis
 */
export async function GET(request: NextRequest) {
  let ctx;
  try {
    ctx = await getOrgContext();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  try {
    // Check Redis cache first
    const redis = isRedisConfigured() ? getRedisConnection() : null;
    const cacheKey = `onboarding:${ctx.orgId}`;

    if (redis) {
      try {
        const cached = await redis.get(cacheKey);
        if (cached) {
          return NextResponse.json(JSON.parse(cached));
        }
      } catch (err) {
        console.error('[Onboarding Progress] Redis error:', err);
      }
    }

    // Fetch from database
    if (!supabase) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    const { data, error } = await supabase
      .from('onboarding_progress')
      .select('*')
      .eq('org_id', ctx.orgId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('[Onboarding Progress] Database error:', error);
      return NextResponse.json({ error: 'Failed to fetch progress' }, { status: 500 });
    }

    // If no row exists, return defaults
    const progress = data || {
      org_id: ctx.orgId,
      connected_hubspot: false,
      viewed_dashboard: false,
      viewed_dedup: false,
      applied_harmony: false,
      ran_normalize: false,
      calibration_completed: false,
      calibration_completed_at: null,
      use_cases: null,
      use_case_selected_at: null,
      welcome_completed_at: null,
      invited_team_at: null,
      onboarding_flow_completed_at: null,
      onboarding_flow_skipped_at: null,
      workspace_name: null,
      user_role: null,
      completed_at: null,
      dismissed_at: null,
      first_normalize_at: null,
      first_merge_at: null,
      created_at: new Date().toISOString(),
    };

    // Cache for 60 seconds
    if (redis) {
      try {
        await redis.setex(cacheKey, 60, JSON.stringify(progress));
      } catch (err) {
        console.error('[Onboarding Progress] Redis cache write error:', err);
      }
    }

    return NextResponse.json(progress);
  } catch (error: any) {
    console.error('[Onboarding Progress] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch onboarding progress' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/onboarding/progress
 *
 * Updates onboarding progress (partial update)
 * Auth: org:admin only
 * Body: Partial onboarding_progress fields
 */
export async function PATCH(request: NextRequest) {
  let ctx;
  try {
    ctx = await getOrgContext();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  // Require admin for updates
  try {
    requireAdmin(ctx.orgRole);
  } catch (e) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  try {
    const body = await request.json();

    // Filter to only allowed fields
    const updates: Record<string, any> = {};
    for (const [key, value] of Object.entries(body)) {
      if (ALLOWED_FIELDS.includes(key)) {
        updates[key] = value;
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    if (!supabase) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    // UPSERT onboarding_progress
    const { data, error } = await supabase
      .from('onboarding_progress')
      .upsert({
        org_id: ctx.orgId,
        ...updates,
      }, { onConflict: 'org_id' })
      .select()
      .single();

    if (error) {
      console.error('[Onboarding Progress] Update error:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });
      console.error('[Onboarding Progress] Attempted update:', updates);

      // Return more helpful error message
      let errorMessage = 'Failed to update progress';
      if (error.message && error.message.includes('user_role_check')) {
        errorMessage = 'Invalid role value. Please leave role blank or use a different value.';
      }

      return NextResponse.json({ error: errorMessage }, { status: 500 });
    }

    // Invalidate Redis cache
    const redis = isRedisConfigured() ? getRedisConnection() : null;
    if (redis) {
      try {
        await redis.del(`onboarding:${ctx.orgId}`);
      } catch (err) {
        console.error('[Onboarding Progress] Redis cache invalidation error:', err);
      }
    }

    return NextResponse.json({ success: true, progress: data });
  } catch (error: any) {
    console.error('[Onboarding Progress] Error:', error);
    return NextResponse.json(
      { error: 'Failed to update onboarding progress' },
      { status: 500 }
    );
  }
}
