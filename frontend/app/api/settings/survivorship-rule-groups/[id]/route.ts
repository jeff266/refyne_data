/**
 * Survivorship Rule Group Management API
 *
 * PATCH  /api/settings/survivorship-rule-groups/[id] - Update group (name, priority, active)
 * DELETE /api/settings/survivorship-rule-groups/[id] - Delete group (cascades to conditions)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { supabaseAdmin } from '@/lib/db/admin-client';

export const dynamic = 'force-dynamic';

/**
 * PATCH /api/settings/survivorship-rule-groups/[id]
 *
 * Update a group's name, priority, or active state.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  let ctx;
  try {
    ctx = await getOrgContext();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  try {
    const groupId = params.id;
    const body = await request.json();
    const { name, group_priority, is_active } = body;

    // Verify group belongs to this org
    const { data: existingGroup, error: fetchError } = await supabaseAdmin
      .from('dedup_survivorship_rule_groups')
      .select('*')
      .eq('id', groupId)
      .single();

    if (fetchError || !existingGroup) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }

    if (existingGroup.org_id !== ctx.orgId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Build updates
    const updates: any = {};
    if (name !== undefined) updates.name = name;
    if (group_priority !== undefined) updates.group_priority = group_priority;
    if (is_active !== undefined) updates.is_active = is_active;
    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from('dedup_survivorship_rule_groups')
      .update(updates)
      .eq('id', groupId)
      .select()
      .single();

    if (error) throw error;

    // Fetch conditions
    const { data: conditions } = await supabaseAdmin
      .from('dedup_survivorship_rule_conditions')
      .select('*')
      .eq('group_id', groupId);

    return NextResponse.json({
      ...data,
      conditions: conditions ?? [],
    });
  } catch (error) {
    console.error('[Survivorship Groups] PATCH error:', error);
    return NextResponse.json(
      { error: 'Failed to update group' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/settings/survivorship-rule-groups/[id]
 *
 * Delete a group (cascade deletes conditions via database constraint).
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  let ctx;
  try {
    ctx = await getOrgContext();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  try {
    const groupId = params.id;

    // Verify group belongs to this org
    const { data: existingGroup, error: fetchError } = await supabaseAdmin
      .from('dedup_survivorship_rule_groups')
      .select('*')
      .eq('id', groupId)
      .single();

    if (fetchError || !existingGroup) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }

    if (existingGroup.org_id !== ctx.orgId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Delete group (cascade deletes conditions via ON DELETE CASCADE)
    const { error } = await supabaseAdmin
      .from('dedup_survivorship_rule_groups')
      .delete()
      .eq('id', groupId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Survivorship Groups] DELETE error:', error);
    return NextResponse.json(
      { error: 'Failed to delete group' },
      { status: 500 }
    );
  }
}
