import { NextResponse } from 'next/server';
import { requireOperatorOrAbove, authError } from '@/lib/auth/clerk-helpers';
import { supabase, isSupabaseConfigured } from '@/lib/db/supabase';

/**
 * GET /api/enrich/history
 *
 * Returns the last 10 enrichment runs for the current org.
 * Used for the "Recent runs" table on the Enrich page.
 */
export async function GET() {
  let ctx;
  try {
    ctx = await requireOperatorOrAbove();
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

    // Query both arrangement_runs and enrichment_runs
    const { data: arrangementRuns, error: arrangementError } = await supabase
      .from('arrangement_runs')
      .select(`
        id,
        arrangement_id,
        run_type,
        status,
        processed_records,
        total_records,
        successful_records,
        failed_records,
        fields_filled,
        started_at,
        completed_at,
        error_message,
        results_snapshot,
        source_snapshot,
        arrangements (
          id,
          name,
          enrichment_steps
        )
      `)
      .eq('org_id', ctx.orgId)
      .order('started_at', { ascending: false })
      .limit(20);

    const { data: enrichmentRuns, error: enrichmentError } = await supabase
      .from('enrichment_runs')
      .select('*')
      .eq('org_id', ctx.orgId)
      .order('started_at', { ascending: false })
      .limit(20);

    if (arrangementError && enrichmentError) {
      console.error('Failed to fetch enrichment history:', { arrangementError, enrichmentError });
      return NextResponse.json(
        { error: 'Failed to fetch enrichment history' },
        { status: 500 }
      );
    }

    const runs = arrangementRuns || [];

    // Transform arrangement runs for display
    const arrangementHistory = runs.map((run: any) => {
      const arrangement = run.arrangements;
      const enrichmentSteps = arrangement?.enrichment_steps || [];
      const isPreviewApply = run.run_type === 'preview_apply';
      const isManualApply = !run.arrangement_id; // NULL arrangement_id = manual enrich page apply
      const resultsSnapshot = run.results_snapshot || {};
      const sourceSnapshot = run.source_snapshot || {};

      // Extract provider and fields based on run type
      let provider: string;
      let fields: string[] = [];

      if (isManualApply) {
        // Manual enrich page apply: extract from source_snapshot
        provider = sourceSnapshot.provider || 'enrich_page';
        fields = sourceSnapshot.fields || [];
      } else if (isPreviewApply) {
        // Preview apply: extract from results_snapshot
        provider = resultsSnapshot.provider || 'Preview';
        const fieldBreakdown = resultsSnapshot.field_breakdown || {};
        fields = Object.keys(fieldBreakdown);
      } else {
        // Regular arrangement run: extract from enrichment_steps
        provider = enrichmentSteps[0]?.provider || 'Unknown';
        enrichmentSteps.forEach((step: any) => {
          if (step.field_configs) {
            Object.keys(step.field_configs).forEach((field) => {
              if (!fields.includes(field)) {
                fields.push(field);
              }
            });
          }
        });
      }

      // Calculate total fields filled
      let totalFilled: number;
      if (isManualApply || isPreviewApply) {
        // For manual/preview applies, use successful_records
        totalFilled = run.successful_records || 0;
      } else {
        // For regular runs, sum fields_filled
        const fieldsFilled = run.fields_filled || {};
        totalFilled = Object.values(fieldsFilled).reduce((sum: number, count: any) => sum + (count || 0), 0);
      }

      return {
        id: run.id,
        arrangement_id: run.arrangement_id,
        arrangement_name: isManualApply ? 'Manual Apply' : (arrangement?.name || 'Unknown'),
        status: run.status,
        provider,
        fields,
        records_processed: run.processed_records || 0,
        records_total: run.total_records || 0,
        fields_filled: totalFilled,
        started_at: run.started_at,
        completed_at: run.completed_at,
        error_message: run.error_message,
        run_type: 'arrangement',
      };
    });

    // Transform enrichment runs for display
    const enrichmentHistory = (enrichmentRuns || []).map((run: any) => ({
      id: run.id,
      arrangement_id: null,
      arrangement_name: 'Ad-hoc Enrichment',
      status: run.status,
      provider: run.providers.join(', '),
      fields: run.fields,
      records_processed: run.processed_records || 0,
      records_total: run.total_records || 0,
      fields_filled: run.fields_enriched || 0,
      started_at: run.started_at,
      completed_at: run.completed_at,
      error_message: run.error_message,
      run_type: 'enrichment',
      cost_usd: run.cost_usd,
    }));

    // Merge and sort by started_at
    const allHistory = [...arrangementHistory, ...enrichmentHistory]
      .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())
      .slice(0, 10);

    return NextResponse.json({ runs: allHistory });
  } catch (error) {
    console.error('Failed to fetch enrichment history:', error);
    return NextResponse.json(
      { error: 'Failed to fetch enrichment history' },
      { status: 500 }
    );
  }
}
