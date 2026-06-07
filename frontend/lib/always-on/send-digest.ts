/**
 * Digest Email Sender
 *
 * Sends Always On digest emails using Resend.
 * NOTE: Requires `npm install resend` and RESEND_API_KEY env var.
 */

import type { DigestPayload } from './types';
import { buildUnsubscribeUrl } from './unsubscribe';
import { buildEmailTemplate } from '../emails/template';

/**
 * Send digest email to recipients using Resend.
 */
export async function sendDigestEmail(
  payload: DigestPayload,
  recipients: string[],
  orgId: string
): Promise<void> {
  // Check if Resend is configured
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY not configured - email not sent');
    return;
  }

  // Lazy-load Resend (will fail gracefully if not installed)
  let Resend: any;
  try {
    Resend = (await import('resend')).Resend;
  } catch (error) {
    console.error('Resend package not installed. Run: npm install resend');
    throw new Error('Resend package not installed');
  }

  const resend = new Resend(process.env.RESEND_API_KEY);

  // Send to each recipient
  const sendPromises = recipients.map(async (email) => {
    const unsubscribeUrl = buildUnsubscribeUrl(email, orgId);

    // Build HTML email with unsubscribe link
    const html = buildEmailHtml(payload, orgId, unsubscribeUrl);

    try {
      await resend.emails.send({
        from: 'Refyne <hello@refynedata.com>',
        to: email,
        subject: `Refyne Digest: ${payload.portalName} - ${payload.score}% ${payload.scoreDelta > 0 ? '+' : payload.scoreDelta < 0 ? '-' : ''} ${Math.abs(payload.scoreDelta)}pts`,
        html,
        headers: {
          'List-Unsubscribe': `<${unsubscribeUrl}>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        },
      });
    } catch (error) {
      console.error(`Failed to send email to ${email}:`, error);
      throw error;
    }
  });

  await Promise.all(sendPromises);
}

/**
 * Build HTML email content.
 * Uses brand standards and shared template utilities.
 */
function buildEmailHtml(payload: DigestPayload, orgId: string, unsubscribeUrl: string): string {
  const {
    portalName,
    digestDate,
    score,
    scoreDelta,
    remediationItems,
    harmonyBreakdown,
    dedupSummary,
    dashboardUrl,
    dedupUrl,
    settingsUrl,
  } = payload;

  const deltaColor = scoreDelta > 0 ? '#10b981' : scoreDelta < 0 ? '#ef4444' : '#6b7280';
  const deltaSymbol = scoreDelta > 0 ? '+' : scoreDelta < 0 ? '-' : '';

  // Build remediation rows (max 3)
  const remediationRows = remediationItems
    .slice(0, 3)
    .map(
      (item, i) => `
    <tr>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
        <div style="font-family: 'Jost', sans-serif; font-size: 13px; color: #1f2937;">
          <strong>#${i + 1}</strong> - <strong>${item.harmony}</strong>
        </div>
        <div style="font-family: 'Jost', sans-serif; font-size: 12px; color: #6b7280; margin-top: 2px;">
          ${item.issue} - ${item.recordsAffected} records
        </div>
      </td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">
        <a href="${item.actionUrl}" style="display: inline-block; padding: 6px 12px; background: #2E6BA8; color: #ffffff; text-decoration: none; font-family: 'Jost', sans-serif; font-size: 12px; font-weight: 500;">
          ${item.actionLabel}
        </a>
      </td>
    </tr>
  `
    )
    .join('');

  // Build harmony breakdown rows
  const harmonyRows = harmonyBreakdown
    .map(
      (h) => `
    <tr>
      <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; font-family: 'Jost', sans-serif; font-size: 12px; color: #6b7280;">
        ${h.name}
      </td>
      <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb;">
        <div style="width: 100%; max-width: 120px; height: 4px; background: #e5e7eb;">
          <div style="width: ${h.score}%; height: 100%; background: #2E6BA8;"></div>
        </div>
      </td>
      <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; font-family: 'Jost', sans-serif; font-size: 12px; color: #1f2937; font-weight: 600; text-align: right;">
        ${h.score}%
      </td>
      <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; font-family: 'Jost', sans-serif; font-size: 11px; color: ${h.delta >= 0 ? '#10b981' : '#ef4444'}; text-align: right;">
        ${h.delta > 0 ? '+' : ''}${h.delta}
      </td>
    </tr>
  `
    )
    .join('');

  const content = `
    <!-- Header with portal and date -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 24px;">
      <tr>
        <td align="right">
          <div style="font-family: 'Jost', sans-serif; font-size: 13px; color: #6b7280;">
            ${portalName} - ${digestDate}
          </div>
        </td>
      </tr>
    </table>

    <!-- Score -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 32px; padding-bottom: 32px; border-bottom: 1px solid #e5e7eb;">
      <tr>
        <td align="center">
          <div style="font-family: 'Lora', Georgia, serif; font-size: 48px; font-weight: 700; color: #1f2937; margin-bottom: 8px;">
            ${score}%
          </div>
          <div style="font-family: 'Jost', sans-serif; font-size: 18px; font-weight: 600; color: ${deltaColor};">
            ${deltaSymbol} ${Math.abs(scoreDelta)} pts
          </div>
        </td>
      </tr>
    </table>

    ${
      remediationItems.length > 0
        ? `
    <!-- Remediation Items -->
    <h2 style="font-family: 'Lora', Georgia, serif; font-size: 18px; font-weight: 600; color: #1f2937; margin: 24px 0 12px 0;">
      Top Remediation Items
    </h2>

    <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #e5e7eb; margin-bottom: 24px;">
      ${remediationRows}
    </table>
    `
        : ''
    }

    ${
      harmonyBreakdown.length > 0
        ? `
    <!-- Harmony Breakdown -->
    <h2 style="font-family: 'Lora', Georgia, serif; font-size: 18px; font-weight: 600; color: #1f2937; margin: 24px 0 12px 0;">
      Harmony Breakdown
    </h2>

    <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #e5e7eb; margin-bottom: 24px;">
      ${harmonyRows}
    </table>
    `
        : ''
    }

    ${
      dedupSummary.newPairs > 0
        ? `
    <!-- Dedup Summary -->
    <table width="100%" cellpadding="0" cellspacing="0" style="background: #f9fafb; border: 1px solid #e5e7eb; margin: 20px 0;">
      <tr>
        <td style="padding: 20px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td>
                <div style="font-family: 'Jost', sans-serif; font-size: 14px; font-weight: 600; color: #1f2937; margin-bottom: 4px;">
                  ${dedupSummary.newPairs} new duplicate pairs detected
                </div>
                <div style="font-family: 'Jost', sans-serif; font-size: 12px; color: #6b7280;">
                  ${dedupSummary.gradeA} Grade A ready for review
                </div>
              </td>
              <td align="right">
                <a href="${dedupUrl}" style="display: inline-block; padding: 8px 16px; background: #2E6BA8; color: #ffffff; text-decoration: none; font-family: 'Jost', sans-serif; font-size: 13px; font-weight: 500;">
                  Review dedup
                </a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
    `
        : ''
    }

    <!-- CTA -->
    <table cellpadding="0" cellspacing="0" style="margin: 20px 0;">
      <tr>
        <td>
          <a href="${dashboardUrl}" style="display: inline-block; padding: 14px 28px; background: #2E6BA8; color: #ffffff; text-decoration: none; font-family: 'Jost', sans-serif; font-size: 15px; font-weight: 600;">
            View Dashboard
          </a>
        </td>
      </tr>
    </table>

    <p style="font-family: 'Jost', sans-serif; font-size: 13px; color: #6b7280; line-height: 1.6; margin: 16px 0;">
      <a href="${settingsUrl}" style="color: #2E6BA8; text-decoration: none;">Manage your digest settings</a>
    </p>
  `;

  return buildEmailTemplate({
    title: 'Refyne Digest',
    preheader: `${portalName}: ${score}% ${deltaSymbol} ${Math.abs(scoreDelta)}pts`,
    content,
    showUnsubscribe: true,
    unsubscribeUrl,
  });
}
