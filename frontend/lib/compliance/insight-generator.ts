/**
 * Insight Generator
 *
 * Generates compliance insight cards from stale and unprocessed records.
 * Run after each compliance scan to surface actionable patterns.
 */

import { supabase, isSupabaseConfigured } from '../db/supabase';
import type { ComplianceInsight, InsightType } from './types';

/**
 * Minimum record count to generate a pattern gap insight.
 */
const PATTERN_GAP_THRESHOLD = 5;

/**
 * Maximum number of sample values to store.
 */
const MAX_SAMPLE_VALUES = 10;

/**
 * Maximum insights to generate per run.
 */
const MAX_INSIGHTS_PER_RUN = 50;

// ─────────────────────────────────────────────────────────────
// Insight Generation
// ─────────────────────────────────────────────────────────────

/**
 * Generate insights for an organization.
 * Returns the number of insights generated.
 */
export async function generateInsights(orgId: string): Promise<number> {
  if (!isSupabaseConfigured() || !supabase) {
    return 0;
  }

  let totalInsights = 0;

  // Generate pattern gap insights
  const patternGaps = await generatePatternGapInsights(orgId);
  totalInsights += patternGaps;

  // Generate new source insights
  const newSources = await generateNewSourceInsights(orgId);
  totalInsights += newSources;

  return totalInsights;
}

/**
 * Generate pattern gap insights.
 *
 * Pattern gap: A raw_value that appears in many stale/unprocessed records
 * for a specific harmony, indicating a missing rule pattern.
 */
async function generatePatternGapInsights(orgId: string): Promise<number> {
  if (!supabase) return 0;

  // Query for raw_value patterns in stale/unprocessed records
  const { data: records, error } = await supabase
    .from('normalized_records')
    .select('harmony_id, field, raw_value')
    .eq('org_id', orgId)
    .in('status', ['stale', 'unprocessed'])
    .not('raw_value', 'is', null);

  if (error) {
    console.error('Error fetching records for pattern gap:', error);
    return 0;
  }

  // Group by harmony_id + raw_value
  const patternCounts = new Map<
    string,
    { harmonyId: string | null; field: string; rawValue: string; count: number }
  >();

  for (const row of records || []) {
    const rawValue = String(row.raw_value).trim().toLowerCase();
    if (!rawValue) continue;

    const key = `${row.harmony_id || 'null'}:${row.field}:${rawValue}`;

    if (!patternCounts.has(key)) {
      patternCounts.set(key, {
        harmonyId: row.harmony_id,
        field: row.field,
        rawValue: row.raw_value,
        count: 0,
      });
    }

    patternCounts.get(key)!.count++;
  }

  // Filter to patterns that exceed threshold
  const significantPatterns = Array.from(patternCounts.values())
    .filter((p) => p.count >= PATTERN_GAP_THRESHOLD)
    .sort((a, b) => b.count - a.count)
    .slice(0, MAX_INSIGHTS_PER_RUN);

  let insightsCreated = 0;

  for (const pattern of significantPatterns) {
    // Check if this insight already exists (same harmony, field, similar message)
    const exists = await checkInsightExists(
      orgId,
      pattern.harmonyId,
      pattern.field,
      'pattern_gap',
      pattern.rawValue
    );

    if (exists) continue;

    // Create the insight
    const truncatedValue =
      pattern.rawValue.length > 50
        ? pattern.rawValue.slice(0, 47) + '...'
        : pattern.rawValue;

    const message = pattern.harmonyId
      ? `${pattern.count} records contain "${truncatedValue}" not matched by current rules.`
      : `${pattern.count} records with field "${pattern.field}" have value "${truncatedValue}" that has no applicable Harmony.`;

    await createInsight({
      orgId,
      harmonyId: pattern.harmonyId,
      field: pattern.field,
      type: 'pattern_gap',
      message,
      recordCount: pattern.count,
      sampleValues: [pattern.rawValue],
    });

    insightsCreated++;
  }

  return insightsCreated;
}

/**
 * Generate new source insights.
 *
 * New source: A provider/source that has 0% match rate on a field,
 * suggesting the provider uses a different taxonomy.
 */
