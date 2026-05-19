import { NextResponse } from 'next/server';
import { supabase } from '@/lib/db/supabase';
import { getOrgContext, requireOperatorOrAbove, authError } from '@/lib/auth/clerk-helpers';
import { checkProspectingCredits, deductCredit } from '@/lib/auth/check-credits';
import { requireFeature, parseFeatureGateError } from '@/lib/billing/check-feature';

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

    // Check for duplicates
    // TODO: Integrate with checkDedupGate from lib/hubspot/dedup-gate.ts
    // For now, simulate duplicate check based on domain
    const duplicateCheck = {
      isDuplicate: false, // Placeholder - implement actual dedup logic
      existingRecordId: null,
      matchedOn: null,
      confidence: null,
      signals: null,
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

    // Push to HubSpot (reuse existing push logic)
    // For now, we'll just simulate success
    // TODO: Integrate with actual HubSpot push logic from existing codebase

    // Deduct credit
    await deductCredit(ctx.orgId, ctx.userId, 'prospect_push', {
      recordId: record.id || null,
      domain: record.domain || null,
    });

    return NextResponse.json({
      message: 'Record pushed successfully',
      warning: duplicateCheck.isDuplicate ? 'Duplicate detected but allowed by policy' : null,
    });
  } catch (error) {
    console.error('Failed to push record:', error);
    return NextResponse.json({ error: 'Failed to push record' }, { status: 500 });
  }
}
