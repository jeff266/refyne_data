/**
 * Database Types
 *
 * Type definitions for Supabase tables.
 */

export type NormalizationMode = 'implicit' | 'explicit';

// Re-export HubSpot types for convenience
export type {
  HubSpotConnectionRow,
  FieldMappingRow,
  FieldMappingDirection,
  WritePolicy,
} from '../hubspot/types';

/**
 * Row type for normalization_settings table.
 */
export interface NormalizationSettingsRow {
  org_id: string;
  mode: NormalizationMode;
  updated_at: string;
}

/**
 * Row type for pipelines table.
 */
export interface PipelineRow {
  id: string;
  org_id: string;
  name: string;
  harmony_ids: string[];
  is_default: boolean;
  created_at: string;
}

/**
 * Insert type for normalization_settings.
 */
export interface NormalizationSettingsInsert {
  org_id: string;
  mode?: NormalizationMode;
}

/**
 * Update type for normalization_settings.
 */
export interface NormalizationSettingsUpdate {
  mode?: NormalizationMode;
  updated_at?: string;
}

/**
 * Insert type for pipelines.
 */
export interface PipelineInsert {
  org_id: string;
  name: string;
  harmony_ids: string[];
  is_default?: boolean;
}

/**
 * Update type for pipelines.
 */
export interface PipelineUpdate {
  name?: string;
  harmony_ids?: string[];
  is_default?: boolean;
}

/**
 * Field weights for dedup similarity scoring.
 */
export interface DedupFieldWeights {
  domain: number;
  name: number;
  phone: number;
  industry: number;
  employee_band: number;
}

/**
 * Dedup thresholds.
 */
export interface DedupThresholds {
  auto_merge: number;
  review_min: number;
}

/**
 * Row type for dedup_settings table.
 */
export interface DedupSettingsRow {
  org_id: string;
  field_weights: DedupFieldWeights;
  thresholds: DedupThresholds;
  blocking_key: 'domain' | 'name' | 'both';
  updated_at: string;
}

/**
 * Full database schema type for Supabase client.
 */
export interface Database {
  public: {
    Tables: {
      normalization_settings: {
        Row: NormalizationSettingsRow;
        Insert: NormalizationSettingsInsert;
        Update: NormalizationSettingsUpdate;
      };
      pipelines: {
        Row: PipelineRow;
        Insert: PipelineInsert;
        Update: PipelineUpdate;
      };
      dedup_settings: {
        Row: DedupSettingsRow;
        Insert: Partial<DedupSettingsRow> & { org_id: string };
        Update: Partial<DedupSettingsRow>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      normalization_mode: NormalizationMode;
    };
  };
}
