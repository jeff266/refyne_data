/**
 * Get email recipients for a notification type
 */

import { supabase } from '@/lib/db/supabase';

type NotificationType =
  | 'always_on_digest'
  | 'compliance_threshold_alert'
  | 'dedup_pairs_detected'
  | 'quarantine_submitted'
  | 'quarantine_decided'
  | 'credit_limit_warning'
  | 'member_joined';

/**
 * Get list of subscribed email addresses for a notification type
 *
 * Used by:
 * - Always On digest sender
 * - Quarantine events
 * - Compliance alerts
 * - Dedup detection
 */
export async function getSubscribers(
  orgId: string,
  type: NotificationType
): Promise<string[]> {
  if (!supabase) {
    console.warn('[Notifications] Supabase not configured');
    return [];
  }

  const { data, error } = await supabase
    .from('notification_subscriptions')
    .select('user_email')
    .eq('org_id', orgId)
    .eq('notification_type', type)
    .eq('subscribed', true);

  if (error) {
    console.error(`[Notifications] Failed to get subscribers for ${type}:`, error);
    return [];
  }

  return data?.map((row) => row.user_email) || [];
}
