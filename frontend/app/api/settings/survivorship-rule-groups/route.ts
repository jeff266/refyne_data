/**
 * Survivorship Rule Groups API
 *
 * GET  /api/settings/survivorship-rule-groups - List all groups with conditions
 * POST /api/settings/survivorship-rule-groups - Create new group with conditions
 */

import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { supabaseAdmin } from '@/lib/db/admin-client';

export const dynamic = 'force-dynamic';

/**
 * GET /api/settings/survivorship-rule-groups
 *
 * Returns all groups with their conditions for the org, ordered by group_priority.
 */
export async function GET(request: NextRequest) {
  let ctx;
  try {
    ctx = await getOrgContext();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  try {
    // Fetch groups
    const { data: groups, error: groupsError } = await supabaseAdmin
      .from('dedup_survivorship_rule_groups')
      .select('*')
      .eq('org_id', ctx.orgId)
      .order('group_priority', { ascending: true });

    if (groupsError) throw groupsError;

    // Fetch all conditions for these groups
    const groupIds = (groups ?? []).map(g => g.id);
    const { data: conditions, error: conditionsError } = await supabaseAdmin
      .from('dedup_survivorship_rule_conditions')
      .select('*')
      .in('group_id', groupIds);

    if (conditionsError) throw conditionsError;

    // Attach conditions to groups
    const groupsWithConditions = (groups ?? []).map(group => ({
      ...group,
      conditions: (conditions ?? []).filter(c => c.group_id === group.id),
    }));

    return NextResponse.json({ groups: groupsWithConditions });
  } catch (error) {
    console.error('[Survivorship Groups] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch groups' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/settings/survivorship-rule-groups
 *
 * Create a new group with conditions.
 * Body: { name: string, conditions: Array<{ field_key, operator, comparison_value }> }
 */
export async function POST(request: NextRequest) {
  let ctx;
  try {
    ctx = await getOrgContext();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  try {
    const body = await request.json();
    const { name, conditions } = body;

    if (!name || !conditions || !Array.isArray(conditions)) {
      return NextResponse.json(
        { error: 'Missing required fields: name, conditions (array)' },
        { status: 400 }
      );
    }

    // Get next priority
    const { data: existingGroups } = await supabaseAdmin
      .from('dedup_survivorship_rule_groups')
      .select('group_priority')
      .eq('org_id', ctx.orgId)
      .order('group_priority', { ascending: false })
      .limit(1);

    const nextPriority = existingGroups && existingGroups.length > 0 && existingGroups[0].group_priority
      ? existingGroups[0].group_priority + 1
      : 1;

    // Insert group
    const { data: group, error: groupError } = await supabaseAdmin
      .from('dedup_survivorship_rule_groups')
      .insert({
        org_id: ctx.orgId,
        name,
        group_priority: nextPriority,
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

    return NextResponse.json({
      ...group,
      conditions: conditionsData ?? [],
    });
  } catch (error) {
    console.error('[Survivorship Groups] POST error:', error);
    return NextResponse.json(
      { error: 'Failed to create group' },
      { status: 500 }
    );
  }
}
