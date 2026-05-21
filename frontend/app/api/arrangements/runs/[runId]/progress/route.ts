/**
 * Arrangement Run Progress API
 *
 * GET /api/arrangements/runs/[runId]/progress
 *
 * Returns progress records for a specific run.
 * Used by the arrangement detail page for the live record feed.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { supabase, isSupabaseConfigured } from '@/lib/db/supabase';

interface RouteContext {
  params: { runId: string };
}

export async function GET(req: NextRequest, context: RouteContext) {
  let ctx;
  try {
    ctx = await getOrgContext();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  try {
    if (!isSupabaseConfigured() || !supabase) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 503 }
      );
    }

    const runId = context.params.runId;
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Get progress records for this run
    const { data: progressRecords, error: progressError } = await supabase
      .from('arrangement_run_progress')
      .select('*')
      .eq('run_id', runId)
      .eq('org_id', ctx.orgId)
      .order('updated_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (progressError) {
      console.error('[Run Progress] Failed to fetch progress:', progressError);
      return NextResponse.json(
        { error: 'Failed to fetch progress records' },
        { status: 500 }
      );
    }

    // Format records for the live feed
    const records = await Promise.all(
      (progressRecords || []).map(async (record: any) => {
        // Try to get company name from the record
        let companyName = record.company_name || record.record_id;

        // If no company name, try to look it up from company_dedup_index
        if (!record.company_name && record.hubspot_company_id && supabase) {
          const { data: company } = await supabase
            .from('company_dedup_index')
            .select('name')
            .eq('hubspot_company_id', record.hubspot_company_id)
            .single();

          if (company?.name) {
            companyName = company.name;
          }
        }

        // Extract field details from result
        const fieldDetail = record.result?.field_detail || {};
        const enrichmentResults = record.enrichment_results || {};

        const field_details = Object.keys(fieldDetail).map((fieldKey) => {
          const detail = fieldDetail[fieldKey];

          return {
            field_key: fieldKey,
            filled: detail.written || !!enrichmentResults[fieldKey],
            harmony_applied: detail.metadata?.harmony?.matched || detail.harmony_applied || false,
            skipped: detail.skipped || false,
            skip_reason: detail.skip_reason || detail.metadata?.skip_reason || null,
          };
        });

        return {
          id: record.id,
          company_name: companyName,
          field_details,
          status: record.status,
          completed_at: record.completed_at || record.updated_at,
        };
      })
    );

    return NextResponse.json({
      records,
    });
  } catch (error) {
    console.error('[Run Progress] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to get progress records',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
