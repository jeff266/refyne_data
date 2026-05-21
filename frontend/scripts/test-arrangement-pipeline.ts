#!/usr/bin/env npx tsx
/**
 * Test Arrangement Pipeline End-to-End
 *
 * Creates a test arrangement, enqueues it, waits for processing,
 * then verifies the results in both Supabase and HubSpot.
 */

import { supabase } from '../lib/db/supabase';
import { enqueueLiveRunJob } from '../lib/queue/arrangement-queue';
import { getAccessToken } from '../lib/hubspot/get-access-token';
import { HubSpotClient } from '../lib/hubspot/client';

const ORG_ID = 'org_3DuSdb0FBnx7RMLmJSUegrpiNLS';
const PORTAL_ID = '49169539';

async function main() {
  console.log('═'.repeat(60));
  console.log('Arrangement Pipeline End-to-End Test');
  console.log('═'.repeat(60));
  console.log('');

  // Step 1: Create test arrangement
  console.log('Step 1: Creating test arrangement...');

  const { data: arrangement, error: arrError } = await supabase
    .from('arrangements')
    .insert({
      org_id: ORG_ID,
      name: 'Test Arrangement - Industry Only',
      source_type: 'hubspot_companies',
      source_config: {
        connection_id: PORTAL_ID,
        source_type: 'all_companies',
      },
      field_configs: [
        {
          field_key: 'industry',
          field_type: 'categorical',
          aggregation_strategy: 'waterfall',
          apply_harmony: false,
          harmony_id: null,
          steps: [
            {
              order: 1,
              provider: 'refyne',
              policy: 'fill_empty',
            },
          ],
        },
      ],
      output_destination: 'hubspot',
      output_config: {
        connection_id: PORTAL_ID,
      },
      status: 'active',
    })
    .select()
    .single();

  if (arrError || !arrangement) {
    console.error('❌ Failed to create arrangement:', arrError);
    process.exit(1);
  }

  console.log(`✅ Created arrangement: ${arrangement.id}`);
  console.log('');

  // Step 2: Create arrangement run
  console.log('Step 2: Creating arrangement run...');

  const { data: run, error: runError } = await supabase
    .from('arrangement_runs')
    .insert({
      arrangement_id: arrangement.id,
      org_id: ORG_ID,
      status: 'pending',
      mode: 'live',
      total_records: 5,
      estimated_credits: 5,
    })
    .select()
    .single();

  if (runError || !run) {
    console.error('❌ Failed to create run:', runError);
    process.exit(1);
  }

  console.log(`✅ Created run: ${run.id}`);
  console.log('');

  // Step 3: Enqueue job
  console.log('Step 3: Enqueueing job to BullMQ...');

  const result = await enqueueLiveRunJob({
    arrangementId: arrangement.id,
    runId: run.id,
    orgId: ORG_ID,
    config: {
      id: arrangement.id,
      name: arrangement.name,
      source_type: arrangement.source_type,
      source_config: arrangement.source_config as Record<string, unknown>,
      field_configs: arrangement.field_configs as any[],
      output_destination: arrangement.output_destination,
      output_config: arrangement.output_config as Record<string, unknown>,
    },
    totalRecords: 5,
  });

  if (!result.queued) {
    console.error('❌ Failed to enqueue job:', result.reason);
    process.exit(1);
  }

  console.log(`✅ Job enqueued: ${result.jobId}`);
  console.log('');

  // Step 4: Wait for processing
  console.log('Step 4: Waiting 2 minutes for worker to process...');
  console.log('(Worker should fetch 5 companies, enrich Industry field, write to HubSpot)');
  console.log('');

  const waitTime = 120000; // 2 minutes
  const startTime = Date.now();

  while (Date.now() - startTime < waitTime) {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const remaining = Math.floor((waitTime - (Date.now() - startTime)) / 1000);
    process.stdout.write(`\r⏳ Elapsed: ${elapsed}s | Remaining: ${remaining}s`);
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Check progress
    const { data: progress } = await supabase
      .from('arrangement_run_progress')
      .select('*')
      .eq('run_id', run.id);

    if (progress && progress.length > 0) {
      process.stdout.write(`\r✅ Progress detected: ${progress.length} records processed\n`);
      break;
    }
  }

  console.log('\n');

  // Step 5: Query results
  console.log('Step 5: Querying Supabase for results...');

  const { data: progressRecords, error: progError } = await supabase
    .from('arrangement_run_progress')
    .select('*')
    .eq('run_id', run.id)
    .order('created_at', { ascending: false })
    .limit(5);

  if (progError) {
    console.error('❌ Failed to query progress:', progError);
    process.exit(1);
  }

  if (!progressRecords || progressRecords.length === 0) {
    console.error('❌ No progress records found. Worker may not be running or job failed.');
    console.log('\nDebugging info:');

    // Check if run status was updated
    const { data: runCheck } = await supabase
      .from('arrangement_runs')
      .select('*')
      .eq('id', run.id)
      .single();

    console.log('Run status:', runCheck?.status);
    console.log('Run error:', runCheck?.error_message);

    process.exit(1);
  }

  console.log(`✅ Found ${progressRecords.length} progress records`);
  console.log('');

  // Display progress records
  console.log('Progress Records:');
  console.log('─'.repeat(60));
  for (const record of progressRecords) {
    console.log(`Record ID: ${record.record_id}`);
    console.log(`Status: ${record.status}`);
    console.log(`Result:`, JSON.stringify(record.result, null, 2));
    console.log('─'.repeat(60));
  }
  console.log('');

  // Step 6: Check HubSpot
  console.log('Step 6: Verifying write to HubSpot...');

  const firstRecord = progressRecords[0];
  const companyId = firstRecord.record_id;

  if (!companyId) {
    console.error('❌ No company ID found in progress record');
    process.exit(1);
  }

  console.log(`Checking HubSpot company: ${companyId}`);

  const accessToken = await getAccessToken(PORTAL_ID);
  const client = new HubSpotClient(accessToken, PORTAL_ID);

  try {
    const response = await fetch(
      `https://api.hubapi.com/crm/v3/objects/companies/${companyId}?properties=industry`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`HubSpot API error: ${response.statusText}`);
    }

    const companyData = await response.json();
    const industryValue = companyData.properties.industry;

    console.log('');
    console.log('═'.repeat(60));
    console.log('STEP 7 RESULT:');
    console.log('═'.repeat(60));
    console.log(`HubSpot Company ID: ${companyId}`);
    console.log(`Current Industry Value: ${industryValue || '(empty)'}`);
    console.log('═'.repeat(60));
    console.log('');

    if (industryValue) {
      console.log('✅ SUCCESS: Industry field was written to HubSpot!');
      console.log(`   Value: "${industryValue}"`);
    } else {
      console.log('⚠️  WARNING: Industry field is empty in HubSpot');
      console.log('   This could mean:');
      console.log('   1. Worker wrote but provider had no data for this company');
      console.log('   2. Worker did not write (check logs)');
      console.log('   3. Write policy prevented update (field already had value)');
    }

  } catch (err) {
    console.error('❌ Failed to check HubSpot:', err);
    process.exit(1);
  }

  console.log('');
  console.log('Test complete!');
}

main().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
