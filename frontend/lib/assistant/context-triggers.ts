/**
 * Context Rebuild Triggers
 *
 * Fire-and-forget triggers for workspace context rebuilds.
 * Called from various API routes when configuration changes occur.
 */

import { buildWorkspaceContext } from './context-builder';

/**
 * Trigger context rebuild (fire-and-forget)
 * Safe to call from any route - non-blocking, never awaited
 */
export function triggerContextRebuild(orgId: string, source: string): void {
  buildWorkspaceContext(orgId, source).catch(err => {
    console.error(`[Context Trigger] Failed to rebuild context for ${orgId} (source: ${source}):`, err);
  });
}

/**
 * Integration points where triggerContextRebuild should be called:
 *
 * 1. Harmony changes: POST /api/harmonies, PATCH /api/harmonies/[id]
 *    Source: 'harmony_created' | 'harmony_updated'
 *
 * 2. Dedup config: PATCH /api/dedup/config
 *    Source: 'dedup_config_updated'
 *
 * 3. Provider connections: POST /api/connections, DELETE /api/connections/[id]
 *    Source: 'provider_connected' | 'provider_disconnected'
 *
 * 4. Survivorship rules: POST /api/settings/survivorship-rules, PATCH /api/settings/survivorship-rules/[id]
 *    Source: 'survivorship_rule_created' | 'survivorship_rule_updated'
 *
 * 5. Normalization settings: PUT /api/settings/normalization
 *    Source: 'normalization_mode_changed'
 *
 * 6. Onboarding calibration complete: POST /api/onboarding/dedup-calibration-complete
 *    Source: 'calibration_completed'
 */
