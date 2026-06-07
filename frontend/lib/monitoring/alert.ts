/**
 * Worker Health Alerting
 *
 * Sends email alerts when worker jobs fail or miss their schedule.
 */

import { Resend } from 'resend';
import { buildEmailTemplate, buildHeading, buildParagraph } from '../emails/template';

// Lazy load Resend client to avoid crash if RESEND_API_KEY is missing at import time
function getResendClient() {
  if (!process.env.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY is not set. Email alerts are disabled.');
  }
  return new Resend(process.env.RESEND_API_KEY);
}

export async function sendWorkerAlert(
  subject: string,
  body: string,
  orgId?: string
) {
  try {
    const resend = getResendClient();

    // Get friendly org name
    let orgDisplay = orgId || 'Unknown';
    if (orgId) {
      orgDisplay = await getOrgDisplayName(orgId);
    }

    const content = `
      ${buildHeading('Worker Alert', 1)}
      ${buildParagraph(body)}
      ${orgId ? buildParagraph(`<span style="color: #6b7280; font-size: 14px;">Organization: ${orgDisplay}</span>`) : ''}
      ${buildParagraph(`<span style="color: #6b7280; font-size: 14px;">Time: ${new Date().toISOString()}</span>`)}
    `;

    const html = buildEmailTemplate({
      title: 'Worker Alert',
      preheader: subject,
      content,
      showUnsubscribe: false, // System alerts don't have unsubscribe
    });

    await resend.emails.send({
      from: 'Refyne <hello@refynedata.com>',
      to: 'jeff@revopsimpact.us',
      subject: `Refyne Worker: ${subject}`,
      html,
    });
  } catch (error) {
    console.error('[Worker Alert] Failed to send alert email:', error);
    // Don't throw - alerting failure shouldn't crash the worker
  }
}

/**
 * Get friendly organization display name.
 * Tries Clerk first, then hubspot_connections.friendly_name, falls back to orgId.
 */
async function getOrgDisplayName(orgId: string): Promise<string> {
  // Try Clerk first
  try {
    const { clerkClient } = await import('@clerk/nextjs/server');
    const client = await clerkClient();
    const org = await client.organizations.getOrganization({ organizationId: orgId });
    if (org?.name) {
      return org.name;
    }
  } catch (clerkError) {
    // Clerk lookup failed, continue to next method
    console.debug('[Worker Alert] Clerk lookup failed, trying database');
  }

  // Try hubspot_connections.friendly_name
  try {
    const { supabaseAdmin } = await import('../db/admin-client');
    const { data: connection } = await supabaseAdmin
      .from('hubspot_connections')
      .select('friendly_name')
      .eq('org_id', orgId)
      .limit(1)
      .single();

    if (connection?.friendly_name) {
      return connection.friendly_name;
    }
  } catch (dbError) {
    // Database lookup failed
    console.debug('[Worker Alert] Database lookup failed');
  }

  // Fallback to orgId
  return orgId;
}
