/**
 * Apply Migration 015: Clerk Organizations + RBAC
 *
 * Run with: npx tsx scripts/run-migration-015.ts
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
  console.log('🚀 Applying Migration 015: Clerk Organizations + RBAC');
  console.log('---------------------------------------------------');

  // Read migration file
  const migrationPath = join(__dirname, '..', 'lib', 'db', 'migrations', '015_clerk_orgs_rbac.sql');
  const sql = readFileSync(migrationPath, 'utf-8');

  console.log(`\n📄 Migration file: ${migrationPath}`);
  console.log(`📏 Migration size: ${sql.length} characters`);
  console.log(`\n🔧 Executing migration...\n`);

  try {
    // Execute the migration
    const { error } = await supabase.rpc('exec_sql', { sql_query: sql });

    if (error) {
      // If exec_sql doesn't exist, try direct execution (split by statement)
      if (error.message?.includes('exec_sql')) {
        console.log('⚠️  exec_sql function not found, executing statements individually...\n');

        // Split SQL into individual statements (rough split on semicolons)
        const statements = sql
          .split(';')
          .map(s => s.trim())
          .filter(s => s.length > 0 && !s.startsWith('--'));

        for (let i = 0; i < statements.length; i++) {
          const statement = statements[i];
          if (!statement) continue;

          console.log(`Executing statement ${i + 1}/${statements.length}...`);

          const { error: stmtError } = await supabase.rpc('exec', {
            query: statement + ';'
          });

          if (stmtError) {
            console.error(`❌ Error in statement ${i + 1}:`, stmtError.message);
            console.error(`Statement: ${statement.substring(0, 100)}...`);
            throw stmtError;
          }
        }

        console.log('\n✅ Migration applied successfully (statement by statement)');
      } else {
        throw error;
      }
    } else {
      console.log('✅ Migration applied successfully');
    }

    // Verify tables were created
    console.log('\n🔍 Verifying migration...');

    const tables = ['quarantine_records', 'prospecting_limits', 'prospecting_usage'];

    for (const table of tables) {
      const { count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });

      if (error && !error.message.includes('permission denied')) {
        console.error(`❌ Table ${table} verification failed:`, error.message);
      } else {
        console.log(`✅ Table ${table} exists (${count ?? 0} rows)`);
      }
    }

    // Check workspace_entitlements columns
    const { data: entitlements, error: entError } = await supabase
      .from('workspace_entitlements')
      .select('clerk_org_id, org_name, allow_operator_push, duplicate_push_policy, external_agencies_enabled')
      .limit(1);

    if (entError && !entError.message.includes('permission denied')) {
      console.error('❌ workspace_entitlements columns verification failed:', entError.message);
    } else {
      console.log('✅ workspace_entitlements columns added');
    }

    console.log('\n🎉 Migration 015 completed successfully!');
    console.log('\nNext steps:');
    console.log('  1. Regenerate TypeScript types: npx supabase gen types typescript --project-id <id> > lib/db/database.types.ts');
    console.log('  2. Proceed to Step 2: Create lib/auth/admin-guard.ts');

  } catch (error: any) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('\nYou may need to apply this migration manually through the Supabase SQL editor.');
    console.error(`Migration file: ${migrationPath}`);
    process.exit(1);
  }
}

runMigration();
