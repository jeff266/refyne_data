import { supabase } from '@/lib/db/supabase';

export interface HarmonyMapping {
  raw: string;
  mapped: string | null;
  confidence: 'high' | 'medium' | 'low' | 'no_match';
  naics_code?: string;
}

/**
 * Generate harmony mappings for a field using NAICS crosswalk + Claude fallback.
 * Checks for existing harmony first to avoid redundant Claude calls.
 */
export async function generateHarmonyForField(
  orgId: string,
  portalId: string,
  fieldKey: string,
  enrichedValues: string[],
  hubspotValidValues: string[]
): Promise<HarmonyMapping[]> {
  // Check if harmony already exists for this org+portal+field
  const existing = await getExistingHarmony(orgId, portalId, fieldKey);
  if (existing) {
    console.log(`[Harmony] Using existing harmony for ${fieldKey}`);
    return existing;
  }

  // Deduplicate enriched values
  const uniqueValues = Array.from(new Set(enrichedValues))
    .filter((v) => v && v.trim().length > 0)
    .slice(0, 100); // max 100 values to Claude

  if (uniqueValues.length === 0) {
    return [];
  }

  // Try NAICS crosswalk first (no Claude needed)
  const crosswalkMappings = await attemptCrosswalkMapping(
    uniqueValues,
    hubspotValidValues,
    fieldKey
  );

  // Values that crosswalk could not map
  const unmapped = uniqueValues.filter(
    (v) => !crosswalkMappings.find((m) => m.raw === v)
  );

  if (unmapped.length === 0) {
    // Crosswalk handled everything, no Claude needed
    await saveHarmony(orgId, portalId, fieldKey, crosswalkMappings);
    console.log(
      `[Harmony] Crosswalk mapped all ${uniqueValues.length} values for ${fieldKey}`
    );
    return crosswalkMappings;
  }

  // Call Claude only for unmapped values
  console.log(
    `[Harmony] Calling Claude for ${unmapped.length} unmapped values in ${fieldKey}`
  );
  const claudeMappings = await callClaudeForMapping(
    unmapped,
    hubspotValidValues,
    fieldKey
  );

  const allMappings = [...crosswalkMappings, ...claudeMappings];
  await saveHarmony(orgId, portalId, fieldKey, allMappings);

  console.log(
    `[Harmony] Generated harmony for ${fieldKey}: ${crosswalkMappings.length} from crosswalk, ${claudeMappings.length} from Claude`
  );

  return allMappings;
}

/**
 * Attempt to map values using the NAICS industry crosswalk table.
 * Only works for industry field.
 */
async function attemptCrosswalkMapping(
  values: string[],
  validOptions: string[],
  fieldKey: string
): Promise<HarmonyMapping[]> {
  if (fieldKey !== 'industry') {
    // Crosswalk only applies to industry field
    return [];
  }

  if (!supabase) {
    return [];
  }

  const mappings: HarmonyMapping[] = [];

  for (const value of values) {
    // Query industry_crosswalk for this value
    const { data, error } = await supabase.rpc('lookup_industry_crosswalk', {
      p_raw_value: value,
    });

    if (error) {
      // Skip silently if RPC doesn't exist - will fall back to Claude
      if (error.code === 'PGRST202') {
        continue;
      }
      console.error('[Harmony] Crosswalk lookup error:', error);
      continue;
    }

    if (data && data.length > 0) {
      const match = data[0];
      // Check if the output value is in the valid HubSpot options
      if (validOptions.includes(match.output)) {
        mappings.push({
          raw: value,
          mapped: match.output,
          confidence: 'high',
          naics_code: match.naics_code,
        });
      }
    }
  }

  return mappings;
}

/**
 * Call Claude API to map values that crosswalk could not handle.
 * Claude is called server-side only, API key never exposed to client.
 */
