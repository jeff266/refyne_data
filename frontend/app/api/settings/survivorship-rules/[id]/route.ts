/**
 * Survivorship Rule Management API
 *
 * PATCH  /api/settings/survivorship-rules/[id] - Update rule (toggle active, change config)
 * DELETE /api/settings/survivorship-rules/[id] - Delete org-specific rule
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { supabase } from '@/lib/db/supabase';

/**
 * PATCH /api/settings/survivorship-rules/[id]
 *
 * Update a survivorship rule (toggle active state or change config).
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { userId, orgId } = await auth();

  if (!userId || !orgId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!supabase) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
  }

  try {
    const ruleId = params.id;
    const body = await request.json();
    const { is_active, rule_config, priority } = body;

    // Verify rule belongs to this org or is a default rule
    const { data: existingRule, error: fetchError } = await supabase
      .from('dedup_survivorship_rules')
      .select('*')
      .eq('id', ruleId)
      .single();

    if (fetchError || !existingRule) {
      return NextResponse.json({ error: 'Rule not found' }, { status: 404 });
    }

    // Only allow updates to org-specific rules or toggling default rules
    if (existingRule.org_id !== '__default__' && existingRule.org_id !== orgId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Prevent config changes to default rules (only allow is_active toggle)
    if (existingRule.org_id === '__default__' && rule_config !== undefined) {
      return NextResponse.json(
        { error: 'Cannot modify config of default rules. Create an org-specific override instead.' },
        { status: 400 }
      );
    }

    const updates: any = {};
    if (is_active !== undefined) updates.is_active = is_active;
    if (rule_config !== undefined) updates.rule_config = rule_config;
    if (priority !== undefined) updates.priority = priority;

    const { data, error } = await supabase
      .from('dedup_survivorship_rules')
      .update(updates)
      .eq('id', ruleId)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error updating survivorship rule:', error);
    return NextResponse.json(
      { error: 'Failed to update rule' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/settings/survivorship-rules/[id]
 *
 * Delete an org-specific survivorship rule.
 * Cannot delete default rules (org_id = '__default__').
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { userId, orgId } = await auth();

  if (!userId || !orgId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!supabase) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
  }

  try {
    const ruleId = params.id;

    // Verify rule belongs to this org and is not a default rule
    const { data: existingRule, error: fetchError } = await supabase
      .from('dedup_survivorship_rules')
      .select('*')
      .eq('id', ruleId)
      .single();

    if (fetchError || !existingRule) {
      return NextResponse.json({ error: 'Rule not found' }, { status: 404 });
    }

    if (existingRule.org_id === '__default__') {
      return NextResponse.json(
        { error: 'Cannot delete default rules. Use PATCH to toggle is_active instead.' },
        { status: 400 }
      );
    }

    if (existingRule.org_id !== orgId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { error } = await supabase
      .from('dedup_survivorship_rules')
      .delete()
      .eq('id', ruleId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting survivorship rule:', error);
    return NextResponse.json(
      { error: 'Failed to delete rule' },
      { status: 500 }
    );
  }
}
