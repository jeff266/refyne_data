import { NextRequest, NextResponse } from 'next/server';
import { requireOperatorOrAbove, authError } from '@/lib/auth/clerk-helpers';
import { supabase, isSupabaseConfigured } from '@/lib/db/supabase';

/**
 * GET /api/history/[runId]/export
 *
 * Exports a CSV file with per-record, per-field results for a specific run.
 * Returns a downloadable CSV file with:
 * hubspot_company_id, company_name, field, before_value, after_value,
 * provider_used, harmony_applied, processed_at
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

    // Verify run belongs to org
    const { data: run, error: runError } = await supabase
      .from('arrangement_runs')
      .select('id, org_id')
      .eq('id', runId)
      .eq('org_id', ctx.orgId)
      .single();

    if (runError || !run) {
      return NextResponse.json(
        { error: 'Run not found' },
        { status: 404 }
      );
    }

    // Fetch all progress records for this run
    const { data: progressRecords, error: progressError } = await supabase
      .from('arrangement_run_progress')
      .select('*')
      .eq('run_id', runId)
      .order('updated_at', { ascending: true });

    if (progressError) {
      console.error('Failed to fetch progress records:', progressError);
      return NextResponse.json(
        { error: 'Failed to fetch progress records' },
        { status: 500 }
      );
    }

    // Build CSV rows
    const rows: string[] = [];
    rows.push('hubspot_company_id,company_name,field,before_value,after_value,provider_used,harmony_applied,processed_at');

    (progressRecords || []).forEach((record: any) => {
      const result = record.result || {};
      const fieldDetail = result.field_detail || {};
      const companyName = result.company_name || record.record_id;
      const processedAt = record.updated_at || record.created_at || '';

      Object.keys(fieldDetail).forEach((fieldKey) => {
        const fd = fieldDetail[fieldKey];
        if (fd.written) {
          const before = fd.before !== undefined && fd.before !== null ? String(fd.before) : '';
          const after = fd.raw || fd.normalized || '';
          const provider = fd.provider || '';
          const harmonyApplied = fd.harmony_applied ? 'true' : 'false';

          // Escape CSV values
          const escapeCsv = (val: string) => {
            val = String(val).replace(/"/g, '""');
            if (val.includes(',') || val.includes('"') || val.includes('\n')) {
              return `"${val}"`;
            }
            return val;
          };

          rows.push(
            [
              escapeCsv(record.record_id),
              escapeCsv(companyName),
              escapeCsv(fieldKey),
              escapeCsv(before),
              escapeCsv(after),
              escapeCsv(provider),
              harmonyApplied,
              escapeCsv(processedAt),
            ].join(',')
          );
        }
      });
    });

    const csvContent = rows.join('\n');

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="refyne-run-${runId}.csv"`,
      },
    });
  } catch (error) {
    console.error('Failed to export run data:', error);
    return NextResponse.json(
      { error: 'Failed to export run data' },
      { status: 500 }
    );
  }
}
