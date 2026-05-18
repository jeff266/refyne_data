/**
 * Slack Block Kit Payload
 *
 * Builds Slack message blocks for Always On digests.
 */

import type { DigestPayload } from './types';

/**
 * Build Slack Block Kit payload from digest data.
 */
export function buildSlackPayload(payload: DigestPayload): any {
  const {
    portalName,
    digestDate,
    score,
    scoreDelta,
    remediationItems,
    dedupSummary,
    dashboardUrl,
    dedupUrl,
  } = payload;

  // Delta icon
  const deltaIcon = scoreDelta > 0 ? ':arrow_up:' : scoreDelta < 0 ? ':arrow_down:' : ':left_right_arrow:';

  const blocks: any[] = [
    // Header
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `Refyne · ${portalName}`,
      },
    },

    // Score summary
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*${score}%* ${deltaIcon} ${Math.abs(scoreDelta)}pts  ·  ${digestDate}`,
      },
    },

    { type: 'divider' },
  ];

  // Remediation items (max 3)
  remediationItems.slice(0, 3).forEach((item) => {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `• *${item.harmony}*: ${item.issue} — ${item.recordsAffected} records`,
      },
    });
  });

  // Dedup summary if new pairs detected
  if (dedupSummary.newPairs > 0) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `• *${dedupSummary.newPairs} new duplicate pairs* — ${dedupSummary.gradeA} Grade A ready`,
      },
    });
  }

  blocks.push({ type: 'divider' });

  // Action buttons
  blocks.push({
    type: 'actions',
    elements: [
      {
        type: 'button',
        text: {
          type: 'plain_text',
          text: 'View dashboard',
        },
        url: dashboardUrl,
        style: 'primary',
      },
      {
        type: 'button',
        text: {
          type: 'plain_text',
          text: 'Review dedup',
        },
        url: dedupUrl,
      },
    ],
  });

  return { blocks };
}

/**
 * Post digest to Slack webhook.
 */
export async function postToSlack(
  payload: DigestPayload,
  webhookUrl: string
): Promise<void> {
  const slackPayload = buildSlackPayload(payload);

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(slackPayload),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Slack webhook failed: ${response.status} ${text}`);
  }
}
