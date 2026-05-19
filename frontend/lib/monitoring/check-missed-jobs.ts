/**
 * Missed Job Detection
 *
 * Checks if any Always On workspace has missed their scheduled digest.
 * Alerts if last run was more than 26 hours ago (should run every 24h).
 */

import { supabase } from '@/lib/db/supabase';
import { sendWorkerAlert } from './alert';

export async function checkMissedJobs() {
  if (!supabase) {
    console.warn('[Missed Jobs] Supabase not configured, skipping check');
    return;
  }

  try {
    // Get all orgs with Always On enabled
    const { data: orgs, error: orgsError } = await supabase
      .from('workspace_entitlements')
      .select('org_id, org_name, always_on_enabled')
      .eq('always_on_enabled', true);

    if (orgsError) {
      console.error('[Missed Jobs] Failed to fetch orgs:', orgsError);
      return;
    }

    if (!orgs || orgs.length === 0) {
      console.log('[Missed Jobs] No orgs with Always On enabled');
      return;
    }

    console.log(`[Missed Jobs] Checking ${orgs.length} orgs with Always On enabled`);

    for (const org of orgs) {
      // Check last digest run
      const { data: lastRun, error: runError } = await supabase
        .from('digest_runs')
        .select('run_at')
        .eq('org_id', org.org_id)
        .order('run_at', { ascending: false })
        .limit(1)
        .single();

      if (runError && runError.code !== 'PGRST116') {
        // PGRST116 is "no rows returned" - that's expected for new orgs
        console.error(`[Missed Jobs] Failed to fetch last run for ${org.org_id}:`, runError);
        continue;
      }

      const hoursSinceLastRun = lastRun
        ? (Date.now() - new Date(lastRun.run_at).getTime()) / 3600000
        : 999;

      if (hoursSinceLastRun > 26) {
        await sendWorkerAlert(
          `Missed digest — ${org.org_name ?? org.org_id}`,
          `Last digest run was ${Math.round(hoursSinceLastRun)} hours ago. Expected every 24 hours.`,
          org.org_id
        );
        console.warn(`[Missed Jobs] Alert sent for ${org.org_id} - ${Math.round(hoursSinceLastRun)}h since last run`);
      }
    }
  } catch (error) {
    console.error('[Missed Jobs] Check failed:', error);
  }
}
