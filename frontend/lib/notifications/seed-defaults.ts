/**
 * Seed default notification subscriptions for new users
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

interface DefaultSubscription {
  type: NotificationType;
  subscribed: boolean;
  mandatory: boolean;
}

/**
 * Get default subscriptions based on user role
 */
function getDefaultsForRole(role: string): DefaultSubscription[] {
  if (role === 'org:admin') {
    return [
      { type: 'always_on_digest', subscribed: true, mandatory: false },
      { type: 'compliance_threshold_alert', subscribed: true, mandatory: false },
      { type: 'dedup_pairs_detected', subscribed: true, mandatory: false },
      { type: 'quarantine_submitted', subscribed: true, mandatory: true },
      { type: 'credit_limit_warning', subscribed: true, mandatory: true },
      { type: 'member_joined', subscribed: true, mandatory: false },
    ];
  }

  if (role === 'org:operator') {
    return [
      { type: 'always_on_digest', subscribed: false, mandatory: false },
      { type: 'compliance_threshold_alert', subscribed: false, mandatory: false },
      { type: 'dedup_pairs_detected', subscribed: false, mandatory: false },
      { type: 'quarantine_decided', subscribed: true, mandatory: true },
      { type: 'credit_limit_warning', subscribed: true, mandatory: true },
    ];
  }

  // org:viewer
  return [
    { type: 'credit_limit_warning', subscribed: true, mandatory: true },
  ];
}

/**
 * Seed default notification subscriptions for a new user
 *
 * Idempotent - uses ON CONFLICT DO NOTHING so safe to call multiple times
 */
export async function seedDefaultSubscriptions(
  orgId: string,
  userId: string,
  userEmail: string,
  role: string
): Promise<void> {
  if (!supabase) {
    console.warn('[Notifications] Supabase not configured, skipping seed');
    return;
  }

  const defaults = getDefaultsForRole(role);

  const rows = defaults.map((d) => ({
    org_id: orgId,
    user_id: userId,
    user_email: userEmail,
    notification_type: d.type,
    subscribed: d.subscribed,
    mandatory: d.mandatory,
  }));

  const { error } = await supabase
    .from('notification_subscriptions')
    .upsert(rows, {
      onConflict: 'org_id,user_id,notification_type',
      ignoreDuplicates: true,
    });

  if (error) {
    console.error('[Notifications] Failed to seed defaults:', error);
  }
}
