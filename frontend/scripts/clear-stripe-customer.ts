/**
 * Clear Stripe customer ID from org_billing to allow test mode checkout
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

async function clearCustomer() {
  const { supabaseAdmin } = await import('../lib/db/admin-client');

  // Get all orgs with stripe_customer_id set
  const { data: orgs } = await supabaseAdmin
    .from('org_billing')
    .select('org_id, stripe_customer_id')
    .not('stripe_customer_id', 'is', null);

  console.log(`\nFound ${orgs?.length || 0} orgs with Stripe customer IDs\n`);

  if (orgs && orgs.length > 0) {
    // Clear all customer IDs
    const { error } = await supabaseAdmin
      .from('org_billing')
      .update({ stripe_customer_id: null })
      .not('stripe_customer_id', 'is', null);

    if (error) {
      console.error('❌ Error clearing customer IDs:', error);
      process.exit(1);
    }

    console.log('✅ Cleared Stripe customer IDs from org_billing');
    console.log('\nOrgs cleared:');
    orgs.forEach(org => {
      console.log(`  - ${org.org_id} (was ${org.stripe_customer_id})`);
    });
    console.log('\nNew TEST customers will be created on next checkout.\n');
  } else {
    console.log('✅ No customer IDs to clear\n');
  }

  process.exit(0);
}

clearCustomer();
