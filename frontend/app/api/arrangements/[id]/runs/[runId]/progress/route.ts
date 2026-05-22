/**
 * Arrangement Run Progress API
 *
 * GET /api/arrangements/[id]/runs/[runId]/progress
 *
 * Returns progress records for a specific run.
 * Used by the arrangement detail page for the live record feed.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { supabase, isSupabaseConfigured } from '@/lib/db/supabase';

interface RouteContext {
  params: { id: string; runId: string };
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
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Get progress records for this run
    const { data: progressRecords, error: progressError } = await supabase
      .from('arrangement_run_progress')
      .select('*')
      .eq('run_id', runId)
      .eq('org_id', ctx.orgId)
      .order('completed_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (progressError) {
      console.error('[Run Progress] Failed to fetch progress:', progressError);
      return NextResponse.json(
        { error: 'Failed to fetch progress records' },
        { status: 500 }
      );
    }

    // Format records for the live feed
    const records = (progressRecords || []).map((record: any) => {
      const companyName = record.result?.company_name || record.record_id;
      const fieldDetail = record.result?.field_detail || {};

      const field_details = Object.keys(fieldDetail).map((fieldKey) => {
        const detail = fieldDetail[fieldKey];

        return {
          field_key: fieldKey,
          filled: detail.written || false,
          harmony_applied: detail.metadata?.harmony?.matched || false,
          skipped: detail.skipped || false,
          skip_reason: detail.reason || null,
        };
      });

      return {
        id: record.id,
        record_id: record.record_id,
        company_name: companyName,
        field_details,
        status: record.status,
        completed_at: record.completed_at,
      };
    });

    return NextResponse.json({
      progress: records,
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
