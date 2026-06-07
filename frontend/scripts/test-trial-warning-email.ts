/**
 * Test Trial Warning Email
 *
 * Sends a test trial warning email to verify brand standards implementation.
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

// Mock trial org data
const mockOrgData = {
  org_id: 'org_test_trial',
  subscription_tier: 'trial' as const,
  subscription_status: 'active' as const,
  trial_days_remaining: 3,
  trial_merges_used: 12,
  trial_normalize_writes_used: 45,
  trial_enrich_credits_used: 25,
  trial_warning_email_sent_at: null,
  trial_expiry_email_sent_at: null,
  trial_end_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
};

async function sendTestTrialWarning() {
  console.log('\n📧 Sending test trial warning email...\n');

  const testEmail = 'jeff@revopsimpact.us';
  const daysRemaining = Math.ceil(mockOrgData.trial_days_remaining || 0);
  const upgradeUrl = `${process.env.NEXT_PUBLIC_APP_URL}/billing/upgrade`;

  // Import email template utilities
  const { buildEmailTemplate, buildHeading, buildParagraph, buildButton, buildDataRow } = await import('../lib/emails/template');

  // Build email content
  const content = `
    ${buildHeading('Your trial ends soon', 1)}

    ${buildParagraph(`Your Refyne trial ends in ${daysRemaining} days.`)}

    ${buildHeading("Here's what you've used so far")}

    <table width="100%" cellpadding="0" cellspacing="0" style="background: #f9fafb; border: 1px solid #e5e7eb; margin: 20px 0;">
      <tbody>
        ${buildDataRow('Merges', `${mockOrgData.trial_merges_used} / 25`)}
        ${buildDataRow('Normalize writes', `${mockOrgData.trial_normalize_writes_used} / 100`)}
        ${buildDataRow('Enrich credits', `${mockOrgData.trial_enrich_credits_used} / 50`)}
      </tbody>
    </table>

    ${buildButton('Upgrade now', upgradeUrl)}

    ${buildParagraph('Upgrade to keep your data pipeline running without interruption.')}
  `;

  const html = buildEmailTemplate({
    title: 'Your Refyne trial ends soon',
    preheader: `Your trial ends in ${daysRemaining} days`,
    content,
    showUnsubscribe: false,
  });

  // Send via Resend
  const { Resend } = await import('resend');
  const resend = new Resend(process.env.RESEND_API_KEY);

  const result = await resend.emails.send({
    from: 'Refyne <hello@refynedata.com>',
    to: testEmail,
    subject: `Your Refyne trial ends in ${daysRemaining} days`,
    html,
  });

  console.log('✅ Email sent successfully!');
  console.log('   Response:', JSON.stringify(result, null, 2));
  console.log('\n📬 Check your inbox at:', testEmail);
  console.log('   (Also check spam/junk folder)\n');
}

sendTestTrialWarning().catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
});
