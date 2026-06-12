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
    const { name, group_priority, is_active, conditions } = body;

    console.log('[Survivorship Groups PATCH] Request:', {
      groupId,
      orgId: ctx.orgId,
      updates: { name, group_priority, is_active, conditions: conditions?.length }
    });

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

    console.log('[Survivorship Groups PATCH] Applying updates:', updates);

    const { data, error } = await supabaseAdmin
      .from('dedup_survivorship_rule_groups')
      .update(updates)
      .eq('id', groupId)
      .select()
      .single();

    console.log('[Survivorship Groups PATCH] Update result:', {
      hasData: !!data,
      hasError: !!error,
      error: error ? JSON.stringify(error, Object.getOwnPropertyNames(error)) : null
    });

    if (error) throw error;

    // Update conditions if provided
    if (conditions && Array.isArray(conditions)) {
      console.log('[Survivorship Groups PATCH] Updating conditions');

      // Delete existing conditions
      const { error: deleteError } = await supabaseAdmin
        .from('dedup_survivorship_rule_conditions')
        .delete()
        .eq('group_id', groupId);

      if (deleteError) {
        console.error('[Survivorship Groups PATCH] Failed to delete old conditions:', deleteError);
        throw deleteError;
      }

      // Insert new conditions
      if (conditions.length > 0) {
        const conditionInserts = conditions.map((c: any) => ({
          group_id: groupId,
          field_key: c.field_key,
          operator: c.operator,
          value: c.value ?? null,
        }));

        const { error: insertError } = await supabaseAdmin
          .from('dedup_survivorship_rule_conditions')
          .insert(conditionInserts);

        if (insertError) {
          console.error('[Survivorship Groups PATCH] Failed to insert new conditions:', insertError);
          throw insertError;
        }
      }
    }

    // Fetch conditions
    const { data: updatedConditions } = await supabaseAdmin
      .from('dedup_survivorship_rule_conditions')
      .select('*')
      .eq('group_id', groupId);

    return NextResponse.json({
      ...data,
      conditions: updatedConditions ?? [],
    });
  } catch (error) {
    console.error('[Survivorship Groups PATCH] Error:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
    console.error('[Survivorship Groups PATCH] Error stack:', error instanceof Error ? error.stack : 'No stack');
    console.error('[Survivorship Groups PATCH] Error details:', {
      message: error instanceof Error ? error.message : String(error),
      name: error instanceof Error ? error.name : typeof error,
      raw: error
    });
    return NextResponse.json(
      { error: 'Failed to update group', details: error instanceof Error ? error.message : String(error) },
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
