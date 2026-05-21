/**
 * Arrangement Runs API
 *
 * GET /api/arrangements/[id]/runs
 *
 * Returns all runs for an arrangement with aggregated stats.
 * Used by the arrangement detail page for the live feed and run history.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { supabase, isSupabaseConfigured } from '@/lib/db/supabase';

interface RouteContext {
  params: { id: string };
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

    const arrangementId = context.params.id;

    // Get all runs for this arrangement
    const { data: runs, error: runsError } = await supabase
      .from('arrangement_runs')
      .select('*')
      .eq('arrangement_id', arrangementId)
      .eq('org_id', ctx.orgId)
      .order('created_at', { ascending: false });

    if (runsError) {
      console.error('[Arrangement Runs] Failed to fetch runs:', runsError);
      return NextResponse.json(
        { error: 'Failed to fetch runs' },
        { status: 500 }
      );
    }

    // For each run, aggregate progress stats
    const runsWithStats = await Promise.all(
      (runs || []).map(async (run) => {
        // Get progress records for this run
        const { data: progressRecords, error: progressError } = await supabase
          .from('arrangement_run_progress')
          .select('*')
          .eq('run_id', run.id)
          .eq('org_id', ctx.orgId);

        if (progressError) {
          console.error('[Arrangement Runs] Failed to fetch progress:', progressError);
          return {
            id: run.id,
            status: run.status,
            records_total: run.total_records || 0,
            records_processed: 0,
            records_failed: 0,
            fields_filled: {},
            fields_normalized: 0,
            started_at: run.created_at,
            completed_at: run.completed_at,
            error: run.error_message,
          };
        }

        // Calculate stats from progress records
        const records_processed = progressRecords?.length || 0;
        const records_failed = progressRecords?.filter((r: any) => r.status === 'failed').length || 0;

        // Aggregate field fills and normalizations
        const fieldsFilledMap: Record<string, number> = {};
        let fields_normalized = 0;

        progressRecords?.forEach((record: any) => {
          const fieldDetail = record.result?.field_detail || {};
          const enrichmentResults = record.enrichment_results || {};

          Object.keys(fieldDetail).forEach((fieldKey) => {
            const detail = fieldDetail[fieldKey];

            // Count if field was written
            if (detail.written || enrichmentResults[fieldKey]) {
              fieldsFilledMap[fieldKey] = (fieldsFilledMap[fieldKey] || 0) + 1;
            }

            // Count if harmony was applied
            if (detail.metadata?.harmony?.matched || detail.harmony_applied) {
              fields_normalized++;
            }
          });
        });

        return {
          id: run.id,
          status: run.status,
          records_total: run.total_records || 0,
          records_processed,
          records_failed,
          fields_filled: fieldsFilledMap,
          fields_normalized,
          started_at: run.created_at,
          completed_at: run.completed_at,
          error: run.error_message,
        };
      })
    );

    return NextResponse.json({
      runs: runsWithStats,
    });
  } catch (error) {
    console.error('[Arrangement Runs] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to get arrangement runs',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
