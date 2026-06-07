/**
 * Alert Evaluator
 *
 * Evaluates compliance thresholds and fires alerts via email/Slack.
 * Runs at the end of each compliance scan.
 */

import { supabase, isSupabaseConfigured } from '../db/supabase';
import { getScore, getBreakdownByHarmony, getPreviousScore } from './compliance-score';
import {
  buildEmailTemplate,
  buildHeading,
  buildParagraph,
  buildButton,
  buildDataRow,
} from '../emails/template';
import { buildUnsubscribeUrl } from '../always-on/unsubscribe';
import type {
  AlertConfig,
  AlertEvaluation,
  AlertReason,
  ComplianceAlertRow,
  ComplianceScore,
  HarmonyBreakdown,
} from './types';

// ─────────────────────────────────────────────────────────────
// Alert Callbacks
// ─────────────────────────────────────────────────────────────

/**
 * Alert callback function type.
 */
type AlertCallback = (
  orgId: string,
  score: ComplianceScore,
  reasons: AlertReason[],
  previousScore: number | null
) => Promise<void>;

/**
 * Registered alert callbacks.
 */
const alertCallbacks: AlertCallback[] = [];

/**
 * Register an alert callback.
 * Use this pattern to make alert channels pluggable.
 */
export function registerAlertCallback(callback: AlertCallback): void {
  alertCallbacks.push(callback);
}

/**
 * Clear all alert callbacks (for testing).
 */
export function clearAlertCallbacks(): void {
  alertCallbacks.length = 0;
}

// ─────────────────────────────────────────────────────────────
// Alert Configuration
// ─────────────────────────────────────────────────────────────

/**
 * Get alert configuration for an organization.
 */
