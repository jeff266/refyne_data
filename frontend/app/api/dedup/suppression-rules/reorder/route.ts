import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/db/supabase';
import {
  rowToRule,
  type SuppressionRuleRow,
  type ReorderRulesRequest,
} from '@/lib/dedup/types';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';

/**
 * POST /api/dedup/suppression-rules/reorder
 *
 * Reorder suppression rules.
 * Admin role only.
 */
export async function POST(request: NextRequest) {
  // Add auth check
  let ctx;
  try { ctx = getOrgContext(); }
  catch (e) { return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 }); }

  try {
    if (!isSupabaseConfigured() || !supabase) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 503 }
      );
    }

    const orgId = ctx.orgId;

    const body = await request.json() as ReorderRulesRequest;

    // Validate ids is an array
    if (!Array.isArray(body.ids) || body.ids.length === 0) {
      return NextResponse.json(
        { error: 'ids must be a non-empty array', field: 'ids' },
        { status: 400 }
      );
    }

    // Get all current rules for this org
    const { data: currentRules, error: fetchError } = await supabase
      .from('dedup_suppression_rules')
      .select('id')
      .eq('org_id', orgId);

    if (fetchError) {
      console.error('Failed to fetch rules for reorder:', fetchError);
      return NextResponse.json(
        { error: 'Failed to fetch rules' },
        { status: 500 }
      );
    }

    // Validate that ids match exactly
    const currentIds = new Set(currentRules?.map(r => r.id) || []);
    const submittedIds = new Set(body.ids);

    if (currentIds.size !== submittedIds.size) {
      return NextResponse.json(
        { error: 'ids must include exactly all rule IDs for this org', field: 'ids' },
        { status: 400 }
      );
    }

    for (const id of body.ids) {
      if (!currentIds.has(id)) {
        return NextResponse.json(
          { error: `Rule ID ${id} does not belong to this org`, field: 'ids' },
          { status: 400 }
        );
      }
    }

    // Update priorities based on submitted order
    const now = new Date().toISOString();
    for (let i = 0; i < body.ids.length; i++) {
      const { error: updateError } = await supabase
        .from('dedup_suppression_rules')
        .update({ priority: i + 1, updated_at: now })
        .eq('id', body.ids[i]);

      if (updateError) {
        console.error(`Failed to update priority for rule ${body.ids[i]}:`, updateError);
        return NextResponse.json(
          { error: 'Failed to update priorities' },
          { status: 500 }
        );
      }
    }

    // Return updated rules in new order
    const { data: updatedRules, error: selectError } = await supabase
      .from('dedup_suppression_rules')
      .select('*')
      .eq('org_id', orgId)
      .order('priority', { ascending: true });

    if (selectError) {
      console.error('Failed to fetch updated rules:', selectError);
      return NextResponse.json(
        { error: 'Rules reordered but failed to fetch updated list' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      rules: (updatedRules as SuppressionRuleRow[]).map(rowToRule),
    });
  } catch (error) {
    console.error('Failed to reorder suppression rules:', error);
    return NextResponse.json(
      { error: 'Failed to reorder rules' },
      { status: 500 }
    );
  }
}
