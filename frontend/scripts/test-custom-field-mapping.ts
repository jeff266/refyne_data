/**
 * Test Custom Field Mapping
 *
 * Tests job segmentation with custom HubSpot property names
 * to verify the configurable field mapping works.
 *
 * This test uses:
 * - levelField: "job_seniority" (custom field)
 * - functionField: "job_department" (custom field)
 *
 * Usage:
 *   npm run jobs:custom-fields
 */

import { supabaseAdmin } from '../lib/db/admin-client';
import { processJobSegmentation } from '../lib/queue/job-segmentation-worker';
import { decryptToken } from '../lib/crypto/token-encryption';

async function testCustomFieldMapping() {
  console.log('\n=== Testing Custom Field Mapping ===\n');

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

    // Create run record with CUSTOM field names
    const { data: run, error: createError } = await supabaseAdmin
      .from('job_segmentation_runs')
      .insert({
        org_id: connection.org_id,
        portal_id: connection.portal_id,
        status: 'pending',
        dry_run: true, // Dry run to avoid creating real HubSpot properties
        batch_size: 10, // Small batch for testing
        level_field: 'job_seniority', // CUSTOM field name
        function_field: 'job_department', // CUSTOM field name
      })
      .select()
      .single();

    if (createError || !run) {
      console.error('❌ Failed to create run:', createError);
      process.exit(1);
    }

    console.log(`✓ Created run ${run.id}`);
    console.log(`  Level Field: ${run.level_field}`);
    console.log(`  Function Field: ${run.function_field}`);
    console.log(`  Dry Run: ${run.dry_run}\n`);

    // Process directly (bypass queue for testing)
    console.log('Starting job segmentation with custom fields...\n');

    await processJobSegmentation({
      runId: run.id,
      orgId: connection.org_id,
      portalId: connection.portal_id,
      accessToken,
      dryRun: true,
      batchSize: 10,
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
    console.log(`Level Field: ${finalRun.level_field}`);
    console.log(`Function Field: ${finalRun.function_field}`);
    console.log(`Processed: ${finalRun.processed_count}`);
    console.log(`Updated: ${finalRun.updated_count}`);
    console.log(`Skipped: ${finalRun.skipped_count}`);
    console.log(`Errors: ${finalRun.error_count}`);

    if (finalRun.status === 'completed') {
      console.log('\n✓ Custom field mapping test completed successfully');
      console.log(
        `✓ In a real run (dryRun: false), would have written to "${finalRun.level_field}" and "${finalRun.function_field}"`
      );
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

testCustomFieldMapping();
