/**
 * Test Compliance Alert Email
 *
 * Sends a test compliance alert email to verify brand standards implementation.
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

// Mock compliance data
const mockScore = {
  score: 72.5,
  compliant: 7250,
  stale: 1500,
  unprocessed: 1250,
  total: 10000,
};

const mockReasons = [
  {
    type: 'score_below' as const,
    threshold: 80,
    actual: 72.5,
  },
  {
    type: 'unprocessed_exceeded' as const,
    threshold: 1000,
    actual: 1250,
  },
];

const previousScore = 78.3;

async function sendTestComplianceAlert() {
  console.log('\n📧 Sending test compliance alert email...\n');

  const testEmail = 'jeff@revopsimpact.us';
  const orgId = 'org_test_compliance';

  // Import email template utilities
  const { buildEmailTemplate, buildHeading, buildParagraph, buildButton, buildDataRow } = await import('../lib/emails/template');

  const delta = previousScore !== null ? mockScore.score - previousScore : null;
  const deltaStr = delta !== null ? ` (${delta >= 0 ? '+' : ''}${delta.toFixed(1)}%)` : '';
  const dashboardUrl = `${process.env.NEXT_PUBLIC_APP_URL}/compliance?org=${orgId}`;

  // Format reasons
  function formatReason(reason: typeof mockReasons[0]): string {
    switch (reason.type) {
      case 'score_below':
        return `Score ${reason.actual.toFixed(1)}% below threshold ${reason.threshold}%`;
      case 'unprocessed_exceeded':
        return `${reason.actual} unprocessed records exceed threshold of ${reason.threshold}`;
      default:
        return 'Unknown alert reason';
    }
  }

  // Build reason list
  const reasonsList = mockReasons.map(reason => `<li>${formatReason(reason)}</li>`).join('');

  const content = `
    ${buildHeading('Compliance Alert', 1)}

    ${buildParagraph(
      `Your compliance score has dropped below the configured threshold.`
    )}

    <table width="100%" cellpadding="0" cellspacing="0" style="background: #f9fafb; border: 1px solid #e5e7eb; margin: 20px 0;">
      <tbody>
        ${buildDataRow('Current score', `${mockScore.score.toFixed(1)}%${deltaStr}`)}
        ${buildDataRow('Compliant records', mockScore.compliant.toLocaleString())}
        ${buildDataRow('Stale records', mockScore.stale.toLocaleString())}
        ${buildDataRow('Unprocessed records', mockScore.unprocessed.toLocaleString())}
        ${buildDataRow('Total records', mockScore.total.toLocaleString())}
      </tbody>
    </table>

    ${buildHeading('Triggered by')}
    ${buildParagraph(`<ul style="margin: 0; padding-left: 20px;">${reasonsList}</ul>`)}

    ${buildButton('View Compliance Dashboard', dashboardUrl)}
  `;

  const html = buildEmailTemplate({
    title: 'Compliance Alert',
    preheader: `Compliance score: ${mockScore.score.toFixed(1)}%`,
    content,
    showUnsubscribe: true,
    unsubscribeUrl: `${dashboardUrl}#settings`,
  });

  // Send via Resend
  const { Resend } = await import('resend');
  const resend = new Resend(process.env.RESEND_API_KEY);

  const result = await resend.emails.send({
    from: 'Refyne <hello@refynedata.com>',
    to: testEmail,
    subject: `Refyne Compliance Alert: Score ${mockScore.score.toFixed(1)}%`,
    html,
  });

  console.log('✅ Email sent successfully!');
  console.log('   Response:', JSON.stringify(result, null, 2));
  console.log('\n📬 Check your inbox at:', testEmail);
  console.log('   (Also check spam/junk folder)\n');
}

sendTestComplianceAlert().catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
});
