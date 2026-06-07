/**
 * Subscription Confirmation Email
 *
 * Sends subscription confirmation emails using Resend.
 */

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

  const html = buildSubscriptionEmailHtml(data);

  try {
    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'Refyne <noreply@refyne.io>',
      to: data.userEmail,
      subject: `Welcome to Refyne ${TIER_DETAILS[data.tier].name}! 🎉`,
      html,
    });

    console.log(`✅ Subscription confirmation email sent to ${data.userEmail}`);
  } catch (error) {
    console.error(`Failed to send subscription email to ${data.userEmail}:`, error);
    throw error;
  }
}

function buildSubscriptionEmailHtml(data: SubscriptionEmailData): string {
  const tierDetails = TIER_DETAILS[data.tier];
  const formattedAmount = (data.amount / 100).toFixed(2);
  const period = data.billingPeriod === 'monthly' ? 'month' : 'year';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to Refyne ${tierDetails.name}</title>
</head>
<body style="margin: 0; padding: 0; background: #f9fafb; font-family: system-ui, -apple-system, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background: #f9fafb; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">

          <!-- Header with Gradient -->
          <tr>
            <td style="padding: 40px 24px; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); text-align: center;">
              <div style="font-family: system-ui, -apple-system, sans-serif; font-size: 24px; font-weight: 700; color: #ffffff; margin-bottom: 8px;">
                🎉 You're all set!
              </div>
              <div style="font-family: system-ui, -apple-system, sans-serif; font-size: 16px; color: rgba(255,255,255,0.9);">
                Welcome to Refyne ${tierDetails.name}
              </div>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 32px 24px;">
              <div style="font-family: system-ui, -apple-system, sans-serif; font-size: 15px; color: #1f2937; line-height: 1.6; margin-bottom: 24px;">
                Hi ${data.userName},
              </div>

              <div style="font-family: system-ui, -apple-system, sans-serif; font-size: 15px; color: #1f2937; line-height: 1.6; margin-bottom: 24px;">
                Thank you for subscribing to <strong>Refyne ${tierDetails.name}</strong>! Your subscription is now active and ready to use.
              </div>

              <!-- Plan Details Card -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 20px;">
                    <div style="font-family: system-ui, -apple-system, sans-serif; font-size: 14px; font-weight: 600; color: #1f2937; margin-bottom: 16px;">
                      Your Plan Details
                    </div>

                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding: 8px 0; font-family: system-ui, -apple-system, sans-serif; font-size: 13px; color: #6b7280;">
                          Plan
                        </td>
                        <td style="padding: 8px 0; font-family: system-ui, -apple-system, sans-serif; font-size: 13px; color: #1f2937; font-weight: 600; text-align: right;">
                          ${tierDetails.name}
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; border-top: 1px solid #e5e7eb; font-family: system-ui, -apple-system, sans-serif; font-size: 13px; color: #6b7280;">
                          Billing
                        </td>
                        <td style="padding: 8px 0; border-top: 1px solid #e5e7eb; font-family: system-ui, -apple-system, sans-serif; font-size: 13px; color: #1f2937; font-weight: 600; text-align: right;">
                          $${formattedAmount}/${period}
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; border-top: 1px solid #e5e7eb; font-family: system-ui, -apple-system, sans-serif; font-size: 13px; color: #6b7280;">
                          Next billing date
                        </td>
                        <td style="padding: 8px 0; border-top: 1px solid #e5e7eb; font-family: system-ui, -apple-system, sans-serif; font-size: 13px; color: #1f2937; font-weight: 600; text-align: right;">
                          ${data.nextBillingDate}
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Features -->
              <div style="font-family: system-ui, -apple-system, sans-serif; font-size: 14px; font-weight: 600; color: #1f2937; margin-bottom: 12px;">
                What's included:
              </div>

              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 24px;">
                <tr>
                  <td style="padding: 8px 0; font-family: system-ui, -apple-system, sans-serif; font-size: 13px; color: #1f2937;">
                    ✓ Up to ${tierDetails.companies} companies
                  </td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-family: system-ui, -apple-system, sans-serif; font-size: 13px; color: #1f2937;">
                    ✓ ${tierDetails.credits} enrich credits/month
                  </td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-family: system-ui, -apple-system, sans-serif; font-size: 13px; color: #1f2937;">
                    ✓ Normalize, Dedup, and Enrich
                  </td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-family: system-ui, -apple-system, sans-serif; font-size: 13px; color: #1f2937;">
                    ✓ Job segmentation
                  </td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-family: system-ui, -apple-system, sans-serif; font-size: 13px; color: #1f2937;">
                    ✓ Email support
                  </td>
                </tr>
              </table>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 24px;">
                <tr>
                  <td align="center" style="padding: 20px 0;">
                    <a href="${data.dashboardUrl}" style="display: inline-block; padding: 14px 32px; background: #6366f1; color: #ffffff; text-decoration: none; border-radius: 6px; font-family: system-ui, -apple-system, sans-serif; font-size: 15px; font-weight: 600;">
                      Go to Dashboard
                    </a>
                  </td>
                </tr>
              </table>

              <div style="font-family: system-ui, -apple-system, sans-serif; font-size: 13px; color: #6b7280; line-height: 1.6;">
                Need help getting started? Check out our <a href="${data.dashboardUrl}/settings" style="color: #6366f1; text-decoration: none;">documentation</a> or reply to this email.
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px; text-align: center; border-top: 1px solid #e5e7eb; background: #f9fafb;">
              <div style="font-family: system-ui, -apple-system, sans-serif; font-size: 12px; color: #9ca3af; margin-bottom: 8px;">
                You're receiving this email because you subscribed to Refyne.
              </div>
              <div style="font-family: system-ui, -apple-system, sans-serif; font-size: 11px; color: #9ca3af;">
                © 2026 Refyne · <a href="${data.dashboardUrl}/settings" style="color: #6366f1; text-decoration: none;">Manage subscription</a>
              </div>
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
