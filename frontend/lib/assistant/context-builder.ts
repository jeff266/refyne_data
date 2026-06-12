/**
 * Workspace Context Builder
 *
 * Two-phase context generation:
 * 1. assembleRawFacts() - Fetch structured data from database
 * 2. interpretContext() - Call Sonnet 4.6 to generate natural language summary
 *
 * Context cached in workspace_context table with delta-based rebuilds.
 */

import Anthropic from '@anthropic-ai/sdk';
import crypto from 'crypto';
import { supabaseAdmin } from '@/lib/db/admin-client';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

const CONTEXT_MODEL = 'claude-sonnet-4-6-20241022';

export interface RawFacts {
  hubspot_connection: {
    connected: boolean;
    portal_id?: string;
    portal_name?: string;
    connected_since?: string;
  };
  active_harmonies: Array<{
    field: string;
    object_type: string;
    hubspot_property: string;
  }>;
  dedup_config: {
    auto_merge: boolean;
    auto_merge_grade?: string;
    scan_trigger?: string;
  };
  normalization_mode: 'implicit' | 'explicit';
  enrichment_providers: string[];
  recent_activity: {
    normalize_runs: number;
    dedup_scans: number;
  };
  survivorship_rules_count: number;
  open_clusters_count: number;
}

/**
 * Phase 1: Assemble raw facts from database
 */
export async function assembleRawFacts(orgId: string): Promise<RawFacts> {
  const facts: Partial<RawFacts> = {};

  // 1. HubSpot connection status
  const { data: connections } = await supabaseAdmin
    .from('hubspot_connections')
    .select('portal_id, name, connection_status, connected_at')
    .eq('org_id', orgId);

  facts.hubspot_connection = connections?.[0] ? {
    connected: true,
    portal_id: connections[0].portal_id,
    portal_name: connections[0].name,
    connected_since: connections[0].connected_at,
  } : { connected: false };

  // 2. Active harmonies
  const { data: harmonies } = await supabaseAdmin
    .from('harmony_field_assignments')
    .select('harmony_id, object_type, canonical_field, hubspot_property, is_active')
    .eq('org_id', orgId)
    .eq('is_active', true);

  facts.active_harmonies = harmonies?.map(h => ({
    field: h.canonical_field,
    object_type: h.object_type,
    hubspot_property: h.hubspot_property,
  })) || [];

  // 3. Dedup configuration
  const { data: dedupConfig } = await supabaseAdmin
    .from('dedup_config')
    .select('auto_merge_grade, review_floor_threshold, scan_trigger')
    .eq('org_id', orgId)
    .single();

  facts.dedup_config = dedupConfig ? {
    auto_merge: dedupConfig.auto_merge_grade !== 'disabled' && dedupConfig.auto_merge_grade !== null,
    auto_merge_grade: dedupConfig.auto_merge_grade || undefined,
    scan_trigger: dedupConfig.scan_trigger || undefined,
  } : { auto_merge: false };

  // 4. Normalization mode
  const { data: normSettings } = await supabaseAdmin
    .from('normalization_settings')
    .select('mode')
    .eq('org_id', orgId)
    .single();

  facts.normalization_mode = normSettings?.mode || 'explicit';

  // 5. Provider connections
  const { data: providers } = await supabaseAdmin
    .from('provider_keys')
    .select('provider_name, is_active')
    .eq('org_id', orgId)
    .eq('is_active', true);

  facts.enrichment_providers = providers?.map(p => p.provider_name) || [];

  // 6. Recent activity (last 7 days)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const { count: recentNormalizeRuns } = await supabaseAdmin
    .from('normalization_runs')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .gte('created_at', sevenDaysAgo.toISOString());

  const { count: recentDedupScans } = await supabaseAdmin
    .from('dedup_scan_runs')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .gte('created_at', sevenDaysAgo.toISOString());

  facts.recent_activity = {
    normalize_runs: recentNormalizeRuns || 0,
    dedup_scans: recentDedupScans || 0,
  };

  // 7. Survivorship rules count
  const { count: survivorshipRules } = await supabaseAdmin
    .from('dedup_survivorship_rules')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', orgId);

  facts.survivorship_rules_count = survivorshipRules || 0;

  // 8. Open clusters count
  const { count: openClusters } = await supabaseAdmin
    .from('dedup_clusters')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .eq('status', 'open');

  facts.open_clusters_count = openClusters || 0;

  return facts as RawFacts;
}

/**
 * Phase 2: Interpret raw facts with Sonnet
 */
export async function interpretContext(rawFacts: RawFacts): Promise<string> {
  const prompt = `You are analyzing a Refyne workspace configuration to build context for an AI assistant.

Raw facts:
${JSON.stringify(rawFacts, null, 2)}

Generate a concise context summary (150-300 words) covering:
1. HubSpot connection status and portal info
2. Active data quality features (harmonies, dedup, enrichment)
3. Configuration preferences (normalization mode, auto-merge settings)
4. Recent activity patterns
5. Any notable gaps or recommendations

Format as natural language context that an assistant can use to answer user questions.
Write in a conversational tone, as if briefing a support agent.`;

  const response = await anthropic.messages.create({
    model: CONTEXT_MODEL,
    max_tokens: 500,
    messages: [{ role: 'user', content: prompt }],
  });

  const content = response.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response type from Sonnet');
  }

  return content.text;
}

/**
 * Compute hash of raw facts for delta detection
 */
export function computeContextHash(rawFacts: RawFacts): string {
  const json = JSON.stringify(rawFacts, Object.keys(rawFacts).sort());
  return crypto.createHash('sha256').update(json).digest('hex');
}

/**
 * Check if rebuild is needed (delta check)
 */
export async function shouldRebuildContext(orgId: string, newFacts: RawFacts): Promise<boolean> {
  const { data: existing } = await supabaseAdmin
    .from('workspace_context')
    .select('context_hash')
    .eq('org_id', orgId)
    .single();

  if (!existing) return true;

  const newHash = computeContextHash(newFacts);
  return newHash !== existing.context_hash;
}

/**
 * Full context build and store
 */
export async function buildWorkspaceContext(orgId: string, triggeredBy?: string): Promise<string> {
  console.log(`[Context Build] Starting for org ${orgId}`);

  // Phase 1: Assemble raw facts
  const rawFacts = await assembleRawFacts(orgId);

  // Delta check
  const needsRebuild = await shouldRebuildContext(orgId, rawFacts);
  if (!needsRebuild) {
    console.log(`[Context Build] No significant changes, skipping rebuild`);

    // Return existing context
    const { data: existing } = await supabaseAdmin
      .from('workspace_context')
      .select('interpreted_context')
      .eq('org_id', orgId)
      .single();

    return existing?.interpreted_context || '';
  }

  // Phase 2: Interpret with Sonnet
  const interpretedContext = await interpretContext(rawFacts);
  const contextHash = computeContextHash(rawFacts);

  // Get current version
  const { data: current } = await supabaseAdmin
    .from('workspace_context')
    .select('version')
    .eq('org_id', orgId)
    .single();

  const newVersion = (current?.version || 0) + 1;

  // Store in database
  const { error } = await supabaseAdmin
    .from('workspace_context')
    .upsert({
      org_id: orgId,
      raw_facts: rawFacts,
      interpreted_context: interpretedContext,
      context_hash: contextHash,
      built_by: triggeredBy || 'system',
      version: newVersion,
      built_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'org_id' });

  if (error) {
    console.error('[Context Build] Failed to store context:', error);
    throw error;
  }

  console.log(`[Context Build] Completed for org ${orgId}, version ${newVersion}`);
  return interpretedContext;
}
