/**
 * Send subscription confirmation email for testing
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

async function sendTestEmail() {
  const { supabaseAdmin } = await import('../lib/db/admin-client');
  const { sendSubscriptionConfirmationEmail } = await import('../lib/billing/send-subscription-email');
  const { clerkClient } = await import('@clerk/nextjs/server');

  const orgId = 'org_3DuSdb0FBnx7RMLmJSUegrpiNLS';

  // Get billing data
  const { data: billing } = await supabaseAdmin
    .from('org_billing')
    .select('*')
    .eq('org_id', orgId)
    .single();

  if (!billing) {
    console.error('No billing record found');
    process.exit(1);
  }

  // Get price details
  const { data: price } = await supabaseAdmin
    .from('stripe_prices')
    .select('*')
    .eq('tier', 'starter')
    .eq('billing_period', 'monthly')
    .single();

  if (!price) {
    console.error('No price found');
    process.exit(1);
  }

  // Get user email from Clerk
  const org = await clerkClient().organizations.getOrganization({ organizationId: orgId });
  const userEmail = org.createdBy; // This is the user ID who created the org

  // For demo, use a fallback email
  const testEmail = 'jeff@refynedata.com'; // Change to your email

  console.log('\n📧 Sending subscription confirmation email...\n');

  const nextBillingDate = new Date();
  nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);

  await sendSubscriptionConfirmationEmail({
    userEmail: testEmail,
    userName: 'Jeff',
    tier: 'starter',
    billingPeriod: 'monthly',
    amount: price.amount_cents,
    nextBillingDate: nextBillingDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }),
    dashboardUrl: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  });

  console.log('✅ Email sent!\n');
  console.log('Check your inbox at:', testEmail);

  process.exit(0);
}

sendTestEmail().catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
});