async function generateNewSourceInsights(orgId: string): Promise<number> {
  if (!supabase) return 0;

  // Query for source + field combinations
  const { data: records, error } = await supabase
    .from('normalized_records')
    .select('source, field, status')
    .eq('org_id', orgId)
    .not('source', 'is', null);

  if (error) {
    console.error('Error fetching records for new source insights:', error);
    return 0;
  }

  // Group by source + field
  const sourceFieldStats = new Map<
    string,
    { source: string; field: string; compliant: number; total: number }
  >();

  for (const row of records || []) {
    if (!row.source) continue;

    const key = `${row.source}:${row.field}`;

    if (!sourceFieldStats.has(key)) {
      sourceFieldStats.set(key, {
        source: row.source,
        field: row.field,
        compliant: 0,
        total: 0,
      });
    }

    const stats = sourceFieldStats.get(key)!;
    stats.total++;
    if (row.status === 'compliant') {
      stats.compliant++;
    }
  }

  // Filter to sources with 0% match rate and significant volume
  const zeroMatchSources = Array.from(sourceFieldStats.values())
    .filter((s) => s.compliant === 0 && s.total >= PATTERN_GAP_THRESHOLD)
    .sort((a, b) => b.total - a.total)
    .slice(0, MAX_INSIGHTS_PER_RUN);

  let insightsCreated = 0;

  for (const source of zeroMatchSources) {
    // Check if this insight already exists
    const exists = await checkInsightExists(
      orgId,
      null,
      source.field,
      'new_source',
      source.source
    );

    if (exists) continue;

    const message = `Records from "${source.source}" have 0% match rate on "${source.field}" (${source.total} records). This provider may use a different taxonomy.`;

    await createInsight({
      orgId,
      harmonyId: null,
      field: source.field,
      type: 'new_source',
      message,
      recordCount: source.total,
      sampleValues: [source.source],
    });

    insightsCreated++;
  }

  return insightsCreated;
}

// ─────────────────────────────────────────────────────────────
// Insight CRUD
// ─────────────────────────────────────────────────────────────

interface CreateInsightInput {
  orgId: string;
  harmonyId: string | null;
  field: string;
  type: InsightType;
  message: string;
  recordCount: number;
  sampleValues: string[];
}

/**
 * Create a new insight.
 */
async function createInsight(input: CreateInsightInput): Promise<void> {
  if (!supabase) return;

  const { error } = await supabase.from('compliance_insights').insert({
    org_id: input.orgId,
    harmony_id: input.harmonyId,
    field: input.field,
    insight_type: input.type,
    message: input.message,
    record_count: input.recordCount,
    sample_values: input.sampleValues.slice(0, MAX_SAMPLE_VALUES),
  });

  if (error) {
    console.error('Error creating insight:', error);
  }
}

/**
 * Check if a similar insight already exists (not dismissed).
 */
async function checkInsightExists(
  orgId: string,
  harmonyId: string | null,
  field: string,
  type: InsightType,
  sampleValue: string
): Promise<boolean> {
  if (!supabase) return false;

  let query = supabase
    .from('compliance_insights')
    .select('id')
    .eq('org_id', orgId)
    .eq('field', field)
    .eq('insight_type', type)
    .is('dismissed_at', null);

  if (harmonyId) {
    query = query.eq('harmony_id', harmonyId);
  } else {
    query = query.is('harmony_id', null);
  }

  // Check if sample_values contains this value
  query = query.contains('sample_values', [sampleValue]);

  const { data, error } = await query.limit(1);

  if (error) {
    console.error('Error checking insight existence:', error);
    return false;
  }

  return (data?.length || 0) > 0;
}

/**
 * Get active insights for an organization (not dismissed).
 */
export async function getActiveInsights(orgId: string): Promise<ComplianceInsight[]> {
  if (!isSupabaseConfigured() || !supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from('compliance_insights')
    .select('*')
    .eq('org_id', orgId)
    .is('dismissed_at', null)
    .order('record_count', { ascending: false })
    .limit(100);

  if (error) {
    console.error('Error fetching insights:', error);
    throw new Error(`Failed to fetch insights: ${error.message}`);
  }

  return (data || []).map((row) => ({
    id: row.id,
    harmonyId: row.harmony_id,
    field: row.field,
    type: row.insight_type as InsightType,
    message: row.message,
    recordCount: row.record_count,
    sampleValues: (row.sample_values as string[]) || [],
    createdAt: row.created_at,
  }));
}

/**
 * Dismiss an insight.
 */
export async function dismissInsight(insightId: string): Promise<void> {
  if (!isSupabaseConfigured() || !supabase) {
    return;
  }

  const { error } = await supabase
    .from('compliance_insights')
    .update({ dismissed_at: new Date().toISOString() })
    .eq('id', insightId);

  if (error) {
    console.error('Error dismissing insight:', error);
    throw new Error(`Failed to dismiss insight: ${error.message}`);
  }
}

/**
 * Clear all insights for an organization (for testing).
 */
export async function clearInsights(orgId: string): Promise<void> {
  if (!isSupabaseConfigured() || !supabase) {
    return;
  }

  const { error } = await supabase
    .from('compliance_insights')
    .delete()
    .eq('org_id', orgId);

  if (error) {
    console.error('Error clearing insights:', error);
  }
}
