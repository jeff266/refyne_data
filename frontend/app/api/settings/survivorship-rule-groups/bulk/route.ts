/**
 * Survivorship Rule Groups Bulk Replace API
 *
 * PUT /api/settings/survivorship-rule-groups/bulk - Replace all groups for org
 */

import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { supabaseAdmin } from '@/lib/db/admin-client';

export const dynamic = 'force-dynamic';

/**
 * PUT /api/settings/survivorship-rule-groups/bulk
 *
 * Atomically replace all groups for an org with a new set.
 * Body: { groups: Array<{ name, conditions: Array<{ field_key, operator, comparison_value }> }> }
 */
export async function PUT(request: NextRequest) {
  let ctx;
  try {
    ctx = await getOrgContext();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  try {
    const body = await request.json();
    const { groups } = body;

    if (!Array.isArray(groups)) {
      return NextResponse.json(
        { error: 'Missing required field: groups (array)' },
        { status: 400 }
      );
    }

    // Delete all existing groups for this org (cascade deletes conditions)
    const { error: deleteError } = await supabaseAdmin
      .from('dedup_survivorship_rule_groups')
      .delete()
      .eq('org_id', ctx.orgId);

    if (deleteError) throw deleteError;

    // Insert new groups
    const createdGroups = [];
    for (let i = 0; i < groups.length; i++) {
      const groupData = groups[i];
      const { name, conditions } = groupData;

      if (!name || !conditions || !Array.isArray(conditions)) {
        return NextResponse.json(
          { error: `Invalid group at index ${i}: missing name or conditions` },
          { status: 400 }
        );
      }

      // Insert group
      const { data: group, error: groupError } = await supabaseAdmin
        .from('dedup_survivorship_rule_groups')
        .insert({
          org_id: ctx.orgId,
          name,
          group_priority: i + 1, // Priority based on array order
          is_active: true,
        })
        .select()
        .single();

      if (groupError) throw groupError;

      // Insert conditions
      if (conditions.length > 0) {
        const conditionInserts = conditions.map((c: any) => ({
          group_id: group.id,
          field_key: c.field_key,
          operator: c.operator,
          comparison_value: c.comparison_value ?? null,
        }));

        const { error: conditionsError } = await supabaseAdmin
          .from('dedup_survivorship_rule_conditions')
          .insert(conditionInserts);

        if (conditionsError) throw conditionsError;
      }

      // Fetch back with conditions
      const { data: conditionsData } = await supabaseAdmin
        .from('dedup_survivorship_rule_conditions')
        .select('*')
        .eq('group_id', group.id);

      createdGroups.push({
        ...group,
        conditions: conditionsData ?? [],
      });
    }

    return NextResponse.json({ groups: createdGroups });
  } catch (error) {
    console.error('[Survivorship Groups] Bulk replace error:', error);
    return NextResponse.json(
      { error: 'Failed to replace groups' },
      { status: 500 }
    );
  }
}
