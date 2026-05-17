#!/usr/bin/env npx tsx
/**
 * Test HubSpot Schema Sync
 *
 * Usage: HUBSPOT_TOKEN=pat-xxx npx tsx scripts/test-schema-sync.ts
 *
 * Tests the schema discovery feature that extracts enum field options from HubSpot.
 */

import { validateToken, HubSpotClient } from '../lib/hubspot/client';

const token = process.env.HUBSPOT_TOKEN;

if (!token) {
  console.error('❌ HUBSPOT_TOKEN environment variable is required');
  console.error('Usage: HUBSPOT_TOKEN=pat-xxx npx tsx scripts/test-schema-sync.ts');
  process.exit(1);
}

async function main() {
  console.log('🔄 HubSpot Schema Sync Test\n');
  console.log('============================================================');

  // Validate token
  console.log('1️⃣  Validating token...');
  const validation = await validateToken(token!);

  if (!validation.valid || !validation.portalId) {
    console.error(`❌ Token validation failed: ${validation.error}`);
    process.exit(1);
  }

  console.log(`✅ Token valid`);
  console.log(`   Portal ID: ${validation.portalId}\n`);

  // Create client and sync schema
  console.log('2️⃣  Syncing workspace schema...');
  const client = new HubSpotClient(token!, validation.portalId);
  const schemaResult = await client.syncWorkspaceSchema();

  console.log(`✅ Schema sync complete`);
  console.log(`   Company properties: ${schemaResult.companyPropertyCount}`);
  console.log(`   Contact properties: ${schemaResult.contactPropertyCount}`);
  console.log(`   Enum properties: ${schemaResult.enumPropertyCount}\n`);

  // Show sample enum properties
  console.log('3️⃣  Sample enum properties (first 10):\n');

  const companyEnums = schemaResult.enumProperties.filter(p => p.objectType === 'companies');
  const contactEnums = schemaResult.enumProperties.filter(p => p.objectType === 'contacts');

  console.log(`   Company enum fields: ${companyEnums.length}`);
  console.log(`   Contact enum fields: ${contactEnums.length}\n`);

  // Show first 5 company enum fields with their options
  console.log('   📊 Sample Company Enum Fields:');
  for (const prop of companyEnums.slice(0, 5)) {
    console.log(`   - ${prop.property} (${prop.label})`);
    console.log(`     Type: ${prop.fieldType}`);
    console.log(`     Options (${prop.options.length}):`);
    for (const opt of prop.options.slice(0, 5)) {
      console.log(`       • ${opt.value} → "${opt.label}"`);
    }
    if (prop.options.length > 5) {
      console.log(`       ... and ${prop.options.length - 5} more`);
    }
    console.log();
  }

  // Show the industry field specifically if it exists
  const industryField = companyEnums.find(p => p.property === 'industry');
  if (industryField) {
    console.log('\n4️⃣  Industry field details:');
    console.log(`   Property: ${industryField.property}`);
    console.log(`   Label: ${industryField.label}`);
    console.log(`   Type: ${industryField.fieldType}`);
    console.log(`   Total options: ${industryField.options.length}`);
    console.log('\n   Sample options:');
    for (const opt of industryField.options.slice(0, 15)) {
      console.log(`   • ${opt.value} → "${opt.label}"`);
    }
    if (industryField.options.length > 15) {
      console.log(`   ... and ${industryField.options.length - 15} more`);
    }
  }

  console.log('\n============================================================');
  console.log('✅ Schema sync test complete!');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
