import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/db/supabase';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { requireFeature, parseFeatureGateError } from '@/lib/billing/check-feature';
import { captureWithOrgContext } from '@/lib/monitoring/sentry';
import { invalidateSummary } from '@/lib/ai/cache';
import { getNormalizeQueue } from '@/lib/queue/normalize-worker';
import { logAuditEvent } from '@/lib/audit/logger';
import { AUDIT_ACTIONS } from '@/lib/audit/actions';
import { consumeUsage } from '@/lib/billing/enforce';
import { requireAdmin } from '@/lib/auth/roles';
import { addToRegistry, type RegistryType } from '@/lib/names/registry';
import { getJobPriority } from '@/lib/billing/job-priority';
import { checkRateLimit, rateLimiters } from '@/lib/api/rate-limit';
import { z } from 'zod';

const applyRequestSchema = z.object({
  harmonyIds: z.array(z.string()).optional(),
  selectedChanges: z.array(z.object({
    companyId: z.string(),
    field: z.string(),
    before: z.string().optional(),
    after: z.string().optional(),
  })).optional(),
  objectType: z.enum(['company', 'contact']).default('company'),
});

interface SelectedChange {
  companyId: string;
  field: string;
  before?: string;  // Original value from HubSpot
  after?: string;   // Admin's chosen value (may differ from normalizer output)
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

  try {
    requireAdmin(ctx.orgRole);
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }

  // Rate limiting: prevent normalization run spam
  const rateLimitResult = await checkRateLimit(rateLimiters.expensive, ctx.orgId);
  if (rateLimitResult) return rateLimitResult;

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

