import { supabase } from '@/lib/db/supabase';
import { sanitizeCSVValue } from './harmony-generator';

/**
 * Full enriched record interface (used in arrangement-queue.ts).
 * WARNING: Contains heavy objects (full HubSpot record, provider responses).
 * Do NOT pass this directly to storePendingEnrichments - causes OOM.
 */
export interface EnrichedRecord {
  record: any;
  companyId: string;
  propertiesToWrite: Record<string, unknown>;
  fieldsAttempted: number;
  fieldsWritten: number;
  fieldsSkipped: number;
  fieldDetail: Record<string, any>;
  creditsUsed: number;
}

/**
 * Lightweight pending enrichment row (memory-safe).
 * Only contains fields needed for review UI and HubSpot write.
 */
export interface PendingEnrichmentRow {
  companyId: string;
  companyName: string;
  hsProperty: string;
  hsValue: any;
  fieldKey: string;
  rawValue: string;
  normalizedValue: string;
  naicsCode: string | null;
  confidence: string;
  harmonyApplied: boolean;
}

/**
 * Store enriched records as pending enrichments in the review session.
 * Does not write to HubSpot - records await user approval.
 *
 * MEMORY FIX: Accepts lightweight PendingEnrichmentRow[] instead of full EnrichedRecord[]
 * to avoid holding full HubSpot company objects and provider responses in memory.
 */
export async function storePendingEnrichments(
  reviewSessionId: string,
  orgId: string,
  portalId: string,
  pendingRows: PendingEnrichmentRow[]
): Promise<void> {
  if (!supabase) {
    throw new Error('Database not configured');
  }

  if (pendingRows.length === 0) {
    return;
  }

  const pendingValues = pendingRows.map(row => ({
    org_id: orgId,
    review_session_id: reviewSessionId,
    hubspot_company_id: row.companyId,
    company_name: row.companyName,
    field_key: row.fieldKey,
    raw_value: sanitizeCSVValue(row.rawValue),
    normalized_value: sanitizeCSVValue(row.normalizedValue),
    naics_code: row.naicsCode,
    hubspot_property: row.hsProperty,
    hubspot_value: sanitizeCSVValue(String(row.hsValue)),
    confidence: row.confidence,
    harmony_applied: row.harmonyApplied,
    current_hubspot_value: null, // Will be populated during review if needed
  }));

  // Batch insert pending enrichment values
  const { error } = await supabase
    .from('pending_enrichment_values')
    .insert(pendingValues);

  if (error) {
    console.error('[PendingStore] Failed to insert pending values:', error);
    throw error;
  }

  console.log(`[PendingStore] Stored ${pendingValues.length} pending enrichment values for session ${reviewSessionId}`);
}

/**
 * Create a new enrichment review session.
 * Returns the session ID.
 */
export async function createReviewSession(
  orgId: string,
  portalId: string,
  arrangementId: string,
  runId: string
): Promise<string> {
  if (!supabase) {
    throw new Error('Database not configured');
  }

  const { data, error } = await supabase
    .from('enrichment_review_sessions')
    .insert({
      org_id: orgId,
      arrangement_id: arrangementId,
      run_id: runId,
      portal_id: portalId,
      status: 'pending_review',
    })
    .select('id')
    .single();

  if (error || !data) {
    console.error('[PendingStore] Failed to create review session:', error);
    throw error || new Error('No session created');
  }

  console.log(`[PendingStore] Created review session ${data.id}`);
  return data.id;
}

/**
 * Get org write behavior setting.
 * Defaults to 'review_first_run' if not configured.
 */
export async function getOrgWriteBehavior(orgId: string): Promise<string> {
  if (!supabase) {
    return 'review_first_run';
  }

  const { data } = await supabase
    .from('org_enrichment_settings')
    .select('enrichment_write_behavior')
    .eq('org_id', orgId)
    .maybeSingle();

  return data?.enrichment_write_behavior || 'review_first_run';
}

/**
 * Check if this is the first run for the given fields on this portal.
 * Returns true if no harmony exists for any of the field keys.
 */
export async function checkIsFirstRun(
  orgId: string,
  portalId: string,
  fieldKeys: string[]
): Promise<boolean> {
  if (fieldKeys.length === 0) return true;

  if (!supabase) {
    return true;
  }

  const { data, error } = await supabase
    .from('field_mappings')
    .select('canonical_field')
    .eq('org_id', orgId)
    .in('canonical_field', fieldKeys);

  if (error) {
    console.error('[PendingStore] Error checking first run:', error);
    return true; // Default to first run on error
  }

  // If no mappings exist, this is the first run
  return !data || data.length === 0;
}

/**
 * Update review session with field results summary.
 */
export async function updateReviewSessionResults(
  reviewSessionId: string,
  fieldResults: Record<string, any>
): Promise<void> {
  if (!supabase) {
    return;
  }

  const { error } = await supabase
    .from('enrichment_review_sessions')
    .update({
      field_results: fieldResults,
    })
    .eq('id', reviewSessionId);

  if (error) {
    console.error('[PendingStore] Failed to update session results:', error);
  }
}

/**
 * Mark review session as ready for review and notify run.
 */
export async function notifyReviewReady(
  runId: string,
  reviewSessionId: string
): Promise<void> {
  if (!supabase) {
    throw new Error('Database not configured');
  }

  // Update arrangement run status to pending_review
  const { error } = await supabase
    .from('arrangement_runs')
    .update({
      status: 'pending_review',
      completed_at: new Date().toISOString(),
    })
    .eq('id', runId);

  if (error) {
    console.error('[PendingStore] Failed to update run status:', error);
    throw error;
  }

  console.log(`[PendingStore] Run ${runId} marked as pending_review, session ${reviewSessionId}`);
}