export async function getAlertConfig(orgId: string): Promise<AlertConfig | null> {
  if (!isSupabaseConfigured() || !supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from('compliance_alerts')
    .select('*')
    .eq('org_id', orgId)
    .single();

  if (error && error.code !== 'PGRST116') {
    // PGRST116 = no rows returned
    console.error('Error fetching alert config:', error);
    return null;
  }

  if (!data) return null;

  return {
    scoreThreshold: data.score_threshold,
    harmonyThreshold: data.harmony_threshold,
    unprocessedThreshold: data.unprocessed_threshold,
    notifyEmail: data.notify_email,
    notifySlackWebhook: data.notify_slack_webhook,
  };
}

/**
 * Save or update alert configuration for an organization.
 */
export async function saveAlertConfig(
  orgId: string,
  config: AlertConfig
): Promise<void> {
  if (!isSupabaseConfigured() || !supabase) {
    return;
  }

  const { error } = await supabase.from('compliance_alerts').upsert(
    {
      org_id: orgId,
      score_threshold: config.scoreThreshold,
      harmony_threshold: config.harmonyThreshold,
      unprocessed_threshold: config.unprocessedThreshold,
      notify_email: config.notifyEmail,
      notify_slack_webhook: config.notifySlackWebhook,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'org_id' }
  );

  if (error) {
    console.error('Error saving alert config:', error);
    throw new Error(`Failed to save alert config: ${error.message}`);
  }
}

// ─────────────────────────────────────────────────────────────
// Alert Evaluation
// ─────────────────────────────────────────────────────────────

/**
 * Evaluate alerts for an organization.
 * Run at the end of each compliance scan.
 */
export async function evaluateAlerts(orgId: string): Promise<AlertEvaluation> {
  const config = await getAlertConfig(orgId);

  // No alert configuration - nothing to evaluate
  if (!config) {
    return { triggered: false, reasons: [] };
  }

  const score = await getScore(orgId);
  const previousScore = await getPreviousScore(orgId);
  const reasons: AlertReason[] = [];

  // Check overall score threshold
  if (config.scoreThreshold !== null && score.score < config.scoreThreshold) {
    reasons.push({
      type: 'score_below',
      threshold: config.scoreThreshold,
      actual: score.score,
    });
  }

  // Check unprocessed threshold
  if (
    config.unprocessedThreshold !== null &&
    score.unprocessed > config.unprocessedThreshold
  ) {
    reasons.push({
      type: 'unprocessed_exceeded',
      threshold: config.unprocessedThreshold,
      actual: score.unprocessed,
    });
  }

  // Check per-Harmony threshold
  if (config.harmonyThreshold !== null) {
    const harmonyBreakdown = await getBreakdownByHarmony(orgId);

    for (const harmony of harmonyBreakdown) {
      if (harmony.rate < config.harmonyThreshold) {
        reasons.push({
          type: 'harmony_below',
          threshold: config.harmonyThreshold,
          actual: harmony.rate,
          harmonyId: harmony.harmonyId,
        });
      }
    }
  }

  // If any thresholds crossed, fire alerts
  if (reasons.length > 0) {
    await fireAlerts(orgId, config, score, reasons, previousScore);
  }

  return {
    triggered: reasons.length > 0,
    reasons,
  };
}

/**
 * Fire alerts through all configured channels.
 */
async function fireAlerts(
  orgId: string,
  config: AlertConfig,
  score: ComplianceScore,
  reasons: AlertReason[],
  previousScore: number | null
): Promise<void> {
  // Fire email alert if configured
  if (config.notifyEmail) {
    await sendEmailAlert(orgId, score, reasons, previousScore);
  }

  // Fire Slack alert if webhook configured
  if (config.notifySlackWebhook) {
    await sendSlackAlert(
      config.notifySlackWebhook,
      orgId,
      score,
      reasons,
      previousScore
    );
  }

  // Fire registered callbacks
  for (const callback of alertCallbacks) {
    try {
      await callback(orgId, score, reasons, previousScore);
    } catch (err) {
      console.error('Alert callback error:', err);
    }
  }
}

// ─────────────────────────────────────────────────────────────
// Email Alerts
// ─────────────────────────────────────────────────────────────

/**
 * Send email alert using Resend.
 */
async function sendEmailAlert(
  orgId: string,
  score: ComplianceScore,
  reasons: AlertReason[],
  previousScore: number | null
): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[Alert Email] RESEND_API_KEY not configured - email not sent');
    return;
  }

  try {
    const { Resend } = await import('resend');
    const resend = new Resend(process.env.RESEND_API_KEY);

    const delta = previousScore !== null ? score.score - previousScore : null;
    const deltaStr = delta !== null ? ` (${delta >= 0 ? '+' : ''}${delta.toFixed(1)}%)` : '';
    const dashboardUrl = getDashboardUrl(orgId);

    // Get org settings to find recipient
    const config = await getAlertConfig(orgId);
    if (!config?.notifyEmail) {
      console.warn('[Alert Email] No recipient email configured');
      return;
    }

    // Build reason list
    const reasonsList = reasons.map(reason => `<li>${formatReason(reason)}</li>`).join('');

    const content = `
      ${buildHeading('Compliance Alert', 1)}

      ${buildParagraph(
        `Your compliance score has dropped below the configured threshold.`
      )}

      <table width="100%" cellpadding="0" cellspacing="0" style="background: #f9fafb; border: 1px solid #e5e7eb; margin: 20px 0;">
        <tbody>
          ${buildDataRow('Current score', `${score.score.toFixed(1)}%${deltaStr}`)}
          ${buildDataRow('Compliant records', score.compliant.toLocaleString())}
          ${buildDataRow('Stale records', score.stale.toLocaleString())}
          ${buildDataRow('Unprocessed records', score.unprocessed.toLocaleString())}
          ${buildDataRow('Total records', score.total.toLocaleString())}
        </tbody>
      </table>

      ${buildHeading('Triggered by')}
      ${buildParagraph(`<ul style="margin: 0; padding-left: 20px;">${reasonsList}</ul>`)}

      ${buildButton('View Compliance Dashboard', dashboardUrl)}
    `;

    const unsubscribeUrl = buildUnsubscribeUrl(config.notifyEmail, orgId);

    const html = buildEmailTemplate({
      title: 'Compliance Alert',
      preheader: `Compliance score: ${score.score.toFixed(1)}%`,
      content,
      showUnsubscribe: true,
      unsubscribeUrl,
    });

    await resend.emails.send({
      from: 'Refyne <hello@refynedata.com>',
      to: config.notifyEmail,
      subject: `Refyne Compliance Alert: Score ${score.score.toFixed(1)}%`,
      html,
      headers: {
        'List-Unsubscribe': `<${unsubscribeUrl}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
    });

    console.log(`[Alert Email] Sent to ${config.notifyEmail} for org ${orgId}`);
  } catch (error) {
    console.error('[Alert Email] Failed to send alert:', error);
  }
}

// ─────────────────────────────────────────────────────────────
// Slack Alerts
// ─────────────────────────────────────────────────────────────

/**
 * Send Slack alert via webhook.
 */
async function sendSlackAlert(
  webhookUrl: string,
  orgId: string,
  score: ComplianceScore,
  reasons: AlertReason[],
  previousScore: number | null
): Promise<void> {
  const delta = previousScore !== null ? score.score - previousScore : null;
  const deltaStr = delta !== null ? ` (${delta >= 0 ? '+' : ''}${delta.toFixed(1)}%)` : '';

  const payload = {
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '⚠️ Compliance Alert',
          emoji: true,
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Score:*\n${score.score.toFixed(1)}%${deltaStr}`,
          },
          {
            type: 'mrkdwn',
            text: `*Organization:*\n${orgId}`,
          },
          {
            type: 'mrkdwn',
            text: `*Compliant:*\n${score.compliant.toLocaleString()}`,
          },
          {
            type: 'mrkdwn',
            text: `*Stale:*\n${score.stale.toLocaleString()}`,
          },
          {
            type: 'mrkdwn',
            text: `*Unprocessed:*\n${score.unprocessed.toLocaleString()}`,
          },
          {
            type: 'mrkdwn',
            text: `*Total:*\n${score.total.toLocaleString()}`,
          },
        ],
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Triggered By:*\n${reasons.map(formatReasonMarkdown).join('\n')}`,
        },
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `<${getDashboardUrl(orgId)}|View Compliance Dashboard>`,
          },
        ],
      },
    ],
  };

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.error(`Slack webhook failed: ${response.status}`);
    }
  } catch (err) {
    console.error('Error sending Slack alert:', err);
  }
}

// ─────────────────────────────────────────────────────────────
// Formatting Helpers
// ─────────────────────────────────────────────────────────────

/**
 * Format an alert reason as a plain text string.
 */
function formatReason(reason: AlertReason): string {
  switch (reason.type) {
    case 'score_below':
      return `Score ${reason.actual.toFixed(1)}% below threshold ${reason.threshold}%`;
    case 'harmony_below':
      return `Harmony ${reason.harmonyId} at ${reason.actual.toFixed(1)}% (threshold: ${reason.threshold}%)`;
    case 'unprocessed_exceeded':
      return `${reason.actual} unprocessed records exceed threshold of ${reason.threshold}`;
    default:
      return 'Unknown alert reason';
  }
}

/**
 * Format an alert reason as Slack markdown.
 */
function formatReasonMarkdown(reason: AlertReason): string {
  switch (reason.type) {
    case 'score_below':
      return `• Overall score (${reason.actual.toFixed(1)}%) below threshold (${reason.threshold}%)`;
    case 'harmony_below':
      return `• Harmony \`${reason.harmonyId}\` at ${reason.actual.toFixed(1)}% (threshold: ${reason.threshold}%)`;
    case 'unprocessed_exceeded':
      return `• ${reason.actual.toLocaleString()} unprocessed records (threshold: ${reason.threshold.toLocaleString()})`;
    default:
      return '• Unknown alert reason';
  }
}

/**
 * Get the dashboard URL for an organization.
 */
function getDashboardUrl(orgId: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  return `${baseUrl}/compliance?org=${orgId}`;
}
