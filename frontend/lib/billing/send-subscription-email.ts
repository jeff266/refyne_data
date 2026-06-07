/**
 * Subscription Confirmation Email
 *
 * Sends subscription confirmation emails using Resend.
 */

import {
  buildEmailTemplate,
  buildHeading,
  buildParagraph,
  buildButton,
  buildInfoCard,
  buildDataRow,
} from '../emails/template';

interface SubscriptionEmailData {
  userEmail: string;
  userName: string;
  tier: 'starter' | 'growth' | 'scale';
  billingPeriod: 'monthly' | 'annual';
  amount: number; // in cents
  nextBillingDate: string;
  dashboardUrl: string;
}

const TIER_DETAILS = {
  starter: {
    name: 'Starter',
    companies: '10,000',
    credits: '10,000',
  },
  growth: {
    name: 'Growth',
    companies: '50,000',
    credits: '20,000',
  },
  scale: {
    name: 'Scale',
    companies: 'Unlimited',
    credits: '35,000',
  },
};

export async function sendSubscriptionConfirmationEmail(
  data: SubscriptionEmailData
): Promise<void> {
  // Check if Resend is configured
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY not configured - email not sent');
    return;
  }

  // Lazy-load Resend
  let Resend: any;
  try {
    Resend = (await import('resend')).Resend;
  } catch (error) {
    console.error('Resend package not installed. Run: npm install resend');
    throw new Error('Resend package not installed');
  }

  const resend = new Resend(process.env.RESEND_API_KEY);

  const tierDetails = TIER_DETAILS[data.tier];
  const formattedAmount = (data.amount / 100).toFixed(2);
  const period = data.billingPeriod === 'monthly' ? 'month' : 'year';

  // Build email content
  const content = `
    ${buildHeading(`Welcome to Refyne ${tierDetails.name}`, 1)}

    ${buildParagraph(`Hi ${data.userName},`)}

    ${buildParagraph(
      `Thank you for subscribing to <strong>Refyne ${tierDetails.name}</strong>. Your subscription is now active and ready to use.`
    )}

    ${buildHeading('Your Plan Details')}

    ${buildInfoCard(`
      <table width="100%" cellpadding="0" cellspacing="0">
        ${buildDataRow('Plan', tierDetails.name)}
        ${buildDataRow('Billing', `$${formattedAmount}/${period}`)}
        ${buildDataRow('Next billing date', data.nextBillingDate)}
      </table>
    `)}

    ${buildHeading("What's included")}

    ${buildParagraph(`
      <table width="100%" cellpadding="0" cellspacing="0" style="font-family: 'Jost', sans-serif; font-size: 14px; color: #1f2937;">
        <tr><td style="padding: 6px 0;">Up to ${tierDetails.companies} companies</td></tr>
        <tr><td style="padding: 6px 0;">${tierDetails.credits} enrich credits per month</td></tr>
        <tr><td style="padding: 6px 0;">Normalize, Dedup, and Enrich</td></tr>
        <tr><td style="padding: 6px 0;">Job segmentation</td></tr>
        <tr><td style="padding: 6px 0;">Email support</td></tr>
      </table>
    `)}

    ${buildButton('Go to Dashboard', data.dashboardUrl)}

    ${buildParagraph(
      `Need help getting started? Check out our <a href="${data.dashboardUrl}/settings" style="color: #2E6BA8; text-decoration: none;">documentation</a> or reply to this email.`
    )}
  `;

  const html = buildEmailTemplate({
    title: `Welcome to Refyne ${tierDetails.name}`,
    preheader: 'Your subscription is now active',
    content,
    showUnsubscribe: false, // Don't show unsubscribe on transactional emails
  });

  try {
    await resend.emails.send({
      from: 'Refyne <hello@refynedata.com>',
      to: data.userEmail,
      subject: `Welcome to Refyne ${tierDetails.name}`,
      html,
    });

    console.log(`✅ Subscription confirmation email sent to ${data.userEmail}`);
  } catch (error) {
    console.error(`Failed to send subscription email to ${data.userEmail}:`, error);
    throw error;
  }
}
