#!/usr/bin/env npx tsx
/**
 * Cache Eviction Cron Job
 *
 * Removes expired entries from the provider_entity_cache table.
 * Schedule this to run nightly at 02:00 UTC via Railway cron.
 *
 * Usage:
 *   npx tsx scripts/cron-cache-eviction.ts
 *
 * Railway cron schedule: 0 2 * * * (daily at 02:00 UTC)
 */

import { evictExpired } from '../lib/cache';

async function main() {
  console.log('═'.repeat(60));
  console.log('Cache Eviction Job');
  console.log(`Started at: ${new Date().toISOString()}`);
  console.log('═'.repeat(60));

  try {
    const deleted = await evictExpired();
    console.log(`\n✅ Cache eviction complete: ${deleted} entries removed`);
  } catch (err) {
    console.error('\n❌ Cache eviction failed:', err);
    process.exit(1);
  }

  console.log(`\nCompleted at: ${new Date().toISOString()}`);
}

main().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
