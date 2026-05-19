/**
 * Get formatted rule explanation for a harmony transformation
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';

interface HarmonyYaml {
  id: string;
  name: string;
  ruleExplanation?: string;
  applies_to: {
    fields: string[];
    entity: string;
  };
}

const harmonyCache = new Map<string, HarmonyYaml>();

/**
 * Load harmony YAML by ID
 */
function loadHarmony(harmonyId: string): HarmonyYaml | null {
  // Check cache first
  if (harmonyCache.has(harmonyId)) {
    return harmonyCache.get(harmonyId)!;
  }

  const harmonyPath = path.join(
    process.cwd(),
    'lib',
    'harmonies',
    'library',
    `${harmonyId}.yaml`
  );

  if (!fs.existsSync(harmonyPath)) {
    console.warn(`[getRuleExplanation] Harmony file not found: ${harmonyId}`);
    return null;
  }

  try {
    const content = fs.readFileSync(harmonyPath, 'utf-8');
    const parsed = yaml.parse(content) as HarmonyYaml;

    // Cache it
    harmonyCache.set(harmonyId, parsed);

    return parsed;
  } catch (error) {
    console.error(`[getRuleExplanation] Failed to parse ${harmonyId}:`, error);
    return null;
  }
}

/**
 * Get formatted rule explanation for a harmony transformation.
 *
 * @param harmonyId - ID of the harmony (e.g., "company-name", "email")
 * @param field - Field being normalized (e.g., "company.name", "person.email")
 * @param oldValue - Original value before normalization
 * @param newValue - New value after normalization
 * @returns Formatted explanation string or null if not available
 *
 * @example
 * getRuleExplanation('company-name', 'company.name', 'ACME CORP', 'Acme Corp.')
 * // Returns: "Normalizing company name from 'ACME CORP' to 'Acme Corp.' (suffix standardization, title case)"
 */
export function getRuleExplanation(
  harmonyId: string,
  field: string,
  oldValue: string,
  newValue: string
): string | null {
  const harmony = loadHarmony(harmonyId);

  if (!harmony || !harmony.ruleExplanation) {
    return null;
  }

  // Replace template variables
  let explanation = harmony.ruleExplanation
    .replace(/\{\{oldValue\}\}/g, oldValue)
    .replace(/\{\{newValue\}\}/g, newValue)
    .replace(/\{\{field\}\}/g, field);

  return explanation;
}

/**
 * Clear the harmony cache (useful for testing)
 */
export function clearHarmonyCache(): void {
  harmonyCache.clear();
}
