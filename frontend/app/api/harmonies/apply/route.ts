import { NextRequest, NextResponse } from 'next/server';
import { executeHarmoniesApply } from '@/lib/mcp';
import type { HarmoniesApplyInput } from '@/lib/mcp/types';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { checkOrgRateLimit, rateLimitErrorResponse } from '@/lib/hubspot/org-rate-limiter';
import { captureWithOrgContext } from '@/lib/monitoring/sentry';
import { supabase, isSupabaseConfigured } from '@/lib/db/supabase';
import { getConnectionId } from '@/lib/hubspot/get-access-token';

/**
 * POST /api/harmonies/apply
 *
 * Runs harmonies_apply tool via API route.
 * Creates a normalization run and tracks all field changes for rollback capability.
 */
export async function POST(request: NextRequest) {
  // Auth check
  let ctx;
  try { ctx = await getOrgContext(); }
  catch (e) { return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 }); }

  // Rate limit check
  const rateLimitCheck = await checkOrgRateLimit(ctx.orgId, '/api/harmonies/apply');
  if (!rateLimitCheck.allowed) {
    return NextResponse.json(
      rateLimitErrorResponse(rateLimitCheck.resetAt!, rateLimitCheck.remaining!),
      { status: 429 }
    );
  }

  try {
    if (!isSupabaseConfigured() || !supabase) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 503 }
      );
    }

    const body = await request.json() as HarmoniesApplyInput & {
      scope?: { type: 'all' | 'list' | 'filter'; listId?: string; filters?: unknown };
      hubspot_company_ids?: string[];
    };

    // Get connection ID
    const connectionId = await getConnectionId(ctx.orgId);

    // Create normalization run
    const { data: run, error: runError } = await supabase
      .from('normalization_runs')
      .insert({
        org_id: ctx.orgId,
        connection_id: connectionId,
        initiated_by: ctx.userId,
        status: 'running',
        scope: body.scope || { type: 'all' },
        harmonies_applied: body.harmony_ids,
        rollback_expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
      })
      .select()
      .single();

    if (runError || !run) {
      throw new Error(`Failed to create normalization run: ${runError?.message}`);
    }

    const runId = run.id;

    // Execute the normalization
    const result = await executeHarmoniesApply(body);

    if (!result.success) {
      // Mark run as failed
      await supabase
        .from('normalization_runs')
        .update({
          status: 'failed',
          error_message: result.error?.message || 'Unknown error',
          completed_at: new Date().toISOString(),
        })
        .eq('id', runId);

      return NextResponse.json(result, { status: 400 });
    }

    // Track changes for each record
    const changes: Array<{
      run_id: string;
      org_id: string;
      hubspot_company_id: string;
      field_name: string;
      value_before: string | null;
      value_after: string | null;
      harmony_id: string | null;
      harmony_name: string | null;
    }> = [];

    const hubspotIds = body.hubspot_company_ids || [];

    for (let i = 0; i < body.records.length; i++) {
      const originalRecord = body.records[i];
      const transformedRecord = result.data!.records[i];
      const hubspotId = hubspotIds[i] || originalRecord._id;

      // Compare original and transformed records to detect changes
      const allFields = new Set([
        ...Object.keys(originalRecord),
        ...Object.keys(transformedRecord),
      ]);

      for (const field of Array.from(allFields)) {
        // Skip internal fields
        if (field.startsWith('_')) continue;

        const before = originalRecord[field];
        const after = transformedRecord[field];

        // Only track actual changes
        if (before !== after) {
          changes.push({
            run_id: runId,
            org_id: ctx.orgId,
            hubspot_company_id: hubspotId,
            field_name: field,
            value_before: before != null ? String(before) : null,
            value_after: after != null ? String(after) : null,
            harmony_id: body.harmony_ids[0] || null, // TODO: Track which harmony changed which field
            harmony_name: null, // TODO: Add harmony name lookup
          });
        }
      }
    }

    // Insert changes
    if (changes.length > 0) {
      const { error: changesError } = await supabase
        .from('normalization_changes')
        .insert(changes);

      if (changesError) {
        console.error('Failed to insert normalization changes:', changesError);
        // Continue despite change tracking failure
      }
    }

    // Update run stats
    await supabase
      .from('normalization_runs')
      .update({
        status: 'completed',
        records_scanned: body.records.length,
        records_changed: changes.length > 0 ? new Set(changes.map(c => c.hubspot_company_id)).size : 0,
        records_failed: result.data!.errors.length,
        completed_at: new Date().toISOString(),
      })
      .eq('id', runId);

    return NextResponse.json({
      ...result,
      runId,
    });
  } catch (error) {
    captureWithOrgContext(error, ctx.orgId, { route: '/api/harmonies/apply' });
    console.error('Harmonies apply error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'server_error',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      },
      { status: 500 }
    );
  }
}
