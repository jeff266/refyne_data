/**
 * Nightly Context Rebuild
 *
 * Cron job that rebuilds workspace context for all orgs at 2am UTC.
 * Uses delta check to skip unnecessary Sonnet calls.
 */

import { supabaseAdmin } from '@/lib/db/admin-client';
import { buildWorkspaceContext } from './context-builder';

/**
 * Nightly context rebuild for all orgs
 * Run via cron job at 2am UTC
 */
export async function runNightlyContextRebuild(): Promise<void> {
  console.log('[Nightly Context Rebuild] Starting...');

  // Get all orgs with HubSpot connections
  const { data: orgs } = await supabaseAdmin
    .from('hubspot_connections')
    .select('org_id')
    .eq('connection_status', 'connected');

  if (!orgs || orgs.length === 0) {
    console.log('[Nightly Context Rebuild] No orgs to rebuild');
    return;
  }

  const uniqueOrgIds = Array.from(new Set(orgs.map(o => o.org_id)));
  console.log(`[Nightly Context Rebuild] Rebuilding for ${uniqueOrgIds.length} orgs`);

  let succeeded = 0;
  let skipped = 0;
  let failed = 0;

  // Rebuild sequentially with delta check
  for (const orgId of uniqueOrgIds) {
    try {
      const context = await buildWorkspaceContext(orgId, 'nightly_rebuild');

      if (!context) {
        console.log(`[Nightly Context Rebuild] ⊘ ${orgId} (skipped - no changes)`);
        skipped++;
      } else {
        console.log(`[Nightly Context Rebuild] ✓ ${orgId}`);
        succeeded++;
      }
    } catch (err) {
      console.error(`[Nightly Context Rebuild] ✗ ${orgId}:`, err);
      failed++;
    }
  }

  console.log(`[Nightly Context Rebuild] Completed: ${succeeded} succeeded, ${skipped} skipped, ${failed} failed`);
}
