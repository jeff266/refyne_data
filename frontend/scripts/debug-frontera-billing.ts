/**
 * Debug Frontera billing status
 *
 * Checks what the database is actually returning for Frontera's org
 */

import { supabaseAdmin } from '@/lib/db/admin-client';

async function debug() {
  console.log('\n=== Debugging Frontera Billing Status ===\n');

  // Step 1: Find Frontera's org_id
  console.log('1. Finding Frontera org...');
  const { data: connections } = await supabaseAdmin
    .from('hubspot_connections')
    .select('org_id, portal_id')
    .eq('portal_id', '49169539') // Frontera's portal ID from CLAUDE.md
    .single();

  if (!connections) {
    console.error('❌ Could not find Frontera in hubspot_connections');
    return;
  }

  const orgId = connections.org_id;
  console.log(`✅ Found Frontera: org_id = ${orgId}\n`);

  // Step 2: Check org_billing table directly
  console.log('2. Checking org_billing table...');
  const { data: billing } = await supabaseAdmin
    .from('org_billing')
    .select('org_id, subscription_tier, plan_override, subscription_status')
    .eq('org_id', orgId)
    .single();

  console.log('org_billing row:');
  console.log(JSON.stringify(billing, null, 2));
  console.log('');

  // Step 3: Check org_entitlements view
  console.log('3. Checking org_entitlements view...');
  const { data: entitlements } = await supabaseAdmin
    .from('org_entitlements')
    .select('org_id, subscription_tier, subscription_status, trial_merges_remaining')
    .eq('org_id', orgId)
    .single();

  console.log('org_entitlements view:');
  console.log(JSON.stringify(entitlements, null, 2));
  console.log('');

  // Step 4: Test canPerformAction
  console.log('4. Testing canPerformAction...');
  const { canPerformAction } = await import('@/lib/billing/entitlements');
  const canMerge = await canPerformAction(orgId, 'merge', 1);
  console.log(`canPerformAction('merge') = ${canMerge}`);
  console.log('');

  // Summary
  console.log('=== Summary ===');
  console.log(`Raw subscription_tier: ${billing?.subscription_tier}`);
  console.log(`plan_override: ${billing?.plan_override || 'null'}`);
  console.log(`View returns subscription_tier: ${entitlements?.subscription_tier}`);
  console.log(`Can merge: ${canMerge ? '✅ YES' : '❌ NO'}`);

  if (!canMerge && entitlements?.subscription_tier === 'enterprise') {
    console.log('\n⚠️  ISSUE: View returns enterprise but canPerformAction still returns false');
    console.log('This means the entitlements.ts code fix did not take effect.');
    console.log('Try restarting your dev server.');
  }

  if (!canMerge && entitlements?.subscription_tier === 'trial') {
    console.log('\n⚠️  ISSUE: View still returns trial instead of enterprise');
    console.log('This means the Supabase view was not updated correctly.');
    console.log('Re-run the migration SQL in Supabase dashboard.');
  }
}

debug();
