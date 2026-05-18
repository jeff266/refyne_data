/**
 * Digest Email Sender
 *
 * Sends Always On digest emails using Resend.
 * NOTE: Requires `npm install resend` and RESEND_API_KEY env var.
 */

import type { DigestPayload } from './types';
import { generateUnsubscribeToken } from './unsubscribe';

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

  // Build HTML email
  const html = buildEmailHtml(payload, orgId);

  // Send to each recipient
  const sendPromises = recipients.map(async (email) => {
    try {
      await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL || 'Refyne <noreply@refyne.io>',
        to: email,
        subject: `Refyne Digest: ${payload.portalName} — ${payload.score}% ${payload.scoreDelta > 0 ? '↑' : payload.scoreDelta < 0 ? '↓' : '→'} ${Math.abs(payload.scoreDelta)}pts`,
        html,
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
 * Uses inline styles for email client compatibility.
 */
function buildEmailHtml(payload: DigestPayload, orgId: string): string {
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
  const deltaSymbol = scoreDelta > 0 ? '↑' : scoreDelta < 0 ? '↓' : '→';

  // Build remediation rows (max 3)
  const remediationRows = remediationItems
    .slice(0, 3)
    .map(
      (item, i) => `
    <tr>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
        <div style="font-family: system-ui, -apple-system, sans-serif; font-size: 13px; color: #1f2937;">
          <strong>#${i + 1}</strong> · <strong>${item.harmony}</strong>
        </div>
        <div style="font-family: system-ui, -apple-system, sans-serif; font-size: 12px; color: #6b7280; margin-top: 2px;">
          ${item.issue} — ${item.recordsAffected} records
        </div>
      </td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">
        <a href="${item.actionUrl}" style="display: inline-block; padding: 6px 12px; background: #6366f1; color: #ffffff; text-decoration: none; border-radius: 6px; font-family: system-ui, -apple-system, sans-serif; font-size: 12px; font-weight: 500;">
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
      <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; font-family: monospace; font-size: 12px; color: #6b7280;">
        ${h.name}
      </td>
      <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb;">
        <div style="width: 100%; max-width: 120px; height: 4px; background: #e5e7eb; border-radius: 2px;">
          <div style="width: ${h.score}%; height: 100%; background: #6366f1; border-radius: 2px;"></div>
        </div>
      </td>
      <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; font-family: monospace; font-size: 12px; color: #1f2937; font-weight: 600; text-align: right;">
        ${h.score}%
      </td>
      <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; font-family: monospace; font-size: 11px; color: ${h.delta >= 0 ? '#10b981' : '#ef4444'}; text-align: right;">
        ${h.delta > 0 ? '+' : ''}${h.delta}
      </td>
    </tr>
  `
    )
    .join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Refyne Digest</title>
</head>
<body style="margin: 0; padding: 0; background: #f9fafb; font-family: system-ui, -apple-system, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background: #f9fafb; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">

          <!-- Header -->
          <tr>
            <td style="padding: 24px; background: #6366f1;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <div style="font-family: system-ui, -apple-system, sans-serif; font-size: 20px; font-weight: 700; color: #ffffff;">
                      Refyne
                    </div>
                  </td>
                  <td align="right">
                    <div style="font-family: system-ui, -apple-system, sans-serif; font-size: 13px; color: rgba(255,255,255,0.9);">
                      ${portalName} · ${digestDate}
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Score -->
          <tr>
            <td style="padding: 32px 24px; text-align: center; border-bottom: 1px solid #e5e7eb;">
              <div style="font-family: system-ui, -apple-system, sans-serif; font-size: 48px; font-weight: 700; color: #1f2937; margin-bottom: 8px;">
                ${score}%
              </div>
              <div style="font-family: system-ui, -apple-system, sans-serif; font-size: 18px; font-weight: 600; color: ${deltaColor};">
                ${deltaSymbol} ${Math.abs(scoreDelta)} pts
              </div>
            </td>
          </tr>

          <!-- Remediation -->
          ${
            remediationItems.length > 0
              ? `
          <tr>
            <td style="padding: 24px 24px 0 24px;">
              <div style="font-family: system-ui, -apple-system, sans-serif; font-size: 16px; font-weight: 600; color: #1f2937; margin-bottom: 16px;">
                Top Remediation Items
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding: 0 12px 24px 12px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
                ${remediationRows}
              </table>
            </td>
          </tr>
          `
              : ''
          }

          <!-- Harmonies -->
          ${
            harmonyBreakdown.length > 0
              ? `
          <tr>
            <td style="padding: 24px 24px 0 24px;">
              <div style="font-family: system-ui, -apple-system, sans-serif; font-size: 16px; font-weight: 600; color: #1f2937; margin-bottom: 16px;">
                Harmony Breakdown
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding: 0 12px 24px 12px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
                ${harmonyRows}
              </table>
            </td>
          </tr>
          `
              : ''
          }

          <!-- Dedup -->
          ${
            dedupSummary.newPairs > 0
              ? `
          <tr>
            <td style="padding: 24px; background: #f9fafb; border-top: 1px solid #e5e7eb;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <div style="font-family: system-ui, -apple-system, sans-serif; font-size: 14px; font-weight: 600; color: #1f2937; margin-bottom: 4px;">
                      ${dedupSummary.newPairs} new duplicate pairs detected
                    </div>
                    <div style="font-family: system-ui, -apple-system, sans-serif; font-size: 12px; color: #6b7280;">
                      ${dedupSummary.gradeA} Grade A ready for review
                    </div>
                  </td>
                  <td align="right">
                    <a href="${dedupUrl}" style="display: inline-block; padding: 8px 16px; background: #6366f1; color: #ffffff; text-decoration: none; border-radius: 6px; font-family: system-ui, -apple-system, sans-serif; font-size: 13px; font-weight: 500;">
                      Review dedup
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          `
              : ''
          }

          <!-- Footer -->
          <tr>
            <td style="padding: 24px; text-align: center; border-top: 1px solid #e5e7eb;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${dashboardUrl}" style="display: inline-block; margin: 0 8px; font-family: system-ui, -apple-system, sans-serif; font-size: 13px; color: #6366f1; text-decoration: none;">
                      Dashboard
                    </a>
                    <span style="color: #d1d5db;">·</span>
                    <a href="${settingsUrl}" style="display: inline-block; margin: 0 8px; font-family: system-ui, -apple-system, sans-serif; font-size: 13px; color: #6366f1; text-decoration: none;">
                      Settings
                    </a>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-top: 16px;">
                    <div style="font-family: system-ui, -apple-system, sans-serif; font-size: 11px; color: #9ca3af;">
                      © 2026 Refyne
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}
