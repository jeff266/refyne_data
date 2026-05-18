/**
 * Compliance Score Calculator
 *
 * Computes compliance scores and breakdowns from normalized_records table.
 * All queries are pure count queries - no Harmony evaluation at query time.
 */

import { supabase, isSupabaseConfigured } from '../db/supabase';
import type {
  ComplianceScore,
  HarmonyBreakdown,
  FieldBreakdown,
  ScoreTrendPoint,
  DrilldownFilters,
  DrilldownResult,
  DrilldownRecord,
  ComplianceStatus,
  ComplianceScoreHistoryRow,
} from './types';
import { getHarmonyById } from '../harmonies/library';

// ─────────────────────────────────────────────────────────────
// Score Queries
// ─────────────────────────────────────────────────────────────

/**
 * Get the current compliance score for an organization.
 *
 * @param orgId - Organization ID
 * @returns Compliance score with counts and last computed timestamp
 */
export async function getScore(orgId: string): Promise<ComplianceScore> {
  if (!isSupabaseConfigured() || !supabase) {
    return {
      score: 0,
      compliant: 0,
      stale: 0,
      unprocessed: 0,
      total: 0,
      lastComputedAt: null,
    };
  }

  // Get counts by status
  const { data: statusCounts, error: countError } = await supabase
    .from('normalized_records')
    .select('status')
    .eq('org_id', orgId);

  if (countError) {
    console.error('Error fetching compliance counts:', countError);
    throw new Error(`Failed to fetch compliance score: ${countError.message}`);
  }

  // Count by status
  const counts = {
    compliant: 0,
    stale: 0,
    unprocessed: 0,
  };

  for (const row of statusCounts || []) {
    const status = row.status as ComplianceStatus;
    if (status in counts) {
      counts[status]++;
    }
  }

  const total = counts.compliant + counts.stale + counts.unprocessed;
  const score = total > 0 ? (counts.compliant / total) * 100 : 0;

  // Get last computed timestamp from history
  const { data: lastHistory } = await supabase
    .from('compliance_score_history')
    .select('computed_at')
    .eq('org_id', orgId)
    .order('computed_at', { ascending: false })
    .limit(1)
    .single();

  return {
    score: Math.round(score * 100) / 100,
    compliant: counts.compliant,
    stale: counts.stale,
    unprocessed: counts.unprocessed,
    total,
    lastComputedAt: lastHistory?.computed_at || null,
  };
}

/**
 * Get compliance breakdown by Harmony.
 *
 * @param orgId - Organization ID
 * @returns Per-Harmony compliance breakdown
 */
export async function getBreakdownByHarmony(orgId: string): Promise<HarmonyBreakdown[]> {
  if (!isSupabaseConfigured() || !supabase) {
    return [];
  }

  // Get all records with harmony_id
  const { data: records, error } = await supabase
    .from('normalized_records')
    .select('harmony_id, status')
    .eq('org_id', orgId);

  if (error) {
    console.error('Error fetching harmony breakdown:', error);
    throw new Error(`Failed to fetch harmony breakdown: ${error.message}`);
  }

  // Group by harmony_id
  const byHarmony = new Map<string, { compliant: number; stale: number; unprocessed: number }>();

  for (const row of records || []) {
    const harmonyId = row.harmony_id || '__unprocessed__';
    const status = row.status as ComplianceStatus;

    if (!byHarmony.has(harmonyId)) {
      byHarmony.set(harmonyId, { compliant: 0, stale: 0, unprocessed: 0 });
    }

    const counts = byHarmony.get(harmonyId)!;
    if (status in counts) {
      counts[status]++;
    }
  }

  // Get previous history for trend calculation
  const { data: prevHistory } = await supabase
    .from('compliance_score_history')
    .select('*')
    .eq('org_id', orgId)
    .order('computed_at', { ascending: false })
    .limit(2);

  const prevScore = prevHistory && prevHistory.length > 1
    ? prevHistory[1].score
    : null;

  // Build breakdown array
  const breakdowns: HarmonyBreakdown[] = [];

  for (const [harmonyId, counts] of Array.from(byHarmony.entries())) {
    if (harmonyId === '__unprocessed__') continue; // Skip unprocessed bucket

    const total = counts.compliant + counts.stale + counts.unprocessed;
    const rate = total > 0 ? (counts.compliant / total) * 100 : 0;

    // Get harmony name
    const harmony = getHarmonyById(harmonyId);

    breakdowns.push({
      harmonyId,
      harmonyName: harmony?.spec.name,
      compliant: counts.compliant,
      stale: counts.stale,
      unprocessed: counts.unprocessed,
      rate: Math.round(rate * 100) / 100,
      trend: prevScore !== null ? Math.round(rate * 100) / 100 - prevScore : null,
    });
  }

  // Sort by rate descending
  breakdowns.sort((a, b) => b.rate - a.rate);

  return breakdowns;
}

/**
 * Get compliance breakdown by field.
 *
 * @param orgId - Organization ID
 * @returns Per-field compliance breakdown
 */
