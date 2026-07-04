/**
 * Capture Data Health Snapshot
 *
 * Daily worker that captures data health metrics for all orgs.
 * Run via cron: 0 0 * * * (midnight daily)
 */

import { supabaseAdmin } from '../lib/db/admin-client';

interface OrgMetrics {
  orgId: string;
  companyCount: number;
  contactCount: number;
  normalizeIssues: number;
  dedupClusters: number;
  enrichCreditsUsed: number;
  enrichCreditsTotal: number;
  dataHealthScore: number;
}

async function calculateDataHealthScore(
  companyCount: number,
  contactCount: number,
  normalizeIssues: number
): Promise<number> {
  const totalRecords = companyCount + contactCount;
  if (totalRecords === 0) return 100;

  const issueRate = normalizeIssues / totalRecords;
  return Math.max(0, Math.min(100, Math.round(100 - issueRate * 100)));
}

async function getOrgMetrics(orgId: string): Promise<OrgMetrics> {
  console.log(`[Snapshot] Calculating metrics for org: ${orgId}`);

  // Get company count
  const { count: companyCount } = await supabaseAdmin
    .from('normalized_records')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .eq('record_type', 'company');

  // Get contact count
  const { count: contactCount } = await supabaseAdmin
    .from('normalized_records')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .eq('record_type', 'contact');

  // Get normalize issues
  const { count: normalizeIssues } = await supabaseAdmin
    .from('normalization_run_progress')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .eq('status', 'pending');

  // Get dedup clusters
  const { count: dedupClusters } = await supabaseAdmin
    .from('dedup_clusters')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .eq('status', 'open');

  // Get billing info for enrich credits
  const { data: billingData } = await supabaseAdmin
    .from('workspace_entitlements')
    .select('enrich_credits_used, enrich_credits_limit')
    .eq('clerk_org_id', orgId)
    .single();

  const enrichCreditsUsed = billingData?.enrich_credits_used || 0;
  const enrichCreditsTotal = billingData?.enrich_credits_limit || 500;

  // Calculate health score
  const dataHealthScore = await calculateDataHealthScore(
    companyCount || 0,
    contactCount || 0,
    normalizeIssues || 0
  );

  return {
    orgId,
    companyCount: companyCount || 0,
    contactCount: contactCount || 0,
    normalizeIssues: normalizeIssues || 0,
    dedupClusters: dedupClusters || 0,
    enrichCreditsUsed,
    enrichCreditsTotal,
    dataHealthScore,
  };
}

async function captureSnapshot(metrics: OrgMetrics, snapshotDate: string): Promise<void> {
  console.log(`[Snapshot] Saving snapshot for org ${metrics.orgId} on ${snapshotDate}`);

  const { error } = await supabaseAdmin
    .from('data_health_snapshots')
    .insert({
      org_id: metrics.orgId,
      snapshot_date: snapshotDate,
      data_health_score: metrics.dataHealthScore,
      company_count: metrics.companyCount,
      contact_count: metrics.contactCount,
      normalize_issues: metrics.normalizeIssues,
      dedup_clusters: metrics.dedupClusters,
      enrich_credits_used: metrics.enrichCreditsUsed,
      enrich_credits_total: metrics.enrichCreditsTotal,
    });

  if (error) {
    // If unique constraint violation, update existing snapshot
    if (error.code === '23505') {
      console.log(`[Snapshot] Updating existing snapshot for ${metrics.orgId}`);
      const { error: updateError } = await supabaseAdmin
        .from('data_health_snapshots')
        .update({
          data_health_score: metrics.dataHealthScore,
          company_count: metrics.companyCount,
          contact_count: metrics.contactCount,
          normalize_issues: metrics.normalizeIssues,
          dedup_clusters: metrics.dedupClusters,
          enrich_credits_used: metrics.enrichCreditsUsed,
          enrich_credits_total: metrics.enrichCreditsTotal,
        })
        .eq('org_id', metrics.orgId)
        .eq('snapshot_date', snapshotDate);

      if (updateError) {
        throw new Error(`Failed to update snapshot: ${updateError.message}`);
      }
    } else {
      throw new Error(`Failed to insert snapshot: ${error.message}`);
    }
  }

  console.log(`[Snapshot] ✓ Saved for org ${metrics.orgId}: score=${metrics.dataHealthScore}`);
}

async function main() {
  console.log('[Snapshot] Starting daily data health snapshot capture...');

  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  try {
    // Get all active orgs
    const { data: orgs, error: orgsError } = await supabaseAdmin
      .from('workspace_entitlements')
      .select('clerk_org_id');

    if (orgsError) {
      throw new Error(`Failed to fetch orgs: ${orgsError.message}`);
    }

    if (!orgs || orgs.length === 0) {
      console.log('[Snapshot] No orgs found');
      return;
    }

    console.log(`[Snapshot] Found ${orgs.length} orgs to process`);

    // Process each org
    let successCount = 0;
    let errorCount = 0;

    for (const org of orgs) {
      try {
        const metrics = await getOrgMetrics(org.clerk_org_id);
        await captureSnapshot(metrics, today);
        successCount++;
      } catch (error) {
        console.error(`[Snapshot] Failed for org ${org.clerk_org_id}:`, error);
        errorCount++;
      }
    }

    console.log(`[Snapshot] Complete: ${successCount} success, ${errorCount} errors`);
  } catch (error) {
    console.error('[Snapshot] Fatal error:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main()
    .then(() => {
      console.log('[Snapshot] Done');
      process.exit(0);
    })
    .catch((error) => {
      console.error('[Snapshot] Error:', error);
      process.exit(1);
    });
}

export { main as captureDataHealthSnapshot };
