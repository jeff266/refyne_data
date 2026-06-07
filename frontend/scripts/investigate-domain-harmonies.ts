/**
 * Investigate Domain Harmonies
 *
 * Find all harmonies that target domain-related fields to diagnose
 * why Field Nation shows duplicate company.domain changes.
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

async function investigateDomainHarmonies() {
  const { supabaseAdmin } = await import('../lib/db/admin-client');

  const ORG_ID = 'org_3DuSdb0FBnx7RMLmJSUegrpiNLS'; // RevOps Impact

  console.log('\n🔍 Investigating Domain-Related Harmonies');
  console.log('═'.repeat(70));

  // Query 1: All harmonies that target domain-related fields
  const { data: harmonies, error: harmoniesError } = await supabaseAdmin
    .from('harmonies')
    .select('id, name, field, object_type, transform_type, transform_function, is_active, org_id')
    .or(`field.ilike.%domain%,transform_function.eq.url_canonical,transform_function.eq.extract_domain`)
    .order('name');

  if (harmoniesError) {
    console.error('❌ Error fetching harmonies:', harmoniesError);
    process.exit(1);
  }

  console.log(`\n📊 Found ${harmonies?.length || 0} domain-related harmonies:\n`);

  for (const h of harmonies || []) {
    console.log(`ID: ${h.id}`);
    console.log(`  Name: ${h.name}`);
    console.log(`  Field: ${h.field}`);
    console.log(`  Type: ${h.transform_type} (${h.transform_function || 'N/A'})`);
    console.log(`  Active: ${h.is_active ? '✅' : '❌'}`);
    console.log(`  Org: ${h.org_id || 'GLOBAL'}`);
    console.log('');
  }

  // Query 2: Field assignments for company.domain
  console.log('\n📋 Field Assignments for company.domain:');
  console.log('─'.repeat(70));

  const { data: assignments, error: assignmentsError } = await supabaseAdmin
    .from('harmony_field_assignments')
    .select('harmony_id, object_type, canonical_field, hubspot_property')
    .eq('org_id', ORG_ID)
    .eq('object_type', 'company')
    .eq('canonical_field', 'company.domain')
    .order('harmony_id');

  if (assignmentsError) {
    console.error('❌ Error fetching assignments:', assignmentsError);
    process.exit(1);
  }

  console.log(`\nFound ${assignments?.length || 0} assignments:\n`);

  for (const a of assignments || []) {
    console.log(`Harmony: ${a.harmony_id}`);
    console.log(`  Object: ${a.object_type}`);
    console.log(`  Canonical: ${a.canonical_field}`);
    console.log(`  HubSpot: ${a.hubspot_property}`);
    console.log('');
  }

  // Query 3: Check for multiple harmonies assigned to same canonical field
  console.log('\n🔍 Duplicate Detection:');
  console.log('─'.repeat(70));

  if (assignments && assignments.length > 1) {
    console.log(`⚠️  FOUND DUPLICATE: ${assignments.length} harmonies write to company.domain!`);
    console.log('\nThis explains why Field Nation shows duplicate domain changes.');
    console.log('Both harmonies generate changes for the same field on the same company.\n');

    console.log('Harmonies involved:');
    for (const a of assignments) {
      const harmony = harmonies?.find(h => h.id === a.harmony_id);
      console.log(`  - ${a.harmony_id} (${harmony?.name || 'Unknown'})`);
    }

    console.log('\n💡 SOLUTION:');
    console.log('   Each canonical field should have only ONE harmony assignment.');
    console.log('   Either:');
    console.log('   1. Delete one of the field assignments, OR');
    console.log('   2. Change one harmony to target a different field');
  } else {
    console.log('✅ No duplicates found. Only one harmony writes to company.domain.');
  }

  console.log('\n' + '═'.repeat(70) + '\n');
}

investigateDomainHarmonies().catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
});
