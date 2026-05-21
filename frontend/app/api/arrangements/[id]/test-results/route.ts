/**
 * Test Results API
 *
 * GET /api/arrangements/[id]/test-results
 *
 * Returns formatted test run results for display on Enrich page.
 * Includes before/after field values with harmony annotations.
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

    // Get arrangement run for this test
    const { data: runs, error: runsError } = await supabase
      .from('arrangement_runs')
      .select('*')
      .eq('arrangement_id', arrangementId)
      .eq('org_id', ctx.orgId)
      .order('created_at', { ascending: false })
      .limit(1);

    if (runsError || !runs || runs.length === 0) {
      return NextResponse.json(
        { error: 'Test run not found' },
        { status: 404 }
      );
    }

    const run = runs[0];

    // Get arrangement run progress records
    const { data: progressRecords, error: progressError } = await supabase
      .from('arrangement_run_progress')
      .select('*')
      .eq('run_id', run.id)
      .eq('org_id', ctx.orgId)
      .order('completed_at', { ascending: true });

    if (progressError) {
      console.error('[Test Results] Failed to fetch progress:', progressError);
      return NextResponse.json(
        { error: 'Failed to fetch test results' },
        { status: 500 }
      );
    }

    // Calculate duration
    const startTime = new Date(run.created_at).getTime();
    const endTime = run.completed_at ? new Date(run.completed_at).getTime() : Date.now();
    const durationSeconds = Math.round((endTime - startTime) / 1000);

    // Field labels mapping
    const fieldLabels: Record<string, string> = {
      industry: 'Industry',
      numberofemployees: 'Employee count',
      linkedin_company_page: 'LinkedIn URL',
      phone: 'Phone',
      domain: 'Domain',
      annualrevenue: 'Revenue',
    };

    // Format results for display - flatten to one row per field change
    const results: any[] = [];

    for (const record of progressRecords || []) {
      // Get company name
      let companyName = record.company_name || record.record_id;

      // If no company name, try to look it up
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

      const fieldDetail = record.result?.field_detail || {};
      const enrichmentResults = record.enrichment_results || {};

      // Create one result row per field
      Object.keys(fieldDetail).forEach((fieldKey) => {
        const detail = fieldDetail[fieldKey];
        const before = detail.before || null;
        const after = enrichmentResults[fieldKey] || detail.after || null;

        results.push({
          company_name: companyName,
          field_key: fieldKey,
          field_label: fieldLabels[fieldKey] || fieldKey,
          before: before,
          after: after,
          harmony_applied: detail.metadata?.harmony?.matched || detail.harmony_applied || false,
          harmony_name: detail.metadata?.harmony?.name || (detail.harmony_applied ? 'Harmony applied' : null),
          skipped: detail.skipped || false,
          skip_reason: detail.skip_reason || detail.metadata?.skip_reason || null,
        });
      });
    }

    return NextResponse.json({
      records_processed: run.processed_records || 0,
      duration_seconds: durationSeconds,
      results,
    });
  } catch (error) {
    console.error('[Test Results] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to get test results',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
