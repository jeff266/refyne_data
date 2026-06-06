/**
 * Audit Log Types
 *
 * Type definitions for the audit_log table and Activity Log UI.
 */

import type { AuditAction } from '@/lib/audit/actions';

export interface AuditLogEvent {
  id: string;
  org_id: string;
  actor_id: string;
  actor_email: string | null;
  user_agent: string | null;
  action: AuditAction;
  object_type: string | null;
  object_id: string | null;
  object_label: string | null;
  // NOTE: before_state and after_state use Record<string, any> for flexibility
  // Different object types have different shapes - discriminated unions would
  // be over-engineering for v1
  before_state: Record<string, any> | null;
  after_state: Record<string, any> | null;
  metadata: Record<string, any> | null;
  ip_address: string | null;
  created_at: string; // ISO timestamp
}

export interface ActivityLogFilters {
  action?: string;
  actor?: string;
  date_from?: string; // ISO date
  date_to?: string; // ISO date
  page?: number;
  limit?: number;
}

export interface ActivityLogResponse {
  events: AuditLogEvent[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    hasNextPage: boolean;
  };
}

export interface GroupedEvents {
  dateLabel: string;
  events: AuditLogEvent[];
}

/**
 * Action display metadata for UI rendering
 * Maps action types to icons, colors, and labels
 */
export interface ActionDisplay {
  icon: string;
  color: string;
  label: string;
}

/**
 * Action display mappings
 * Uses design tokens (C.*) for colors
 */
export const ACTION_DISPLAY: Record<string, ActionDisplay> = {
  // Harmony actions
  'harmony.created': { icon: '✦', color: '#6366F1', label: 'Harmony created' },
  'harmony.updated': { icon: '✎', color: '#A1A1AA', label: 'Harmony updated' },
  'harmony.deactivated': { icon: '○', color: '#F59E0B', label: 'Harmony deactivated' },
  'harmony.archived': { icon: '□', color: '#71717A', label: 'Harmony archived' },
  'harmony.deleted': { icon: '×', color: '#EF4444', label: 'Harmony deleted' },
  'harmony.conditions.changed': { icon: '⚡', color: '#6366F1', label: 'Conditions updated' },
  'harmony.reference.added': { icon: '+', color: '#10B981', label: 'Reference data added' },
  'harmony.reference.deleted': { icon: '-', color: '#EF4444', label: 'Reference data removed' },

  // Dedup actions
  'dedup.merge_executed': { icon: '⇒', color: '#10B981', label: 'Cluster merged' },
  'dedup.cluster.rejected': { icon: '✗', color: '#71717A', label: 'Cluster rejected' },
  'dedup.scan.triggered': { icon: '⟳', color: '#6366F1', label: 'Dedup scan triggered' },
  'dedup_policy.updated': { icon: '⚙', color: '#F59E0B', label: 'Dedup policy updated' },

  // Normalize actions
  'normalize.applied': { icon: '↓', color: '#6366F1', label: 'Normalize applied' },
  'normalize.run.cancelled': { icon: '✗', color: '#71717A', label: 'Normalize cancelled' },

  // Enrichment actions
  'enrich_run.started': { icon: '→', color: '#6366F1', label: 'Enrichment started' },
  'enrich_run.applied': { icon: '✓', color: '#10B981', label: 'Enrichment applied' },

  // Taxonomy actions
  'taxonomy.pack.activated': { icon: '◈', color: '#6366F1', label: 'Taxonomy pack activated' },
  'taxonomy.suggestion.accepted': { icon: '+', color: '#10B981', label: 'Suggestion accepted' },
  'taxonomy.suggestion.rejected': { icon: '×', color: '#71717A', label: 'Suggestion rejected' },

  // Connection actions
  'connection.hubspot.connected': { icon: '⬡', color: '#10B981', label: 'HubSpot connected' },
  'connection.hubspot.disconnected': { icon: '⬡', color: '#EF4444', label: 'HubSpot disconnected' },
};

/**
 * Get action display metadata with fallback for unknown actions
 *
 * @param action - Audit action type
 * @returns Action display metadata
 */
export function getActionDisplay(action: string): ActionDisplay {
  if (ACTION_DISPLAY[action]) {
    return ACTION_DISPLAY[action];
  }

  // Fallback: Parse action string (e.g., "harmony.created" → "Harmony Created")
  const [object, verb] = action.split('.');
  const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  const label = verb
    ? `${capitalize(object)} ${verb.replace(/_/g, ' ')}`
    : capitalize(object);

  return {
    icon: '◦',
    color: '#71717A', // C.text3
    label,
  };
}

/**
 * Calculate field-level diff between before/after states
 *
 * NOTE: Only compares top-level keys using JSON.stringify.
 * This has limitations:
 * - Object key ordering can cause false positives
 * - Nested object changes shown as full replacement
 * - Date objects compared as ISO strings
 *
 * For v1, this simple approach is acceptable. Future versions
 * could use lodash isEqual for deep comparison.
 *
 * @param before - State before change
 * @param after - State after change
 * @returns Array of changed fields
 */
export function getDiff(
  before: Record<string, any> | null,
  after: Record<string, any> | null
): Array<{ key: string; before: any; after: any }> {
  const beforeObj = before ?? {};
  const afterObj = after ?? {};
  const allKeys = new Set([...Object.keys(beforeObj), ...Object.keys(afterObj)]);

  const changed: Array<{ key: string; before: any; after: any }> = [];

  for (const key of allKeys) {
    const beforeVal = beforeObj[key];
    const afterVal = afterObj[key];

    if (JSON.stringify(beforeVal) !== JSON.stringify(afterVal)) {
      changed.push({
        key,
        before: beforeVal !== undefined ? beforeVal : null,
        after: afterVal !== undefined ? afterVal : null
      });
    }
  }

  return changed;
}
