/**
 * Settings Repository
 *
 * Data access layer for normalization settings and pipelines.
 * Provides a clean API with fallbacks when Supabase is not configured.
 */

import { supabase, isSupabaseConfigured } from './supabase';
import type {
  NormalizationMode,
  NormalizationSettingsRow,
  PipelineRow,
  PipelineInsert,
  PipelineUpdate,
  DedupSettingsRow,
  DedupFieldWeights,
} from './types';

/**
 * Default settings when no org settings exist.
 */
const DEFAULT_SETTINGS: NormalizationSettingsRow = {
  org_id: 'default',
  mode: 'explicit',
  updated_at: new Date().toISOString(),
};

/**
 * Default dedup settings per PRD.
 * Used when no org-specific settings exist.
 */
const DEFAULT_DEDUP_SETTINGS: DedupSettingsRow = {
  org_id: 'default',
  field_weights: {
    domain: 0.50,
    name: 0.25,
    phone: 0.10,
    industry: 0.08,
    employee_band: 0.07,
  },
  thresholds: {
    auto_merge: 0.90,
    review_min: 0.60,
  },
  blocking_key: 'domain',
  updated_at: new Date().toISOString(),
};

/**
 * Default pipeline when no org pipelines exist.
 */
const DEFAULT_PIPELINE: PipelineRow = {
  id: 'default',
  org_id: 'default',
  name: 'Default Pipeline',
  harmony_ids: [
    'company-name',
    'company-industry',
    'company-employees',
    'company-revenue',
    'person-name',
    'person-title',
  ],
  is_default: true,
  created_at: new Date().toISOString(),
};

// ─────────────────────────────────────────────────────────────
// Normalization Settings
// ─────────────────────────────────────────────────────────────

/**
 * Get normalization settings for an org.
 * Returns defaults if not found or Supabase not configured.
 */
export async function getSettings(orgId: string): Promise<NormalizationSettingsRow> {
  if (!isSupabaseConfigured() || !supabase) {
    return { ...DEFAULT_SETTINGS, org_id: orgId };
  }

  const { data, error } = await supabase
    .from('normalization_settings')
    .select('*')
    .eq('org_id', orgId)
    .single();

  if (error || !data) {
    return { ...DEFAULT_SETTINGS, org_id: orgId };
  }

  return data as NormalizationSettingsRow;
}

/**
 * Update normalization mode for an org.
 * Creates settings row if it doesn't exist.
 */
export async function setMode(orgId: string, mode: NormalizationMode): Promise<boolean> {
  if (!isSupabaseConfigured() || !supabase) {
    console.warn('Supabase not configured - mode change not persisted');
    return false;
  }

  const { error } = await supabase
    .from('normalization_settings')
    .upsert({
      org_id: orgId,
      mode,
      updated_at: new Date().toISOString(),
    });

  if (error) {
    console.error('Failed to update mode:', error);
    return false;
  }

  return true;
}

// ─────────────────────────────────────────────────────────────
// Pipelines
// ─────────────────────────────────────────────────────────────

/**
 * Get all pipelines for an org.
 */
export async function getPipelines(orgId: string): Promise<PipelineRow[]> {
  if (!isSupabaseConfigured() || !supabase) {
    return [{ ...DEFAULT_PIPELINE, org_id: orgId }];
  }

  const { data, error } = await supabase
    .from('pipelines')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false });

  if (error || !data || data.length === 0) {
    return [{ ...DEFAULT_PIPELINE, org_id: orgId }];
  }

  return data as PipelineRow[];
}

/**
 * Get the default pipeline for an org.
 */
export async function getDefaultPipeline(orgId: string): Promise<PipelineRow> {
  if (!isSupabaseConfigured() || !supabase) {
    return { ...DEFAULT_PIPELINE, org_id: orgId };
  }

  const { data, error } = await supabase
    .from('pipelines')
    .select('*')
    .eq('org_id', orgId)
    .eq('is_default', true)
    .single();

  if (error || !data) {
    // Try to get any pipeline for the org
    const pipelines = await getPipelines(orgId);
    return pipelines[0] || { ...DEFAULT_PIPELINE, org_id: orgId };
  }

  return data as PipelineRow;
}

