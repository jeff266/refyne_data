import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/db/supabase';
import {
  rowToRule,
  type SuppressionRuleRow,
  type UpdateSuppressionRuleRequest,
  type RuleCondition,
} from '@/lib/dedup/types';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { requireFeature, parseFeatureGateError } from '@/lib/billing/check-feature';

// Valid operators for conditions
const VALID_OPERATORS = new Set([
  'is_blank', 'is_not_blank', 'equals', 'not_equals',
  'differs_between', 'matches_between', 'contains',
]);

// Valid scopes for conditions
const VALID_SCOPES = new Set(['record_a', 'record_b', 'both', 'either']);

/**
 * Validate a condition object.
 */
function validateCondition(condition: RuleCondition, index: number): string | null {
  if (!condition.field || typeof condition.field !== 'string') {
    return `Condition ${index + 1}: field is required`;
  }
  if (!VALID_OPERATORS.has(condition.operator)) {
    return `Condition ${index + 1}: invalid operator "${condition.operator}"`;
  }
  if (!VALID_SCOPES.has(condition.scope)) {
    return `Condition ${index + 1}: invalid scope "${condition.scope}"`;
  }
  if (['equals', 'not_equals', 'contains'].includes(condition.operator)) {
    if (condition.value === null || condition.value === undefined) {
      return `Condition ${index + 1}: value required for operator "${condition.operator}"`;
    }
  }
  return null;
}

/**
 * PUT /api/dedup/suppression-rules/:id
 *
 * Update a suppression rule.
 * Admin role only.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // Add auth check
  let ctx;
  try { ctx = getOrgContext(); }
  catch (e) { return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 }); }

  // Feature gate: dedup
  try {
    await requireFeature(ctx.orgId, 'dedup');
  } catch (error) {
    const gateError = parseFeatureGateError(error);
    if (gateError) {
      return NextResponse.json(
        { error: 'feature_gated', feature: gateError.feature, currentPlan: gateError.currentPlan },
        { status: 403 }
      );
    }
    throw error;
  }

  try {
    if (!isSupabaseConfigured() || !supabase) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 503 }
      );
    }

    const { id } = params;
    const orgId = ctx.orgId;

    // Verify rule exists and belongs to org
    const { data: existing, error: selectError } = await supabase
      .from('dedup_suppression_rules')
      .select('*')
      .eq('id', id)
      .eq('org_id', orgId)
      .single();

    if (selectError || !existing) {
      return NextResponse.json(
        { error: 'Rule not found' },
        { status: 404 }
      );
    }

    const body = await request.json() as UpdateSuppressionRuleRequest;

    // Build update object - cannot mutate id, org_id, created_at
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (body.name !== undefined) {
      if (typeof body.name !== 'string' || body.name.trim() === '') {
        return NextResponse.json(
          { error: 'name cannot be empty', field: 'name' },
          { status: 400 }
        );
      }
      updateData.name = body.name.trim();
    }

    if (body.priority !== undefined) {
      updateData.priority = body.priority;
    }

    if (body.enabled !== undefined) {
      updateData.enabled = body.enabled;
    }

    if (body.action !== undefined) {
      if (!['block', 'review', 'require_approval'].includes(body.action)) {
        return NextResponse.json(
          { error: 'Invalid action', field: 'action' },
          { status: 400 }
        );
      }
      updateData.action = body.action;
    }

    if (body.approverUserId !== undefined) {
      updateData.approver_user_id = body.approverUserId;
    }

    // Check require_approval still has approver
    const finalAction = (updateData.action ?? existing.action) as string;
    const finalApprover = updateData.approver_user_id ?? existing.approver_user_id;
    if (finalAction === 'require_approval' && !finalApprover) {
      return NextResponse.json(
        { error: 'approverUserId required when action is require_approval', field: 'approverUserId' },
        { status: 400 }
      );
    }

    if (body.conditionOperator !== undefined) {
      if (!['AND', 'OR'].includes(body.conditionOperator)) {
        return NextResponse.json(
          { error: 'conditionOperator must be AND or OR', field: 'conditionOperator' },
          { status: 400 }
        );
      }
      updateData.condition_operator = body.conditionOperator;
    }

    if (body.conditions !== undefined) {
      if (!Array.isArray(body.conditions) || body.conditions.length < 1) {
        return NextResponse.json(
          { error: 'At least one condition is required', field: 'conditions' },
          { status: 400 }
        );
      }
      for (let i = 0; i < body.conditions.length; i++) {
        const conditionError = validateCondition(body.conditions[i], i);
        if (conditionError) {
          return NextResponse.json(
            { error: conditionError, field: 'conditions' },
            { status: 400 }
          );
        }
      }
      updateData.conditions = body.conditions;
    }

    if (body.uiNote !== undefined) {
      updateData.ui_note = body.uiNote;
    }

    // Update the rule
    const { data: updated, error: updateError } = await supabase
      .from('dedup_suppression_rules')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Failed to update suppression rule:', updateError);
      return NextResponse.json(
        { error: 'Failed to update rule' },
        { status: 500 }
      );
    }

    return NextResponse.json({ rule: rowToRule(updated as SuppressionRuleRow) });
  } catch (error) {
    console.error('Failed to update suppression rule:', error);
    return NextResponse.json(
      { error: 'Failed to update rule' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/dedup/suppression-rules/:id
 *
 * Delete a suppression rule.
 * Admin role only.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // Add auth check
  let ctx;
  try { ctx = getOrgContext(); }
  catch (e) { return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 }); }

  // Feature gate: dedup
  try {
    await requireFeature(ctx.orgId, 'dedup');
  } catch (error) {
    const gateError = parseFeatureGateError(error);
    if (gateError) {
      return NextResponse.json(
        { error: 'feature_gated', feature: gateError.feature, currentPlan: gateError.currentPlan },
        { status: 403 }
      );
    }
    throw error;
  }

  try {
    if (!isSupabaseConfigured() || !supabase) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 503 }
      );
    }

    const { id } = params;
    const orgId = ctx.orgId;

    // Get the rule first (to return suppressedCount and verify ownership)
    const { data: existing, error: selectError } = await supabase
      .from('dedup_suppression_rules')
      .select('suppressed_count, priority')
      .eq('id', id)
      .eq('org_id', orgId)
      .single();

    if (selectError || !existing) {
      return NextResponse.json(
        { error: 'Rule not found' },
        { status: 404 }
      );
    }

    const suppressedCount = existing.suppressed_count;

    // Delete the rule
    const { error: deleteError } = await supabase
      .from('dedup_suppression_rules')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('Failed to delete suppression rule:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete rule' },
        { status: 500 }
      );
    }

    // Reassign priorities to close the gap
    // Get all remaining rules ordered by current priority
    const { data: remainingRules, error: fetchError } = await supabase
      .from('dedup_suppression_rules')
      .select('id')
      .eq('org_id', orgId)
      .order('priority', { ascending: true });

    if (!fetchError && remainingRules && remainingRules.length > 0) {
      // Reassign priorities 1..n
      for (let i = 0; i < remainingRules.length; i++) {
        await supabase
          .from('dedup_suppression_rules')
          .update({ priority: i + 1, updated_at: new Date().toISOString() })
          .eq('id', remainingRules[i].id);
      }
    }

    return NextResponse.json({
      deletedId: id,
      suppressedCount,
    });
  } catch (error) {
    console.error('Failed to delete suppression rule:', error);
    return NextResponse.json(
      { error: 'Failed to delete rule' },
      { status: 500 }
    );
  }
}
