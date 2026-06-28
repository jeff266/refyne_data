#!/usr/bin/env npx tsx
/**
 * Test Record Count via API
 *
 * Triggers record count refresh via API and polls for results
 */

import { supabaseAdmin } from '../lib/db/admin-client';

const ORG_ID = 'org_3EHiMlz7uhantEQJt7XH9NYoyuC'; // RevOps Impact
const PORTAL_ID = '24202132';

async function main() {
  console.log('═'.repeat(60));
  console.log('Record Count API Verification');
  console.log('═'.repeat(60));
  console.log(`\nOrg ID: ${ORG_ID}`);
  console.log(`Portal ID: ${PORTAL_ID}\n`);

  // Check current state
  console.log('Step 1: Checking current record count...');
  const { data: existing } = await supabaseAdmin
    .from('hubspot_record_counts')
    .select('*')
    .eq('org_id', ORG_ID)
    .order('fetched_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) {
    console.log('Found existing record:');
    console.log(`  Total records: ${existing.total_records.toLocaleString()}`);
    console.log(`  Fetched at: ${existing.fetched_at}`);
    console.log(`  Suggested plan: ${existing.suggested_plan}\n`);
  } else {
    console.log('No existing record found\n');
  }

  // Trigger via API
  console.log('Step 2: Triggering refresh via API...');
  console.log('NOTE: This requires the app to be running and authenticated\n');

  console.log('To complete this test, run:');
  console.log(`  curl -X POST http://localhost:3000/api/billing/record-count/refresh \\`);
  console.log(`    -H "Cookie: YOUR_SESSION_COOKIE"`);
  console.log('\nOR use the worker queue directly:\n');

  // Show how to enqueue directly using CLI
  console.log('Alternative: Enqueue job directly via database (production):');
  console.log(`  This would require Railway deployment and worker running`);
  console.log(`  Worker will pick up jobs from the queue automatically\n`);

  // Poll for new results
  console.log('Step 3: Polling for results (30 seconds)...\n');

  const startTime = Date.now();
  const timeout = 30_000;
  const pollInterval = 3_000;
  let attempt = 1;

  while (Date.now() - startTime < timeout) {
    const { data, error } = await supabaseAdmin
      .from('hubspot_record_counts')
      .select('*')
      .eq('org_id', ORG_ID)
      .order('fetched_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('❌ Database query error:', error);
      break;
    }

    if (data && (!existing || data.fetched_at !== existing.fetched_at)) {
      console.log('\n✅ New record count detected!\n');
      console.log('═'.repeat(60));
      console.log('Results:');
      console.log('═'.repeat(60));
      console.log(`Company count:    ${data.company_count.toLocaleString()}`);
      console.log(`Contact count:    ${data.contact_count.toLocaleString()}`);
      console.log(`Total records:    ${data.total_records.toLocaleString()}`);
      console.log(`Suggested plan:   ${data.suggested_plan}`);
      console.log(`Fetched at:       ${data.fetched_at}`);
      console.log(`Near limit:       ${data.is_near_limit}`);
      console.log(`Over limit:       ${data.is_over_limit}`);
      console.log(`Grace expired:    ${data.grace_period_expired}`);
      console.log('═'.repeat(60));

      // Verify
      let expectedPlan: string;
      if (data.total_records <= 25_000) {
        expectedPlan = 'starter';
      } else if (data.total_records <= 75_000) {
        expectedPlan = 'growth';
      } else if (data.total_records <= 200_000) {
        expectedPlan = 'scale';
      } else {
        expectedPlan = 'enterprise';
      }

      console.log('\nVerification:');
      if (data.suggested_plan === expectedPlan) {
        console.log(`✅ PASS - Suggested plan "${data.suggested_plan}" matches threshold`);
      } else {
        console.log(`❌ FAIL - Expected "${expectedPlan}" but got "${data.suggested_plan}"`);
      }

      return;
    }

    console.log(`Poll ${attempt}: No new data yet...`);
    await new Promise(resolve => setTimeout(resolve, pollInterval));
    attempt++;
  }

  console.log('\n⚠️  No new data detected in 30 seconds');
  console.log('Worker may need to be triggered manually or via Railway deployment');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
