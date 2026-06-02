/**
 * Verify Job Segmentation Properties in HubSpot
 *
 * Checks that refyne_job_level and refyne_job_function properties exist
 * and displays their configuration.
 */

import { supabaseAdmin } from '../lib/db/admin-client';
import { HubSpotClient } from '../lib/hubspot/client';
import { decryptToken } from '../lib/crypto/token-encryption';

const TARGET_PORTAL_ID = '49169539'; // Frontera Health

async function verifyProperties() {
  console.log('\n=== Verifying Job Segmentation Properties in HubSpot ===\n');
  console.log(`Portal: ${TARGET_PORTAL_ID}\n`);

  try {
    // Get HubSpot connection
    const { data: connection } = await supabaseAdmin
      .from('hubspot_connections')
      .select('access_token')
      .eq('portal_id', TARGET_PORTAL_ID)
      .single();

    if (!connection) {
      console.error('❌ Connection not found');
      process.exit(1);
    }

    const accessToken = decryptToken(connection.access_token);
    const hubspot = new HubSpotClient(accessToken, TARGET_PORTAL_ID);

    // Check refyne_job_level property
    console.log('1. Checking refyne_job_level property...');
    const jobLevelProp = await hubspot.request<{
      name: string;
      label: string;
      type: string;
      fieldType: string;
      options?: Array<{ label: string; value: string }>;
    }>('/crm/v3/properties/contacts/refyne_job_level');

    console.log(`   ✓ Property exists`);
    console.log(`   Label: ${jobLevelProp.label}`);
    console.log(`   Type: ${jobLevelProp.type}`);
    console.log(`   Field Type: ${jobLevelProp.fieldType}`);
    console.log(`   Options: ${jobLevelProp.options?.map((o) => o.label).join(', ')}\n`);

    // Check refyne_job_function property
    console.log('2. Checking refyne_job_function property...');
    const jobFunctionProp = await hubspot.request<{
      name: string;
      label: string;
      type: string;
      fieldType: string;
      options?: Array<{ label: string; value: string }>;
    }>('/crm/v3/properties/contacts/refyne_job_function');

    console.log(`   ✓ Property exists`);
    console.log(`   Label: ${jobFunctionProp.label}`);
    console.log(`   Type: ${jobFunctionProp.type}`);
    console.log(`   Field Type: ${jobFunctionProp.fieldType}`);
    console.log(`   Options: ${jobFunctionProp.options?.map((o) => o.label).join(', ')}\n`);

    // Check a sample contact
    console.log('3. Checking sample contact (95749820785 - Maria Johnson)...');
    const contact = await hubspot.request<{
      id: string;
      properties: {
        firstname?: string;
        lastname?: string;
        jobtitle?: string;
        refyne_job_level?: string;
        refyne_job_function?: string;
      };
    }>('/crm/v3/objects/contacts/95749820785?properties=firstname,lastname,jobtitle,refyne_job_level,refyne_job_function');

    console.log(`   Name: ${contact.properties.firstname} ${contact.properties.lastname}`);
    console.log(`   Job Title: ${contact.properties.jobtitle}`);
    console.log(`   Job Level: ${contact.properties.refyne_job_level}`);
    console.log(`   Job Function: ${contact.properties.refyne_job_function}\n`);

    console.log('✓ All properties verified successfully');
    console.log(`✓ View in HubSpot: https://app.hubspot.com/contacts/${TARGET_PORTAL_ID}/contact/95749820785/`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Verification failed:', error);
    process.exit(1);
  }
}

verifyProperties();