/**
 * Get a pipeline by ID.
 */
export async function getPipeline(pipelineId: string): Promise<PipelineRow | null> {
  if (!isSupabaseConfigured() || !supabase) {
    if (pipelineId === 'default') {
      return DEFAULT_PIPELINE;
    }
    return null;
  }

  const { data, error } = await supabase
    .from('pipelines')
    .select('*')
    .eq('id', pipelineId)
    .single();

  if (error || !data) {
    return null;
  }

  return data as PipelineRow;
}

/**
 * Create a new pipeline.
 */
export async function createPipeline(pipeline: PipelineInsert): Promise<PipelineRow | null> {
  if (!isSupabaseConfigured() || !supabase) {
    console.warn('Supabase not configured - pipeline not created');
    return null;
  }

  // If setting as default, unset other defaults first
  if (pipeline.is_default) {
    await supabase
      .from('pipelines')
      .update({ is_default: false })
      .eq('org_id', pipeline.org_id)
      .eq('is_default', true);
  }

  const { data, error } = await supabase
    .from('pipelines')
    .insert(pipeline)
    .select()
    .single();

  if (error || !data) {
    console.error('Failed to create pipeline:', error);
    return null;
  }

  return data as PipelineRow;
}

/**
 * Update a pipeline.
 */
export async function updatePipeline(
  pipelineId: string,
  updates: PipelineUpdate
): Promise<boolean> {
  if (!isSupabaseConfigured() || !supabase) {
    console.warn('Supabase not configured - pipeline not updated');
    return false;
  }

  // If setting as default, unset other defaults first
  if (updates.is_default) {
    const pipeline = await getPipeline(pipelineId);
    if (pipeline) {
      await supabase
        .from('pipelines')
        .update({ is_default: false })
        .eq('org_id', pipeline.org_id)
        .eq('is_default', true)
        .neq('id', pipelineId);
    }
  }

  const { error } = await supabase
    .from('pipelines')
    .update(updates)
    .eq('id', pipelineId);

  if (error) {
    console.error('Failed to update pipeline:', error);
    return false;
  }

  return true;
}

/**
 * Delete a pipeline.
 */
export async function deletePipeline(pipelineId: string): Promise<boolean> {
  if (!isSupabaseConfigured() || !supabase) {
    console.warn('Supabase not configured - pipeline not deleted');
    return false;
  }

  const { error } = await supabase
    .from('pipelines')
    .delete()
    .eq('id', pipelineId);

  if (error) {
    console.error('Failed to delete pipeline:', error);
    return false;
  }

  return true;
}

/**
 * Set a pipeline as the default for its org.
 */
export async function setDefaultPipeline(pipelineId: string): Promise<boolean> {
  return updatePipeline(pipelineId, { is_default: true });
}

// ─────────────────────────────────────────────────────────────
// Dedup Settings
// ─────────────────────────────────────────────────────────────

/**
 * Get dedup settings for an org.
 * Returns defaults if not found or Supabase not configured.
 */
export async function getDedupSettings(orgId: string): Promise<DedupSettingsRow> {
  if (!isSupabaseConfigured() || !supabase) {
    return { ...DEFAULT_DEDUP_SETTINGS, org_id: orgId };
  }

  const { data, error } = await supabase
    .from('dedup_settings')
    .select('*')
    .eq('org_id', orgId)
    .single();

  if (error || !data) {
    return { ...DEFAULT_DEDUP_SETTINGS, org_id: orgId };
  }

  return data as DedupSettingsRow;
}

/**
 * Get dedup field weights for an org.
 * Returns just the weights for use in dedup gate.
 */
export async function getDedupFieldWeights(orgId: string): Promise<DedupFieldWeights> {
  const settings = await getDedupSettings(orgId);
  return settings.field_weights;
}

/**
 * Get default dedup settings (for use without database).
 */
export function getDefaultDedupSettings(): DedupSettingsRow {
  return { ...DEFAULT_DEDUP_SETTINGS };
}
