import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';

/**
 * GET /api/admin/workspaces
 *
 * Returns all workspaces across all orgs for super admin only.
 * Returns 404 if user is not the designated admin to hide the route's existence.
 */
export async function GET() {
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

    // Use service role key to bypass RLS
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch all workspaces with their entitlements
    const { data: workspaces, error: workspacesError } = await supabase
      .from('workspace_entitlements')
      .select('*')
      .order('created_at', { ascending: false });

    if (workspacesError) {
      console.error('Failed to fetch workspaces:', workspacesError);
      return NextResponse.json({ error: 'Failed to fetch workspaces' }, { status: 500 });
    }

    if (!workspaces) {
      return NextResponse.json({ workspaces: [] });
    }

    // Get org_ids for subsequent queries
    const orgIds = workspaces.map(w => w.org_id).filter(Boolean);

    // Fetch latest compliance scores for each org
    const { data: complianceScores } = await supabase
      .from('compliance_score_history')
      .select('org_id, score, computed_at')
      .in('org_id', orgIds)
      .order('computed_at', { ascending: false });

    // Create a map of latest scores by org_id
    const latestScores = new Map();
    complianceScores?.forEach(score => {
      if (!latestScores.has(score.org_id)) {
        latestScores.set(score.org_id, score);
      }
    });

    // Fetch latest digest run for each org (for last scan time)
    const { data: digestRuns } = await supabase
      .from('digest_runs')
      .select('org_id, run_at, status')
      .in('org_id', orgIds)
      .order('run_at', { ascending: false });

    // Create a map of latest digest runs by org_id
    const latestDigestRuns = new Map();
    digestRuns?.forEach(run => {
      if (!latestDigestRuns.has(run.org_id)) {
        latestDigestRuns.set(run.org_id, run);
      }
    });

    // Fetch HubSpot connection count per org (active portals)
    const { data: hubspotConnections } = await supabase
      .from('hubspot_connections')
      .select('org_id, portal_id')
      .in('org_id', orgIds);

    // Create a map of portal counts by org_id
    const portalCounts = new Map();
    hubspotConnections?.forEach(conn => {
      portalCounts.set(conn.org_id, (portalCounts.get(conn.org_id) || 0) + 1);
    });

    // Count total records monitored (normalized_records per org)
    const { data: recordCounts } = await supabase
      .from('normalized_records')
      .select('org_id')
      .in('org_id', orgIds);

    const recordCountsByOrg = new Map();
    recordCounts?.forEach(record => {
      recordCountsByOrg.set(record.org_id, (recordCountsByOrg.get(record.org_id) || 0) + 1);
    });

    // Combine all data
    const enrichedWorkspaces = workspaces.map(workspace => {
      const latestScore = latestScores.get(workspace.org_id);
      const latestDigest = latestDigestRuns.get(workspace.org_id);
      const portalCount = portalCounts.get(workspace.org_id) || 0;
      const recordCount = recordCountsByOrg.get(workspace.org_id) || 0;

      return {
        org_id: workspace.org_id,
        org_name: workspace.org_name || workspace.clerk_org_id || 'Unknown',
        plan: workspace.plan || 'trialing',
        status: workspace.subscription_status || 'trialing',
        compliance_score: latestScore?.score || null,
        compliance_computed_at: latestScore?.computed_at || null,
        last_scan: latestDigest?.run_at || null,
        last_scan_status: latestDigest?.status || null,
        active_portals: portalCount,
        always_on: workspace.always_on_enabled || false,
        always_on_since: workspace.always_on_since || null,
        credits_used: workspace.enrich_credits_used || 0,
        credits_limit: workspace.enrich_credits_limit || 50,
        joined_date: workspace.created_at || null,
        trial_ends_at: workspace.trial_ends_at || null,
        stripe_customer_id: workspace.stripe_customer_id || null,
        records_monitored: recordCount,
      };
    });

    // Calculate summary metrics
    const totalWorkspaces = enrichedWorkspaces.length;
    const activeSubscriptions = enrichedWorkspaces.filter(w => w.status === 'active').length;
    const trialingCount = enrichedWorkspaces.filter(w => w.status === 'trialing' || w.plan === 'trialing').length;
    const totalRecordsMonitored = enrichedWorkspaces.reduce((sum, w) => sum + w.records_monitored, 0);

    // Count digests sent this month
    const firstOfMonth = new Date();
    firstOfMonth.setDate(1);
    firstOfMonth.setHours(0, 0, 0, 0);

    const { data: digestsThisMonth } = await supabase
      .from('digest_runs')
      .select('id', { count: 'exact', head: true })
      .gte('run_at', firstOfMonth.toISOString())
      .eq('digest_sent', true);

    const digestsSentThisMonth = digestsThisMonth?.length || 0;

    return NextResponse.json({
      workspaces: enrichedWorkspaces,
      summary: {
        total_workspaces: totalWorkspaces,
        active_subscriptions: activeSubscriptions,
        trialing: trialingCount,
        total_records_monitored: totalRecordsMonitored,
        digests_sent_this_month: digestsSentThisMonth,
      },
    });
  } catch (error) {
    console.error('Admin workspaces API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
