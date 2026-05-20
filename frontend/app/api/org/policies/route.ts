import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db/supabase';

/**
 * GET /api/org/policies
 * Returns org-level policy defaults
 */
export async function GET(request: NextRequest) {
  const orgId = request.headers.get('x-org-id') || 'demo-org';

  if (!supabase) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
  }

  const { data, error } = await supabase
    .from('org_policies')
    .select('*')
    .eq('org_id', orgId)
    .single();

  if (error && error.code !== 'PGRST116') { // PGRST116 = no rows
    return NextResponse.json({ error: 'Failed to fetch policies' }, { status: 500 });
  }

  // Return defaults if no row exists
  return NextResponse.json({
    policies: data || {
      org_id: orgId,
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
  const orgId = request.headers.get('x-org-id') || 'demo-org';
  const body = await request.json();

  if (!supabase) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
  }

  const { data, error } = await supabase
    .from('org_policies')
    .upsert({
      org_id: orgId,
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
