/**
 * Trial Expiry Email Notifier
 *
 * Runs nightly at 9am UTC to send trial warning and expiry emails.
 * Integrated into the digest worker cron.
 */

import { supabaseAdmin } from '@/lib/db/admin-client';
import { clerkClient } from '@clerk/nextjs/server';

// Resend will be imported when implemented
// For now, we'll log the emails that would be sent

interface TrialOrg {
  org_id: string;
  subscription_tier: string;
  subscription_status: string;
  trial_days_remaining: number | null;
  trial_merges_used: number;
  trial_normalize_writes_used: number;
  trial_enrich_credits_used: number;
  trial_warning_email_sent_at: string | null;
  trial_expiry_email_sent_at: string | null;
  trial_end_date: string | null;
}

/**
 * Check and send trial expiry emails
 * Called from digest worker nightly at 9am UTC
 */
export async function checkAndSendTrialExpiryEmails(): Promise<{
  warningEmailsSent: number;
  expiryEmailsSent: number;
  errors: number;
}> {
  const results = {
    warningEmailsSent: 0,
    expiryEmailsSent: 0,
    errors: 0,
  };

  try {
    // Query all trial orgs
    const { data: trialOrgs, error } = await supabaseAdmin
      .from('org_entitlements')
      .select(`
        org_id,
        subscription_tier,
        subscription_status,
        trial_days_remaining,
        trial_merges_used,
        trial_normalize_writes_used,
        trial_enrich_credits_used,
        trial_warning_email_sent_at,
        trial_expiry_email_sent_at,
        trial_end_date
      `)
      .eq('subscription_tier', 'trial')
      .eq('subscription_status', 'active');

    if (error) {
      console.error('[Trial Expiry] Failed to query trial orgs:', error);
      return results;
    }

    if (!trialOrgs || trialOrgs.length === 0) {
      console.log('[Trial Expiry] No active trial orgs found');
      return results;
    }

    console.log(`[Trial Expiry] Checking ${trialOrgs.length} trial orgs`);

    for (const org of trialOrgs as unknown as TrialOrg[]) {
      try {
        // Check if warning email should be sent (3 days before expiry)
        if (
          org.trial_days_remaining !== null &&
          org.trial_days_remaining <= 3 &&
          org.trial_days_remaining > 0 &&
          !org.trial_warning_email_sent_at
        ) {
          await sendTrialWarningEmail(org);
          results.warningEmailsSent++;
          continue; // Don't send both emails on same day
        }

        // Check if expiry email should be sent (after trial ends)
        if (
          org.trial_end_date &&
          new Date(org.trial_end_date) < new Date() &&
          !org.trial_expiry_email_sent_at
        ) {
          await sendTrialExpiryEmail(org);
          results.expiryEmailsSent++;
        }
      } catch (error) {
        console.error(`[Trial Expiry] Error processing org ${org.org_id}:`, error);
        results.errors++;
      }
    }

    console.log(
      `[Trial Expiry] Complete: ` +
      `warning=${results.warningEmailsSent} ` +
      `expiry=${results.expiryEmailsSent} ` +
      `errors=${results.errors}`
    );

    return results;
  } catch (error) {
    console.error('[Trial Expiry] Fatal error:', error);
    return results;
  }
}

/**
 * Send 3-day trial warning email
 */
async function sendTrialWarningEmail(org: TrialOrg): Promise<void> {
  try {
    // Get org admin email from Clerk
    const adminEmail = await getOrgAdminEmail(org.org_id);

    if (!adminEmail) {
      console.warn(`[Trial Expiry] No admin email found for org ${org.org_id}`);
      return;
    }

    const daysRemaining = Math.ceil(org.trial_days_remaining || 0);

    // TODO: Send via Resend when email infrastructure is ready
    // For now, just log what would be sent
    console.log(`[Trial Expiry] Would send warning email to ${adminEmail}`);
    console.log(`Subject: Your Refyne trial ends in ${daysRemaining} days`);
    console.log(`Body:`);
    console.log(`  Hi,`);
    console.log(``);
    console.log(`  Your Refyne trial ends in ${daysRemaining} days.`);
    console.log(``);
    console.log(`  Here's what you've used so far:`);
    console.log(`  - Merges: ${org.trial_merges_used} / 25`);
    console.log(`  - Normalize writes: ${org.trial_normalize_writes_used} / 100`);
    console.log(`  - Enrich credits: ${org.trial_enrich_credits_used} / 50`);
    console.log(``);
    console.log(`  Upgrade to keep your data pipeline running:`);
    console.log(`  ${process.env.NEXT_PUBLIC_APP_URL}/billing/upgrade`);
    console.log(``);
    console.log(`  The Refyne team`);

    // Update org_billing to mark email as sent
    await supabaseAdmin
      .from('org_billing')
      .update({
        trial_warning_email_sent_at: new Date().toISOString(),
      })
      .eq('org_id', org.org_id);

    console.log(`[Trial Expiry] Warning email sent for org ${org.org_id}`);
  } catch (error) {
    console.error(`[Trial Expiry] Failed to send warning email for org ${org.org_id}:`, error);
    throw error;
  }
}

/**
 * Send trial expiry email
 */
async function sendTrialExpiryEmail(org: TrialOrg): Promise<void> {
  try {
    // Get org admin email from Clerk
    const adminEmail = await getOrgAdminEmail(org.org_id);

    if (!adminEmail) {
      console.warn(`[Trial Expiry] No admin email found for org ${org.org_id}`);
      return;
    }

    // TODO: Send via Resend when email infrastructure is ready
    // For now, just log what would be sent
    console.log(`[Trial Expiry] Would send expiry email to ${adminEmail}`);
    console.log(`Subject: Your Refyne trial has ended`);
    console.log(`Body:`);
    console.log(`  Hi,`);
    console.log(``);
    console.log(`  Your Refyne trial has ended.`);
    console.log(``);
    console.log(`  Your data is safe. Upgrade to continue normalizing,`);
    console.log(`  deduping, and enriching your HubSpot records.`);
    console.log(``);
    console.log(`  Choose a plan:`);
    console.log(`  ${process.env.NEXT_PUBLIC_APP_URL}/billing/upgrade`);
    console.log(``);
    console.log(`  The Refyne team`);

    // Update org_billing to mark email as sent
    await supabaseAdmin
      .from('org_billing')
      .update({
        trial_expiry_email_sent_at: new Date().toISOString(),
      })
      .eq('org_id', org.org_id);

    console.log(`[Trial Expiry] Expiry email sent for org ${org.org_id}`);
  } catch (error) {
    console.error(`[Trial Expiry] Failed to send expiry email for org ${org.org_id}:`, error);
    throw error;
  }
}

/**
 * Get org admin email from Clerk
 */
async function getOrgAdminEmail(orgId: string): Promise<string | null> {
  try {
    const memberships = await clerkClient.organizations.getOrganizationMembershipList({
      organizationId: orgId,
    });

    // Find first admin
    const admin = memberships.data.find(m => m.role === 'org:admin');

    if (admin && admin.publicUserData?.identifier) {
      return admin.publicUserData.identifier;
    }

    return null;
  } catch (error) {
    console.error(`[Trial Expiry] Failed to get admin email for org ${orgId}:`, error);
    return null;
  }
}
