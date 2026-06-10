import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { requireAdmin } from '@/lib/auth/roles';
import { supabase } from '@/lib/db/supabase';

export const dynamic = 'force-dynamic';

/**
 * PATCH /api/dedup/signal-groups/[id]
 *
 * Update a signal group and optionally replace its conditions.
 * Auth: requireAdmin()
 * Body: { name?, group_order?, conditions? }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  let ctx;
  try {
    ctx = await getOrgContext();
    requireAdmin(ctx.orgRole);
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  const { id } = params;

  try {
    const body = await request.json();
    const { name, group_order, conditions } = body;

    if (!supabase) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    // Verify ownership
    const { data: existing, error: fetchError } = await supabase
      .from('dedup_signal_groups')
      .select('*')
      .eq('id', id)
      .eq('org_id', ctx.orgId)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Signal group not found' }, { status: 404 });
    }

    // Update group
    const updates: any = {};
    if (name !== undefined) updates.name = name;
    if (group_order !== undefined) updates.group_order = group_order;
    updates.updated_at = new Date().toISOString();

    const { error: updateError } = await supabase
      .from('dedup_signal_groups')
      .update(updates)
      .eq('id', id);

    if (updateError) {
      console.error('[Signal Groups] Error updating:', updateError);
      return NextResponse.json({ error: 'Failed to update signal group' }, { status: 500 });
    }

    // Replace conditions if provided
    if (conditions && Array.isArray(conditions)) {
      // Delete existing conditions
      await supabase
        .from('dedup_signal_conditions')
        .delete()
        .eq('group_id', id);

      // Insert new conditions
      if (conditions.length > 0) {
        const conditionInserts = conditions.map((c: any) => ({
          group_id: id,
          field: c.field,
          match_type: c.matchType || 'exact',
          fuzzy_threshold: c.fuzzyThreshold || 0.85,
          weight: c.weight || 10,
        }));

        const { error: insertError } = await supabase
          .from('dedup_signal_conditions')
          .insert(conditionInserts);

        if (insertError) {
          console.error('[Signal Groups] Error replacing conditions:', insertError);
          return NextResponse.json({ error: 'Failed to update conditions' }, { status: 500 });
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Signal Groups] Error:', error);
    return NextResponse.json({ error: 'Failed to update signal group' }, { status: 500 });
  }
}

/**
 * DELETE /api/dedup/signal-groups/[id]
 *
 * Delete a signal group (cascades to conditions).
 * Auth: requireAdmin()
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  let ctx;
  try {
    ctx = await getOrgContext();
    requireAdmin(ctx.orgRole);
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  const { id } = params;

  try {
    if (!supabase) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    // Verify ownership
    const { data: existing } = await supabase
      .from('dedup_signal_groups')
      .select('*')
      .eq('id', id)
      .eq('org_id', ctx.orgId)
      .single();

    if (!existing) {
      return NextResponse.json({ error: 'Signal group not found' }, { status: 404 });
    }

    // Delete (cascades to conditions via ON DELETE CASCADE)
    const { error: deleteError } = await supabase
      .from('dedup_signal_groups')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('[Signal Groups] Error deleting:', deleteError);
      return NextResponse.json({ error: 'Failed to delete signal group' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Signal Groups] Error:', error);
    return NextResponse.json({ error: 'Failed to delete signal group' }, { status: 500 });
  }
}
