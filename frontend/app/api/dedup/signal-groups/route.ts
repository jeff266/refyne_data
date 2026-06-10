import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { requireAdmin } from '@/lib/auth/roles';
import { supabase } from '@/lib/db/supabase';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

/**
 * GET /api/dedup/signal-groups
 *
 * List signal groups for the org.
 * Auth: getOrgContext()
 * Query: ?objectType=company|contact
 */
export async function GET(request: NextRequest) {
  let ctx;
  try {
    ctx = await getOrgContext();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const objectType = searchParams.get('objectType') || 'company';

  try {
    if (!supabase) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    // Get groups with their conditions
    const { data: groups, error: groupsError } = await supabase
      .from('dedup_signal_groups')
      .select(`
        *,
        conditions:dedup_signal_conditions(*)
      `)
      .eq('org_id', ctx.orgId)
      .eq('object_type', objectType)
      .order('group_order', { ascending: true });

    if (groupsError) {
      console.error('[Signal Groups] Error fetching:', groupsError);
      return NextResponse.json({ error: 'Failed to fetch signal groups' }, { status: 500 });
    }

    return NextResponse.json({ groups: groups || [] });
  } catch (error) {
    console.error('[Signal Groups] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch signal groups' }, { status: 500 });
  }
}

const signalGroupSchema = z.object({
  name: z.string().optional(),
  objectType: z.enum(['company', 'contact']),
  group_order: z.number().int().min(1).optional(),
  conditions: z.array(z.object({
    field: z.string().min(1),
    match_type: z.enum(['exact', 'fuzzy', 'normalized']),
    fuzzy_threshold: z.number().min(0.5).max(1.0).optional(),
    weight: z.number().int().min(1).max(100).optional(),
  })).min(1, 'At least one condition required'),
});

/**
 * POST /api/dedup/signal-groups
 *
 * Create a signal group with conditions.
 * Auth: requireAdmin()
 * Body: { name, objectType, conditions: [...] }
 */
export async function POST(request: NextRequest) {
  let ctx;
  try {
    ctx = await getOrgContext();
    requireAdmin(ctx.orgRole);
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  try {
    // Validate request body
    const rawBody = await request.json();
    const validation = signalGroupSchema.safeParse(rawBody);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.issues },
        { status: 400 }
      );
    }
    const body = validation.data;
    const { name, objectType, conditions } = body;

    if (!supabase) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    // Get max group_order for this org
    const { data: existingGroups } = await supabase
      .from('dedup_signal_groups')
      .select('group_order')
      .eq('org_id', ctx.orgId)
      .eq('object_type', objectType)
      .order('group_order', { ascending: false })
      .limit(1);

    const maxOrder = existingGroups?.[0]?.group_order || 0;

    // Create group
    const { data: group, error: groupError } = await supabase
      .from('dedup_signal_groups')
      .insert({
        org_id: ctx.orgId,
        object_type: objectType,
        name,
        group_order: maxOrder + 1,
      })
      .select()
      .single();

    if (groupError || !group) {
      console.error('[Signal Groups] Error creating group:', groupError);
      return NextResponse.json({ error: 'Failed to create signal group' }, { status: 500 });
    }

    // Create conditions
    const conditionInserts = conditions.map((c: any) => ({
      group_id: group.id,
      field: c.field,
      match_type: c.matchType || 'exact',
      fuzzy_threshold: c.fuzzyThreshold || 0.85,
      weight: c.weight || 10,
    }));

    const { error: conditionsError } = await supabase
      .from('dedup_signal_conditions')
      .insert(conditionInserts);

    if (conditionsError) {
      console.error('[Signal Groups] Error creating conditions:', conditionsError);
      // Rollback group creation
      await supabase.from('dedup_signal_groups').delete().eq('id', group.id);
      return NextResponse.json({ error: 'Failed to create conditions' }, { status: 500 });
    }

    return NextResponse.json({ success: true, group });
  } catch (error) {
    console.error('[Signal Groups] Error:', error);
    return NextResponse.json({ error: 'Failed to create signal group' }, { status: 500 });
  }
}
