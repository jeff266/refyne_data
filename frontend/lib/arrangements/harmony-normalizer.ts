/**
 * Harmony Normalization for Arrangement Worker
 *
 * Applies harmony normalization to resolved field values before writing to HubSpot.
 */

import { supabase } from '../db/supabase';
import { extractHarmonyOutput, getEffectiveOutputFormat } from '../harmonies/output';

export interface HarmonyNormalizationOptions {
  orgId: string;
  harmonyId: string;
  rawValue: any;
  /**
   * Additional metadata for crosswalk lookups (e.g., NAICS code, provider name)
   */
  metadata?: {
    naics_code?: string | null;
    provider?: string;
  };
}

export interface HarmonyNormalizationResult {
  normalized: string | null;
  matched: boolean;
  harmonyId: string;
  outputFormat: string;
  raw: any;
}

/**
 * Normalize a field value using a harmony.
 *
 * Steps:
 * 1. Look up harmony from harmonies table
 * 2. Call lookup_harmony_value RPC
 * 3. Get output_format setting (org or harmony)
 * 4. Extract value using extractHarmonyOutput
 * 5. Return normalized string or null if no match
 */
export async function normalizeWithHarmony(
  options: HarmonyNormalizationOptions
): Promise<HarmonyNormalizationResult> {
  const { orgId, harmonyId, rawValue } = options;

  if (!supabase) {
    throw new Error('Database not configured');
  }

  try {
    // Step 1: Get harmony details
    const { data: harmony, error: harmonyError } = await supabase
      .from('harmonies')
      .select('*')
      .eq('id', harmonyId)
      .single();

    if (harmonyError || !harmony) {
      console.warn(`[Harmony Normalizer] Harmony ${harmonyId} not found`);
      return {
        normalized: null,
        matched: false,
        harmonyId,
        outputFormat: 'default',
        raw: rawValue,
      };
    }

    // Step 2: Call lookup RPC
    // For crosswalk-based harmonies, use the crosswalk RPC
    // For standard harmonies, use the harmony value lookup RPC
    let lookupResult: any;
    let lookupError: any;

    if (harmony.approach === 'crosswalk') {
      // Industry crosswalk lookup
      const result = await supabase.rpc('lookup_industry_crosswalk', {
        p_input_value: String(rawValue),
        p_naics_code: options.metadata?.naics_code || null,
        p_provider: options.metadata?.provider || null,
      });

      lookupError = result.error;
      // Crosswalk RPC returns array, convert to standard format
      if (result.data && result.data.length > 0) {
        const row = result.data[0];
        lookupResult = {
          matched: row.matched,
          output: row.output,
        };
      } else {
        lookupResult = { matched: false, output: null };
      }
    } else {
      // Standard harmony lookup
      const result = await supabase.rpc('lookup_harmony_value', {
        p_harmony_id: harmonyId,
        p_input_value: String(rawValue),
        p_org_id: orgId,
      });

      lookupError = result.error;
      lookupResult = result.data;
    }

    if (lookupError) {
      console.error(`[Harmony Normalizer] RPC lookup failed for ${harmonyId}:`, lookupError);
      // On RPC error, return raw value (don't fail the enrichment)
      return {
        normalized: null,
        matched: false,
        harmonyId,
        outputFormat: 'default',
        raw: rawValue,
      };
    }

    // If no match found, return raw value (don't skip the field)
    if (!lookupResult || !lookupResult.matched) {
      return {
        normalized: null,
        matched: false,
        harmonyId,
        outputFormat: 'default',
        raw: rawValue,
      };
    }

    // Step 3: Get output format setting
    // Check org-specific settings for library harmonies
    let orgSettings = null;
    if (harmony.is_preset) {
      const { data: orgSetting } = await supabase
        .from('harmony_org_settings')
        .select('output_format')
        .eq('org_id', orgId)
        .eq('harmony_id', harmonyId)
        .single();

      orgSettings = orgSetting;
    }

    const effectiveOutputFormat = getEffectiveOutputFormat(
      harmonyId,
      orgId,
      {
        output_format: harmony.output_format,
        is_preset: harmony.is_preset,
      },
      orgSettings
    );

    // Step 4: Extract value using output format
    // The harmony should declare available_formats in metadata
    const availableFormats = harmony.available_formats || [
      { key: 'default', label: 'Default', default: true },
    ];

    const extractedValue = extractHarmonyOutput(
      lookupResult.output,
      effectiveOutputFormat,
      availableFormats
    );

    return {
      normalized: extractedValue,
      matched: true,
      harmonyId,
      outputFormat: effectiveOutputFormat,
      raw: rawValue,
    };
  } catch (error) {
    console.error(`[Harmony Normalizer] Unexpected error for ${harmonyId}:`, error);
    // On unexpected error, return raw value (don't fail the enrichment)
    return {
      normalized: null,
      matched: false,
      harmonyId,
      outputFormat: 'default',
      raw: rawValue,
    };
  }
}
