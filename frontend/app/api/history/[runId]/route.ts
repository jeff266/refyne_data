import { NextRequest, NextResponse } from 'next/server';
import { requireOperatorOrAbove, authError } from '@/lib/auth/clerk-helpers';
import { supabase, isSupabaseConfigured } from '@/lib/db/supabase';

/**
 * GET /api/history/[runId]
 *
 * Returns detailed information for a specific enrichment run,
 * including record-level progress and results.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { runId: string } }
) {
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

    const { runId } = params;

    // Fetch run details (left join for preview runs without arrangements)
    const { data: run, error: runError } = await supabase
      .from('arrangement_runs')
      .select(`
        id,
        arrangement_id,
        run_type,
        status,
        processed_records,
        total_records,
        successful_records,
        fields_filled,
        started_at,
        completed_at,
        error_message,
        source_snapshot,
        results_snapshot,
        arrangements (
          id,
          name,
          field_configs
        )
      `)
      .eq('id', runId)
      .eq('org_id', ctx.orgId)
      .single();

    if (runError || !run) {
      console.error(`[History API] Run not found - runId: ${runId}, org_id: ${ctx.orgId}, error:`, runError);

      // Check if this is actually an arrangement ID
      const { data: arrangement } = await supabase
        .from('arrangements')
        .select('id')
        .eq('id', runId)
        .eq('org_id', ctx.orgId)
        .single();

      if (arrangement) {
        console.error(`[History API] ID ${runId} is an arrangement ID, not a run ID`);
        return NextResponse.json(
          { error: 'Invalid run ID - this appears to be an arrangement ID. Use the run ID instead.' },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { error: 'Run not found' },
        { status: 404 }
      );
    }

    // Calculate duration
    let durationSeconds = 0;
    if (run.started_at && run.completed_at) {
      const start = new Date(run.started_at).getTime();
      const end = new Date(run.completed_at).getTime();
      durationSeconds = Math.round((end - start) / 1000);
    }

    // Extract providers and fields
    const arrangement = Array.isArray(run.arrangements) ? run.arrangements[0] : run.arrangements;
    const fieldConfigs = arrangement?.field_configs || [];
    const providers: string[] = [];
    const fields: string[] = [];

    // For preview runs (no arrangement), extract from source_snapshot
    const isPreviewRun = !run.arrangement_id;
    if (isPreviewRun && run.source_snapshot) {
      const snapshot = run.source_snapshot as any;
      if (snapshot.provider) providers.push(snapshot.provider);
      if (snapshot.fields) fields.push(...snapshot.fields);
    } else {
      // For arrangement runs, extract from field_configs
      fieldConfigs.forEach((fc: any) => {
        if (fc.field_key && !fields.includes(fc.field_key)) {
          fields.push(fc.field_key);
        }
        fc.steps?.forEach((step: any) => {
          if (step.provider && !providers.includes(step.provider)) {
            providers.push(step.provider);
          }
        });
      });
    }

    // Fetch progress records (limit to 100 for now per spec)
    const { data: progressRecords, error: progressError } = await supabase
      .from('arrangement_run_progress')
      .select('*')
      .eq('run_id', runId)
      .limit(100);

    if (progressError) {
      console.error('Failed to fetch progress records:', progressError);
      return NextResponse.json(
        { error: 'Failed to fetch progress records' },
        { status: 500 }
      );
    }

    // Categorize progress records
    const filled: any[] = [];
    const notFound: any[] = [];
    const failed: any[] = [];

    (progressRecords || []).forEach((record: any) => {
      const result = record.result || {};
      const recordStatus = record.status || 'completed';

      if (recordStatus === 'failed') {
        failed.push({
          record_id: record.record_id,
          company_name: result.company_name || record.record_id,
          error: result.error || record.error_message || 'Unknown error',
        });
      } else if (result.fields_written && result.fields_written > 0) {
        // This record had fields filled
        const fieldDetails = result.field_detail || {};
        const fieldsArray: any[] = [];

        Object.keys(fieldDetails).forEach((fieldKey) => {
          const fd = fieldDetails[fieldKey];
          if (fd.written) {
            fieldsArray.push({
              field_key: fieldKey,
              before: fd.before !== undefined ? fd.before : '(empty)',
              after: fd.raw || fd.normalized,
              provider: fd.provider || 'Unknown',
              harmony_applied: fd.harmony_applied || false,
            });
          }
        });

        filled.push({
          record_id: record.record_id,
          company_name: result.company_name || record.record_id,
          fields: fieldsArray,
        });
      } else {
        // Record not found
        let reason = 'Provider returned no match';
        if (result.no_domain) {
          reason = 'No domain in HubSpot';
        } else if (result.reason) {
          reason = result.reason;
        }

        notFound.push({
          record_id: record.record_id,
          company_name: result.company_name || record.record_id,
          reason,
        });
      }
    });

    // Calculate total fields filled
    const fieldsFilled = run.fields_filled || {};
    const totalFilled = Object.values(fieldsFilled).reduce(
      (sum: number, count: any) => sum + (count || 0),
      0
    );

    return NextResponse.json({
      run: {
        run_id: run.id,
        arrangement_id: run.arrangement_id,
        arrangement_name: isPreviewRun ? 'Preview Run' : (arrangement?.name || 'Unknown'),
        started_at: run.started_at,
        completed_at: run.completed_at,
        duration_seconds: durationSeconds,
        status: run.status,
        providers,
        fields,
        processed_records: run.processed_records || 0,
        total_records: run.total_records || 0,
        successful_records: run.successful_records || 0,
        fields_filled: totalFilled,
      },
      arrangement: {
        id: run.arrangement_id,
        name: isPreviewRun ? 'Preview Run' : (arrangement?.name || 'Unknown'),
        field_configs: fieldConfigs,
      },
      progress: {
        filled,
        notFound,
        failed,
      },
    });
  } catch (error) {
    console.error('Failed to fetch run details:', error);
    return NextResponse.json(
      { error: 'Failed to fetch run details' },
      { status: 500 }
    );
  }
}
