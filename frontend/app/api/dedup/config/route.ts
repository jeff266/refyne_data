import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { requireAdmin } from '@/lib/auth/roles';
import { supabase } from '@/lib/db/supabase';

export const dynamic = 'force-dynamic';

/**
 * GET /api/dedup/config
 *
 * Get dedup config for the org.
 * Auth: getOrgContext()
 */
export async function GET(request: NextRequest) {
  let ctx;
  try {
    ctx = await getOrgContext();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  try {
    if (!supabase) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    const { data: config, error } = await supabase
      .from('dedup_config')
      .select('*')
      .eq('org_id', ctx.orgId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('[Dedup Config] Error fetching:', error);
      return NextResponse.json({ error: 'Failed to fetch dedup config' }, { status: 500 });
    }

    // Return empty config if not found
    if (!config) {
      return NextResponse.json({
        config: {
          org_id: ctx.orgId,
          inactive_owner_action: 'warn',
          parent_child_awareness: false,
          require_closed_won_survivor: false,
        },
      });
    }

    return NextResponse.json({ config });
  } catch (error) {
    console.error('[Dedup Config] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch dedup config' }, { status: 500 });
  }
}

/**
 * PATCH /api/dedup/config
 *
 * Update dedup config for the org.
 * Auth: requireAdmin()
 */
export async function PATCH(request: NextRequest) {
  let ctx;
  try {
    ctx = await getOrgContext();
    requireAdmin(ctx.orgRole);
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  try {
    const body = await request.json();
    const {
      inactive_owner_action,
      inactive_owner_fallback_id,
      parent_child_awareness,
      require_closed_won_survivor,
    } = body;

    if (
      inactive_owner_action &&
      !['warn', 'assign_fallback', 'leave_unassigned'].includes(inactive_owner_action)
    ) {
      return NextResponse.json(
        { error: 'Invalid inactive_owner_action' },
        { status: 400 }
      );
    }

    if (!supabase) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    const updates: any = {};
    if (inactive_owner_action !== undefined) updates.inactive_owner_action = inactive_owner_action;
    if (inactive_owner_fallback_id !== undefined) updates.inactive_owner_fallback_id = inactive_owner_fallback_id;
    if (parent_child_awareness !== undefined) updates.parent_child_awareness = parent_child_awareness;
    if (require_closed_won_survivor !== undefined) updates.require_closed_won_survivor = require_closed_won_survivor;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('dedup_config')
      .upsert(
        { org_id: ctx.orgId, ...updates },
        { onConflict: 'org_id' }
      )
      .select()
      .single();

    if (error) {
      console.error('[Dedup Config] Error updating:', error);
      return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
    }

    return NextResponse.json({ success: true, config: data });
  } catch (error) {
    console.error('[Dedup Config] Error:', error);
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
  }
}
