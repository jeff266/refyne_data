/**
 * Database Module
 *
 * Exports Supabase client and repositories.
 */

export { supabase, isSupabaseConfigured } from './supabase';

export type {
  Database,
  NormalizationMode,
  NormalizationSettingsRow,
  PipelineRow,
  PipelineInsert,
  PipelineUpdate,
  DedupSettingsRow,
  DedupFieldWeights,
  DedupThresholds,
} from './types';

export {
  getSettings,
  setMode,
  getPipelines,
  getDefaultPipeline,
  getPipeline,
  createPipeline,
  updatePipeline,
  deletePipeline,
  setDefaultPipeline,
  getDedupSettings,
  getDedupFieldWeights,
  getDefaultDedupSettings,
} from './settings-repository';
