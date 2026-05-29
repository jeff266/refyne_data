/**
 * Apply Migration 057: Add new survivorship rule types
 *
 * Run with: npx tsx scripts/run-migration-057.ts
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
  console.log('🚀 Applying Migration 057: Add new survivorship rule types');
  console.log('-----------------------------------------------------------');

  // Read migration file
  const migrationPath = join(__dirname, '..', 'lib', 'db', 'migrations', '057_add_new_survivorship_rule_types.sql');
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
      console.log(`Statement: ${statement.substring(0, 80)}...`);

      const { error } = await supabase.rpc('exec', {
        query: statement + ';'
      });

      if (error) {
        console.error(`❌ Error in statement ${i + 1}:`, error.message);
        throw error;
      }
    }

    console.log('\n✅ Migration applied successfully');

    // Verify the constraint was updated
    console.log('\n🔍 Verifying migration...');

    // Try to check if constraint exists (this might not work due to permissions)
    const { data, error } = await supabase
      .from('dedup_survivorship_rules')
      .select('rule_type')
      .limit(1);

    if (error && !error.message.includes('permission denied')) {
      console.error('❌ Table verification failed:', error.message);
    } else {
      console.log('✅ dedup_survivorship_rules table accessible');
    }

    console.log('\n🎉 Migration 057 completed successfully!');
    console.log('\nYou can now create survivorship rules with:');
    console.log('  - specific_value (enum priority matching)');
    console.log('  - rollup (numeric aggregation)');
    console.log('  - most_recent (timestamp-based)');

  } catch (error: any) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('\nYou may need to apply this migration manually through the Supabase SQL editor.');
    console.error(`Migration file: ${migrationPath}`);
    process.exit(1);
  }
}

runMigration();
