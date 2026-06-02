/**
 * Test Job Segmentation (Live Write)
 *
 * Fetches 5 contacts from portal 24202132, classifies their job titles,
 * and writes refyne_job_level and refyne_job_function to HubSpot.
 *
 * Usage:
 *   npm run jobs:test:live
 */

import { supabaseAdmin } from '../lib/db/admin-client';
import { HubSpotClient } from '../lib/hubspot/client';
import { decryptToken } from '../lib/crypto/token-encryption';
import { classifyJobTitle } from '../lib/harmonies/job-title-classifier';
import { ensureJobSegmentationProperties } from '../lib/hubspot/job-segmentation-properties';

const TARGET_PORTAL_ID = '49169539'; // Frontera Health

async function testLiveJobSegmentation() {
  console.log('\n=== Job Segmentation Live Write Test ===\n');
  console.log(`Portal: ${TARGET_PORTAL_ID}`);
  console.log('Mode: LIVE WRITE (dryRun: false)\n');

  try {
    // Get HubSpot connection for portal 24202132
    const { data: connection } = await supabaseAdmin
      .from('hubspot_connections')
      .select('org_id, portal_id, access_token')
      .eq('portal_id', TARGET_PORTAL_ID)
      .eq('connection_status', 'active')
      .single();

    if (!connection) {
      console.error(`❌ No active HubSpot connection found for portal ${TARGET_PORTAL_ID}`);
      process.exit(1);
    }

    console.log(`✓ Found HubSpot connection for portal ${connection.portal_id}\n`);

    // Decrypt access token
    const accessToken = decryptToken(connection.access_token);
    const hubspot = new HubSpotClient(accessToken, connection.portal_id);

    // Step 1: Ensure HubSpot properties exist
    console.log('Step 1: Ensuring HubSpot custom properties exist...');
    await ensureJobSegmentationProperties(hubspot);
    console.log('✓ Properties ensured (refyne_job_level, refyne_job_function)\n');

    // Step 2: Fetch 5 contacts with job titles
    console.log('Step 2: Fetching 5 contacts with job titles...');
    const response = await hubspot.request<{
      results: Array<{
        id: string;
        properties: {
          jobtitle?: string;
          firstname?: string;
          lastname?: string;
          email?: string;
        };
      }>;
    }>('/crm/v3/objects/contacts/search', {
      method: 'POST',
      body: JSON.stringify({
        filterGroups: [
          {
            filters: [
              {
                propertyName: 'jobtitle',
                operator: 'HAS_PROPERTY',
              },
            ],
          },
        ],
        properties: ['jobtitle', 'firstname', 'lastname', 'email'],
        limit: 5,
      }),
    });

    const contacts = response.results;

    if (contacts.length === 0) {
      console.error('❌ No contacts found with job titles');
      process.exit(1);
    }

    console.log(`✓ Found ${contacts.length} contacts\n`);
    console.log('Contacts to process:');
    contacts.forEach((c, i) => {
      console.log(
        `  ${i + 1}. ${c.id} - ${c.properties.firstname || ''} ${c.properties.lastname || ''} (${c.properties.jobtitle || 'N/A'})`
      );
    });
    console.log();

    // Step 3: Classify and write
    console.log('Step 3: Classifying job titles and writing to HubSpot...\n');

    const results: Array<{
      contactId: string;
      name: string;
      jobTitle: string;
      level?: string;
      function?: string;
      success: boolean;
      error?: string;
    }> = [];

    for (const contact of contacts) {
      const name = `${contact.properties.firstname || ''} ${contact.properties.lastname || ''}`.trim() || 'Unknown';
      const jobTitle = contact.properties.jobtitle || '';

      console.log(`Processing: ${contact.id} - ${name}`);
      console.log(`  Job Title: "${jobTitle}"`);

      try {
        // Classify
        const classification = await classifyJobTitle(jobTitle);
        console.log(`  Classified: ${classification.level}, ${classification.function}`);

        // Write to HubSpot
        await hubspot.request(`/crm/v3/objects/contacts/${contact.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            properties: {
              refyne_job_level: classification.level,
              refyne_job_function: classification.function,
            },
          }),
        });

        console.log(`  ✓ Written to HubSpot\n`);

        results.push({
          contactId: contact.id,
          name,
          jobTitle,
          level: classification.level,
          function: classification.function,
          success: true,
        });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.log(`  ❌ Error: ${errorMsg}\n`);

        results.push({
          contactId: contact.id,
          name,
          jobTitle,
          success: false,
          error: errorMsg,
        });
      }
    }

    // Step 4: Verify writes by reading back from HubSpot
    console.log('Step 4: Verifying writes by reading back from HubSpot...\n');

    for (const result of results) {
      if (!result.success) continue;

      console.log(`Verifying: ${result.contactId} - ${result.name}`);

      const contact = await hubspot.request<{
        id: string;
        properties: {
          refyne_job_level?: string;
          refyne_job_function?: string;
        };
      }>(`/crm/v3/objects/contacts/${result.contactId}?properties=refyne_job_level,refyne_job_function`);

      const levelMatch = contact.properties.refyne_job_level === result.level;
      const functionMatch = contact.properties.refyne_job_function === result.function;

      if (levelMatch && functionMatch) {
        console.log(`  ✓ Verified: ${contact.properties.refyne_job_level}, ${contact.properties.refyne_job_function}\n`);
      } else {
        console.log(`  ❌ Mismatch!`);
        console.log(`    Expected: ${result.level}, ${result.function}`);
        console.log(`    Got: ${contact.properties.refyne_job_level}, ${contact.properties.refyne_job_function}\n`);
      }
    }

    // Summary
    console.log('=== Summary ===\n');
    const successCount = results.filter((r) => r.success).length;
    const failureCount = results.filter((r) => !r.success).length;

    console.log(`Total: ${results.length}`);
    console.log(`Success: ${successCount}`);
    console.log(`Failures: ${failureCount}\n`);

    console.log('Contact IDs processed:');
    results.forEach((r) => {
      console.log(`  - ${r.contactId} (${r.success ? '✓' : '❌'})`);
    });

    console.log('\n✓ Live write test completed');
    console.log(
      `✓ View contacts in HubSpot: https://app.hubspot.com/contacts/${TARGET_PORTAL_ID}/contacts/list/view/all/`
    );

    process.exit(0);
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

testLiveJobSegmentation();
