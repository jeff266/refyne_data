/**
 * Trial Expiry Notifier
 *
 * Sends warning emails 3 days before trial ends and expiry emails after trial ends.
 * Called nightly from the digest worker at 9am UTC.
 *
 * Tracks send state in org_billing.trial_warning_email_sent_at and
 * org_billing.trial_expiry_email_sent_at to ensure each email is sent once.
 */

import { supabaseAdmin } from '@/lib/db/admin-client';
import { clerkClient } from '@clerk/nextjs/server';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.refynedata.com';
const FROM_EMAIL = 'hello@refynedata.com';

interface TrialOrg {
  org_id: string;
  trial_end_date: string;
  trial_merges_used: number;
  trial_normalize_writes_used: number;
  trial_enrich_credits_used: number;
  trial_warning_email_sent_at: string | null;
  trial_expiry_email_sent_at: string | null;
}

async function getAdminEmail(orgId: string): Promise<string | null> {
  try {
    const client = await clerkClient();
    const memberships = await client.organizations.getOrganizationMembershipList({
      organizationId: orgId,
    });
    const admin = memberships.data.find(m => m.role === 'org:admin');
    if (!admin) return null;
    const user = await client.users.getUser(admin.publicUserData?.userId ?? '');
    return user.emailAddresses?.[0]?.emailAddress ?? null;
  } catch {
    return null;
  }
}

async function sendEmail(to: string, subject: string, text: string): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[TrialExpiry] RESEND_API_KEY not configured - skipping email');
    return;
  }

  let Resend: any;
  try {
    Resend = (await import('resend')).Resend;
  } catch {
    console.error('[TrialExpiry] Resend package not installed');
    return;
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  await resend.emails.send({ from: FROM_EMAIL, to, subject, text });
}

/**
 * Run trial expiry email checks.
 * Should be called once per day at 9am UTC from the digest worker.
 */
export async function runTrialExpiryNotifier(): Promise<void> {
  const { data: orgs, error } = await supabaseAdmin
    .from('org_billing')
    .select(
      'org_id, trial_end_date, trial_merges_used, trial_normalize_writes_used, ' +
      'trial_enrich_credits_used, trial_warning_email_sent_at, trial_expiry_email_sent_at'
    )
    .eq('subscription_tier', 'trial')
    .eq('subscription_status', 'active');

  if (error) {
    console.error('[TrialExpiry] Failed to fetch trial orgs:', error);
    return;
  }

  if (!orgs || orgs.length === 0) return;

  console.log(`[TrialExpiry] Checking ${orgs.length} trial orgs`);

  for (const org of orgs as TrialOrg[]) {
    await processOrg(org);
  }
}

async function processOrg(org: TrialOrg): Promise<void> {
  const now = new Date();
  const trialEnd = new Date(org.trial_end_date);
  const msRemaining = trialEnd.getTime() - now.getTime();
  const daysRemaining = Math.ceil(msRemaining / 86400000);

  // Warning email: 3 days before end, send once
  if (
    daysRemaining <= 3 &&
    daysRemaining > 0 &&
    !org.trial_warning_email_sent_at
  ) {
    const email = await getAdminEmail(org.org_id);
    if (email) {
      const subject = `Your Refyne trial ends in ${daysRemaining} ${daysRemaining === 1 ? 'day' : 'days'}`;
      const text = [
        'Hi,',
        '',
        `Your Refyne trial ends in ${daysRemaining} ${daysRemaining === 1 ? 'day' : 'days'}.`,
        '',
        "Here's what you've used so far:",
        `- Merges: ${org.trial_merges_used} / 25`,
        `- Normalize writes: ${org.trial_normalize_writes_used} / 100`,
        `- Enrich credits: ${org.trial_enrich_credits_used} / 50`,
        '',
        'Upgrade to keep your data pipeline running:',
        `${APP_URL}/billing/upgrade`,
        '',
        'The Refyne team',
      ].join('\n');

      try {
        await sendEmail(email, subject, text);
        await supabaseAdmin
          .from('org_billing')
          .update({ trial_warning_email_sent_at: now.toISOString() })
          .eq('org_id', org.org_id);
        console.log(`[TrialExpiry] Warning email sent to org ${org.org_id}`);
      } catch (err) {
        console.error(`[TrialExpiry] Failed to send warning email to org ${org.org_id}:`, err);
      }
    }
    return;
  }

  // Expiry email: after trial ends, send once
  if (trialEnd < now && !org.trial_expiry_email_sent_at) {
    const email = await getAdminEmail(org.org_id);
    if (email) {
      const subject = 'Your Refyne trial has ended';
      const text = [
        'Hi,',
        '',
        'Your Refyne trial has ended.',
        '',
        'Your data is safe. Upgrade to continue normalizing,',
        'deduping, and enriching your HubSpot records.',
        '',
        'Choose a plan:',
        `${APP_URL}/billing/upgrade`,
        '',
        'The Refyne team',
      ].join('\n');

      try {
        await sendEmail(email, subject, text);
        await supabaseAdmin
          .from('org_billing')
          .update({ trial_expiry_email_sent_at: now.toISOString() })
          .eq('org_id', org.org_id);
        console.log(`[TrialExpiry] Expiry email sent to org ${org.org_id}`);
      } catch (err) {
        console.error(`[TrialExpiry] Failed to send expiry email to org ${org.org_id}:`, err);
      }
    }
  }
}
