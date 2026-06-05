/**
 * Product Telemetry Tracker
 *
 * Fire-and-forget event tracking to org_events table.
 * Never throws errors - failures are logged but silent.
 */

import { supabase } from '@/lib/db/supabase';

export type TelemetryEvent =
  | 'hubspot_connected'
  | 'trial_started'
  | 'normalize_run_completed'
  | 'dedup_scan_completed'
  | 'dedup_merge_executed'
  | 'enrich_run_completed'
  | 'harmony_created'
  | 'arrangement_created';

interface TrackParams {
  event: TelemetryEvent;
  orgId: string;
  userId?: string;
  metadata?: Record<string, any>;
}

/**
 * Track a product event to org_events table.
 * Fire and forget - never throws, never blocks.
 */
export async function track(params: TrackParams): Promise<void> {
  const { event, orgId, userId, metadata = {} } = params;

  // Fire and forget - don't await
  Promise.resolve().then(async () => {
    try {
      if (!supabase) {
        console.warn('[Telemetry] Supabase not configured, skipping track');
        return;
      }

      await supabase.from('org_events').insert({
        org_id: orgId,
        user_id: userId || null,
        event_type: event,
        metadata,
        created_at: new Date().toISOString(),
      });

      console.log(`[Telemetry] Tracked: ${event} (org: ${orgId})`);
    } catch (error) {
      // Silent failure - log but don't throw
      console.error('[Telemetry] Failed to track event:', {
        event,
        orgId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });
}
