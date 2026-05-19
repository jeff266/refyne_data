import { NextResponse } from 'next/server';
import { supabase } from '@/lib/db/supabase';
import { getOrgContext, requireOperatorOrAbove, authError } from '@/lib/auth/clerk-helpers';
import { checkProspectingCredits, deductCredit } from '@/lib/auth/check-credits';
import { requireFeature, parseFeatureGateError } from '@/lib/billing/check-feature';
import { captureWithOrgContext } from '@/lib/monitoring/sentry';

/**
 * POST /api/enrich/csv-push
 *
 * Bulk pushes CSV records with credit limit enforcement.
 * Each row counts as 1 credit.
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
    const { records, connectionId } = body;

    if (!records || !Array.isArray(records) || records.length === 0) {
      return NextResponse.json(
        { error: 'records array is required and must not be empty' },
        { status: 400 }
      );
    }

    if (!connectionId) {
      return NextResponse.json({ error: 'connectionId is required' }, { status: 400 });
    }

    // Get org settings
    const { data: settings, error: settingsError } = await supabase
      .from('workspace_entitlements')
      .select('allow_operator_push')
      .eq('clerk_org_id', ctx.orgId)
      .single();

    if (settingsError || !settings) {
      captureWithOrgContext(error, ctx.orgId, { route: '/api/enrich/csv-push' });
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

    // Check if user has enough credits for all records
    const creditCheck = await checkProspectingCredits(ctx.orgId, ctx.userId, ctx.orgRole);

    if (!creditCheck.unlimited) {
      const creditsNeeded = records.length;
      const creditsAvailable = (creditCheck.limit || 0) - (creditCheck.used || 0);

      if (creditsAvailable < creditsNeeded) {
        return NextResponse.json(
          {
            error: 'Insufficient credits',
            needed: creditsNeeded,
            available: creditsAvailable,
            limit: creditCheck.limit,
            resetAt: creditCheck.resetAt,
          },
          { status: 429 }
        );
      }
    }

    // Process records and deduct credits
    // TODO: Integrate with actual CSV push logic
    const results = {
      processed: 0,
      failed: 0,
      quarantined: 0,
    };

    for (const record of records) {
      try {
        // Deduct credit for each row
        await deductCredit(ctx.orgId, ctx.userId, 'csv_row', {
          domain: record.domain || null,
        });

        results.processed++;
      } catch (error) {
        captureWithOrgContext(error, ctx.orgId, { route: '/api/enrich/csv-push' });
        console.error('Failed to process record:', error);
        results.failed++;
      }
    }

    return NextResponse.json({
      message: 'CSV push completed',
      results,
    });
  } catch (error) {
    captureWithOrgContext(error, ctx.orgId, { route: '/api/enrich/csv-push' });
    console.error('Failed to push CSV:', error);
    return NextResponse.json({ error: 'Failed to push CSV' }, { status: 500 });
  }
}
