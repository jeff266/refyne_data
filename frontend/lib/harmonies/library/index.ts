/**
 * Harmony Library - Phase 7: Seed Harmony Library
 *
 * This module loads and exports all built-in Harmonies from YAML files.
 * Provides utilities for discovering Harmonies by ID or field.
 *
 * YAML files are bundled at build time via generated-bundle.ts to ensure
 * they're available in serverless environments (Vercel) where filesystem
 * access is restricted.
 */

import { parseHarmony, parseHarmonies } from '../spec/parser';
import type { ValidatedHarmony, HarmonySpec } from '../spec/schema';

// Import the pre-bundled YAML files (generated at build time)
// Falls back to filesystem for local dev/testing
let HARMONY_YAML_BUNDLE: Record<string, string> = {};
let LIBRARY_HARMONY_FILES: string[] = [];

// Synchronous initialization - try to load the bundle
function initializeBundle() {
  try {
    // Try to require the generated bundle (available after build)
    // Use require for synchronous loading
    const bundle = require('./generated-bundle');
    HARMONY_YAML_BUNDLE = bundle.HARMONY_YAML_BUNDLE;
    LIBRARY_HARMONY_FILES = bundle.HARMONY_YAML_FILES;
  } catch (err) {
    // Fallback for dev/test environments - use filesystem
    console.warn(
      'Generated bundle not found, falling back to filesystem. Run: npm run generate:harmonies'
    );

    try {
      const { readFileSync } = require('fs');
      const { join, dirname } = require('path');
      const { fileURLToPath } = require('url');

      const getLibraryDir = (): string => {
        try {
          if (typeof import.meta !== 'undefined' && import.meta.url) {
            return dirname(fileURLToPath(import.meta.url));
          }
        } catch {
          // Fall through
        }
        return __dirname;
      };

      const libraryDir = getLibraryDir();
      const files = [
        'company-name.yaml',
        'company-domain.yaml',
        'company-revenue.yaml',
        'company-employees.yaml',
        'company-industry.yaml',
        'person-name.yaml',
        'person-title.yaml',
        'phone.yaml',
        'email.yaml',
        'address-country.yaml',
        'address-state.yaml',
        'linkedin-url.yaml',
        'contact-name-case.yaml',
        'contact-phone-e164.yaml',
        'contact-title-standard.yaml',
        'contact-email-lower.yaml',
        'contact-location.yaml',
        'website-social-media.yaml',
      ];

      for (const filename of files) {
        try {
          const filepath = join(libraryDir, filename);
          const content = readFileSync(filepath, 'utf-8');
          HARMONY_YAML_BUNDLE[filename] = content;
          LIBRARY_HARMONY_FILES.push(filename);
        } catch (e) {
          console.error(`Failed to read ${filename}:`, e);
        }
      }
    } catch (fsErr) {
      console.error('Failed to initialize harmony bundle:', fsErr);
    }
  }
}

// Initialize on module load
initializeBundle();

/**
 * Cache for loaded Harmonies to avoid re-parsing.
 */
let cachedHarmonies: ValidatedHarmony[] | null = null;
let cachedByIdMap: Map<string, ValidatedHarmony> | null = null;
let cachedByFieldMap: Map<string, ValidatedHarmony[]> | null = null;

/**
 * Load a single Harmony YAML file from the library.
 *
 * @param filename - Name of the YAML file
 * @returns ParseResult with the validated Harmony or errors
 */
export function loadHarmonyFile(filename: string): ValidatedHarmony | null {
  try {
    const content = HARMONY_YAML_BUNDLE[filename];
    if (!content) {
      console.error(`YAML file not found in bundle: ${filename}`);
      return null;
    }

    const result = parseHarmony(content, { source: 'library' });

    if (result.success && result.harmony) {
      return result.harmony;
    }

    console.error(`Failed to parse ${filename}:`, result.errors);
    return null;
  } catch (err) {
    console.error(`Failed to load ${filename}:`, err);
    return null;
  }
}

/**
 * Load all library Harmonies from YAML files.
 * Results are cached after first load.
 *
 * @param forceReload - Force reloading from bundle
 * @returns Array of validated Harmonies
 */
export function loadLibraryHarmonies(forceReload = false): ValidatedHarmony[] {
  if (cachedHarmonies && !forceReload) {
    return cachedHarmonies;
  }

  const yamls: Array<{ name: string; content: string }> = [];

  for (const filename of LIBRARY_HARMONY_FILES) {
    const content = HARMONY_YAML_BUNDLE[filename];
    if (content) {
      yamls.push({ name: filename, content });
    } else {
      console.error(`YAML file missing from bundle: ${filename}`);
    }
  }

  const { harmonies, errors, warnings } = parseHarmonies(yamls, {
    source: 'library',
  });

  // Log any errors or warnings
  if (errors.length > 0) {
    console.error('Library Harmony parse errors:', errors);
  }
  if (warnings.length > 0) {
    console.warn('Library Harmony warnings:', warnings);
  }

  // Cache the results
  cachedHarmonies = harmonies;
  cachedByIdMap = null; // Clear derived caches
  cachedByFieldMap = null;

  return harmonies;
}

