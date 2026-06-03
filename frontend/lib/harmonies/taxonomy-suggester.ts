/**
 * Taxonomy Suggester
 *
 * AI-powered classification engine that scans HubSpot for unmapped values
 * and suggests canonical mappings using Claude Haiku.
 */

import Anthropic from '@anthropic-ai/sdk';
import { supabaseAdmin } from '../db/admin-client';
import { HubSpotClient } from '../hubspot/client';

export interface TaxonomySuggestion {
  rawValue: string;
  suggestedCanonical: string | null;
  confidence: 'high' | 'medium' | 'low' | 'unsure';
  status: 'pending' | 'accepted' | 'rejected';
}

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// ─────────────────────────────────────────────────────────────────────────────
// Step 1: Find Unmapped Values
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Scans HubSpot field for values not already mapped in harmony_reference_data.
 * Excludes previously rejected suggestions to avoid re-surfacing them.
 */
export async function findUnmappedValues(
  client: HubSpotClient,
  harmonyId: string,
  hubspotProperty: string,
  objectType: 'company' | 'contact',
  orgId: string
): Promise<string[]> {
  // Get all distinct values from HubSpot for this property
  const allValues = new Set<string>();
  for await (const batch of client.getAllRecords(objectType, [hubspotProperty])) {
    for (const record of batch) {
      const val = record.properties?.[hubspotProperty]?.trim();
      if (val) allValues.add(val);
    }
  }

  // Get already-mapped input values for this harmony
  const { data: mapped } = await supabaseAdmin
    .from('harmony_reference_data')
    .select('input_value')
    .eq('table_name', harmonyId)
    .or(`org_id.eq.${orgId},org_id.is.null`);

  const mappedSet = new Set(
    (mapped ?? []).map((r) => r.input_value.toLowerCase().trim())
  );

  // Get already-surfaced suggestions (don't re-surface rejected ones)
  const { data: existing } = await supabaseAdmin
    .from('taxonomy_suggestions')
    .select('raw_value, status')
    .eq('org_id', orgId)
    .eq('harmony_id', harmonyId);

  const rejectedSet = new Set(
    (existing ?? [])
      .filter((r) => r.status === 'rejected')
      .map((r) => r.raw_value.toLowerCase().trim())
  );

  // Return values not already mapped and not previously rejected
  return Array.from(allValues).filter((val) => {
    const lower = val.toLowerCase().trim();
    return !mappedSet.has(lower) && !rejectedSet.has(lower);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 2: Classify Unmapped Values via Claude Haiku
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Uses Claude Haiku to classify unmapped values against known canonical values.
 * Processes in batches of 20 to keep prompts manageable.
 */
export async function classifyUnmappedValues(
  unmappedValues: string[],
  canonicalValues: string[],
  harmonyContext: string
): Promise<Map<string, { canonical: string | null; confidence: string }>> {
  if (unmappedValues.length === 0) return new Map();

  const results = new Map<string, { canonical: string | null; confidence: string }>();

  // Process in batches of 20 to keep prompts manageable
  const BATCH_SIZE = 20;
  for (let i = 0; i < unmappedValues.length; i += BATCH_SIZE) {
    const batch = unmappedValues.slice(i, i + BATCH_SIZE);

    const prompt = `You are classifying industry/sub-industry values for ${harmonyContext}.

Given these canonical values:
${canonicalValues.map((v, idx) => `${idx + 1}. ${v}`).join('\n')}

For each input value below, return the best matching canonical value and your confidence.
If no canonical value is a reasonable match, return null for canonical.

Inputs to classify:
${batch.map((v, idx) => `${idx + 1}. "${v}"`).join('\n')}

Return ONLY a JSON array in this exact format, one object per input, in order:
[
  { "input": "value", "canonical": "Canonical Value or null", "confidence": "high|medium|low|unsure" },
  ...
]

Rules:
- "high": clearly belongs to one canonical value
- "medium": likely matches but some ambiguity
- "low": possible match but uncertain
- "unsure": no reasonable match, return null for canonical
- Never invent canonical values not in the list above`;

    try {
      const response = await anthropic.messages.create({
        model: 'claude-haiku-4-5',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }],
      });

      const text = response.content[0].type === 'text' ? response.content[0].text : '[]';

      try {
        const parsed = JSON.parse(text.trim()) as Array<{
          input: string;
          canonical: string | null;
          confidence: string;
        }>;

        for (const item of parsed) {
          results.set(item.input, {
            canonical: item.canonical,
            confidence: item.confidence,
          });
        }
      } catch {
        // If parsing fails, mark all in batch as unsure
        for (const val of batch) {
          results.set(val, { canonical: null, confidence: 'unsure' });
        }
      }
    } catch (error) {
      console.error('[taxonomy-suggester] Claude API error:', error);
      // Mark batch as unsure on API error
      for (const val of batch) {
        results.set(val, { canonical: null, confidence: 'unsure' });
      }
    }
  }

  return results;
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 3: Store Suggestions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Stores AI suggestions in taxonomy_suggestions table.
 * Upserts: if already exists and pending, updates suggestion.
 * If accepted/rejected, leaves it alone.
 */
export async function storeSuggestions(
  orgId: string,
  harmonyId: string,
  suggestions: Map<string, { canonical: string | null; confidence: string }>
): Promise<void> {
  const rows = Array.from(suggestions.entries()).map(([rawValue, result]) => ({
    org_id: orgId,
    harmony_id: harmonyId,
    raw_value: rawValue,
    suggested_canonical: result.canonical,
    confidence: result.confidence,
    status: 'pending',
  }));

  if (rows.length === 0) return;

  // Upsert: if already exists and pending, update suggestion
  // If accepted/rejected, leave it alone
  await supabaseAdmin.from('taxonomy_suggestions').upsert(rows, {
    onConflict: 'org_id,harmony_id,raw_value',
    ignoreDuplicates: false,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 4: Accept a Suggestion
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Accepts a suggestion and adds it to harmony_reference_data.
 */
export async function acceptSuggestion(
  suggestionId: string,
  orgId: string,
  harmonyId: string,
  rawValue: string,
  canonicalValue: string,
  userId: string
): Promise<void> {
  // Get the harmony's reference table name
  const { data: harmony } = await supabaseAdmin
    .from('harmonies')
    .select('id, reference_table')
    .eq('id', harmonyId)
    .single();

  if (!harmony?.reference_table) throw new Error('Harmony has no reference table');

  // Add to reference data
  await supabaseAdmin.from('harmony_reference_data').insert({
    table_name: harmony.reference_table,
    input_value: rawValue,
    canonical_value: canonicalValue,
    org_id: orgId,
    source: 'suggestion',
    suggestion_status: 'accepted',
  });

  // Mark suggestion as accepted
  await supabaseAdmin
    .from('taxonomy_suggestions')
    .update({
      status: 'accepted',
      reviewed_by: userId,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', suggestionId);
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 5: Reject a Suggestion
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Rejects a suggestion. Won't be re-surfaced in future scans.
 */
export async function rejectSuggestion(
  suggestionId: string,
  userId: string
): Promise<void> {
  await supabaseAdmin
    .from('taxonomy_suggestions')
    .update({
      status: 'rejected',
      reviewed_by: userId,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', suggestionId);
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Entry Point
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Runs full taxonomy suggestion scan for a harmony.
 * Finds unmapped values, classifies them via Claude, stores suggestions.
 */
export async function runTaxonomySuggester(
  client: HubSpotClient,
  harmonyId: string,
  hubspotProperty: string,
  objectType: 'company' | 'contact',
  orgId: string,
  harmonyContext: string
): Promise<{ found: number; stored: number }> {
  // Get current canonical values for this harmony
  const { data: refData } = await supabaseAdmin
    .from('harmony_reference_data')
    .select('canonical_value')
    .eq('table_name', harmonyId);

  const canonicalValues = [
    ...new Set((refData ?? []).map((r) => r.canonical_value)),
  ];

  if (canonicalValues.length === 0) {
    return { found: 0, stored: 0 };
  }

  // Find unmapped values
  const unmapped = await findUnmappedValues(
    client,
    harmonyId,
    hubspotProperty,
    objectType,
    orgId
  );

  if (unmapped.length === 0) return { found: 0, stored: 0 };

  // Classify via Haiku
  const suggestions = await classifyUnmappedValues(
    unmapped,
    canonicalValues,
    harmonyContext
  );

  // Store suggestions
  await storeSuggestions(orgId, harmonyId, suggestions);

  return {
    found: unmapped.length,
    stored: suggestions.size,
  };
}
