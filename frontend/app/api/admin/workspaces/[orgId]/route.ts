import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';

/**
 * GET /api/admin/workspaces/[orgId]
 *
 * Returns detailed information for a specific workspace.
 * Returns 404 if user is not the designated admin.
 */
export async function GET(
  request: Request,
  { params }: { params: { orgId: string } }
) {
  try {
    // Get authenticated user
    const { userId } = await auth();

    // Check if user is authenticated
    if (!userId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Check if user is the designated admin
    const adminUserId = process.env.ADMIN_USER_ID;
    if (!adminUserId || userId !== adminUserId) {
      // Return 404 to hide route existence
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const orgId = params.orgId;

    // Use service role key to bypass RLS
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch recent digest runs (last 30)
    const { data: digestRuns, error: digestError } = await supabase
      .from('digest_runs')
      .select('*')
      .eq('org_id', orgId)
      .order('run_at', { ascending: false })
      .limit(30);

    if (digestError) {
      console.error('Failed to fetch digest runs:', digestError);
    }

    // Fetch compliance score trend (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: complianceTrend, error: complianceError } = await supabase
      .from('compliance_score_history')
      .select('score, compliant, stale, unprocessed, total, computed_at')
      .eq('org_id', orgId)
      .gte('computed_at', thirtyDaysAgo.toISOString())
      .order('computed_at', { ascending: true });

    if (complianceError) {
      console.error('Failed to fetch compliance trend:', complianceError);
    }

    // Fetch dedup pair history (last 100)
    const { data: dedupPairs, error: dedupError } = await supabase
      .from('dedup_pairs')
      .select('*')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
      .limit(100);

    if (dedupError) {
      console.error('Failed to fetch dedup pairs:', dedupError);
    }

    // Fetch workspace entitlements
    const { data: workspace, error: workspaceError } = await supabase
      .from('workspace_entitlements')
      .select('*')
      .eq('org_id', orgId)
      .single();

    if (workspaceError) {
      console.error('Failed to fetch workspace:', workspaceError);
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    // Fetch HubSpot connections
    const { data: hubspotConnections, error: hubspotError } = await supabase
      .from('hubspot_connections')
      .select('portal_id, created_at, updated_at, scopes')
      .eq('org_id', orgId);

    if (hubspotError) {
      console.error('Failed to fetch HubSpot connections:', hubspotError);
    }

    // Fetch normalized records count by status
    const { data: recordsByStatus, error: recordsError } = await supabase
      .from('normalized_records')
      .select('status')
      .eq('org_id', orgId);

    const recordStats = {
      compliant: 0,
      stale: 0,
      unprocessed: 0,
      total: recordsByStatus?.length || 0,
    };

    recordsByStatus?.forEach(record => {
      if (record.status === 'compliant') recordStats.compliant++;
      else if (record.status === 'stale') recordStats.stale++;
      else if (record.status === 'unprocessed') recordStats.unprocessed++;
    });

    if (recordsError) {
      console.error('Failed to fetch normalized records:', recordsError);
    }

    return NextResponse.json({
      workspace: {
        org_id: workspace.org_id,
        org_name: workspace.org_name || workspace.clerk_org_id || 'Unknown',
        plan: workspace.plan || 'trialing',
        status: workspace.subscription_status || 'trialing',
        always_on: workspace.always_on_enabled || false,
        always_on_since: workspace.always_on_since || null,
        credits_used: workspace.enrich_credits_used || 0,
        credits_limit: workspace.enrich_credits_limit || 50,
        joined_date: workspace.created_at || null,
        trial_ends_at: workspace.trial_ends_at || null,
        stripe_customer_id: workspace.stripe_customer_id || null,
        stripe_subscription_id: workspace.stripe_subscription_id || null,
        allow_operator_push: workspace.allow_operator_push || false,
        duplicate_push_policy: workspace.duplicate_push_policy || 'block',
      },
      digest_runs: digestRuns || [],
      compliance_trend: complianceTrend || [],
      dedup_pairs: dedupPairs || [],
      hubspot_connections: hubspotConnections || [],
      record_stats: recordStats,
    });
  } catch (error) {
    console.error('Admin workspace detail API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
