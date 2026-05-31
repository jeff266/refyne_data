/**
 * Harmony Field Assignments
 *
 * Manages the mapping between harmonies and fields per org.
 * Replaces the hardcoded DEFAULT_FIELD_MAPPINGS constant.
 */

import { supabase } from '@/lib/db/supabase';
import type { Harmony } from './normalization-engine';

export interface FieldAssignment {
  id: string;
  harmonyId: string;
  objectType: string;
  canonicalField: string;
  hubspotProperty: string;
  outputFormat: string | null;
  priority: number;
  harmony: Harmony;
}

interface DbFieldAssignment {
  id: string;
  org_id: string | null;
  harmony_id: string;
  object_type: string;
  canonical_field: string;
  hubspot_property: string;
  output_format: string | null;
  priority: number;
  harmony: any;
}

/**
 * Get field assignments for an org and object type.
 * Merges global defaults (org_id=null) with org-specific overrides.
 *
 * @param orgId - Organization ID
 * @param objectType - Object type ('company', 'contact', 'deal')
 * @returns Array of field assignments with harmonies
 */
export async function getFieldAssignments(
  orgId: string,
  objectType: 'company' | 'contact' | 'deal'
): Promise<FieldAssignment[]> {
  if (!supabase) {
    throw new Error('Supabase client not configured');
  }

  const { data, error } = await supabase
    .from('harmony_field_assignments')
    .select(`
      id,
      org_id,
      harmony_id,
      object_type,
      canonical_field,
      hubspot_property,
      output_format,
      priority,
      harmony:harmonies(
        id,
        name,
        field,
        object_type,
        transform_type,
        transform_function,
        transform_config,
        reference_table,
        fuzzy_threshold,
        phonetic_enabled,
        is_active,
        output_format,
        output_formats_available,
        is_preset
      )
    `)
    .or(`org_id.is.null,org_id.eq.${orgId}`)
    .eq('object_type', objectType)
    .eq('is_active', true)
    .order('priority', { ascending: true });

  if (error) {
    console.error('[Field Assignments] Query error:', error);
    throw error;
  }

  const assignments = (data || []) as DbFieldAssignment[];

  // Merge: org-specific overrides global for same harmony+field combo
  const merged = mergeAssignments(assignments, orgId);

  return merged;
}

/**
 * Merge global and org-specific assignments.
 * Org-specific assignments take precedence over global assignments.
 */
function mergeAssignments(
  assignments: DbFieldAssignment[],
  orgId: string
): FieldAssignment[] {
  const seen = new Map<string, DbFieldAssignment>();

  for (const assignment of assignments) {
    const key = `${assignment.harmony_id}:${assignment.canonical_field}`;
    const existing = seen.get(key);

    // Org-specific always wins over global (org_id=null)
    if (!existing || assignment.org_id === orgId) {
      seen.set(key, assignment);
    }
  }

  return Array.from(seen.values()).map((a) => ({
    id: a.id,
    harmonyId: a.harmony_id,
    objectType: a.object_type,
    canonicalField: a.canonical_field,
    hubspotProperty: a.hubspot_property,
    outputFormat: a.output_format,
    priority: a.priority,
    harmony: {
      id: a.harmony.id,
      name: a.harmony.name,
      field: a.harmony.field,
      objectType: a.harmony.object_type,
      transformType: a.harmony.transform_type,
      transformFunction: a.harmony.transform_function,
      transformConfig: a.harmony.transform_config,
      referenceTable: a.harmony.reference_table,
      fuzzyThreshold: a.harmony.fuzzy_threshold,
      phoneticEnabled: a.harmony.phonetic_enabled,
      isActive: a.harmony.is_active,
      outputFormat: a.harmony.output_format,
      outputFormatsAvailable: a.harmony.output_formats_available,
      isPreset: a.harmony.is_preset,
    },
  }));
}

/**
 * Build canonical→hubspot lookup map from field assignments.
 * Replaces DEFAULT_FIELD_MAPPINGS for the normalize flow.
 *
 * @param assignments - Field assignments
 * @returns Map of canonical field → HubSpot property
 */
export function buildFieldMap(
  assignments: FieldAssignment[]
): Map<string, string> {
  const map = new Map<string, string>();
  for (const a of assignments) {
    map.set(a.canonicalField, a.hubspotProperty);
  }
  return map;
}

/**
 * Build reverse map: HubSpot property → canonical field.
 * Used when mapping HubSpot API responses to canonical format.
 *
 * @param assignments - Field assignments
 * @returns Map of HubSpot property → canonical field
 */
export function buildReverseFieldMap(
  assignments: FieldAssignment[]
): Map<string, string> {
  const map = new Map<string, string>();
  for (const a of assignments) {
    map.set(a.hubspotProperty, a.canonicalField);
  }
  return map;
}
