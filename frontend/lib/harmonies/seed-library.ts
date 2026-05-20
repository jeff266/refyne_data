/**
 * Harmony Library Seeder
 *
 * Reads all YAML harmony files from lib/harmonies/library/
 * and upserts them to the harmonies table as preset harmonies.
 *
 * Run on app startup and deployment to ensure library is in sync.
 */

import { supabase, isSupabaseConfigured } from '@/lib/db/supabase';
import { getLibraryHarmonies } from './library';

export interface HarmonyRow {
  id: string;
  org_id: null;
  name: string;
  description: string | null;
  field: string;
  object_type: 'company' | 'contact' | 'person';
  category: string | null;
  is_preset: boolean;
  is_active: boolean;
  rule_count: number;
  yaml_content: string | null;
  examples?: Array<{ input: any; output: any }> | null;
  output_format?: string;
  output_formats_available?: Array<{ key: string; label: string; default?: boolean }> | null;
  created_at?: string;
  updated_at?: string;
}

/**
 * Seed preset harmonies from YAML library to database.
 * Upserts harmonies so updates to YAML files are reflected in DB.
 */
export async function seedHarmonyLibrary(): Promise<{
  success: boolean;
  seededCount: number;
  errors: string[];
}> {
  if (!isSupabaseConfigured() || !supabase) {
    return {
      success: false,
      seededCount: 0,
      errors: ['Supabase not configured'],
    };
  }

  const errors: string[] = [];
  let seededCount = 0;

  try {
    // Load all harmonies from YAML library
    const harmonies = getLibraryHarmonies();

    console.log(`[Harmony Seeder] Loading ${harmonies.length} preset harmonies...`);

    // Convert each harmony to database row format
    const rows: HarmonyRow[] = harmonies.map((h) => {
      const spec = h.spec;
      const field = spec.applies_to.fields[0] || 'unknown';
      const objectType = spec.applies_to.entity === 'person' ? 'contact' : 'company';

      // Extract examples from tests (first 5 non-null/empty tests)
      const examples = spec.tests
        ?.filter((t) => t.input !== null && t.input !== '')
        .slice(0, 5)
        .map((t) => ({
          input: t.input,
          output: t.expected,
        })) || [];

      return {
        id: spec.id,
        org_id: null, // Preset harmonies have null org_id
        name: spec.name,
        description: spec.description || null,
        field,
        object_type: objectType,
        category: spec.category || null,
        is_preset: true,
        is_active: spec.default_enabled !== false, // Default to active unless explicitly disabled
        rule_count: spec.rules?.length || 0,
        yaml_content: null, // Optional: could store full YAML here if needed
        examples: examples.length > 0 ? examples : null,
        output_format: 'default',
        output_formats_available: spec.output_formats || null,
      };
    });

    // Upsert in batches of 50
    const batchSize = 50;
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);

      const { error } = await supabase.from('harmonies').upsert(batch, {
        onConflict: 'id',
        ignoreDuplicates: false,
      });

      if (error) {
        const msg = `Failed to upsert batch ${i / batchSize + 1}: ${error.message}`;
        errors.push(msg);
        console.error(`[Harmony Seeder] ${msg}`);
      } else {
        seededCount += batch.length;
      }
    }

    if (errors.length === 0) {
      console.log(`[Harmony Seeder] ✅ Successfully seeded ${seededCount} preset harmonies`);
    } else {
      console.error(`[Harmony Seeder] ⚠️  Seeded ${seededCount} harmonies with ${errors.length} errors`);
    }

    return {
      success: errors.length === 0,
      seededCount,
      errors,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Harmony Seeder] Failed to seed library:`, error);
    return {
      success: false,
      seededCount,
      errors: [msg],
    };
  }
}

/**
 * Seed harmonies on module load (server-side only).
 * This runs once when the module is first imported.
 */
if (typeof window === 'undefined') {
  // Only run on server-side
  seedHarmonyLibrary().catch((err) => {
    console.error('[Harmony Seeder] Failed to auto-seed on module load:', err);
  });
}
