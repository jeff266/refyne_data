#!/usr/bin/env npx tsx
/**
 * Test Record Count Worker
 *
 * Manually enqueues a record count job for RevOps Impact org
 * and polls the database for results.
 */

import { enqueueRecordCountJob } from '../lib/queue/record-count-queue';
import { getAccessToken } from '../lib/hubspot/get-access-token';
import { supabaseAdmin } from '../lib/db/admin-client';

// Portal 24202132 is actually connected to this org (verified via DB query)
const ORG_ID = 'org_3EHiMlz7uhantEQJt7XH9NYoyuC';
const PORTAL_ID = '24202132';

async function main() {
  console.log('═'.repeat(60));
  console.log('Record Count Worker Verification');
  console.log('═'.repeat(60));
  console.log(`\nOrg ID: ${ORG_ID}`);
  console.log(`Portal ID: ${PORTAL_ID}\n`);

  // Step 1: Get access token
  console.log('Step 1: Fetching access token...');
  let accessToken: string;
  try {
    accessToken = await getAccessToken(ORG_ID);
    console.log('✅ Access token retrieved\n');
  } catch (error) {
    console.error('❌ Failed to get access token:', error);
    process.exit(1);
  }

  // Step 2: Enqueue job
  console.log('Step 2: Enqueuing record count job...');
  try {
    const result = await enqueueRecordCountJob(ORG_ID, PORTAL_ID, accessToken);

    if (result.queued) {
      console.log(`✅ Job enqueued: ${result.jobId}\n`);
    } else {
      console.error(`❌ Job not enqueued: ${result.reason}`);
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Failed to enqueue job:', error);
    process.exit(1);
  }

  // Step 3: Poll for results
  console.log('Step 3: Polling database for results (60 second timeout)...');
  console.log('NOTE: Worker must be running locally or on Railway for job to process\n');

  const startTime = Date.now();
  const timeout = 60_000; // 60 seconds
  const pollInterval = 5_000; // 5 seconds
  let attempt = 1;

  while (Date.now() - startTime < timeout) {
    console.log(`Poll attempt ${attempt}...`);

    const { data, error } = await supabaseAdmin
      .from('hubspot_record_counts')
      .select('*')
      .eq('org_id', ORG_ID)
      .order('fetched_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('❌ Database query error:', error);
      process.exit(1);
    }

    if (data) {
      console.log('\n✅ Record count job completed!\n');
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

      // Verify suggested plan matches thresholds
      console.log('\nVerification:');
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

      if (data.suggested_plan === expectedPlan) {
        console.log(`✅ PASS - Suggested plan "${data.suggested_plan}" matches threshold for ${data.total_records.toLocaleString()} records`);
      } else {
        console.log(`❌ FAIL - Expected "${expectedPlan}" but got "${data.suggested_plan}" for ${data.total_records.toLocaleString()} records`);
        process.exit(1);
      }

      process.exit(0);
    }

    // Wait before next poll
    await new Promise(resolve => setTimeout(resolve, pollInterval));
    attempt++;
  }

  console.log('\n⚠️  Timeout - No results after 60 seconds');
  console.log('Worker may not be running. Check Railway logs or start worker locally with:');
  console.log('  npm run worker:digest');
  process.exit(1);
}

main().catch(err => {
  console.error('Script error:', err);
  process.exit(1);
});