async function callClaudeForMapping(
  values: string[],
  validOptions: string[],
  fieldKey: string
): Promise<HarmonyMapping[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('[Harmony] ANTHROPIC_API_KEY not configured');
    return values.map((v) => ({
      raw: v,
      mapped: null,
      confidence: 'no_match',
    }));
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [
          {
            role: 'user',
            content: `Map these ${fieldKey} values to the closest valid HubSpot option.

Values to map:
${values.join('\n')}

Valid HubSpot options:
${validOptions.join('\n')}

Return JSON only. No other text. Format:
[{"raw": "input value", "mapped": "HUBSPOT_VALUE", "confidence": "high|medium|low|no_match"}]

If no good match exists, use "no_match" for mapped.`,
          },
        ],
      }),
    });

    if (!response.ok) {
      console.error('[Harmony] Claude API error:', response.status);
      return values.map((v) => ({
        raw: v,
        mapped: null,
        confidence: 'no_match',
      }));
    }

    const data = await response.json();
    let text = data.content[0].text.trim();

    // Strip markdown code fences if present
    if (text.startsWith('```json')) {
      text = text.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (text.startsWith('```')) {
      text = text.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    try {
      const parsed = JSON.parse(text) as HarmonyMapping[];
      return parsed.map((m) => ({
        ...m,
        mapped: m.confidence === 'no_match' ? null : m.mapped,
      }));
    } catch (err) {
      console.error('[Harmony] Claude returned invalid JSON:', text);
      console.error('[Harmony] Parse error:', err);
      return values.map((v) => ({
        raw: v,
        mapped: null,
        confidence: 'no_match',
      }));
    }
  } catch (error) {
    console.error('[Harmony] Claude API call failed:', error);
    return values.map((v) => ({
      raw: v,
      mapped: null,
      confidence: 'no_match',
    }));
  }
}

/**
 * Check if a harmony already exists for this org+portal+field combination.
 */
async function getExistingHarmony(
  orgId: string,
  portalId: string,
  fieldKey: string
): Promise<HarmonyMapping[] | null> {
  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from('field_mappings')
    .select('canonical_to_hubspot_map')
    .eq('org_id', orgId)
    .eq('canonical_field', fieldKey)
    .maybeSingle();

  if (error || !data || !data.canonical_to_hubspot_map) {
    return null;
  }

  // Convert map to HarmonyMapping array
  const map = data.canonical_to_hubspot_map as Record<string, string>;
  return Object.entries(map).map(([raw, mapped]) => ({
    raw,
    mapped,
    confidence: 'high', // Existing harmonies are assumed high confidence
  }));
}

/**
 * Save harmony to field_mappings table for future reuse.
 */
async function saveHarmony(
  orgId: string,
  portalId: string,
  fieldKey: string,
  mappings: HarmonyMapping[]
): Promise<void> {
  if (!supabase) {
    return;
  }

  // Convert HarmonyMapping array to map format
  const map: Record<string, string> = {};
  for (const m of mappings) {
    if (m.mapped) {
      map[m.raw] = m.mapped;
    }
  }

  // Upsert to field_mappings (skip if column doesn't exist yet)
  const { error } = await supabase
    .from('field_mappings')
    .upsert(
      {
        org_id: orgId,
        canonical_field: fieldKey,
        canonical_to_hubspot_map: map,
      },
      {
        onConflict: 'org_id,canonical_field',
      }
    );

  if (error) {
    // Skip silently if column doesn't exist - mappings still work in-memory
    if (error.code === 'PGRST204') {
      console.log('[Harmony] Skipping save (canonical_to_hubspot_map column not yet added to field_mappings)');
      return;
    }
    console.error('[Harmony] Failed to save harmony:', error);
  }
}

/**
 * Apply harmony to a raw value.
 * Returns the mapped value or null if no match found.
 */
export function applyHarmony(
  rawValue: string,
  mappings: HarmonyMapping[]
): string | null {
  const match = mappings.find((m) => m.raw === rawValue);
  return match?.mapped ?? null;
}

/**
 * Sanitize a CSV value to prevent formula injection.
 * Values starting with = + - @ are prefixed with a single quote.
 */
export function sanitizeCSVValue(value: string): string {
  if (!value) return value;
  const firstChar = value.trim()[0];
  if (firstChar === '=' || firstChar === '+' || firstChar === '-' || firstChar === '@') {
    return `'${value}`;
  }
  return value;
}
