/**
 * Apply Migration 081: Billing System Foundation
 *
 * Applies the billing foundation migration to production Supabase.
 * Creates tables, partitions, views, and RPC functions.
 *
 * Run: npx tsx scripts/apply-migration-081.ts
 */

import { supabaseAdmin } from '../lib/db/admin-client';
import { readFileSync } from 'fs';
import { join } from 'path';

async function applyMigration() {
  console.log('[Migration 081] Starting...\n');

  try {
    // Read migration file
    const migrationPath = join(__dirname, '../lib/db/migrations/081_billing_foundation.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf-8');

    console.log('[Migration 081] Read migration file');
    console.log(`[Migration 081] SQL length: ${migrationSQL.length} characters\n`);

    // Split into individual statements (basic split on semicolons outside of functions)
    // For complex migrations with functions, we need to be careful about splitting
    const statements = splitSQLStatements(migrationSQL);

    console.log(`[Migration 081] Found ${statements.length} SQL statements\n`);

    // Execute each statement
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i].trim();

      if (!statement || statement.startsWith('--')) {
        continue; // Skip empty or comment-only statements
      }

      const preview = statement.substring(0, 80).replace(/\s+/g, ' ');
      console.log(`[${i + 1}/${statements.length}] Executing: ${preview}...`);

      try {
        const { error } = await supabaseAdmin.rpc('exec_sql', { sql: statement });

        if (error) {
          // Try direct execution if RPC doesn't exist
          const result = await supabaseAdmin.from('_migrations').select('*').limit(1);

          if (result.error && result.error.message.includes('does not exist')) {
            console.log('  ⚠ Direct SQL execution not available via Supabase client');
            console.log('  ℹ Please apply migration manually via Supabase dashboard\n');
            console.log('Migration SQL:');
            console.log('='.repeat(80));
            console.log(migrationSQL);
            console.log('='.repeat(80));
            process.exit(1);
          }

          throw error;
        }

        successCount++;
        console.log('  ✓ Success\n');
      } catch (err) {
        failCount++;
        console.error('  ✗ Failed:', err);
        console.error('  Statement:', statement.substring(0, 200));
        console.error('');
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log('[Migration 081] Complete');
    console.log(`  Success: ${successCount}`);
    console.log(`  Failed: ${failCount}`);
    console.log('='.repeat(80) + '\n');

    if (failCount > 0) {
      console.error('⚠ Some statements failed. Please review errors above.\n');
      process.exit(1);
    }

    // Verify migration
    await verifyMigration();

  } catch (error) {
    console.error('[Migration 081] Fatal error:', error);
    process.exit(1);
  }
}

/**
 * Basic SQL statement splitter
 * Splits on semicolons, but preserves function bodies
 */
function splitSQLStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = '';
  let inFunction = false;
  let dollarQuoteTag: string | null = null;

  const lines = sql.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();

    // Track function boundaries
    if (trimmed.match(/CREATE (OR REPLACE )?FUNCTION/i)) {
      inFunction = true;
    }

    // Track dollar-quoted strings ($$, $body$, etc.)
    const dollarMatch = trimmed.match(/\$([a-zA-Z_]*)\$/);
    if (dollarMatch) {
      const tag = dollarMatch[0];
      if (dollarQuoteTag === null) {
        dollarQuoteTag = tag;
      } else if (dollarQuoteTag === tag) {
        dollarQuoteTag = null;
        if (trimmed.endsWith(';')) {
          inFunction = false;
        }
      }
    }

    current += line + '\n';

    // Split on semicolon if not inside function
    if (line.includes(';') && !inFunction && dollarQuoteTag === null) {
      statements.push(current);
      current = '';
    }
  }

  // Add any remaining content
  if (current.trim()) {
    statements.push(current);
  }

  return statements;
}

/**
 * Verify migration was applied correctly
 */
async function verifyMigration() {
  console.log('[Verify] Checking migration results...\n');

  // Check tables exist
  const tables = [
    'org_billing',
    'org_usage',
    'stripe_webhook_events',
    'stripe_prices',
    'org_billing_events',
  ];

  for (const table of tables) {
    const { count, error } = await supabaseAdmin
      .from(table)
      .select('*', { count: 'exact', head: true });

    if (error) {
      console.log(`  ✗ Table '${table}' not found or not accessible`);
      console.error('    Error:', error.message);
    } else {
      console.log(`  ✓ Table '${table}' exists (${count ?? 0} rows)`);
    }
  }

  console.log('');

  // Check partitions exist
  console.log('[Verify] Checking weekly partitions...\n');

  const { data: partitions, error: partError } = await supabaseAdmin
    .rpc('exec_sql', {
      sql: `
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = 'public'
          AND tablename LIKE 'org_usage_%'
        ORDER BY tablename;
      `
    });

  if (!partError && partitions) {
    console.log(`  ✓ Found ${partitions.length} partitions`);
    partitions.forEach((p: any) => console.log(`    - ${p.tablename}`));
  } else {
    console.log('  ℹ Cannot verify partitions via RPC (may need manual check)');
  }

  console.log('\n[Verify] Complete\n');
}

// Run migration
applyMigration().catch((err) => {
  console.error('[Migration 081] Unhandled error:', err);
  process.exit(1);
});
