/**
 * Always On Digest Job
 *
 * Processes nightly compliance scans, dedup detection, and sends digest emails/Slack.
 */

import type { Job } from 'bullmq';
import type { DigestJobData, DigestJobResult } from '../queue/digest-queue';
import type { DigestPayload, RemediationItem, HarmonyBreakdownItem } from '../always-on/types';
import { supabase } from '../db/supabase';
import { sendDigestEmail } from '../always-on/send-digest';
import { postToSlack } from '../always-on/slack-payload';

/**
 * Process a digest job.
 *
 * This is the main entry point for Always On digest processing.
 */
export async function processDigestJob(
  job: Job<DigestJobData, DigestJobResult>
): Promise<DigestJobResult> {
  const { orgId, connectionId, triggeredBy } = job.data;

  console.log(`Processing digest job for org=${orgId}, connection=${connectionId || 'all'}, triggeredBy=${triggeredBy}`);

  try {
    if (!supabase) {
      throw new Error('Supabase not configured');
    }

    // Get Always On config
    const { data: config } = await supabase
      .from('always_on_config')
      .select('*')
      .eq('org_id', orgId)
      .single();

    if (!config) {
      throw new Error('Always On config not found');
    }

    // Get connections to process
    const connections = await getConnectionsToProcess(orgId, connectionId);

    if (connections.length === 0) {
      console.log(`No active connections found for org=${orgId}`);
      const runId = await createSkippedRun(orgId, null, null, triggeredBy, 'no_connections');
      return {
        runId,
        status: 'skipped',
        scoreDelta: null,
        digestSent: false,
        slackSent: false,
      };
    }

    // Process each connection
    const results: DigestJobResult[] = [];

    for (const conn of connections) {
      try {
        const result = await processConnection(
          orgId,
          conn.id,
          conn.portal_id,
          triggeredBy,
          config
        );
        results.push(result);
      } catch (error) {
        console.error(`Failed to process connection ${conn.id}:`, error);
        const runId = await createFailedRun(
          orgId,
          conn.id,
          conn.portal_id,
          triggeredBy,
          error instanceof Error ? error.message : 'Unknown error'
        );
        results.push({
          runId,
          status: 'failed',
          scoreDelta: null,
          digestSent: false,
          slackSent: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Return first result (or combined result if multiple)
    return results[0] || {
      runId: '',
      status: 'completed',
      scoreDelta: null,
      digestSent: false,
      slackSent: false,
    };

  } catch (error) {
    console.error('Digest job failed:', error);
    throw error;
  }
}

/**
 * Get connections to process for this digest job.
 */
async function getConnectionsToProcess(
  orgId: string,
  connectionId?: string
): Promise<any[]> {
  if (!supabase) return [];

  let query = supabase
    .from('hubspot_connections')
    .select('id, org_id, portal_id')
    .eq('org_id', orgId);

  if (connectionId) {
    query = query.eq('id', connectionId);
  }

  const { data: connections } = await query;

  return connections || [];
}

/**
 * Process a single connection for the digest.
 */
async function processConnection(
  orgId: string,
  connectionId: string,
  portalName: string | null,
  triggeredBy: 'schedule' | 'manual',
  config: any
): Promise<DigestJobResult> {
  if (!supabase) {
    throw new Error('Supabase not configured');
  }

  // 1. Create digest_run row
  const { data: run, error: createError } = await supabase
    .from('digest_runs')
    .insert({
      org_id: orgId,
      connection_id: connectionId,
      portal_name: portalName,
      triggered_by: triggeredBy,
      status: 'running',
    })
    .select()
    .single();

  if (createError || !run) {
    throw new Error(`Failed to create digest run: ${createError?.message}`);
  }

  const runId = run.id;

  try {
    // 2. Fetch last completed run for baseline
    const { data: lastRun } = await supabase
      .from('digest_runs')
      .select('score_after, run_at')
      .eq('org_id', orgId)
      .eq('connection_id', connectionId)
      .eq('status', 'completed')
      .order('run_at', { ascending: false })
      .limit(1)
      .single();

    const scoreBefore = lastRun?.score_after || null;

    // 3. Get connection details for access token
    const { data: connection } = await supabase
      .from('hubspot_connections')
      .select('encrypted_token, has_export_scope')
      .eq('id', connectionId)
      .single();

    if (!connection) {
      throw new Error(`Connection ${connectionId} not found`);
    }

    // 4. Determine scan mode
    // Use incremental mode for scheduled runs if there's a previous run
    // Use full scan for manual triggers or weekly schedule (day of week 0 = Sunday)
    const now = new Date();
    const isWeeklyFullScan = triggeredBy === 'schedule' && now.getDay() === 0;
    const shouldUseIncremental =
      triggeredBy === 'schedule' &&
      !isWeeklyFullScan &&
      lastRun?.run_at;

    const scanMode = shouldUseIncremental ? 'incremental' : 'full';
    const since = shouldUseIncremental && lastRun?.run_at
      ? new Date(lastRun.run_at)
      : undefined;

    console.log(`[Digest] Running ${scanMode} compliance scan${since ? ` (since ${since.toISOString()})` : ''}`);

    // 5. Run compliance scan
    const { score: scoreAfter, recordsScanned } = await runComplianceScan(
      orgId,
      connection.encrypted_token,
      connection.has_export_scope || false,
      {
        mode: scanMode,
        since,
      }
    );

    // 6. Run incremental dedup scan
    const { newPairs, gradeACounts } = await runDedupScan(orgId, lastRun?.run_at);

    // 7. Compute delta
    const scoreDelta = scoreBefore !== null ? scoreAfter - scoreBefore : null;

    // Check if we should skip sending
    if (
      scoreDelta !== null &&
      Math.abs(scoreDelta) < config.score_delta_threshold &&
      !config.send_on_no_change
    ) {
      await supabase
        .from('digest_runs')
        .update({
          status: 'skipped',
          skipped_reason: 'below_threshold',
          score_before: scoreBefore,
          score_after: scoreAfter,
          score_delta: scoreDelta,
          new_pairs_detected: newPairs,
          records_scanned: recordsScanned,
        })
        .eq('id', runId);

      return {
        runId,
        status: 'skipped',
        scoreDelta,
        digestSent: false,
        slackSent: false,
      };
    }

    // 6. Compute remediation items
    const remediationItems = await computeRemediationItems(orgId);

    // 7. Fetch harmony breakdown
    const harmonyBreakdown = await getHarmonyBreakdown(orgId, connectionId);

    // 8. Get insights count
    const { count: insightsCount } = await supabase
      .from('compliance_insights')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId);

    const newInsightsCount = insightsCount || 0;

    // 9. Build digest payload
    const dashboardUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://refyne.io'}/dashboard`;
    const dedupUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://refyne.io'}/dedup`;
    const settingsUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://refyne.io'}/settings`;

    const digestPayload: DigestPayload = {
      portalName: portalName || 'Unknown Portal',
      digestDate: new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
      score: scoreAfter,
      scoreDelta: scoreDelta || 0,
      remediationItems,
      harmonyBreakdown,
      dedupSummary: {
        newPairs,
        gradeA: gradeACounts.A || 0,
        gradeB: gradeACounts.B || 0,
        gradeC: gradeACounts.C || 0,
        gradeD: gradeACounts.D || 0,
      },
      newInsightsCount,
      dashboardUrl,
      dedupUrl,
      settingsUrl,
    };

    // 10. Send email digest
    let digestSent = false;
    if (config.digest_enabled && config.email_recipients?.length > 0) {
      try {
        await sendDigestEmail(digestPayload, config.email_recipients, orgId);
        digestSent = true;
      } catch (error) {
        console.error('Failed to send digest email:', error);
      }
    }

    // 11. Send Slack alert
    let slackSent = false;
    if (config.slack_enabled && config.slack_webhook_url) {
      try {
        await postToSlack(digestPayload, config.slack_webhook_url);
        slackSent = true;
      } catch (error) {
        console.error('Failed to send Slack alert:', error);
      }
    }

    // 12. Auto-merge Grade A pairs
    if (config.auto_merge_grade_a && gradeACounts.A > 0) {
      try {
        // Get all pending Grade A pair IDs from this run
        const { data: gradePairs } = await supabase
          .from('dedup_pairs')
          .select('id')
          .eq('org_id', orgId)
          .eq('grade', 'A')
          .eq('status', 'pending');

        if (gradePairs && gradePairs.length > 0) {
          const pairIds = gradePairs.map(p => p.id);

          // Call bulk approve API
          const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
          const response = await fetch(`${baseUrl}/api/dedup/pairs/bulk-approve`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-org-id': orgId,
            },
            body: JSON.stringify({ pairIds }),
          });

          if (!response.ok) {
            console.error('Bulk approve failed:', await response.text());
          } else {
            console.log(`Auto-merged ${pairIds.length} Grade A pairs`);
          }
        }
      } catch (error) {
        console.error('Failed to auto-merge Grade A pairs:', error);
      }
    }

    // 13. Update digest_run with results
    await supabase
      .from('digest_runs')
      .update({
        status: 'completed',
        score_before: scoreBefore,
        score_after: scoreAfter,
        score_delta: scoreDelta,
        new_pairs_detected: newPairs,
        new_insights: newInsightsCount,
        records_scanned: recordsScanned,
        digest_sent: digestSent,
        slack_sent: slackSent,
        digest_payload: digestPayload,
      })
      .eq('id', runId);

    return {
      runId,
      status: 'completed',
      scoreDelta,
      digestSent,
      slackSent,
    };

  } catch (error) {
    // Mark run as failed
    if (supabase) {
      await supabase
        .from('digest_runs')
        .update({
          status: 'failed',
          error_message: error instanceof Error ? error.message : 'Unknown error',
        })
        .eq('id', runId);
    }

    throw error;
  }
}

/**
 * Run compliance scan and return score.
 * Calls the existing compliance scanner directly.
 */
async function runComplianceScan(
  orgId: string,
  accessToken: string,
  hasExportScope: boolean,
  options?: {
    since?: Date;
    mode?: 'full' | 'incremental';
  }
): Promise<{
  score: number;
  recordsScanned: number;
}> {
  // Import the existing compliance scanner
  const { runComplianceScan: runScan } = await import('../compliance/compliance-scanner');
  const { getScore } = await import('../compliance/compliance-score');

  // Run the scan (this is the same logic that POST /api/compliance/scan enqueues)
  const scanResult = await runScan(orgId, accessToken, hasExportScope, options);

  // Get the computed score
  const scoreData = await getScore(orgId);

  return {
    score: scoreData.score,
    recordsScanned: scanResult.recordsScanned,
  };
}

/**
 * Run incremental dedup scan and return new pairs.
 * TODO: Integrate with actual dedup scan logic.
 */
async function runDedupScan(
  orgId: string,
  since?: string
): Promise<{
  newPairs: number;
  gradeACounts: Record<string, number>;
}> {
  if (!supabase) {
    return { newPairs: 0, gradeACounts: {} };
  }

  // Count new pairs since last run
  let query = supabase
    .from('dedup_pairs')
    .select('grade', { count: 'exact' })
    .eq('org_id', orgId);

  if (since) {
    query = query.gte('created_at', since);
  }

  const { data: pairs, count } = await query;

  // Count by grade
  const gradeCounts: Record<string, number> = {};
  (pairs || []).forEach((pair: any) => {
    gradeCounts[pair.grade] = (gradeCounts[pair.grade] || 0) + 1;
  });

  return {
    newPairs: count || 0,
    gradeACounts: gradeCounts,
  };
}

/**
 * Compute top 3 remediation items ranked by impact.
 * Calls getBreakdownByHarmony() and getActiveInsights(), ranks by impact.
 */
async function computeRemediationItems(orgId: string): Promise<RemediationItem[]> {
  const { getBreakdownByHarmony } = await import('../compliance/compliance-score');
  const { getActiveInsights } = await import('../compliance/insight-generator');
  const { getHarmonyById } = await import('../harmonies/library');

  // Get harmony breakdown
  const harmonyBreakdown = await getBreakdownByHarmony(orgId);

  // Get active insights
  const insights = await getActiveInsights(orgId);

  // Build remediation candidates
  interface RemediationCandidate {
    harmonyId: string | null;
    harmony: string;
    issue: string;
    recordsAffected: number;
    impactScore: number;
    actionLabel: string;
    actionUrl: string;
  }

  const candidates: RemediationCandidate[] = [];

  // Process insights
  for (const insight of insights) {
    let impactScore = insight.recordCount;

    // Apply 1.5x multiplier if an active Harmony exists that covers the gap
    if (insight.harmonyId) {
      const harmonyExists = harmonyBreakdown.some(h => h.harmonyId === insight.harmonyId);
      if (harmonyExists) {
        impactScore *= 1.5;
      }
    }

    // Apply 1.2x if the insight is new this run (created within last hour)
    const createdAt = new Date(insight.createdAt || Date.now());
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    if (createdAt > oneHourAgo) {
      impactScore *= 1.2;
    }

    // Determine action URL
    let actionUrl = '/normalize';
    let actionLabel = 'Review records';

    if (insight.harmonyId) {
      // Harmony gap - link to harmonies page
      actionUrl = `/harmonies`;
      actionLabel = 'Fix in Harmonies';
    } else if (insight.type === 'pattern_gap') {
      // Missing data - link to normalize
      actionUrl = '/normalize';
      actionLabel = 'Review records';
    }

    const harmonyName = insight.harmonyId
      ? getHarmonyById(insight.harmonyId)?.spec.name || insight.harmonyId
      : insight.field || 'Unknown';

    candidates.push({
      harmonyId: insight.harmonyId,
      harmony: harmonyName,
      issue: insight.message,
      recordsAffected: insight.recordCount,
      impactScore,
      actionLabel,
      actionUrl,
    });
  }

  // Add harmony breakdown items with low scores as candidates
  for (const h of harmonyBreakdown) {
    if (h.rate < 80 && h.unprocessed > 0) {
      // Low compliance rate - needs attention
      candidates.push({
        harmonyId: h.harmonyId,
        harmony: h.harmonyName || h.harmonyId,
        issue: `${h.unprocessed} unprocessed records`,
        recordsAffected: h.unprocessed,
        impactScore: h.unprocessed,
        actionLabel: 'Fix in Harmonies',
        actionUrl: `/harmonies`,
      });
    }
  }

  // Sort by impact score descending
  candidates.sort((a, b) => b.impactScore - a.impactScore);

  // Return top 3 with rank
  return candidates.slice(0, 3).map((c, i) => ({
    rank: i + 1,
    harmony: c.harmony,
    harmonyId: c.harmonyId || 'unknown',
    issue: c.issue,
    recordsAffected: c.recordsAffected,
    actionLabel: c.actionLabel,
    actionUrl: c.actionUrl,
  }));
}

/**
 * Get harmony breakdown with scores.
 * Calls getBreakdownByHarmony() and compares against previous run's payload.
 */
async function getHarmonyBreakdown(
  orgId: string,
  connectionId: string
): Promise<HarmonyBreakdownItem[]> {
  const { getBreakdownByHarmony } = await import('../compliance/compliance-score');

  // Get current harmony breakdown
  const breakdown = await getBreakdownByHarmony(orgId);

  // Get previous digest run's payload for delta calculation
  if (!supabase) {
    return breakdown.map(h => ({
      name: h.harmonyName || h.harmonyId,
      harmonyId: h.harmonyId,
      score: Math.round(h.rate),
      delta: 0,
    }));
  }

  const { data: previousRun } = await supabase
    .from('digest_runs')
    .select('digest_payload')
    .eq('org_id', orgId)
    .eq('connection_id', connectionId)
    .eq('status', 'completed')
    .not('digest_payload', 'is', null)
    .order('run_at', { ascending: false })
    .limit(1)
    .single();

  // Build a map of previous scores
  const previousScores = new Map<string, number>();
  if (previousRun?.digest_payload) {
    const payload = previousRun.digest_payload as any;
    if (payload.harmonyBreakdown) {
      for (const item of payload.harmonyBreakdown) {
        previousScores.set(item.harmonyId, item.score);
      }
    }
  }

  // Map to HarmonyBreakdownItem with delta
  return breakdown.map(h => {
    const currentScore = Math.round(h.rate);
    const previousScore = previousScores.get(h.harmonyId);
    const delta = previousScore !== undefined ? currentScore - previousScore : 0;

    return {
      name: h.harmonyName || h.harmonyId,
      harmonyId: h.harmonyId,
      score: currentScore,
      delta,
    };
  });
}

/**
 * Create a skipped digest run.
 */
async function createSkippedRun(
  orgId: string,
  connectionId: string | null,
  portalName: string | null,
  triggeredBy: 'schedule' | 'manual',
  reason: string
): Promise<string> {
  if (!supabase) {
    return '';
  }

  const { data: run } = await supabase
    .from('digest_runs')
    .insert({
      org_id: orgId,
      connection_id: connectionId,
      portal_name: portalName,
      triggered_by: triggeredBy,
      status: 'skipped',
      skipped_reason: reason,
    })
    .select('id')
    .single();

  return run?.id || '';
}

/**
 * Create a failed digest run.
 */
async function createFailedRun(
  orgId: string,
  connectionId: string,
  portalName: string | null,
  triggeredBy: 'schedule' | 'manual',
  errorMessage: string
): Promise<string> {
  if (!supabase) {
    return '';
  }

  const { data: run } = await supabase
    .from('digest_runs')
    .insert({
      org_id: orgId,
      connection_id: connectionId,
      portal_name: portalName,
      triggered_by: triggeredBy,
      status: 'failed',
      error_message: errorMessage,
    })
    .select('id')
    .single();

  return run?.id || '';
}