/**
 * Get all library Harmonies (pre-loaded and cached).
 */
export function getLibraryHarmonies(): ValidatedHarmony[] {
  return loadLibraryHarmonies();
}

/**
 * Alias for getLibraryHarmonies - exported constant.
 */
export const LIBRARY_HARMONIES: ValidatedHarmony[] = [];

// Initialize LIBRARY_HARMONIES on module load (lazy)
let initialized = false;
export function ensureInitialized(): void {
  if (!initialized) {
    const harmonies = loadLibraryHarmonies();
    LIBRARY_HARMONIES.length = 0;
    LIBRARY_HARMONIES.push(...harmonies);
    initialized = true;
  }
}

/**
 * Get a Harmony by its unique ID.
 *
 * @param id - Harmony ID to look up
 * @returns The Harmony if found, undefined otherwise
 */
export function getHarmonyById(id: string): ValidatedHarmony | undefined {
  ensureInitialized();

  // Build ID map if not cached
  if (!cachedByIdMap) {
    cachedByIdMap = new Map();
    for (const harmony of LIBRARY_HARMONIES) {
      cachedByIdMap.set(harmony.spec.id, harmony);
    }
  }

  return cachedByIdMap.get(id);
}

/**
 * Get all Harmonies that apply to a specific field.
 *
 * @param field - Canonical field path (e.g., 'company.name')
 * @returns Array of Harmonies that target this field
 */
export function getHarmoniesForField(field: string): ValidatedHarmony[] {
  ensureInitialized();

  // Build field map if not cached
  if (!cachedByFieldMap) {
    cachedByFieldMap = new Map();
    for (const harmony of LIBRARY_HARMONIES) {
      for (const targetField of harmony.spec.applies_to.fields) {
        const existing = cachedByFieldMap.get(targetField) || [];
        existing.push(harmony);
        cachedByFieldMap.set(targetField, existing);
      }
    }
  }

  return cachedByFieldMap.get(field) || [];
}

/**
 * Get all Harmonies for a specific category.
 *
 * @param category - Harmony category
 * @returns Array of Harmonies in that category
 */
export function getHarmoniesByCategory(
  category: HarmonySpec['category']
): ValidatedHarmony[] {
  ensureInitialized();
  return LIBRARY_HARMONIES.filter((h) => h.spec.category === category);
}

/**
 * Get all Harmonies for a specific entity type.
 *
 * @param entity - Entity type ('company' or 'person')
 * @returns Array of Harmonies for that entity
 */
export function getHarmoniesByEntity(
  entity: 'company' | 'person'
): ValidatedHarmony[] {
  ensureInitialized();
  return LIBRARY_HARMONIES.filter((h) => h.spec.applies_to.entity === entity);
}

/**
 * Search Harmonies by tags.
 *
 * @param tags - Tags to search for (matches any)
 * @returns Array of Harmonies with matching tags
 */
export function searchHarmoniesByTags(tags: string[]): ValidatedHarmony[] {
  ensureInitialized();
  const tagSet = new Set(tags.map((t) => t.toLowerCase()));

  return LIBRARY_HARMONIES.filter((h) => {
    const harmonyTags = h.spec.tags || [];
    return harmonyTags.some((t) => tagSet.has(t.toLowerCase()));
  });
}

/**
 * Get a summary of all library Harmonies.
 */
export function getLibrarySummary(): {
  total: number;
  byCategory: Record<string, number>;
  byEntity: Record<string, number>;
  harmonies: Array<{
    id: string;
    name: string;
    category: string;
    fields: string[];
  }>;
} {
  ensureInitialized();

  const byCategory: Record<string, number> = {};
  const byEntity: Record<string, number> = {};

  for (const harmony of LIBRARY_HARMONIES) {
    // Count by category
    const cat = harmony.spec.category;
    byCategory[cat] = (byCategory[cat] || 0) + 1;

    // Count by entity
    const entity = harmony.spec.applies_to.entity || 'any';
    byEntity[entity] = (byEntity[entity] || 0) + 1;
  }

  return {
    total: LIBRARY_HARMONIES.length,
    byCategory,
    byEntity,
    harmonies: LIBRARY_HARMONIES.map((h) => ({
      id: h.spec.id,
      name: h.spec.name,
      category: h.spec.category,
      fields: h.spec.applies_to.fields,
    })),
  };
}

/**
 * Clear all caches (useful for testing).
 */
export function clearLibraryCache(): void {
  cachedHarmonies = null;
  cachedByIdMap = null;
  cachedByFieldMap = null;
  LIBRARY_HARMONIES.length = 0;
  initialized = false;
}
