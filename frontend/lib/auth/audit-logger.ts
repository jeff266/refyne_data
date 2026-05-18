/**
 * Audit Logger
 *
 * Fire-and-forget logging to org_events table.
 * Does not block the response if audit insert fails.
 */

import { supabase } from '@/lib/db/supabase';

type AuditAction =
  | 'member_invited'
  | 'member_removed'
  | 'role_changed'
  | 'ownership_transferred'
  | 'agency_offboarded'
  | 'org_created'
  | 'policy_changed'
  | 'limit_changed';

interface LogAuditEventParams {
  orgId: string;
  actorId: string;
  action: AuditAction;
  targetId?: string;
  metadata?: any;
}

/**
 * Log an audit event to org_events table.
 * Fire-and-forget - does not throw errors or block execution.
 *
 * @param params Event parameters
 */
export function logAuditEvent(params: LogAuditEventParams): void {
  if (!supabase) {
    return;
  }

  const { orgId, actorId, action, targetId, metadata } = params;

  // Fire and forget - use void to ignore promise
  void (async () => {
    try {
      const { error } = await supabase
        .from('org_events')
        .insert({
          org_id: orgId,
          actor_id: actorId,
          action,
          target_id: targetId || null,
          metadata: metadata || null,
        });

      if (error) {
        console.error('[Audit] Failed to log event:', action, error);
      }
    } catch (err) {
      console.error('[Audit] Exception logging event:', action, err);
    }
  })();
}