    // Validate request body
    const rawBody = await request.json();
    const validation = applyRequestSchema.safeParse(rawBody);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.issues },
        { status: 400 }
      );
    }
    const body = validation.data as ApplyRequest;

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

    // Count writes for billing enforcement
    let writeCount = 0;
    if (body.selectedChanges && body.selectedChanges.length > 0) {
      writeCount = body.selectedChanges.length;
    } else {
      // If applying all changes, count preview records
      let countQuery = supabase
        .from('normalized_records')
        .select('record_id', { count: 'exact', head: true })
        .eq('org_id', ctx.orgId)
        .eq('record_type', 'company')
        .not('normalized_value', 'is', null)
        .not('raw_value', 'is', null);

      if (body.harmonyIds && body.harmonyIds.length > 0) {
        countQuery = countQuery.in('harmony_id', body.harmonyIds);
      }

      const { count } = await countQuery;
      writeCount = count ?? 0;
    }

    // Billing enforcement: Consume normalize write usage
    const billingResult = await consumeUsage(ctx.orgId, 'normalize_write', writeCount);
    if (!billingResult.allowed) {
      return NextResponse.json(
        {
          error: 'billing_limit_exceeded',
          reason: billingResult.reason,
          remaining: billingResult.remaining,
        },
        { status: 402 } // 402 Payment Required
      );
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

    // Detect admin corrections and learn from them
    if (body.selectedChanges && body.selectedChanges.length > 0) {
      await detectAndLearnCorrections(
        ctx.orgId,
        body.selectedChanges,
        body.objectType ?? 'company',
        run.id
      );
    }

    // Enqueue the normalize job with priority based on subscription tier
    const priority = await getJobPriority(ctx.orgId);
    const job = await getNormalizeQueue().add('normalize-apply', {
      runId: run.id,
      orgId: ctx.orgId,
      portalId: connection.portal_id,
      connectionId: connection.id,
      harmonyIds: body.harmonyIds || [],
      selectedChanges: body.selectedChanges ?? [],
      objectType: body.objectType ?? 'company',
    }, {
      priority,
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

/**
 * Detect admin corrections by comparing selected changes with normalizer output.
 * Learn from corrections by adding them to the registry and propagating across batch.
 */
async function detectAndLearnCorrections(
  orgId: string,
  selectedChanges: SelectedChange[],
  objectType: 'company' | 'contact',
  runId: string
) {
  if (!supabase) {
    console.error('[Registry] Supabase not configured, skipping correction detection');
    return;
  }

  try {
    // Build a map of record_id:field -> selected change for quick lookup
    const selectedMap = new Map<string, SelectedChange>();
    for (const change of selectedChanges) {
      if (change.after && change.before) {
        selectedMap.set(`${change.companyId}:${change.field}`, change);
      }
    }

    if (selectedMap.size === 0) {
      // No changes with both before/after values, nothing to detect
      return;
    }

    // Fetch the normalizer's original output from normalized_records table
    const recordIds = Array.from(new Set(selectedChanges.map(c => c.companyId)));
    const { data: normalizedRecords, error: fetchError } = await supabase
      .from('normalized_records')
      .select('record_id, field, raw_value, normalized_value, harmony_id')
      .eq('org_id', orgId)
      .eq('record_type', objectType)
      .in('record_id', recordIds);

    if (fetchError) {
      console.error('[Registry] Failed to fetch normalized records:', fetchError);
      return;
    }

    if (!normalizedRecords || normalizedRecords.length === 0) {
      console.log('[Registry] No normalized records found, skipping correction detection');
      return;
    }

    // Track corrections to propagate
    const correctionsByField = new Map<string, Map<string, string>>();
    let totalCorrections = 0;

    // Detect corrections by comparing admin's chosen value vs normalizer's output
    for (const record of normalizedRecords) {
      const key = `${record.record_id}:${record.field}`;
      const selectedChange = selectedMap.get(key);

      if (!selectedChange) {
        continue; // Not in selected changes
      }

      const normalizerOutput = record.normalized_value;
      const adminChosen = selectedChange.after;
      const originalValue = selectedChange.before || record.raw_value;

      // Detect correction: admin chose different value than normalizer suggested
      if (normalizerOutput && adminChosen && normalizerOutput !== adminChosen) {
        console.log(
          `[Registry] Correction detected for ${record.record_id}.${record.field}: ` +
          `normalizer suggested "${normalizerOutput}", admin chose "${adminChosen}"`
        );

        // Determine registry type based on field
        let registryType: RegistryType;
        if (record.field === 'name' || record.field === 'company.name') {
          registryType = 'company';
        } else if (record.field === 'firstname' || record.field === 'contact.firstname') {
          registryType = 'contact_first';
        } else if (record.field === 'lastname' || record.field === 'contact.lastname') {
          registryType = 'contact_last';
        } else {
          // For other fields, use 'company' as default
          registryType = 'company';
        }

        // Add to registry
        await addToRegistry(
          orgId,
          registryType,
          originalValue,
          adminChosen,
          'admin_correction',
          {
            record_id: record.record_id,
            field: record.field,
            normalizer_suggested: normalizerOutput,
            run_id: runId,
          }
        );

        totalCorrections++;

        // Track for propagation
        if (!correctionsByField.has(record.field)) {
          correctionsByField.set(record.field, new Map());
        }
        correctionsByField.get(record.field)!.set(originalValue, adminChosen);
      }
    }

    if (totalCorrections === 0) {
      console.log('[Registry] No corrections detected');
      return;
    }

    console.log(`[Registry] Added ${totalCorrections} corrections to registry`);

    // Propagate corrections across the batch
    let propagatedCount = 0;
    for (const change of selectedChanges) {
      const fieldCorrections = correctionsByField.get(change.field);
      if (!fieldCorrections) continue;

      const correctedValue = fieldCorrections.get(change.before || '');
      if (correctedValue && change.after !== correctedValue) {
        // Update the change to use the corrected value
        change.after = correctedValue;
        propagatedCount++;
      }
    }

    if (propagatedCount > 0) {
      console.log(`[Registry] Applied correction to ${propagatedCount} other records`);
    }

  } catch (error) {
    console.error('[Registry] Error detecting corrections:', error);
    // Don't throw - this is a best-effort feature
  }
}
