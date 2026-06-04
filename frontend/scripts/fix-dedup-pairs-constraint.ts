#!/usr/bin/env npx tsx
/**
 * Fix missing unique constraint on dedup_pairs table
 *
 * Error: there is no unique or exclusion constraint matching the ON CONFLICT specification
 *
 * This script checks if the unique constraint exists and recreates it if missing.
 */

import { supabaseAdmin } from '../lib/db/admin-client';

async function main() {
  console.log('Checking dedup_pairs unique constraint...\n');

  if (!supabaseAdmin) {
    console.error('❌ Supabase admin client not configured');
    process.exit(1);
  }

  // Check if constraint exists
  const { data: constraints, error: checkError } = await supabaseAdmin.rpc('execute_sql', {
    query: `
      SELECT constraint_name, constraint_type
      FROM information_schema.table_constraints
      WHERE table_name = 'dedup_pairs'
        AND constraint_type = 'UNIQUE'
        AND constraint_name LIKE '%org_id%record%';
    `
  });

  if (checkError) {
    console.error('❌ Failed to check constraints:', checkError);
    process.exit(1);
  }

  console.log('Existing unique constraints:', constraints);

  // Check if the specific constraint exists
  const hasConstraint = constraints && constraints.length > 0;

  if (hasConstraint) {
    console.log('✅ Unique constraint already exists');
    console.log('\nConstraint details:', constraints[0]);
    process.exit(0);
  }

  console.log('⚠️  Unique constraint missing - recreating it...\n');

  // Drop any existing constraint with this name (in case it's malformed)
  const { error: dropError } = await supabaseAdmin.rpc('execute_sql', {
    query: `
      ALTER TABLE dedup_pairs
      DROP CONSTRAINT IF EXISTS dedup_pairs_org_id_record_a_id_record_b_id_key;
    `
  });

  if (dropError) {
    console.warn('⚠️  Could not drop existing constraint:', dropError.message);
  }

  // Recreate the constraint
  const { error: createError } = await supabaseAdmin.rpc('execute_sql', {
    query: `
      ALTER TABLE dedup_pairs
      ADD CONSTRAINT dedup_pairs_org_id_record_a_id_record_b_id_key
      UNIQUE (org_id, record_a_id, record_b_id);
    `
  });

  if (createError) {
    console.error('❌ Failed to create constraint:', createError);

    // Check if there are duplicate rows preventing the constraint
    console.log('\nChecking for duplicate rows...');
    const { data: dupes, error: dupeError } = await supabaseAdmin.rpc('execute_sql', {
      query: `
        SELECT org_id, record_a_id, record_b_id, COUNT(*) as count
        FROM dedup_pairs
        GROUP BY org_id, record_a_id, record_b_id
        HAVING COUNT(*) > 1;
      `
    });

    if (dupeError) {
      console.error('❌ Could not check for duplicates:', dupeError);
    } else if (dupes && dupes.length > 0) {
      console.log(`\n⚠️  Found ${dupes.length} duplicate pairs that need cleanup:`);
      console.log(dupes.slice(0, 5));
      console.log('\nYou need to remove duplicates before adding the constraint.');
      console.log('Run this SQL to see all duplicates:');
      console.log(`
        SELECT org_id, record_a_id, record_b_id, COUNT(*) as count
        FROM dedup_pairs
        GROUP BY org_id, record_a_id, record_b_id
        HAVING COUNT(*) > 1;
      `);
    }

    process.exit(1);
  }

  console.log('✅ Unique constraint created successfully\n');

  // Verify it was created
  const { data: verify, error: verifyError } = await supabaseAdmin.rpc('execute_sql', {
    query: `
      SELECT constraint_name, constraint_type
      FROM information_schema.table_constraints
      WHERE table_name = 'dedup_pairs'
        AND constraint_type = 'UNIQUE';
    `
  });

  if (verifyError) {
    console.error('❌ Failed to verify constraint:', verifyError);
    process.exit(1);
  }

  console.log('Verified constraints:', verify);
  console.log('\n✅ Fix complete! Dedup scans should now work.\n');
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
