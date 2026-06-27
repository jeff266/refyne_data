/**
 * Test All Email Types
 *
 * Sends one of each email type to verify brand standards.
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const TEST_EMAIL = 'jeff@revopsimpact.com';
const TEST_ORG_ID = 'org_test_emails';

async function sendAllTestEmails() {
  console.log('\n📧 Sending all 8 email types for inspection...\n');
  console.log(`Recipient: ${TEST_EMAIL}\n`);

  const results = [];

  // 1. Subscription Confirmation
  try {
    console.log('1️⃣  Sending Subscription Confirmation...');
    await sendSubscriptionEmail();
    results.push({ email: 'Subscription Confirmation', status: '✅ Sent' });
  } catch (error) {
    results.push({ email: 'Subscription Confirmation', status: `❌ Error: ${error.message}` });
  }

  // 2. Always-On Digest
  try {
    console.log('2️⃣  Sending Always-On Digest...');
    await sendDigestEmail();
    results.push({ email: 'Always-On Digest', status: '✅ Sent' });
  } catch (error) {
    results.push({ email: 'Always-On Digest', status: `❌ Error: ${error.message}` });
  }

  // 3. Dedup Scan Notification
  try {
    console.log('3️⃣  Sending Dedup Scan Notification...');
    await sendDedupNotification();
    results.push({ email: 'Dedup Scan Notification', status: '✅ Sent' });
  } catch (error) {
    results.push({ email: 'Dedup Scan Notification', status: `❌ Error: ${error.message}` });
  }

  // 4. Worker Alert
  try {
    console.log('4️⃣  Sending Worker Alert...');
    await sendWorkerAlert();
    results.push({ email: 'Worker Alert', status: '✅ Sent' });
  } catch (error) {
    results.push({ email: 'Worker Alert', status: `❌ Error: ${error.message}` });
  }

  // 5. Auto-Merge Notification
  try {
    console.log('5️⃣  Sending Auto-Merge Notification...');
    await sendAutoMergeNotification();
    results.push({ email: 'Auto-Merge Notification', status: '✅ Sent' });
  } catch (error) {
    results.push({ email: 'Auto-Merge Notification', status: `❌ Error: ${error.message}` });
  }

  // 6. Trial Warning
  try {
    console.log('6️⃣  Sending Trial Warning...');
    await sendTrialWarning();
    results.push({ email: 'Trial Warning', status: '✅ Sent' });
  } catch (error) {
    results.push({ email: 'Trial Warning', status: `❌ Error: ${error.message}` });
  }

  // 7. Trial Expiry
  try {
    console.log('7️⃣  Sending Trial Expiry...');
    await sendTrialExpiry();
    results.push({ email: 'Trial Expiry', status: '✅ Sent' });
  } catch (error) {
    results.push({ email: 'Trial Expiry', status: `❌ Error: ${error.message}` });
  }

  // 8. Compliance Alert
  try {
    console.log('8️⃣  Sending Compliance Alert...');
    await sendComplianceAlert();
    results.push({ email: 'Compliance Alert', status: '✅ Sent' });
  } catch (error) {
    results.push({ email: 'Compliance Alert', status: `❌ Error: ${error.message}` });
  }

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('📬 EMAIL SEND SUMMARY');
  console.log('='.repeat(60));
  results.forEach(r => console.log(`${r.status.padEnd(15)} ${r.email}`));
  console.log('='.repeat(60));
  console.log(`\nCheck your inbox at: ${TEST_EMAIL}`);
  console.log('(Also check spam/junk folder)\n');
}

// 1. Subscription Confirmation
async function sendSubscriptionEmail() {
  const { sendSubscriptionConfirmationEmail } = await import('../lib/billing/send-subscription-email');

  await sendSubscriptionConfirmationEmail({
    userEmail: TEST_EMAIL,
    userName: 'Jeff',
    tier: 'growth',
    billingPeriod: 'monthly',
    amount: 24900, // $249
    nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }),
    dashboardUrl: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  });
}

// 2. Always-On Digest
async function sendDigestEmail() {
  const { sendDigestEmail } = await import('../lib/always-on/send-digest');

  await sendDigestEmail(
    {
      portalName: 'RevOps Impact',
      digestDate: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      score: 87,
      scoreDelta: -3,
      remediationItems: [
        {
          harmony: 'Company Industry',
          issue: 'Missing industry classification',
          recordsAffected: 234,
          actionUrl: `${process.env.NEXT_PUBLIC_APP_URL}/harmonies/industry`,
          actionLabel: 'Fix',
        },
        {
          harmony: 'Job Title Normalization',
          issue: 'Unnormalized titles',
          recordsAffected: 156,
          actionUrl: `${process.env.NEXT_PUBLIC_APP_URL}/harmonies/job-title`,
          actionLabel: 'Normalize',
        },
      ],
      harmonyBreakdown: [
        { name: 'Industry', score: 92, delta: 2 },
        { name: 'Job Title', score: 78, delta: -5 },
        { name: 'Company Size', score: 95, delta: 1 },
      ],
      dedupSummary: {
        newPairs: 12,
        gradeA: 8,
      },
      dashboardUrl: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`,
      dedupUrl: `${process.env.NEXT_PUBLIC_APP_URL}/dedup`,
      settingsUrl: `${process.env.NEXT_PUBLIC_APP_URL}/settings`,
    },
    [TEST_EMAIL],
    TEST_ORG_ID
  );
}

// 3. Dedup Scan Notification
async function sendDedupNotification() {
  const { sendDedupScanNotification } = await import('../lib/dedup/send-scan-notification');

  await sendDedupScanNotification({
    orgId: TEST_ORG_ID,
    portalId: '12345678',
    portalName: 'RevOps Impact',
    newClustersFound: 15,
    gradeBreakdown: {
      A: 8,
      B: 4,
      C: 2,
      D: 1,
    },
  });
}

// 4. Worker Alert
async function sendWorkerAlert() {
  const { sendWorkerAlert } = await import('../lib/monitoring/alert');

  await sendWorkerAlert(
    'Dedup scanner completed with errors',
    'The nightly dedup scan encountered 3 API rate limit errors. All retries exhausted.',
    TEST_ORG_ID
  );
}

// 5. Auto-Merge Notification
async function sendAutoMergeNotification() {
  const { buildEmailTemplate, buildHeading, buildParagraph, buildButton } = await import('../lib/emails/template');
  const { buildUnsubscribeUrl } = await import('../lib/always-on/unsubscribe');
  const { Resend } = await import('resend');

  const resend = new Resend(process.env.RESEND_API_KEY);
  const dedupUrl = `${process.env.NEXT_PUBLIC_APP_URL}/dedup`;
  const count = 5;
  const waitingHours = 24;

  const content = `
    ${buildHeading(`${count} duplicate clusters scheduled for auto-merge`, 1)}

    ${buildParagraph(
      `${count} high-confidence duplicate clusters will auto-merge in ${waitingHours} hours.`
    )}

    ${buildButton('Review pending merges', dedupUrl)}

    ${buildParagraph(
      'You can cancel individual merges or disable auto-merge entirely from the dedup settings page.'
    )}
  `;

  const unsubscribeUrl = buildUnsubscribeUrl(TEST_EMAIL, TEST_ORG_ID);

  const html = buildEmailTemplate({
    title: 'Duplicates Scheduled for Auto-Merge',
    preheader: `${count} duplicate clusters will merge in ${waitingHours} hours`,
    content,
    showUnsubscribe: true,
    unsubscribeUrl,
  });

  await resend.emails.send({
    from: 'Refyne <hello@refynedata.com>',
    to: TEST_EMAIL,
    subject: `Refyne: ${count} duplicates scheduled for auto-merge`,
    html,
    headers: {
      'List-Unsubscribe': `<${unsubscribeUrl}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
  });
}

// 6. Trial Warning
async function sendTrialWarning() {
  const { buildEmailTemplate, buildHeading, buildParagraph, buildButton, buildDataRow } = await import('../lib/emails/template');
  const { Resend } = await import('resend');

  const resend = new Resend(process.env.RESEND_API_KEY);
  const daysRemaining = 3;
  const upgradeUrl = `${process.env.NEXT_PUBLIC_APP_URL}/billing/upgrade`;

  const content = `
    ${buildHeading('Your trial ends soon', 1)}

    ${buildParagraph(`Your Refyne trial ends in ${daysRemaining} days.`)}

    ${buildHeading("Here's what you've used so far")}

    <table width="100%" cellpadding="0" cellspacing="0" style="background: #f9fafb; border: 1px solid #e5e7eb; margin: 20px 0;">
      <tbody>
        ${buildDataRow('Merges', '12 / 25')}
        ${buildDataRow('Normalize writes', '45 / 100')}
        ${buildDataRow('Enrich credits', '25 / 50')}
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

  await resend.emails.send({
    from: 'Refyne <hello@refynedata.com>',
    to: TEST_EMAIL,
    subject: `Your Refyne trial ends in ${daysRemaining} days`,
    html,
  });
}

// 7. Trial Expiry
async function sendTrialExpiry() {
  const { buildEmailTemplate, buildHeading, buildParagraph, buildButton } = await import('../lib/emails/template');
  const { Resend } = await import('resend');

  const resend = new Resend(process.env.RESEND_API_KEY);
  const upgradeUrl = `${process.env.NEXT_PUBLIC_APP_URL}/billing/upgrade`;

  const content = `
    ${buildHeading('Your trial has ended', 1)}

    ${buildParagraph('Your Refyne trial has ended.')}

    ${buildParagraph(
      'Your data is safe. Upgrade to continue normalizing, deduping, and enriching your HubSpot records.'
    )}

    ${buildButton('Choose a plan', upgradeUrl)}

    ${buildParagraph(
      'Questions? Reply to this email or visit our <a href="https://refynedata.com/support" style="color: #2E6BA8; text-decoration: none;">support page</a>.'
    )}
  `;

  const html = buildEmailTemplate({
    title: 'Your Refyne trial has ended',
    preheader: 'Upgrade to continue using Refyne',
    content,
    showUnsubscribe: false,
  });

  await resend.emails.send({
    from: 'Refyne <hello@refynedata.com>',
    to: TEST_EMAIL,
    subject: 'Your Refyne trial has ended',
    html,
  });
}

// 8. Compliance Alert
async function sendComplianceAlert() {
  const { buildEmailTemplate, buildHeading, buildParagraph, buildButton, buildDataRow } = await import('../lib/emails/template');
  const { buildUnsubscribeUrl } = await import('../lib/always-on/unsubscribe');
  const { Resend } = await import('resend');

  const resend = new Resend(process.env.RESEND_API_KEY);
  const dashboardUrl = `${process.env.NEXT_PUBLIC_APP_URL}/compliance`;

  const mockScore = {
    score: 72.5,
    compliant: 7250,
    stale: 1500,
    unprocessed: 1250,
    total: 10000,
  };

  const content = `
    ${buildHeading('Compliance Alert', 1)}

    ${buildParagraph('Your compliance score has dropped below the configured threshold.')}

    <table width="100%" cellpadding="0" cellspacing="0" style="background: #f9fafb; border: 1px solid #e5e7eb; margin: 20px 0;">
      <tbody>
        ${buildDataRow('Current score', `${mockScore.score.toFixed(1)}% (-5.8%)`)}
        ${buildDataRow('Compliant records', mockScore.compliant.toLocaleString())}
        ${buildDataRow('Stale records', mockScore.stale.toLocaleString())}
        ${buildDataRow('Unprocessed records', mockScore.unprocessed.toLocaleString())}
        ${buildDataRow('Total records', mockScore.total.toLocaleString())}
      </tbody>
    </table>

    ${buildHeading('Triggered by')}
    ${buildParagraph('<ul style="margin: 0; padding-left: 20px;"><li>Score 72.5% below threshold 80%</li><li>1,250 unprocessed records exceed threshold of 1,000</li></ul>')}

    ${buildButton('View Compliance Dashboard', dashboardUrl)}
  `;

  const unsubscribeUrl = buildUnsubscribeUrl(TEST_EMAIL, TEST_ORG_ID);

  const html = buildEmailTemplate({
    title: 'Compliance Alert',
    preheader: 'Compliance score: 72.5%',
    content,
    showUnsubscribe: true,
    unsubscribeUrl,
  });

  await resend.emails.send({
    from: 'Refyne <hello@refynedata.com>',
    to: TEST_EMAIL,
    subject: 'Refyne Compliance Alert: Score 72.5%',
    html,
    headers: {
      'List-Unsubscribe': `<${unsubscribeUrl}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
  });
}

sendAllTestEmails().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
