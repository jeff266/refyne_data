import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { requireAdmin } from '@/lib/auth/roles';
import { supabaseAdmin } from '@/lib/db/admin-client';

/**
 * PUT /api/import/rule-sets/[id]
 * Update a rule set
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  let ctx;
  try {
    ctx = await getOrgContext();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  requireAdmin(ctx.orgRole);

  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  try {
    const { id } = params;
    const body = await request.json();
    const { name, description, rules } = body;

    // Verify rule set belongs to org
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('import_rule_sets')
      .select('id, org_id')
      .eq('id', id)
      .eq('org_id', ctx.orgId)
      .is('deleted_at', null)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Rule set not found' }, { status: 404 });
    }

    // Build update object
    const updates: any = {
      updated_at: new Date().toISOString(),
    };

    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length === 0) {
        return NextResponse.json({ error: 'Name is required' }, { status: 400 });
      }
      updates.name = name.trim();
    }

    if (description !== undefined) {
      updates.description = description?.trim() || null;
    }

    if (rules !== undefined) {
      if (!Array.isArray(rules)) {
        return NextResponse.json({ error: 'Rules must be an array' }, { status: 400 });
      }
      updates.rules = rules;
    }

    // Update
    const { error: updateError } = await supabaseAdmin
      .from('import_rule_sets')
      .update(updates)
      .eq('id', id);

    if (updateError) {
      console.error('[Rule Sets] Failed to update:', updateError);
      return NextResponse.json({ error: 'Failed to update rule set' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Rule Sets] Unexpected error:', error);
    return NextResponse.json({ error: 'Failed to update rule set' }, { status: 500 });
  }
}

/**
 * DELETE /api/import/rule-sets/[id]
 * Soft-delete a rule set
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

  requireAdmin(ctx.orgRole);

  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  try {
    const { id } = params;

    // Verify rule set belongs to org
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('import_rule_sets')
      .select('id, org_id')
      .eq('id', id)
      .eq('org_id', ctx.orgId)
      .is('deleted_at', null)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Rule set not found' }, { status: 404 });
    }

    // Soft delete
    const { error: deleteError } = await supabaseAdmin
      .from('import_rule_sets')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);

    if (deleteError) {
      console.error('[Rule Sets] Failed to delete:', deleteError);
      return NextResponse.json({ error: 'Failed to delete rule set' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Rule Sets] Unexpected error:', error);
    return NextResponse.json({ error: 'Failed to delete rule set' }, { status: 500 });
  }
}
