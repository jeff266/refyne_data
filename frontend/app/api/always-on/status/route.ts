import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/db/supabase';
import type { AlwaysOnStatus } from '@/lib/always-on/types';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { captureWithOrgContext } from '@/lib/monitoring/sentry';

/**
 * GET /api/always-on/status
 *
 * Returns Always On status including enabled state, config, last run, and next run time.
 * Auth: any role
 */
export async function GET(request: NextRequest) {
  // Add auth check
  let ctx;
  try { ctx = await getOrgContext(); }
  catch (e) { return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 }); }

  try {
    const orgId = ctx.orgId;

    if (!isSupabaseConfigured() || !supabase) {
      return NextResponse.json({
        enabled: false,
        config: null,
        lastRun: null,
        nextRunAt: null,
      } as AlwaysOnStatus);
    }

    // Get entitlement
    const { data: entitlement } = await supabase
      .from('workspace_entitlements')
      .select('always_on_enabled')
      .eq('org_id', orgId)
      .single();

    const enabled = entitlement?.always_on_enabled || false;

    if (!enabled) {
      return NextResponse.json({
        enabled: false,
        config: null,
        lastRun: null,
        nextRunAt: null,
      } as AlwaysOnStatus);
    }

    // Get config
    const { data: config } = await supabase
      .from('always_on_config')
      .select('*')
      .eq('org_id', orgId)
      .single();

    // Get last completed run
    const { data: lastRun } = await supabase
      .from('digest_runs')
      .select('*')
      .eq('org_id', orgId)
      .order('run_at', { ascending: false })
      .limit(1)
      .single();

    // Calculate next run time based on scan_time_utc
    const nextRunAt = calculateNextRun(config?.scan_time_utc || '06:00:00');

    return NextResponse.json({
      enabled,
      config: config ? mapConfigFromDb(config) : null,
      lastRun: lastRun ? mapDigestRunFromDb(lastRun) : null,
      nextRunAt,
    } as AlwaysOnStatus);
  } catch (error) {
    captureWithOrgContext(error, ctx.orgId, { route: '/api/always-on/status' });
    console.error('Failed to get Always On status:', error);
    return NextResponse.json(
      { error: 'Failed to get Always On status' },
      { status: 500 }
    );
  }
}

/**
 * Calculate next run time based on scan_time_utc
 */
function calculateNextRun(scanTimeUtc: string): string {
  const now = new Date();
  const [hours, minutes] = scanTimeUtc.split(':').map(Number);

  // Create next run date at the specified UTC time
  const nextRun = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    hours,
    minutes,
    0,
    0
  ));

  // If the time has already passed today, schedule for tomorrow
  if (nextRun <= now) {
    nextRun.setUTCDate(nextRun.getUTCDate() + 1);
  }

  return nextRun.toISOString();
}

/**
 * Map database config to API format
 */
function mapConfigFromDb(data: any): any {
  return {
    orgId: data.org_id,
    scanTimeUtc: data.scan_time_utc,
    digestEnabled: data.digest_enabled,
    emailRecipients: data.email_recipients || [],
    slackEnabled: data.slack_enabled,
    slackWebhookUrl: data.slack_webhook_url,
    sendOnNoChange: data.send_on_no_change,
    scoreDeltaThreshold: data.score_delta_threshold,
    autoMergeGradeA: data.auto_merge_grade_a,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

/**
 * Map database digest run to API format
 */
function mapDigestRunFromDb(data: any): any {
  return {
    id: data.id,
    orgId: data.org_id,
    connectionId: data.connection_id,
    portalName: data.portal_name,
    runAt: data.run_at,
    triggeredBy: data.triggered_by,
    status: data.status,
    scoreBefore: data.score_before ? parseFloat(data.score_before) : null,
    scoreAfter: data.score_after ? parseFloat(data.score_after) : null,
    scoreDelta: data.score_delta ? parseFloat(data.score_delta) : null,
    newPairsDetected: data.new_pairs_detected,
    newInsights: data.new_insights,
    recordsScanned: data.records_scanned,
    digestSent: data.digest_sent,
    slackSent: data.slack_sent,
    skippedReason: data.skipped_reason,
    errorMessage: data.error_message,
    digestPayload: data.digest_payload,
    createdAt: data.created_at,
  };
}
