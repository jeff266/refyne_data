import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { requireAdmin } from '@/lib/auth/roles';
import { supabaseAdmin } from '@/lib/db/admin-client';
import { z } from 'zod';

/**
 * GET /api/import/rule-sets
 * Fetch saved rule sets for the org
 */
export async function GET(request: NextRequest) {
  let ctx;
  try {
    ctx = await getOrgContext();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  try {
    const { data: ruleSets, error } = await supabaseAdmin
      .from('import_rule_sets')
      .select('*')
      .eq('org_id', ctx.orgId)
      .is('deleted_at', null)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('[Rule Sets] Failed to fetch:', error);
      return NextResponse.json({ error: 'Failed to fetch rule sets' }, { status: 500 });
    }

    return NextResponse.json({ ruleSets: ruleSets || [] });
  } catch (error) {
    console.error('[Rule Sets] Unexpected error:', error);
    return NextResponse.json({ error: 'Failed to fetch rule sets' }, { status: 500 });
  }
}

/**
 * POST /api/import/rule-sets
 * Create a new rule set
 */
export async function POST(request: NextRequest) {
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
    // Validate request body
    const createRuleSetSchema = z.object({
      name: z.string().trim().min(1, 'Name is required'),
      description: z.string().optional(),
      rules: z.array(z.any()),
    });

    const rawBody = await request.json();
    const validation = createRuleSetSchema.safeParse(rawBody);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.issues },
        { status: 400 }
      );
    }
    const body = validation.data;

    const { name, description, rules } = body;

    // Insert rule set
    const { data: ruleSet, error } = await supabaseAdmin
      .from('import_rule_sets')
      .insert({
        org_id: ctx.orgId,
        name: name.trim(),
        description: description?.trim() || null,
        rules,
        created_by: ctx.userId,
      })
      .select('id, name')
      .single();

    if (error) {
      console.error('[Rule Sets] Failed to create:', error);
      return NextResponse.json({ error: 'Failed to create rule set' }, { status: 500 });
    }

    return NextResponse.json(ruleSet);
  } catch (error) {
    console.error('[Rule Sets] Unexpected error:', error);
    return NextResponse.json({ error: 'Failed to create rule set' }, { status: 500 });
  }
}
