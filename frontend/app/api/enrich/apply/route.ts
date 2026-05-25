/**
 * Enrich Apply API
 *
 * POST /api/enrich/apply
 *
 * Applies selected preview results to HubSpot companies.
 * Only writes fields that the user has selected in the preview UI.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { supabase, isSupabaseConfigured } from '@/lib/db/supabase';
import { getAccessToken } from '@/lib/hubspot/get-access-token';
import { HubSpotClient } from '@/lib/hubspot/client';

interface SelectedRow {
  company_id: string;
  field_key: string;
  found_value: string;
}

interface ApplyRequest {
  selectedRows: SelectedRow[];
}

interface ApplyResponse {
  written: number;
  failed: number;
  skipped_invalid_value: number;
  errors: Array<{
    company_id: string;
    field_key: string;
    error: string;
  }>;
  field_breakdown: Record<string, number>;
}

// Map canonical field keys to HubSpot property names
const CANONICAL_TO_HUBSPOT: Record<string, string> = {
  'industry': 'industry',
  'employee_count': 'numberofemployees',
  'linkedin_url': 'linkedin_company_page',
  'phone': 'phone',
  'domain': 'domain',
  'revenue': 'annualrevenue',
};

export async function POST(req: NextRequest) {
  let ctx;
  try {
    ctx = await getOrgContext();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  const startTime = new Date();

  try {
    if (!isSupabaseConfigured() || !supabase) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 503 }
      );
    }

    const body: ApplyRequest = await req.json();

    if (!body.selectedRows || body.selectedRows.length === 0) {
      return NextResponse.json({ error: 'No rows selected' }, { status: 400 });
    }

    console.log(`[Apply] Processing ${body.selectedRows.length} selected rows for org ${ctx.orgId}`);

    // Get HubSpot access token
    const accessToken = await getAccessToken(ctx.orgId);

    // Get portal info
    const { data: connection } = await supabase
      .from('hubspot_connections')
      .select('portal_id')
      .eq('org_id', ctx.orgId)
      .eq('connection_status', 'active')
      .single();

    if (!connection) {
      return NextResponse.json(
        { error: 'HubSpot not connected' },
        { status: 400 }
      );
    }

    const hubspot = new HubSpotClient(accessToken, connection.portal_id);

    // Fetch valid HubSpot industry enum values from crosswalk table
    const { data: industryValues } = await supabase
      .from('industry_crosswalk')
      .select('hubspot_value')
      .not('hubspot_value', 'is', null);

    const validIndustries = new Set(
      (industryValues || [])
        .map(row => row.hubspot_value)
        .filter((v): v is string => v !== null)
    );

    console.log(`[Apply] Loaded ${validIndustries.size} valid industry enum values`);

    // Group rows by company and validate
    const companyUpdates = new Map<string, Record<string, string>>();
    const skippedRows: SelectedRow[] = [];
    const fieldBreakdown: Record<string, number> = {};

    for (const row of body.selectedRows) {
      const hubspotProperty = CANONICAL_TO_HUBSPOT[row.field_key] || row.field_key;

      // Validate industry values
      if (row.field_key === 'industry') {
        if (!validIndustries.has(row.found_value)) {
          console.warn(`[Apply] Skipping invalid industry value: ${row.found_value} for company ${row.company_id}`);
          skippedRows.push(row);
          continue;
        }
      }

      // Group by company
      if (!companyUpdates.has(row.company_id)) {
        companyUpdates.set(row.company_id, {});
      }

      companyUpdates.get(row.company_id)![hubspotProperty] = row.found_value;

      // Track field breakdown
      fieldBreakdown[row.field_key] = (fieldBreakdown[row.field_key] || 0) + 1;
    }

    console.log(`[Apply] Grouped into ${companyUpdates.size} companies, skipped ${skippedRows.length} invalid values`);

    // Build batch update records
    const recordsToUpdate = Array.from(companyUpdates.entries()).map(([companyId, properties]) => ({
      id: companyId,
      properties,
    }));

    if (recordsToUpdate.length === 0) {
      return NextResponse.json({
        written: 0,
        failed: 0,
        skipped_invalid_value: skippedRows.length,
        errors: [],
        field_breakdown: {},
      });
    }

    // Batch update via HubSpot client (handles batching internally)
    const { results, errors } = await hubspot.batchUpdateCompanies(recordsToUpdate);

    console.log(`[Apply] Written: ${results.length}, Failed: ${errors.length}, Skipped: ${skippedRows.length}`);

    const response: ApplyResponse = {
      written: results.length,
      failed: errors.length,
      skipped_invalid_value: skippedRows.length,
      errors: errors.map(err => {
        // Map error index back to company_id
        const record = recordsToUpdate[err.index];
        return {
          company_id: record?.id || 'unknown',
          field_key: 'multiple',
          error: err.error,
        };
      }),
      field_breakdown: fieldBreakdown,
    };

    // Log to enrichment history
    try {
      // Get or create "Preview Apply" arrangement for this org
      let previewArrangementId: string | null = null;

      const { data: existingArrangement } = await supabase
        .from('arrangements')
        .select('id')
        .eq('org_id', ctx.orgId)
        .eq('name', 'Preview Apply')
        .single();

      if (existingArrangement) {
        previewArrangementId = existingArrangement.id;
      } else {
        // Create the Preview Apply arrangement
        const { data: newArrangement, error: createError } = await supabase
          .from('arrangements')
          .insert({
            org_id: ctx.orgId,
            name: 'Preview Apply',
            description: 'System arrangement for tracking preview apply operations',
            enrichment_steps: [],
            is_active: false,
          })
          .select('id')
          .single();

        if (createError) {
          console.error('[Apply] Failed to create Preview Apply arrangement:', createError);
        } else if (newArrangement) {
          previewArrangementId = newArrangement.id;
        }
      }

      if (previewArrangementId) {
        await supabase.from('arrangement_runs').insert({
          org_id: ctx.orgId,
          arrangement_id: previewArrangementId,
          run_type: 'preview_apply',
          status: 'completed',
          total_records: body.selectedRows.length,
          processed_records: body.selectedRows.length,
          successful_records: results.length,
          failed_records: errors.length,
          initiated_by: ctx.userId,
          started_at: startTime.toISOString(),
          completed_at: new Date().toISOString(),
          source_snapshot: {},
          results_snapshot: {
            provider: 'preview',
            written: results.length,
            failed: errors.length,
            skipped: skippedRows.length,
            field_breakdown: fieldBreakdown,
          },
        });
        console.log('[Apply] Logged to history successfully');
      }
    } catch (historyError) {
      console.error('[Apply] Failed to log to history:', historyError);
      // Don't fail the request if history logging fails
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('[Apply] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to apply changes',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
