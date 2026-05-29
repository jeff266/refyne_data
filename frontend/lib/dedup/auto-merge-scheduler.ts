/**
 * Auto-merge Scheduler
 *
 * Schedules high-confidence Grade A clusters for automatic merge after a
 * configurable waiting period. Called at the end of each dedup scan.
 */

import { supabase } from '@/lib/db/supabase';

const AUTO_MERGE_CONFIDENCE_THRESHOLD = 0.97;

/**
 * Called at the end of a dedup scan.
 * Schedules high-confidence clusters for auto-merge if enabled for org.
 */
export async function scheduleAutoMerges(
  orgId: string,
  newClusterIds: string[]
): Promise<void> {
  if (!supabase) {
    console.warn('[Auto-merge] Supabase not configured');
    return;
  }

  if (newClusterIds.length === 0) return;

  // Load org settings
  const { data: settings } = await supabase
    .from('dedup_auto_merge_settings')
    .select('*')
    .eq('org_id', orgId)
    .single();

  if (!settings?.enabled) {
    console.log('[Auto-merge] Not enabled for org', orgId);
    return;
  }

  const threshold = settings.confidence_threshold ?? AUTO_MERGE_CONFIDENCE_THRESHOLD;
  const waitingHours = settings.waiting_period_hours ?? 24;
  const scheduledAt = new Date(
    Date.now() + waitingHours * 60 * 60 * 1000
  ).toISOString();

  // Find new Grade A clusters
  const { data: eligibleClusters } = await supabase
    .from('dedup_clusters')
    .select('id, grade')
    .in('id', newClusterIds)
    .eq('status', 'pending')
    .eq('grade', 'A');

  if (!eligibleClusters || eligibleClusters.length === 0) {
    console.log('[Auto-merge] No Grade A clusters found');
    return;
  }

  // Check confidence from pairs (confidence stored as 0-100)
  const clusterIds = eligibleClusters.map((c) => c.id);
  const { data: pairs } = await supabase
    .from('dedup_pairs')
    .select('cluster_id, confidence')
    .in('cluster_id', clusterIds)
    .gte('confidence', threshold * 100);

  const highConfidenceClusterIds = Array.from(new Set(
    (pairs ?? []).map((p) => p.cluster_id)
  ));

  if (highConfidenceClusterIds.length === 0) {
    console.log('[Auto-merge] No clusters above confidence threshold', threshold);
    return;
  }

  // Schedule auto-merge
  const { error: updateError } = await supabase
    .from('dedup_clusters')
    .update({ auto_merge_scheduled_at: scheduledAt })
    .in('id', highConfidenceClusterIds);

  if (updateError) {
    console.error('[Auto-merge] Failed to schedule clusters:', updateError);
    return;
  }

  console.log(
    `[Auto-merge] Scheduled ${highConfidenceClusterIds.length} clusters for ${orgId} at ${scheduledAt}`
  );

  // Send notification
  await sendAutoMergeNotification(
    orgId,
    settings,
    highConfidenceClusterIds.length,
    waitingHours
  );
}

/**
 * Send notification to configured channels when auto-merge is scheduled.
 */
async function sendAutoMergeNotification(
  orgId: string,
  settings: Record<string, any>,
  count: number,
  waitingHours: number
): Promise<void> {
  const message = `${count} high-confidence duplicate ${
    count === 1 ? 'cluster' : 'clusters'
  } will auto-merge in ${waitingHours} hours. Review and cancel at app.refynedata.com/dedup`;

  // Email notification via Resend
  if (settings.notify_email) {
    try {
      const resendApiKey = process.env.RESEND_API_KEY;
      if (resendApiKey) {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${resendApiKey}`,
          },
          body: JSON.stringify({
            from: 'Refyne Dedup <dedup@refynedata.com>',
            to: [settings.notify_email],
            subject: `🔁 ${count} duplicate${count === 1 ? '' : 's'} scheduled for auto-merge`,
            html: `
              <p>${message}</p>
              <p><a href="https://app.refynedata.com/dedup">Review pending merges →</a></p>
            `,
          }),
        });
        console.log(`[Auto-merge] Email notification sent to ${settings.notify_email}`);
      }
    } catch (err) {
      console.error('[Auto-merge] Email notification failed:', err);
    }
  }

  // Slack notification via webhook
  if (settings.notify_slack_webhook) {
    try {
      await fetch(settings.notify_slack_webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `🔁 Refyne Dedup: ${message}`,
        }),
      });
      console.log('[Auto-merge] Slack notification sent');
    } catch (err) {
      console.error('[Auto-merge] Slack notification failed:', err);
    }
  }
}
