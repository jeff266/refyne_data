/**
 * Survivorship Rule Management API
 *
 * PATCH  /api/settings/survivorship-rules/[id] - Update rule (toggle active, change config)
 * DELETE /api/settings/survivorship-rules/[id] - Delete org-specific rule
 */

import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { supabaseAdmin } from '@/lib/db/admin-client';

export const dynamic = 'force-dynamic';

/**
 * PATCH /api/settings/survivorship-rules/[id]
 *
 * Update a survivorship rule (toggle active state or change config).
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
    const ruleId = params.id;
    const body = await request.json();
    const { is_active, rule_config, priority } = body;

    console.log('[Survivorship Rules PATCH] Request:', {
      ruleId,
      orgId: ctx.orgId,
      updates: { is_active, rule_config, priority }
    });

    // Verify rule belongs to this org or is a default rule
    const { data: existingRule, error: fetchError } = await supabaseAdmin
      .from('dedup_survivorship_rules')
      .select('*')
      .eq('id', ruleId)
      .single();

    if (fetchError || !existingRule) {
      return NextResponse.json({ error: 'Rule not found' }, { status: 404 });
    }

    // Only allow updates to org-specific rules or toggling default rules
    if (existingRule.org_id !== '__default__' && existingRule.org_id !== ctx.orgId) {
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

    console.log('[Survivorship Rules PATCH] Applying updates:', updates);

    const { data, error } = await supabaseAdmin
      .from('dedup_survivorship_rules')
      .update(updates)
      .eq('id', ruleId)
      .select()
      .single();

    console.log('[Survivorship Rules PATCH] Update result:', {
      hasData: !!data,
      hasError: !!error,
      error: error ? JSON.stringify(error, Object.getOwnPropertyNames(error)) : null
    });

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error('[Survivorship Rules PATCH] Error:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
    console.error('[Survivorship Rules PATCH] Error stack:', error instanceof Error ? error.stack : 'No stack');
    console.error('[Survivorship Rules PATCH] Error details:', {
      message: error instanceof Error ? error.message : String(error),
      name: error instanceof Error ? error.name : typeof error,
      raw: error
    });
    return NextResponse.json(
      { error: 'Failed to update rule', details: error instanceof Error ? error.message : String(error) },
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
  let ctx;
  try {
    ctx = await getOrgContext();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  try {
    const ruleId = params.id;

    console.log('[Survivorship Rules DELETE] Request:', {
      ruleId,
      orgId: ctx.orgId
    });

    // Verify rule belongs to this org and is not a default rule
    const { data: existingRule, error: fetchError } = await supabaseAdmin
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

    if (existingRule.org_id !== ctx.orgId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { error } = await supabaseAdmin
      .from('dedup_survivorship_rules')
      .delete()
      .eq('id', ruleId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Survivorship Rules DELETE] Error:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
    console.error('[Survivorship Rules DELETE] Error stack:', error instanceof Error ? error.stack : 'No stack');
    return NextResponse.json(
      { error: 'Failed to delete rule', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
