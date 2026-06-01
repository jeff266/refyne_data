/**
 * Apply Migration 064: Fix contact harmonies and add field assignments
 *
 * Run with: npx tsx scripts/apply-migration-064.ts
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  console.error('Make sure these are set in your environment or .env.local file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function applyMigration() {
  console.log('🚀 Applying Migration 064: Fix contact harmonies and add field assignments');
  console.log('------------------------------------------------------------------------\n');

  try {
    // Step 1: Fix person-name and contact-name-case
    console.log('1️⃣  Updating person-name and contact-name-case...');
    const { error: e1 } = await supabase
      .from('harmonies')
      .update({
        transform_function: 'smart_title_case',
        transform_config: {}
      })
      .in('id', ['person-name', 'contact-name-case']);

    if (e1) throw new Error(`person-name/contact-name-case update failed: ${e1.message}`);
    console.log('   ✅ Updated person-name and contact-name-case\n');

    // Step 2: Fix person-title and contact-title-standard
    console.log('2️⃣  Updating person-title and contact-title-standard...');
    const { error: e2 } = await supabase
      .from('harmonies')
      .update({
        transform_type: 'lookup',
        transform_function: null,
        reference_table: 'contact_titles'
      })
      .in('id', ['person-title', 'contact-title-standard']);

    if (e2) throw new Error(`person-title/contact-title-standard update failed: ${e2.message}`);
    console.log('   ✅ Updated person-title and contact-title-standard\n');

    // Step 3: Fix contact-location
    console.log('3️⃣  Updating contact-location...');
    const { error: e3 } = await supabase
      .from('harmonies')
      .update({
        transform_type: 'lookup',
        transform_function: null,
        reference_table: 'countries'
      })
      .eq('id', 'contact-location');

    if (e3) throw new Error(`contact-location update failed: ${e3.message}`);
    console.log('   ✅ Updated contact-location\n');

    // Step 4: Deactivate duplicate email harmony
    console.log('4️⃣  Deactivating duplicate email harmony...');
    const { error: e4 } = await supabase
      .from('harmonies')
      .update({ is_active: false })
      .eq('id', 'email');

    if (e4) throw new Error(`email deactivation failed: ${e4.message}`);
    console.log('   ✅ Deactivated email harmony\n');

    // Step 5: Add field assignments
    console.log('5️⃣  Adding contact field assignments...');
    const assignments = [
      { harmony_id: 'person-name',           object_type: 'contact', canonical_field: 'contact.firstname',   hubspot_property: 'firstname',   priority: 0 },
      { harmony_id: 'contact-name-case',     object_type: 'contact', canonical_field: 'contact.lastname',    hubspot_property: 'lastname',    priority: 0 },
      { harmony_id: 'contact-title-standard',object_type: 'contact', canonical_field: 'contact.jobtitle',    hubspot_property: 'jobtitle',    priority: 0 },
      { harmony_id: 'person-title',          object_type: 'contact', canonical_field: 'contact.jobtitle',    hubspot_property: 'jobtitle',    priority: 1 },
      { harmony_id: 'contact-location',      object_type: 'contact', canonical_field: 'contact.country',     hubspot_property: 'country',     priority: 0 },
      { harmony_id: 'contact-email-lower',   object_type: 'contact', canonical_field: 'contact.email',       hubspot_property: 'email',       priority: 0 },
      { harmony_id: 'contact-phone-e164',    object_type: 'contact', canonical_field: 'contact.phone',       hubspot_property: 'phone',       priority: 0 },
      { harmony_id: 'contact-phone-e164',    object_type: 'contact', canonical_field: 'contact.mobilephone', hubspot_property: 'mobilephone', priority: 1 },
    ];

    for (const assignment of assignments) {
      const { error } = await supabase
        .from('harmony_field_assignments')
        .insert({ org_id: null, ...assignment })
        .select()
        .single();

      // Ignore duplicate errors (ON CONFLICT DO NOTHING)
      if (error && !error.message.includes('duplicate key')) {
        throw new Error(`Field assignment failed for ${assignment.harmony_id}/${assignment.canonical_field}: ${error.message}`);
      }
    }
    console.log(`   ✅ Added ${assignments.length} contact field assignments\n`);

    // Verify
    console.log('🔍 Verifying migration...\n');
    const { data, error } = await supabase
      .from('harmony_field_assignments')
      .select('harmony_id, canonical_field, hubspot_property')
      .eq('object_type', 'contact')
      .is('org_id', null)
      .order('harmony_id');

    if (error) {
      console.error('❌ Verification query failed:', error.message);
    } else {
      console.log(`✅ Found ${data?.length || 0} contact field assignments:\n`);
      console.table(data);
    }

    console.log('\n🎉 Migration 064 completed successfully!');

  } catch (error: any) {
    console.error('\n❌ Migration failed:', error.message);
    process.exit(1);
  }
}

applyMigration();
