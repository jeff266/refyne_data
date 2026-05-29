import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db/supabase';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';

/**
 * GET /api/org/policies
 * Returns org-level policy defaults
 */
export async function GET(request: NextRequest) {
  // Auth check - get org from Clerk context
  let ctx;
  try {
    ctx = await getOrgContext();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  if (!supabase) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
  }

  const { data, error } = await supabase
    .from('org_policies')
    .select('*')
    .eq('org_id', ctx.orgId)
    .single();

  if (error && error.code !== 'PGRST116') { // PGRST116 = no rows
    return NextResponse.json({ error: 'Failed to fetch policies' }, { status: 500 });
  }

  // Return defaults if no row exists
  return NextResponse.json({
    policies: data || {
      org_id: ctx.orgId,
      write_policy_default: 'fill_empty',
      dedup_auto_merge_threshold: null,
      dedup_merge_survivor_rule: 'most_recent',
      quarantine_threshold: 40,
      nightly_scan_enabled: true,
      incremental_scan_enabled: true,
    },
  });
}

/**
 * PUT /api/org/policies
 * Updates org policy defaults
 */
export async function PUT(request: NextRequest) {
  // Auth check - get org from Clerk context
  let ctx;
  try {
    ctx = await getOrgContext();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  const body = await request.json();

  if (!supabase) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
  }

  const { data, error } = await supabase
    .from('org_policies')
    .upsert({
      org_id: ctx.orgId,
      write_policy_default: body.write_policy_default,
      dedup_auto_merge_threshold: body.dedup_auto_merge_threshold,
      dedup_merge_survivor_rule: body.dedup_merge_survivor_rule,
      quarantine_threshold: body.quarantine_threshold,
      nightly_scan_enabled: body.nightly_scan_enabled,
      incremental_scan_enabled: body.incremental_scan_enabled,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error('Failed to save policies:', error);
    return NextResponse.json({ error: 'Failed to save policies' }, { status: 500 });
  }

  return NextResponse.json({ policies: data });
}
