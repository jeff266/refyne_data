#!/usr/bin/env tsx
// Cleanup expired cache entries
// Run nightly via Railway cron or scheduled task

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function cleanupExpiredCache() {
  console.log('[Cache Cleanup] Starting cleanup of expired entries...');

  const { data, error } = await supabase
    .from('cache')
    .delete()
    .lt('expires_at', new Date().toISOString())
    .select('key');

  if (error) {
    console.error('[Cache Cleanup] Error:', error);
    process.exit(1);
  }

  const deletedCount = data?.length ?? 0;
  console.log(`[Cache Cleanup] Deleted ${deletedCount} expired entries`);

  // Also log current cache stats
  const { count: totalCount } = await supabase
    .from('cache')
    .select('*', { count: 'exact', head: true });

  console.log(`[Cache Cleanup] Remaining entries: ${totalCount ?? 0}`);
}

cleanupExpiredCache()
  .then(() => {
    console.log('[Cache Cleanup] Complete');
    process.exit(0);
  })
  .catch((err) => {
    console.error('[Cache Cleanup] Fatal error:', err);
    process.exit(1);
  });
