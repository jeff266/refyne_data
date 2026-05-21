import { NextResponse } from 'next/server';
import { supabase } from '@/lib/db/supabase';
import { getOrgContext, requireOperatorOrAbove, authError } from '@/lib/auth/clerk-helpers';
import { checkProspectingCredits, deductCredit } from '@/lib/auth/check-credits';
import { requireFeature, parseFeatureGateError } from '@/lib/billing/check-feature';
import { captureWithOrgContext } from '@/lib/monitoring/sentry';
import { getAccessToken } from '@/lib/hubspot/get-access-token';
import { HubSpotClient } from '@/lib/hubspot/client';
import { checkDedupGate } from '@/lib/hubspot/dedup-gate';
import type { RawRecord } from '@/lib/mcp/types';

/**
 * POST /api/enrich/push
 *
 * Pushes an enriched record to HubSpot with:
 * - Operator permission check
 * - Credit limit enforcement
 * - Duplicate detection with configurable policy (block/quarantine/allow)
 */
export async function POST(request: Request) {
  let ctx;
  try {
    ctx = await requireOperatorOrAbove();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  // Feature gate: prospect
  try {
    await requireFeature(ctx.orgId, 'prospect');
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
    if (!supabase) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    const body = await request.json();
    const { record, connectionId } = body;

    if (!record || !connectionId) {
      return NextResponse.json(
        { error: 'record and connectionId are required' },
        { status: 400 }
      );
    }

    // Get org settings
    const { data: settings, error: settingsError } = await supabase
      .from('workspace_entitlements')
      .select('allow_operator_push, duplicate_push_policy')
      .eq('clerk_org_id', ctx.orgId)
      .single();

    if (settingsError || !settings) {
      captureWithOrgContext(settingsError, ctx.orgId, { route: '/api/enrich/push' });
      console.error('Failed to fetch org settings:', settingsError);
      return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
    }

    // Check if operator can push
    if (ctx.orgRole === 'org:operator' && !settings.allow_operator_push) {
      return NextResponse.json(
        { error: 'Operators are not allowed to push records. Contact your admin.' },
        { status: 403 }
      );
    }

    // Check credit limits
    const creditCheck = await checkProspectingCredits(ctx.orgId, ctx.userId, ctx.orgRole);

    if (!creditCheck.allowed) {
      return NextResponse.json(
        {
          error: 'Credit limit reached',
          used: creditCheck.used,
          limit: creditCheck.limit,
          resetAt: creditCheck.resetAt,
        },
        { status: 429 }
      );
    }

    // Get HubSpot client for dedup check
    const accessToken = await getAccessToken(ctx.orgId);
    const { data: connection } = await supabase
      .from('hubspot_connections')
      .select('portal_id')
      .eq('org_id', ctx.orgId)
      .eq('connection_status', 'active')
      .single();

    if (!connection) {
      return NextResponse.json(
        { error: 'HubSpot not connected' },
        { status: 400 }
      );
    }

    const hubspot = new HubSpotClient(accessToken, connection.portal_id);

    // Check for duplicates using dedup gate
    const rawRecord: RawRecord = {
      _id: record.id || `prospect_${Date.now()}`,
      _label: record.name,
      ...record,
    };

    const dedupResult = await checkDedupGate(rawRecord, hubspot, ctx.orgId);

    const duplicateCheck = {
      isDuplicate: dedupResult.action !== 'insert',
      existingRecordId: dedupResult.targetHubSpotId,
      matchedOn: dedupResult.matchedRecord ? 'domain' : null,
      confidence: dedupResult.similarityScore ? Math.round(dedupResult.similarityScore * 100) : null,
      signals: dedupResult.fieldComparison,
    };

    // Handle duplicate based on policy
    if (duplicateCheck.isDuplicate) {
      const policy = settings.duplicate_push_policy;

      if (policy === 'block') {
        // Block: Return 409 with existing record info
        return NextResponse.json(
          {
            error: 'Duplicate record found',
            duplicate: true,
            existingRecordId: duplicateCheck.existingRecordId,
            matchedOn: duplicateCheck.matchedOn,
            confidence: duplicateCheck.confidence,
          },
          { status: 409 }
        );
      } else if (policy === 'quarantine') {
        // Quarantine: Add to queue for admin review
        const { error: quarantineError } = await supabase
          .from('quarantine_records')
          .insert({
            org_id: ctx.orgId,
            submitted_by: ctx.userId,
            record_data: record,
            source: 'manual',
            duplicate_of: duplicateCheck.existingRecordId,
            confidence: duplicateCheck.confidence,
            signals_fired: duplicateCheck.signals || null,
            status: 'pending',
          });

        if (quarantineError) {
          captureWithOrgContext(quarantineError, ctx.orgId, { route: '/api/enrich/push' });
          console.error('Failed to quarantine record:', quarantineError);
          return NextResponse.json(
            { error: 'Failed to quarantine record' },
            { status: 500 }
          );
        }

        // Deduct credit
        await deductCredit(ctx.orgId, ctx.userId, 'prospect_push', {
          quarantined: true,
          duplicateOf: duplicateCheck.existingRecordId,
        });

        return NextResponse.json(
          {
            message: 'Record submitted for review',
            quarantined: true,
            duplicateOf: duplicateCheck.existingRecordId,
          },
          { status: 202 }
        );
      }
      // policy === 'allow': fall through to push
    }

    // Push to HubSpot
    const propertiesToPush: Record<string, string | number | null> = {};

    // Map record fields to HubSpot properties
    for (const [key, value] of Object.entries(record)) {
      if (key !== 'id' && value !== null && value !== undefined) {
        propertiesToPush[key] = String(value);
      }
    }

    const { results, errors } = await hubspot.batchCreateCompanies([{
      properties: propertiesToPush,
    }]);

    if (errors.length > 0) {
      captureWithOrgContext(
        new Error(`HubSpot push failed: ${errors[0].error}`),
        ctx.orgId,
        { route: '/api/enrich/push', errors }
      );
      return NextResponse.json(
        { error: 'Failed to push to HubSpot', details: errors[0].error },
        { status: 500 }
      );
    }

    const createdCompany = results[0];

    // Deduct credit
    await deductCredit(ctx.orgId, ctx.userId, 'prospect_push', {
      recordId: createdCompany.id,
      domain: record.domain || null,
    });

    return NextResponse.json({
      message: 'Record pushed successfully',
      hubspotId: createdCompany.id,
      warning: duplicateCheck.isDuplicate ? 'Duplicate detected but allowed by policy' : null,
    });
  } catch (error) {
    captureWithOrgContext(error, ctx.orgId, { route: '/api/enrich/push' });
    console.error('Failed to push record:', error);
    return NextResponse.json({ error: 'Failed to push record' }, { status: 500 });
  }
}
