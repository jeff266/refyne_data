/**
 * Rollback Execution for Normalization Runs
 *
 * Handles the actual rollback of normalization changes by writing
 * original values back to HubSpot.
 */

import { HubSpotClient } from '@/lib/hubspot/client';
import { supabase } from '@/lib/db/supabase';

interface NormalizationChange {
  id: string;
  run_id: string;
  org_id: string;
  hubspot_company_id: string;
  field_name: string;
  value_before: string | null;
  value_after: string | null;
  harmony_id: string | null;
  harmony_name: string | null;
  status: 'applied' | 'rolled_back' | 'skipped';
  applied_at: string;
  rolled_back_at: string | null;
}

interface RollbackResult {
  success: boolean;
  rolled_back: number;
  failed: number;
  errors: Array<{
    company_id: string;
    field: string;
    error: string;
  }>;
}

/**
 * Execute rollback for a normalization run.
 *
 * @param runId - Normalization run ID
 * @param orgId - Organization ID
 * @param accessToken - HubSpot access token
 * @param portalId - HubSpot portal ID
 * @returns Rollback result with counts
 */
export async function executeRollback(
  runId: string,
  orgId: string,
  accessToken: string,
  portalId: string
): Promise<RollbackResult> {
  if (!supabase) {
    throw new Error('Database not configured');
  }

  // Get all changes that need to be rolled back
  const { data: changes, error: changesError } = await supabase
    .from('normalization_changes')
    .select('*')
    .eq('run_id', runId)
    .eq('org_id', orgId)
    .eq('status', 'applied');

  if (changesError) {
    throw new Error(`Failed to fetch changes: ${changesError.message}`);
  }

  if (!changes || changes.length === 0) {
    return {
      success: true,
      rolled_back: 0,
      failed: 0,
      errors: [],
    };
  }

  // Group changes by company for batch updates
  const changesByCompany = new Map<string, NormalizationChange[]>();
  for (const change of changes as NormalizationChange[]) {
    if (!changesByCompany.has(change.hubspot_company_id)) {
      changesByCompany.set(change.hubspot_company_id, []);
    }
    changesByCompany.get(change.hubspot_company_id)!.push(change);
  }

  const client = new HubSpotClient(accessToken, portalId);
  const errors: Array<{ company_id: string; field: string; error: string }> = [];
  const succeededChanges: string[] = [];
  let rolledBackCount = 0;
  let failedCount = 0;

  // Process each company
  for (const [companyId, companyChanges] of changesByCompany.entries()) {
    try {
      // Build properties object with original values
      const properties: Record<string, string | null> = {};
      for (const change of companyChanges) {
        properties[change.field_name] = change.value_before;
      }

      // Write back to HubSpot
      await client.updateCompany(companyId, properties);

      // Track successful changes
      succeededChanges.push(...companyChanges.map(c => c.id));
      rolledBackCount += companyChanges.length;
    } catch (error) {
      // Log error but continue with other companies
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Failed to rollback company ${companyId}:`, errorMsg);

      for (const change of companyChanges) {
        errors.push({
          company_id: companyId,
          field: change.field_name,
          error: errorMsg,
        });
      }
      failedCount += companyChanges.length;
    }
  }

  // Update change records to mark as rolled back
  if (succeededChanges.length > 0) {
    const { error: updateError } = await supabase
      .from('normalization_changes')
      .update({
        status: 'rolled_back',
        rolled_back_at: new Date().toISOString(),
      })
      .in('id', succeededChanges);

    if (updateError) {
      console.error('Failed to update change records:', updateError);
      // Don't throw - rollback was successful even if we failed to record it
    }
  }

  return {
    success: errors.length === 0,
    rolled_back: rolledBackCount,
    failed: failedCount,
    errors,
  };
}
