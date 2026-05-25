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

    // Query arrangement_runs joined with arrangements
    const { data: runs, error } = await supabase
      .from('arrangement_runs')
      .select(`
        id,
        arrangement_id,
        status,
        processed_records,
        total_records,
        fields_filled,
        started_at,
        completed_at,
        error_message,
        arrangements!inner (
          id,
          name,
          enrichment_steps
        )
      `)
      .eq('org_id', ctx.orgId)
      .order('started_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('Failed to fetch enrichment history:', error);
      return NextResponse.json(
        { error: 'Failed to fetch enrichment history' },
        { status: 500 }
      );
    }

    // Transform runs for display
    const history = runs.map((run: any) => {
      const arrangement = run.arrangements;
      const enrichmentSteps = arrangement?.enrichment_steps || [];

      // Extract provider from first step
      const provider = enrichmentSteps[0]?.provider || 'Unknown';

      // Extract fields from all steps
      const fields: string[] = [];
      enrichmentSteps.forEach((step: any) => {
        if (step.field_configs) {
          Object.keys(step.field_configs).forEach((field) => {
            if (!fields.includes(field)) {
              fields.push(field);
            }
          });
        }
      });

      // Calculate total fields filled
      const fieldsFilled = run.fields_filled || {};
      const totalFilled = Object.values(fieldsFilled).reduce((sum: number, count: any) => sum + (count || 0), 0);

      return {
        id: run.id,
        arrangement_id: run.arrangement_id,
        arrangement_name: arrangement?.name || 'Unknown',
        status: run.status,
        provider,
        fields,
        records_processed: run.processed_records || 0,
        records_total: run.total_records || 0,
        fields_filled: totalFilled,
        started_at: run.started_at,
        completed_at: run.completed_at,
        error_message: run.error_message,
      };
    });

    return NextResponse.json({ runs: history });
  } catch (error) {
    console.error('Failed to fetch enrichment history:', error);
    return NextResponse.json(
      { error: 'Failed to fetch enrichment history' },
      { status: 500 }
    );
  }
}
