import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/db/supabase';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { requireFeature, parseFeatureGateError } from '@/lib/billing/check-feature';
import { captureWithOrgContext } from '@/lib/monitoring/sentry';
import { createHubSpotClient } from '@/lib/hubspot/client';
import { getAccessToken } from '@/lib/hubspot/get-access-token';
import { getHarmoniesByEntity, getHarmonyById } from '@/lib/harmonies/library';
import { Normalizer } from '@/lib/harmonies/pipeline/normalizer';
import type { RawCandidate } from '@/lib/harmonies/pipeline/types';
import { invalidateSummary } from '@/lib/ai/cache';

/**
 * POST /api/contact-normalize/apply
 *
 * Apply normalization harmonies to contacts.
 * Creates a normalization run and applies changes to HubSpot.
 */
export async function POST(request: NextRequest) {
  // Add auth check
  let ctx;
  try { ctx = await getOrgContext(); }
  catch (e) { return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 }); }

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

    const orgId = ctx.orgId;
    const userId = ctx.userId;
    const body = await request.json();
    const harmonyIds = body.harmonyIds as string[];
    const scope = body.scope || { type: 'all' };

    if (!harmonyIds || harmonyIds.length === 0) {
      return NextResponse.json(
        { error: 'harmonyIds array is required' },
        { status: 400 }
      );
    }

    // Get HubSpot connection
    const { data: connection, error: connError } = await supabase
      .from('hubspot_connections')
      .select('id, portal_id')
      .eq('org_id', orgId)
      .single();

    if (connError || !connection) {
      return NextResponse.json(
        { error: 'HubSpot connection not found' },
        { status: 404 }
      );
    }

    // Create normalization run
    const { data: run, error: runError } = await supabase
      .from('normalization_runs')
      .insert({
        org_id: orgId,
        connection_id: connection.id,
        initiated_by: userId,
        object_type: 'contact',
        status: 'running',
        scope,
        harmonies_applied: harmonyIds,
        rollback_expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
      })
      .select('id')
      .single();

    if (runError || !run) {
      return NextResponse.json(
        { error: 'Failed to create normalization run' },
        { status: 500 }
      );
    }

    // TODO: Enqueue BullMQ job to process normalization asynchronously
    // For now, return the run ID

    // Invalidate AI summary cache after normalization run starts
    await invalidateSummary(`ai:compliance:${orgId}:all`);

    return NextResponse.json({
      runId: run.id,
      status: 'queued',
    });
  } catch (error) {
    captureWithOrgContext(error, ctx.orgId, { route: '/api/contact-normalize/apply' });
    console.error('Failed to apply contact normalization:', error);
    return NextResponse.json(
      { error: 'Failed to apply normalization' },
      { status: 500 }
    );
  }
}
