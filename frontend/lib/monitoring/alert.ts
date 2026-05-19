/**
 * Worker Health Alerting
 *
 * Sends email alerts when worker jobs fail or miss their schedule.
 */

import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendWorkerAlert(
  subject: string,
  body: string,
  orgId?: string
) {
  try {
    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL!,
      to: 'jeff@revopsimpact.us',
      subject: `[Refyne Worker] ${subject}`,
      html: `
        <div style="font-family: system-ui, sans-serif; padding: 20px;">
          <h2 style="color: #dc2626; margin-bottom: 16px;">Worker Alert</h2>
          <p style="margin-bottom: 12px;">${body}</p>
          ${orgId ? `<p style="color: #6b7280; font-size: 14px;">Org ID: ${orgId}</p>` : ''}
          <p style="color: #6b7280; font-size: 14px;">Time: ${new Date().toISOString()}</p>
        </div>
      `,
    });
  } catch (error) {
    console.error('[Worker Alert] Failed to send alert email:', error);
    // Don't throw - alerting failure shouldn't crash the worker
  }
}
