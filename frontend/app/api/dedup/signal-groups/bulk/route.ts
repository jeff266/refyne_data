import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { requireAdmin } from '@/lib/auth/roles';
import { supabase } from '@/lib/db/supabase';

export const dynamic = 'force-dynamic';

/**
 * PUT /api/dedup/signal-groups/bulk
 *
 * Bulk replace all signal groups for an org + object type.
 * Deletes existing groups and inserts new ones in a single operation.
 *
 * Auth: requireAdmin()
 */
export async function PUT(request: NextRequest) {
  let ctx;
  try {
    ctx = await getOrgContext();
    requireAdmin(ctx.orgRole);
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  try {
    const body = await request.json();
    const { objectType, groups } = body;

    // Validation
    if (!objectType || !['company', 'contact'].includes(objectType)) {
      return NextResponse.json(
        { error: 'Invalid objectType (must be "company" or "contact")' },
        { status: 400 }
      );
    }

    if (!Array.isArray(groups)) {
      return NextResponse.json({ error: 'groups must be an array' }, { status: 400 });
    }

    // Validate each group
    for (const group of groups) {
      if (!group.conditions || !Array.isArray(group.conditions) || group.conditions.length === 0) {
        return NextResponse.json(
          { error: 'Each group must have at least 1 condition' },
          { status: 400 }
        );
      }

      for (const condition of group.conditions) {
        if (!['exact', 'fuzzy', 'normalized'].includes(condition.match_type)) {
          return NextResponse.json(
            { error: 'Invalid match_type (must be exact, fuzzy, or normalized)' },
            { status: 400 }
          );
        }

        if (
          condition.match_type === 'fuzzy' &&
          (condition.fuzzy_threshold < 0.5 || condition.fuzzy_threshold > 1.0)
        ) {
          return NextResponse.json(
            { error: 'fuzzy_threshold must be between 0.5 and 1.0' },
            { status: 400 }
          );
        }
      }
    }

    if (!supabase) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    // Delete all existing signal groups for this org + objectType
    const { error: deleteError } = await supabase
      .from('dedup_signal_groups')
      .delete()
      .eq('org_id', ctx.orgId)
      .eq('object_type', objectType);

    if (deleteError) {
      console.error('[Signal Groups Bulk] Delete error:', deleteError);
      return NextResponse.json({ error: 'Failed to delete existing groups' }, { status: 500 });
    }

    // If groups array is empty, we're done (user clicked "Reset to defaults")
    if (groups.length === 0) {
      return NextResponse.json({ groups: [] });
    }

    // Insert new groups
    const groupsToInsert = groups.map((group, idx) => ({
      org_id: ctx.orgId,
      object_type: objectType,
      name: group.name || `Group ${idx + 1}`,
      group_order: group.group_order ?? idx + 1,
    }));

    const { data: insertedGroups, error: groupInsertError } = await supabase
      .from('dedup_signal_groups')
      .insert(groupsToInsert)
      .select();

    if (groupInsertError || !insertedGroups) {
      console.error('[Signal Groups Bulk] Group insert error:', groupInsertError);
      return NextResponse.json({ error: 'Failed to insert groups' }, { status: 500 });
    }

    // Insert conditions for each group
    const conditionsToInsert = [];
    for (let i = 0; i < groups.length; i++) {
      const group = groups[i];
      const insertedGroup = insertedGroups[i];

      for (const condition of group.conditions) {
        conditionsToInsert.push({
          signal_group_id: insertedGroup.id,
          field: condition.field,
          match_type: condition.match_type,
          fuzzy_threshold: condition.fuzzy_threshold ?? 0.85,
          weight: condition.weight ?? 10,
        });
      }
    }

    const { error: conditionInsertError } = await supabase
      .from('dedup_signal_conditions')
      .insert(conditionsToInsert);

    if (conditionInsertError) {
      console.error('[Signal Groups Bulk] Condition insert error:', conditionInsertError);
      return NextResponse.json({ error: 'Failed to insert conditions' }, { status: 500 });
    }

    // Fetch complete groups with conditions to return
    const { data: finalGroups, error: fetchError } = await supabase
      .from('dedup_signal_groups')
      .select('*, conditions:dedup_signal_conditions(*)')
      .eq('org_id', ctx.orgId)
      .eq('object_type', objectType)
      .order('group_order', { ascending: true });

    if (fetchError) {
      console.error('[Signal Groups Bulk] Fetch error:', fetchError);
      return NextResponse.json({ error: 'Failed to fetch groups' }, { status: 500 });
    }

    return NextResponse.json({ groups: finalGroups || [] });
  } catch (error) {
    console.error('[Signal Groups Bulk] Error:', error);
    return NextResponse.json({ error: 'Failed to update signal groups' }, { status: 500 });
  }
}
