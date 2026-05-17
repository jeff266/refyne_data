import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/db/supabase';
import {
  rowToRule,
  createRequestToRow,
  type SuppressionRuleRow,
  type CreateSuppressionRuleRequest,
  type RuleCondition,
} from '@/lib/dedup/types';

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
  // Value required for equals/not_equals/contains operators
  if (['equals', 'not_equals', 'contains'].includes(condition.operator)) {
    if (condition.value === null || condition.value === undefined) {
      return `Condition ${index + 1}: value required for operator "${condition.operator}"`;
    }
  }
  return null;
}

/**
 * GET /api/dedup/suppression-rules
 *
 * Returns all suppression rules for the org, ordered by priority.
 */
export async function GET(request: NextRequest) {
  try {
    if (!isSupabaseConfigured() || !supabase) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 503 }
      );
    }

    // TODO: Get org ID from auth context (Clerk)
    const orgId = request.headers.get('x-org-id') || 'default';

    const { data: rules, error } = await supabase
      .from('dedup_suppression_rules')
      .select('*')
      .eq('org_id', orgId)
      .order('priority', { ascending: true });

    if (error) {
      console.error('Failed to get suppression rules:', error);
      return NextResponse.json(
        { error: 'Failed to get rules' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      rules: (rules as SuppressionRuleRow[]).map(rowToRule),
    });
  } catch (error) {
    console.error('Failed to get suppression rules:', error);
    return NextResponse.json(
      { error: 'Failed to get rules' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/dedup/suppression-rules
 *
 * Create a new suppression rule.
 * Admin role only.
 */
export async function POST(request: NextRequest) {
  try {
    if (!isSupabaseConfigured() || !supabase) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 503 }
      );
    }

    // TODO: Get org ID and role from auth context (Clerk)
    const orgId = request.headers.get('x-org-id') || 'default';
    // TODO: Check admin role

    const body = await request.json() as CreateSuppressionRuleRequest;

    // Validate name
    if (!body.name || typeof body.name !== 'string' || body.name.trim() === '') {
      return NextResponse.json(
        { error: 'name is required', field: 'name' },
        { status: 400 }
      );
    }

    // Validate action
    if (!['block', 'review', 'require_approval'].includes(body.action)) {
      return NextResponse.json(
        { error: 'Invalid action', field: 'action' },
        { status: 400 }
      );
    }

    // Validate approverUserId required when action = 'require_approval'
    if (body.action === 'require_approval' && !body.approverUserId) {
      return NextResponse.json(
        { error: 'approverUserId required when action is require_approval', field: 'approverUserId' },
        { status: 400 }
      );
    }

    // Validate conditionOperator
    if (!['AND', 'OR'].includes(body.conditionOperator)) {
      return NextResponse.json(
        { error: 'conditionOperator must be AND or OR', field: 'conditionOperator' },
        { status: 400 }
      );
    }

    // Validate conditions (min 1)
    if (!Array.isArray(body.conditions) || body.conditions.length < 1) {
      return NextResponse.json(
        { error: 'At least one condition is required', field: 'conditions' },
        { status: 400 }
      );
    }

    // Validate each condition
    for (let i = 0; i < body.conditions.length; i++) {
      const conditionError = validateCondition(body.conditions[i], i);
      if (conditionError) {
        return NextResponse.json(
          { error: conditionError, field: 'conditions' },
          { status: 400 }
        );
      }
    }

    // Get max priority
    const { data: maxPriorityResult } = await supabase
      .from('dedup_suppression_rules')
      .select('priority')
      .eq('org_id', orgId)
      .order('priority', { ascending: false })
      .limit(1)
      .single();

    const nextPriority = (maxPriorityResult?.priority ?? 0) + 1;

    // Create the rule
    const row = createRequestToRow(orgId, nextPriority, body);

    const { data: created, error: insertError } = await supabase
      .from('dedup_suppression_rules')
      .insert(row)
      .select()
      .single();

    if (insertError) {
      console.error('Failed to create suppression rule:', insertError);
      return NextResponse.json(
        { error: 'Failed to create rule' },
        { status: 500 }
      );
    }

    return NextResponse.json({ rule: rowToRule(created as SuppressionRuleRow) });
  } catch (error) {
    console.error('Failed to create suppression rule:', error);
    return NextResponse.json(
      { error: 'Failed to create rule' },
      { status: 500 }
    );
  }
}
