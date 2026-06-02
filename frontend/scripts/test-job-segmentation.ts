/**
 * Test Job Segmentation (Dry Run)
 *
 * Starts a dry run of job title segmentation and polls until completion.
 * Does NOT write to HubSpot - only classifies and displays results.
 *
 * Usage:
 *   npm run jobs:test
 */

import { supabaseAdmin } from '../lib/db/admin-client';
import { jobSegmentationQueue, processJobSegmentation } from '../lib/queue/job-segmentation-worker';
import { decryptToken } from '../lib/crypto/token-encryption';

const ORG_ID = '00000000-0000-0000-0000-000000000000'; // Placeholder - will use first org from DB

async function testJobSegmentation() {
  console.log('\n=== Job Segmentation Dry Run Test ===\n');

  try {
    // Get first active HubSpot connection
    const { data: connection } = await supabaseAdmin
      .from('hubspot_connections')
      .select('org_id, portal_id, access_token')
      .eq('connection_status', 'active')
      .limit(1)
      .single();

    if (!connection) {
      console.error('❌ No active HubSpot connection found');
      process.exit(1);
    }

    console.log(`✓ Found HubSpot connection for portal ${connection.portal_id}`);

    // Decrypt access token
    const accessToken = decryptToken(connection.access_token);

    // Create run record
    const { data: run, error: createError } = await supabaseAdmin
      .from('job_segmentation_runs')
      .insert({
        org_id: connection.org_id,
        portal_id: connection.portal_id,
        status: 'pending',
        dry_run: true,
        batch_size: 100,
        level_field: 'refyne_job_level',
        function_field: 'refyne_job_function',
      })
      .select()
      .single();

    if (createError || !run) {
      console.error('❌ Failed to create run:', createError);
      process.exit(1);
    }

    console.log(`✓ Created run ${run.id} (dryRun: true)\n`);

    // Process directly (bypass queue for testing)
    console.log('Starting job segmentation...\n');

    await processJobSegmentation({
      runId: run.id,
      orgId: connection.org_id,
      portalId: connection.portal_id,
      accessToken,
      dryRun: true,
      batchSize: 100,
    });

    // Fetch final results
    const { data: finalRun } = await supabaseAdmin
      .from('job_segmentation_runs')
      .select('*')
      .eq('id', run.id)
      .single();

    if (!finalRun) {
      console.error('❌ Failed to fetch final run');
      process.exit(1);
    }

    console.log('\n=== Run Results ===\n');
    console.log(`Status: ${finalRun.status}`);
    console.log(`Processed: ${finalRun.processed_count}`);
    console.log(`Updated: ${finalRun.updated_count}`);
    console.log(`Skipped: ${finalRun.skipped_count}`);
    console.log(`Errors: ${finalRun.error_count}`);

    if (finalRun.error_message) {
      console.log(`\nError: ${finalRun.error_message}`);
    }

    if (finalRun.status === 'completed') {
      console.log('\n✓ Dry run completed successfully');
      console.log('✓ No data was written to HubSpot (dryRun: true)');
    } else {
      console.log('\n❌ Run failed');
      process.exit(1);
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

testJobSegmentation();
