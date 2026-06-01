/**
 * Apply Migration 064: Fix contact harmonies and add field assignments
 *
 * Run with: npx tsx scripts/run-migration-064.ts
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  console.error('Make sure these are set in your environment or .env.local file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigration() {
  console.log('🚀 Applying Migration 064: Fix contact harmonies and add field assignments');
  console.log('------------------------------------------------------------------------');

  // Read migration file
  const migrationPath = join(__dirname, '..', 'supabase', 'migrations', '064_contacts_harmonies_and_assignments.sql');
  const sql = readFileSync(migrationPath, 'utf-8');

  console.log(`\n📄 Migration file: ${migrationPath}`);
  console.log(`📏 Migration size: ${sql.length} characters`);
  console.log(`\n🔧 Executing migration...\n`);

  try {
    // Split SQL into individual statements
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (!statement) continue;

      console.log(`Executing statement ${i + 1}/${statements.length}...`);
      console.log(`Statement: ${statement.substring(0, 100)}...`);

      const { error } = await supabase.rpc('exec', {
        query: statement + ';'
      });

      if (error) {
        console.error(`❌ Error in statement ${i + 1}:`, error.message);
        throw error;
      }
    }

    console.log('\n✅ Migration applied successfully');

    // Verify the field assignments were created
    console.log('\n🔍 Verifying migration...');

    const { data, error } = await supabase
      .from('harmony_field_assignments')
      .select('harmony_id, canonical_field, hubspot_property')
      .eq('object_type', 'contact')
      .is('org_id', null)
      .order('harmony_id');

    if (error) {
      console.error('❌ Verification query failed:', error.message);
    } else {
      console.log(`\n✅ Found ${data?.length || 0} contact field assignments:`);
      console.table(data);
    }

    console.log('\n🎉 Migration 064 completed successfully!');

  } catch (error: any) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('\nYou may need to apply this migration manually through the Supabase SQL editor.');
    console.error(`Migration file: ${migrationPath}`);
    process.exit(1);
  }
}

runMigration();
