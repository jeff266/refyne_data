import { config } from 'dotenv';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl!, supabaseKey!);

async function checkPhoneIssues() {
  console.log('Checking phone issues for RevOps Impact...\n');

  // Get org details
  const orgId = 'org_3EO4lJVNFJTFXSaUi8iieMKwFTx'; // RevOps Impact

  // Get HubSpot connection
  const { data: connection } = await supabase
    .from('hubspot_connections')
    .select('portal_id, org_id')
    .eq('org_id', orgId)
    .eq('connection_status', 'active')
    .single();

  if (!connection) {
    console.log('No active HubSpot connection found for RevOps Impact');
    return;
  }

  console.log(`Portal ID: ${connection.portal_id}`);
  console.log(`Org ID: ${connection.org_id}\n`);

  // Check if there's cached issue count data
  const cacheKey = `normalize:counts:${orgId}:${connection.portal_id}`;
  console.log(`Cache key would be: ${cacheKey}\n`);

  // Get the phone harmony
  const { data: phoneHarmony } = await supabase
    .from('harmonies')
    .select('*')
    .eq('id', 'phone')
    .eq('is_active', true)
    .single();

  if (!phoneHarmony) {
    console.log('Phone harmony not found');
    return;
  }

  console.log('Phone harmony:');
  console.log(`  ID: ${phoneHarmony.id}`);
  console.log(`  Name: ${phoneHarmony.name}`);
  console.log(`  Field: ${phoneHarmony.field}`);
  console.log(`  Object type: ${phoneHarmony.object_type}`);
  console.log(`  Transform type: ${phoneHarmony.transform_type}`);
  console.log(`  Transform function: ${phoneHarmony.transform_function}\n`);

  // Get field assignment for phone harmony
  const { data: fieldAssignment } = await supabase
    .from('harmony_field_assignments')
    .select('*')
    .eq('harmony_id', 'phone')
    .eq('object_type', 'company')
    .is('org_id', null) // Global assignment
    .single();

  if (!fieldAssignment) {
    console.log('No field assignment found for phone harmony');
    return;
  }

  console.log('Field assignment:');
  console.log(`  Canonical field: ${fieldAssignment.canonical_field}`);
  console.log(`  HubSpot property: ${fieldAssignment.hubspot_property}\n`);

  console.log('The discrepancy might be:');
  console.log('1. Issue count API is counting all companies with phone field set');
  console.log('2. Preview is filtering to only companies that match the selected source filter');
  console.log('3. Preview might be applying exclusions that the count isn\'t');
  console.log('\nTo verify: Check if there are 24 companies with phone numbers or just 2 with non-E.164 format');
}

checkPhoneIssues().catch(console.error);
