// Industry classifier
// Converts raw industry strings from DeepSeek/Haiku extraction
// into canonical HubSpot picklist values via NAICS crosswalk.
//
// Flow:
//   raw string → NAICS lookup (exact/fuzzy) → hubspot_value
//   If crosswalk miss → Haiku classifier → NAICS code → cache → hubspot_value
//
// Cost: one Haiku call per unknown raw industry string, ever.
// Subsequent calls for the same string are free crosswalk lookups.

import { createClient, SupabaseClient } from '@supabase/supabase-js'

const ANTHROPIC_API_KEY =
  process.env.ANTHROPIC_API_KEY || process.env.REFYNE_ANTHROPIC_KEY

const HAIKU_MODEL = 'claude-haiku-4-5-20251001'

// Lazy initialization to avoid build-time errors
let supabaseClient: SupabaseClient | null = null

function getSupabase(): SupabaseClient {
  if (!supabaseClient) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    supabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  }
  return supabaseClient
}

export interface ClassifiedIndustry {
  hubspotValue: string        // e.g. 'MENTAL_HEALTH_CARE'
  hubspotLabel: string        // e.g. 'Mental Health Care'
  naicsCode: string           // e.g. '621340'
  naicsLabel: string          // e.g. 'Offices of Other Mental Health Practitioners'
  confidence: number          // passed through from extraction
  source: 'crosswalk_exact' | 'crosswalk_fuzzy' | 'haiku_classified' | 'unknown'
}

/**
 * Split compound industry strings into individual components.
 * Handles: slash-separated, dash-separated, pipe-separated
 * Examples:
 *   "ABA Therapy / Healthcare - Behavioral Health"
 *     → ["ABA Therapy", "Healthcare", "Behavioral Health"]
 *   "Mental Health Care | Behavioral Services"
 *     → ["Mental Health Care", "Behavioral Services"]
 */
function extractComponents(rawValue: string): string[] {
  return rawValue
    .split(/[\/\|]/)                    // split on / and |
    .flatMap(part => part.split(' - ')) // split each part on ' - '
    .map(s => s.trim())
    .filter(s => s.length > 3)         // drop short fragments
    .filter((s, i, arr) => arr.indexOf(s) === i) // deduplicate
}

/**
 * Get trust level for a classification source.
 * crosswalk_exact: high (direct match in NAICS table)
 * crosswalk_fuzzy: medium (keyword match)
 * haiku_classified: low (LLM classification, requires review)
 */
export function getSourceTrustLevel(
  source: ClassifiedIndustry['source']
): 'high' | 'medium' | 'low' {
  switch (source) {
    case 'crosswalk_exact': return 'high'
    case 'crosswalk_fuzzy': return 'medium'
    case 'haiku_classified': return 'low'
    default: return 'low'
  }
}

/**
 * Main entry point.
 * Takes a raw industry string from extraction and returns a canonical HubSpot value.
 * Returns null if classification fails completely.
 */
export async function classifyIndustry(
  rawValue: string,
  confidence: number
): Promise<ClassifiedIndustry | null> {
  if (!rawValue || rawValue.trim().length === 0) return null

  const normalized = rawValue.trim().toLowerCase()

  // Step 1: Try full string exact match
  const exactMatch = await crosswalkLookupByLabel(normalized)
  if (exactMatch) {
    return { ...exactMatch, confidence, source: 'crosswalk_exact' }
  }

  // Step 2: Try full string fuzzy match
  const fuzzyMatch = await crosswalkFuzzyLookup(normalized)
  if (fuzzyMatch) {
    return { ...fuzzyMatch, confidence, source: 'crosswalk_fuzzy' }
  }

  // Step 3: Try each component of compound strings
  const components = extractComponents(rawValue)
  if (components.length > 1) {
    console.log(`[Industry] Compound value detected: "${rawValue}" → ${components.length} components`)

    for (const component of components) {
      const componentNorm = component.toLowerCase()

      const compExact = await crosswalkLookupByLabel(componentNorm)
      if (compExact) {
        console.log(`[Industry] Component exact match: "${component}" → ${compExact.hubspotValue}`)
        return { ...compExact, confidence, source: 'crosswalk_exact' }
      }

      const compFuzzy = await crosswalkFuzzyLookup(componentNorm)
      if (compFuzzy) {
        console.log(`[Industry] Component fuzzy match: "${component}" → ${compFuzzy.hubspotValue}`)
        return { ...compFuzzy, confidence, source: 'crosswalk_fuzzy' }
      }
    }
  }

  // Step 4: Haiku classifier on full string (last resort)
  const classified = await classifyWithHaiku(rawValue)
  if (!classified) return null

  const crosswalkResult = await crosswalkLookupByCode(classified.naicsCode)
  if (!crosswalkResult) {
    // NAICS code from Haiku not in our crosswalk - return unknown
    console.warn(
      `[Industry] Haiku returned NAICS ${classified.naicsCode} not in crosswalk for: "${rawValue}"`
    )
    return null
  }

  // Cache the new mapping so this raw string never hits Haiku again
  await cacheNewMapping(rawValue, classified.naicsCode, crosswalkResult.hubspotValue)

  console.log(`[Industry] Haiku classified: "${rawValue}" → ${crosswalkResult.hubspotValue} (low trust - requires review)`)

  return {
    ...crosswalkResult,
    confidence,
    source: 'haiku_classified',
  }
}

// ── Crosswalk lookups ─────────────────────────────────────────────────────────

