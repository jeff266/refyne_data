import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/db/supabase';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { requireFeature, parseFeatureGateError } from '@/lib/billing/check-feature';
import { captureWithOrgContext } from '@/lib/monitoring/sentry';
import { invalidateSummary } from '@/lib/ai/cache';
import { getNormalizeQueue } from '@/lib/queue/normalize-worker';
import { logAuditEvent } from '@/lib/audit/logger';
import { AUDIT_ACTIONS } from '@/lib/audit/actions';

interface SelectedChange {
  companyId: string;
  field: string;
}

interface ApplyRequest {
  harmonyIds?: string[];
  selectedChanges?: SelectedChange[];
  objectType?: 'company' | 'contact';
}

/**
 * POST /api/normalize/apply
 *
 * Apply normalization to companies.
 * - If selectedChanges provided, only apply those specific changes
 * - If selectedChanges omitted, apply all changes for harmonyIds
 * - Auto-adds skip_once exclusions for unselected items
 */
export async function POST(request: NextRequest) {
  // Auth check
  let ctx;
  try {
    ctx = await getOrgContext();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  // Feature gate: normalize
  try {
    await requireFeature(ctx.orgId, 'normalize');
  } catch (error) {
    const gateError = parseFeatureGateError(error);
    if (gateError) {
      return NextResponse.json(
        { error: 'feature_gated', feature: gateError.feature, currentPlan: gateError.currentPlan },
        { status: 403 }
      );
    }
    throw error;
  }

  try {
    if (!isSupabaseConfigured() || !supabase) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 503 }
      );
    }

    const body: ApplyRequest = await request.json();

    // Get HubSpot connection
    const { data: connection, error: connError } = await supabase
      .from('hubspot_connections')
      .select('id, portal_id')
      .eq('org_id', ctx.orgId)
      .eq('connection_status', 'active')
      .single();

    if (connError || !connection) {
      return NextResponse.json(
        { error: 'HubSpot connection not found' },
        { status: 404 }
      );
    }

    // If selectedChanges provided, apply only those changes
    if (body.selectedChanges && body.selectedChanges.length > 0) {
      // Get all preview records to identify unselected ones
      let previewQuery = supabase
        .from('normalized_records')
        .select('record_id, field, harmony_id')
        .eq('org_id', ctx.orgId)
        .eq('record_type', 'company')
        .not('normalized_value', 'is', null)
        .not('raw_value', 'is', null);

      if (body.harmonyIds && body.harmonyIds.length > 0) {
        previewQuery = previewQuery.in('harmony_id', body.harmonyIds);
      }

      const { data: previewRecords } = await previewQuery;

      // Build set of selected changes
      const selectedSet = new Set(
        body.selectedChanges.map((c) => `${c.companyId}:${c.field}`)
      );

      // Find unselected records
      const unselectedRecords = (previewRecords || []).filter(
        (r) => !selectedSet.has(`${r.record_id}:${r.field}`)
      );

      // Create skip_once exclusions for unselected records
      const exclusionsToInsert = unselectedRecords.map((r) => ({
        org_id: ctx.orgId,
        company_id: r.record_id,
        field: r.field,
        exclusion_type: 'skip_once' as const,
        reason: 'Excluded from manual apply',
        created_by: ctx.userId,
        expires_at: null,
      }));

      if (exclusionsToInsert.length > 0) {
        const { error: exclusionError } = await supabase
          .from('normalize_exclusions')
          .insert(exclusionsToInsert);

        if (exclusionError) {
          console.error('Failed to create skip_once exclusions:', exclusionError);
          // Continue anyway - exclusions are best-effort
        }
      }
    }

    // Create normalization run
    const { data: run, error: runError } = await supabase
      .from('normalization_runs')
      .insert({
        org_id: ctx.orgId,
        connection_id: connection.id,
        initiated_by: ctx.userId,
        object_type: body.objectType ?? 'company',
        status: 'running',
        scope: body.selectedChanges
          ? { type: 'selected', changes: body.selectedChanges }
          : { type: 'all' },
        harmonies_applied: body.harmonyIds || [],
        rollback_expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
      })
      .select('id')
      .single();

    if (runError || !run) {
      captureWithOrgContext(runError, ctx.orgId, { route: '/api/normalize/apply' });
      console.error('Failed to create normalization run:', runError);
      return NextResponse.json(
        { error: 'Failed to create normalization run' },
        { status: 500 }
      );
    }

    // Enqueue the normalize job
    const job = await getNormalizeQueue().add('normalize-apply', {
      runId: run.id,
      orgId: ctx.orgId,
      portalId: connection.portal_id,
      connectionId: connection.id,
      harmonyIds: body.harmonyIds || [],
      selectedChanges: body.selectedChanges ?? [],
      objectType: body.objectType ?? 'company',
    });

    console.log(`[Normalize Apply] Enqueued job ${job.id} for run ${run.id}`);

    // Invalidate AI summary cache after normalization run starts
    await invalidateSummary(`ai:compliance:${ctx.orgId}:all`);

    // Log audit event
    logAuditEvent({
      orgId: ctx.orgId,
      actorId: ctx.userId,
      actorEmail: ctx.userEmail,
      action: AUDIT_ACTIONS.NORMALIZE_APPLIED,
      objectType: 'normalization_run',
      objectId: run.id,
      objectLabel: `Run ${run.id.substring(0, 8)}`,
      metadata: {
        harmony_count: body.harmonyIds?.length || 0,
        change_count: body.selectedChanges?.length || 'all',
        object_type: body.objectType ?? 'company',
        scope: body.selectedChanges ? 'selected' : 'all',
      },
      request,
    });

    return NextResponse.json({
      runId: run.id,
      jobId: job.id,
      status: 'queued',
      applied: body.selectedChanges?.length || 'all',
    });
  } catch (error) {
    captureWithOrgContext(error, ctx.orgId, { route: '/api/normalize/apply' });
    console.error('Failed to apply normalization:', error);
    return NextResponse.json(
      { error: 'Failed to apply normalization' },
      { status: 500 }
    );
  }
}
