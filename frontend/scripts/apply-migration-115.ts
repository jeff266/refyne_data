/**
 * Apply Migration 115: Fix org_entitlements view to respect plan_override
 *
 * Usage: npx tsx --env-file=.env.local scripts/apply-migration-115.ts
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { supabaseAdmin } from '@/lib/db/admin-client';

async function applyMigration() {
  console.log('[Migration 115] Starting...');

  // Read migration SQL
  const migrationPath = join(
    process.cwd(),
    'supabase/migrations/20260805000001_115_fix_org_entitlements_plan_override.sql'
  );

  let sql: string;
  try {
    sql = readFileSync(migrationPath, 'utf8');
    console.log('[Migration 115] Migration file loaded');
  } catch (error) {
    console.error('[Migration 115] Failed to read migration file:', error);
    process.exit(1);
  }

  // Execute migration
  try {
    const { error } = await supabaseAdmin.rpc('exec_sql', { sql_query: sql });

    if (error) {
      // If exec_sql RPC doesn't exist, try direct execution
      console.log('[Migration 115] Trying direct execution...');
      const { error: directError } = await supabaseAdmin.from('_migrations').insert({
        name: '115_fix_org_entitlements_plan_override',
        executed_at: new Date().toISOString(),
      });

      if (directError && directError.code !== '42P01') {
        // Table doesn't exist, which is fine
        console.warn('[Migration 115] Could not log migration:', directError);
      }

      // Execute the SQL in parts (CREATE OR REPLACE VIEW, then COMMENT)
      const statements = sql.split(';').filter(s => s.trim());

      for (const statement of statements) {
        if (!statement.trim()) continue;

        try {
          // Use raw SQL query if available
          const { error: execError } = await (supabaseAdmin as any).rpc('exec', {
            sql: statement.trim() + ';'
          });

          if (execError) {
            throw execError;
          }
        } catch (e: any) {
          // If RPC doesn't work, we'll need to apply manually
          console.error('[Migration 115] Could not execute statement:', e.message);
          console.log('\n=== MANUAL MIGRATION REQUIRED ===');
          console.log('Please run this SQL in the Supabase SQL Editor:\n');
          console.log(sql);
          console.log('\n=================================\n');
          process.exit(1);
        }
      }
    }

    console.log('[Migration 115] ✅ Migration applied successfully!');
    console.log('\nThe org_entitlements view now respects plan_override.');
    console.log('Admin-comped accounts will no longer show trial banners.');

  } catch (error) {
    console.error('[Migration 115] Migration failed:', error);
    console.log('\n=== MANUAL MIGRATION REQUIRED ===');
    console.log('Please run this SQL in the Supabase SQL Editor:\n');
    console.log(sql);
    console.log('\n=================================\n');
    process.exit(1);
  }
}

applyMigration();
