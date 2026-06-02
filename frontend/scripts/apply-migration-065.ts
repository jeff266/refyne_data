/**
 * Apply migration 065 - job_title_cache table
 *
 * Note: This manually creates the table since Supabase CLI requires project linking.
 * In production, apply migrations via Supabase dashboard SQL editor.
 */

import { supabaseAdmin } from '../lib/db/admin-client';

async function main() {
  console.log('Creating job_title_cache table...\n');

  // Check if table exists
  const { data: existing } = await supabaseAdmin
    .from('job_title_cache')
    .select('id')
    .limit(1);

  if (existing !== null) {
    console.log('✓ Table already exists, skipping creation');
    return;
  }

  console.log('Table does not exist. Please apply via Supabase Dashboard:');
  console.log('1. Go to https://supabase.com/dashboard/project/lfaiiswszxvexqpnhtgq/sql/new');
  console.log('2. Paste the contents of supabase/migrations/065_job_title_cache.sql');
  console.log('3. Click "Run"');
  console.log('\nOr use Supabase CLI:');
  console.log('  npx supabase link --project-ref lfaiiswszxvexqpnhtgq');
  console.log('  npx supabase db push');

  process.exit(1);
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