async function crosswalkLookupByLabel(
  normalizedLabel: string
): Promise<Omit<ClassifiedIndustry, 'confidence' | 'source'> | null> {
  const { data } = await getSupabase()
    .from('industry_crosswalk')
    .select('naics_code, naics_label, hubspot_value, apollo_label')
    .or(
      `naics_label.ilike.%${normalizedLabel}%,apollo_label.ilike.%${normalizedLabel}%`
    )
    .eq('is_primary', true)
    .limit(1)
    .single()

  if (!data) return null

  return {
    hubspotValue: data.hubspot_value,
    hubspotLabel: toHubspotLabel(data.hubspot_value),
    naicsCode: data.naics_code,
    naicsLabel: data.naics_label,
  }
}

async function crosswalkFuzzyLookup(
  normalizedLabel: string
): Promise<Omit<ClassifiedIndustry, 'confidence' | 'source'> | null> {
  // Extract key words for matching (remove common stop words)
  const keywords = normalizedLabel
    .replace(/\b(and|of|the|for|in|at|by|to|a|an|services|service)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter((w) => w.length > 3)
    .slice(0, 3) // top 3 keywords

  if (keywords.length === 0) return null

  // Try matching on first keyword
  const { data } = await getSupabase()
    .from('industry_crosswalk')
    .select('naics_code, naics_label, hubspot_value, apollo_label')
    .ilike('naics_label', `%${keywords[0]}%`)
    .eq('is_primary', true)
    .limit(1)
    .single()

  if (!data) return null

  return {
    hubspotValue: data.hubspot_value,
    hubspotLabel: toHubspotLabel(data.hubspot_value),
    naicsCode: data.naics_code,
    naicsLabel: data.naics_label,
  }
}

async function crosswalkLookupByCode(
  naicsCode: string
): Promise<Omit<ClassifiedIndustry, 'confidence' | 'source'> | null> {
  const { data } = await getSupabase()
    .from('industry_crosswalk')
    .select('naics_code, naics_label, hubspot_value')
    .eq('naics_code', naicsCode)
    .eq('is_primary', true)
    .limit(1)
    .single()

  if (!data) return null

  return {
    hubspotValue: data.hubspot_value,
    hubspotLabel: toHubspotLabel(data.hubspot_value),
    naicsCode: data.naics_code,
    naicsLabel: data.naics_label,
  }
}

// ── Haiku classifier ──────────────────────────────────────────────────────────

interface HaikuClassification {
  naicsCode: string
  naicsLabel: string
  confidence: number
}

async function classifyWithHaiku(
  rawValue: string
): Promise<HaikuClassification | null> {
  if (!ANTHROPIC_API_KEY) {
    console.warn('[Industry] No Anthropic API key for Haiku classifier')
    return null
  }

  // Fetch all NAICS codes from crosswalk to give Haiku a bounded set
  const { data: crosswalkRows } = await getSupabase()
    .from('industry_crosswalk')
    .select('naics_code, naics_label')
    .eq('is_primary', true)
    .order('naics_code')

  if (!crosswalkRows || crosswalkRows.length === 0) return null

  const naicsList = crosswalkRows
    .map((r) => `${r.naics_code}: ${r.naics_label}`)
    .join('\n')

  const prompt = `You are an industry classification specialist.

Given a raw industry description, return the single best matching NAICS code from the list below.

Raw industry description: "${rawValue}"

Available NAICS codes:
${naicsList}

Return ONLY valid JSON, no other text:
{
  "naics_code": "621340",
  "naics_label": "Offices of Other Mental Health Practitioners",
  "confidence": 0.92
}

Rules:
- Return the single best match only
- confidence: 0.9+ for clear match, 0.7-0.89 for reasonable match, below 0.7 if uncertain
- If nothing matches well, return the closest and set confidence below 0.5`

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: HAIKU_MODEL,
        max_tokens: 150,
        temperature: 0.1,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!res.ok) return null

    const data = await res.json()
    const text = data.content?.[0]?.text ?? ''
    const cleaned = text.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(cleaned)

    return {
      naicsCode: parsed.naics_code,
      naicsLabel: parsed.naics_label,
      confidence: parsed.confidence ?? 0.7,
    }
  } catch (err: any) {
    console.error('[Industry] Haiku classification error:', err?.message)
    return null
  }
}

// ── Cache new mapping ─────────────────────────────────────────────────────────

// Stores the raw value → NAICS mapping so future lookups skip Haiku entirely.
// Uses apollo_label field to store the original raw string for traceability.
async function cacheNewMapping(
  rawValue: string,
  naicsCode: string,
  hubspotValue: string
): Promise<void> {
  try {
    // Check if this exact raw value already exists as an apollo_label
    const { data: existing } = await getSupabase()
      .from('industry_crosswalk')
      .select('naics_code')
      .eq('naics_code', naicsCode)
      .eq('hubspot_value', hubspotValue)
      .limit(1)
      .single()

    if (existing) return // Already cached

    // Insert with raw value stored in apollo_label for future fuzzy matching
    await getSupabase().from('industry_crosswalk').insert({
      naics_code: naicsCode,
      naics_label: `[auto] ${rawValue}`,
      hubspot_value: hubspotValue,
      apollo_label: rawValue,
      is_primary: false, // not primary - this is a learned mapping
    })

    console.log(
      `[Industry] Cached new mapping: "${rawValue}" → ${naicsCode} → ${hubspotValue}`
    )
  } catch (err: any) {
    // Non-fatal: duplicate inserts will fail silently
    console.warn('[Industry] Cache write skipped:', err?.message)
  }
}

// ── Utility ───────────────────────────────────────────────────────────────────

// Convert UPPER_SNAKE_CASE hubspot value to human readable label
function toHubspotLabel(hubspotValue: string): string {
  return hubspotValue
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
    .replace(/\bAnd\b/g, 'and')
    .replace(/\bOf\b/g, 'of')
    .replace(/\bThe\b/g, 'the')
}