export async function getBreakdownByField(orgId: string): Promise<FieldBreakdown[]> {
  if (!isSupabaseConfigured() || !supabase) {
    return [];
  }

  // Get all records grouped by field
  const { data: records, error } = await supabase
    .from('normalized_records')
    .select('field, status')
    .eq('org_id', orgId);

  if (error) {
    console.error('Error fetching field breakdown:', error);
    throw new Error(`Failed to fetch field breakdown: ${error.message}`);
  }

  // Group by field
  const byField = new Map<string, { compliant: number; stale: number; unprocessed: number }>();

  for (const row of records || []) {
    const field = row.field;
    const status = row.status as ComplianceStatus;

    if (!byField.has(field)) {
      byField.set(field, { compliant: 0, stale: 0, unprocessed: 0 });
    }

    const counts = byField.get(field)!;
    if (status in counts) {
      counts[status]++;
    }
  }

  // Build breakdown array
  const breakdowns: FieldBreakdown[] = [];

  for (const [field, counts] of Array.from(byField.entries())) {
    const total = counts.compliant + counts.stale + counts.unprocessed;
    const rate = total > 0 ? (counts.compliant / total) * 100 : 0;

    breakdowns.push({
      field,
      compliant: counts.compliant,
      stale: counts.stale,
      unprocessed: counts.unprocessed,
      rate: Math.round(rate * 100) / 100,
    });
  }

  // Sort by rate descending
  breakdowns.sort((a, b) => b.rate - a.rate);

  return breakdowns;
}

/**
 * Get score trend over time.
 *
 * @param orgId - Organization ID
 * @param days - Number of days to look back (default: 30)
 * @returns Array of score trend points
 */
export async function getTrend(orgId: string, days = 30): Promise<ScoreTrendPoint[]> {
  if (!isSupabaseConfigured() || !supabase) {
    return [];
  }

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  const { data: history, error } = await supabase
    .from('compliance_score_history')
    .select('*')
    .eq('org_id', orgId)
    .gte('computed_at', cutoff.toISOString())
    .order('computed_at', { ascending: true });

  if (error) {
    console.error('Error fetching trend:', error);
    throw new Error(`Failed to fetch trend: ${error.message}`);
  }

  return (history || []).map((row: ComplianceScoreHistoryRow) => ({
    score: Number(row.score),
    compliant: row.compliant,
    stale: row.stale,
    unprocessed: row.unprocessed,
    total: row.total,
    computedAt: row.computed_at,
  }));
}

/**
 * Get drill-down records with filters.
 *
 * @param orgId - Organization ID
 * @param filters - Filter criteria
 * @returns Paginated drill-down result
 */
export async function getDrilldown(
  orgId: string,
  filters: DrilldownFilters
): Promise<DrilldownResult> {
  if (!isSupabaseConfigured() || !supabase) {
    return {
      records: [],
      total: 0,
      page: filters.page || 1,
      pageSize: filters.pageSize || 50,
      hasMore: false,
    };
  }

  const page = filters.page || 1;
  const pageSize = filters.pageSize || 50;
  const offset = (page - 1) * pageSize;

  // Build query
  let query = supabase
    .from('normalized_records')
    .select('*', { count: 'exact' })
    .eq('org_id', orgId);

  if (filters.harmonyId) {
    query = query.eq('harmony_id', filters.harmonyId);
  }

  if (filters.field) {
    query = query.eq('field', filters.field);
  }

  if (filters.status) {
    query = query.eq('status', filters.status);
  }

  if (filters.recordType) {
    query = query.eq('record_type', filters.recordType);
  }

  // Add pagination
  query = query
    .order('updated_at', { ascending: false })
    .range(offset, offset + pageSize - 1);

  const { data: records, error, count } = await query;

  if (error) {
    console.error('Error fetching drilldown:', error);
    throw new Error(`Failed to fetch drilldown: ${error.message}`);
  }

  const total = count || 0;

  const drilldownRecords: DrilldownRecord[] = (records || []).map((row) => ({
    recordId: row.record_id,
    recordName: undefined, // Would need HubSpot lookup
    field: row.field,
    rawValue: row.raw_value,
    normalizedValue: row.normalized_value,
    status: row.status as ComplianceStatus,
    harmonyId: row.harmony_id,
    normalizedAt: row.normalized_at,
  }));

  return {
    records: drilldownRecords,
    total,
    page,
    pageSize,
    hasMore: offset + pageSize < total,
  };
}

// ─────────────────────────────────────────────────────────────
// History Management
// ─────────────────────────────────────────────────────────────

/**
 * Store a compliance score snapshot in history.
 *
 * @param orgId - Organization ID
 * @param score - Score data to store
 */
export async function storeScoreHistory(
  orgId: string,
  score: ComplianceScore
): Promise<void> {
  if (!isSupabaseConfigured() || !supabase) {
    return;
  }

  const { error } = await supabase
    .from('compliance_score_history')
    .insert({
      org_id: orgId,
      score: score.score,
      compliant: score.compliant,
      stale: score.stale,
      unprocessed: score.unprocessed,
      total: score.total,
      computed_at: new Date().toISOString(),
    });

  if (error) {
    console.error('Error storing score history:', error);
    throw new Error(`Failed to store score history: ${error.message}`);
  }
}

/**
 * Get the previous score for trend comparison.
 *
 * @param orgId - Organization ID
 * @returns Previous score or null
 */
export async function getPreviousScore(orgId: string): Promise<number | null> {
  if (!isSupabaseConfigured() || !supabase) {
    return null;
  }

  const { data } = await supabase
    .from('compliance_score_history')
    .select('score')
    .eq('org_id', orgId)
    .order('computed_at', { ascending: false })
    .limit(2);

  // Return the second-to-last score (previous)
  if (data && data.length > 1) {
    return Number(data[1].score);
  }

  return null;
}
