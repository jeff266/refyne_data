import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/db/supabase';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';

/**
 * GET /api/settings/dedup-policies
 *
 * Get dedup policy for the current org.
 */
export async function GET(request: NextRequest) {
  let ctx;
  try {
    ctx = await getOrgContext();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  if (!isSupabaseConfigured() || !supabase) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  try {
    // Get active policy for this org
    const { data: policy, error } = await supabase
      .from('dedup_policies')
      .select('*')
      .eq('org_id', ctx.orgId)
      .eq('is_active', true)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('[Dedup Policies] Failed to load policy:', error);
      return NextResponse.json({ error: 'Failed to load policy' }, { status: 500 });
    }

    // If no org-specific policy, return default
    if (!policy) {
      const { data: defaultPolicy } = await supabase
        .from('dedup_policies')
        .select('*')
        .eq('org_id', '__default__')
        .single();

      return NextResponse.json({
        policy: defaultPolicy,
        isDefault: true,
      });
    }

    return NextResponse.json({
      policy,
      isDefault: false,
    });
  } catch (error: any) {
    console.error('[Dedup Policies] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dedup policies' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/settings/dedup-policies
 *
 * Create or update dedup policy for the current org.
 */
export async function POST(request: NextRequest) {
  let ctx;
  try {
    ctx = await getOrgContext();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  if (!isSupabaseConfigured() || !supabase) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  try {
    const body = await request.json();
    const {
      name,
      block_if_different_parent,
      block_if_closed_won_deals,
      compliance_fields,
      field_rules,
    } = body;

    // Validate field_rules structure
    if (field_rules && !Array.isArray(field_rules)) {
      return NextResponse.json(
        { error: 'field_rules must be an array' },
        { status: 400 }
      );
    }

    for (const rule of field_rules || []) {
      if (!rule.field || !rule.rule) {
        return NextResponse.json(
          { error: 'Each field rule must have "field" and "rule" properties' },
          { status: 400 }
        );
      }
    }

    // Check if policy exists
    const { data: existingPolicy } = await supabase
      .from('dedup_policies')
      .select('id')
      .eq('org_id', ctx.orgId)
      .eq('is_active', true)
      .single();

    if (existingPolicy) {
      // Update existing policy
      const { data: updated, error } = await supabase
        .from('dedup_policies')
        .update({
          name,
          block_if_different_parent,
          block_if_closed_won_deals,
          compliance_fields,
          field_rules,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingPolicy.id)
        .select()
        .single();

      if (error) {
        console.error('[Dedup Policies] Failed to update policy:', error);
        return NextResponse.json({ error: 'Failed to update policy' }, { status: 500 });
      }

      return NextResponse.json({ policy: updated, updated: true });
    } else {
      // Create new policy
      const { data: created, error } = await supabase
        .from('dedup_policies')
        .insert({
          org_id: ctx.orgId,
          name,
          block_if_different_parent,
          block_if_closed_won_deals,
          compliance_fields,
          field_rules,
          is_active: true,
        })
        .select()
        .single();

      if (error) {
        console.error('[Dedup Policies] Failed to create policy:', error);
        return NextResponse.json({ error: 'Failed to create policy' }, { status: 500 });
      }

      return NextResponse.json({ policy: created, created: true });
    }
  } catch (error: any) {
    console.error('[Dedup Policies] Error:', error);
    return NextResponse.json(
      { error: 'Failed to save dedup policy' },
      { status: 500 }
    );
  }
}
