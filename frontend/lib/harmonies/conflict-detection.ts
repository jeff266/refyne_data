/**
 * Harmony field conflict detection
 *
 * Checks if multiple harmonies are configured to write to the same field,
 * which can cause last-write-wins conflicts.
 */

import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface FieldConflict {
  harmonyId: string;
  harmonyName: string;
  canonicalField: string;
}

/**
 * Check if activating a harmony would conflict with other active harmonies
 * @param harmonyId - ID of harmony being activated
 * @param orgId - Organization ID
 * @returns Array of conflicts (empty if no conflicts)
 */
export async function checkFieldConflicts(
  harmonyId: string,
  orgId: string
): Promise<FieldConflict[]> {
  try {
    // Get field assignments for the harmony being activated
    const { data: activatingAssignments, error: assignError } = await supabaseAdmin
      .from('harmony_field_assignments')
      .select('canonical_field')
      .eq('harmony_id', harmonyId);

    if (assignError || !activatingAssignments || activatingAssignments.length === 0) {
      return [];
    }

    const targetFields = activatingAssignments.map((a) => a.canonical_field);

    // Find other active harmonies that write to the same fields
    const { data: conflicts, error: conflictError } = await supabaseAdmin
      .from('harmony_field_assignments')
      .select(`
        canonical_field,
        harmony_id,
        harmonies!inner (
          id,
          name,
          is_active,
          org_id
        )
      `)
      .in('canonical_field', targetFields)
      .neq('harmony_id', harmonyId);

    if (conflictError || !conflicts) {
      return [];
    }

    // Filter to only active harmonies in this org or global (org_id IS NULL)
    const activeConflicts = conflicts.filter((c: any) => {
      const harmony = c.harmonies;
      return (
        harmony.is_active &&
        (harmony.org_id === null || harmony.org_id === orgId)
      );
    });

    // Return unique conflicts (one per harmony)
    const uniqueConflicts = new Map<string, FieldConflict>();
    activeConflicts.forEach((c: any) => {
      const harmony = c.harmonies;
      if (!uniqueConflicts.has(harmony.id)) {
        uniqueConflicts.set(harmony.id, {
          harmonyId: harmony.id,
          harmonyName: harmony.name,
          canonicalField: c.canonical_field,
        });
      }
    });

    return Array.from(uniqueConflicts.values());
  } catch (error) {
    console.error('[Conflict Detection] Error checking field conflicts:', error);
    return [];
  }
}

/**
 * Get all active field conflicts for harmonies in an org
 * Used to show warning badges in harmonies list
 * @param orgId - Organization ID
 * @returns Map of harmonyId -> array of conflicts
 */
export async function getAllFieldConflicts(
  orgId: string
): Promise<Map<string, FieldConflict[]>> {
  try {
    // Get all active harmonies with their field assignments
    const { data: activeHarmonies, error: harmonyError } = await supabaseAdmin
      .from('harmonies')
      .select(`
        id,
        name,
        is_active,
        harmony_field_assignments (
          canonical_field
        )
      `)
      .eq('is_active', true)
      .or(`org_id.is.null,org_id.eq.${orgId}`);

    if (harmonyError || !activeHarmonies) {
      return new Map();
    }

    // Build map of field -> harmonies that write to it
    const fieldToHarmonies = new Map<string, Array<{ id: string; name: string }>>();

    activeHarmonies.forEach((harmony: any) => {
      const assignments = harmony.harmony_field_assignments || [];
      assignments.forEach((assignment: any) => {
        const field = assignment.canonical_field;
        if (!fieldToHarmonies.has(field)) {
          fieldToHarmonies.set(field, []);
        }
        fieldToHarmonies.get(field)!.push({
          id: harmony.id,
          name: harmony.name,
        });
      });
    });

    // Find conflicts (fields with multiple harmonies)
    const conflictsByHarmony = new Map<string, FieldConflict[]>();

    fieldToHarmonies.forEach((harmonies, field) => {
      if (harmonies.length > 1) {
        // Multiple harmonies write to this field - that's a conflict
        harmonies.forEach((harmony) => {
          if (!conflictsByHarmony.has(harmony.id)) {
            conflictsByHarmony.set(harmony.id, []);
          }

          // Add all other harmonies as conflicts
          const otherHarmonies = harmonies.filter((h) => h.id !== harmony.id);
          otherHarmonies.forEach((other) => {
            conflictsByHarmony.get(harmony.id)!.push({
              harmonyId: other.id,
              harmonyName: other.name,
              canonicalField: field,
            });
          });
        });
      }
    });

    return conflictsByHarmony;
  } catch (error) {
    console.error('[Conflict Detection] Error getting all conflicts:', error);
    return new Map();
  }
}
