/**
 * Check subscription status for an org
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

async function checkStatus() {
  const { supabaseAdmin } = await import('../lib/db/admin-client');

  const orgId = 'org_3DuSdb0FBnx7RMLmJSUegrpiNLS';

  const { data: billing } = await supabaseAdmin
    .from('org_billing')
    .select('*')
    .eq('org_id', orgId)
    .single();

  console.log('\n📊 Subscription Status:');
  console.log('═'.repeat(80));
  console.log(`Org ID: ${billing?.org_id}`);
  console.log(`Tier: ${billing?.subscription_tier}`);
  console.log(`Status: ${billing?.subscription_status}`);
  console.log(`Stripe Customer: ${billing?.stripe_customer_id || 'None'}`);
  console.log(`Stripe Subscription: ${billing?.stripe_subscription_id || 'None'}`);
  console.log('═'.repeat(80));

  if (billing?.subscription_tier === 'trial') {
    console.log('\n⚠️  Still on trial - webhook may not have fired yet');
    console.log('\nStripe webhooks require:');
    console.log('1. Webhook endpoint configured in Stripe dashboard');
    console.log('2. Or use Stripe CLI: stripe listen --forward-to localhost:3000/api/webhooks/stripe');
  } else {
    console.log(`\n✅ Subscription activated: ${billing?.subscription_tier}`);
  }

  console.log('');
  process.exit(0);
}

checkStatus();
