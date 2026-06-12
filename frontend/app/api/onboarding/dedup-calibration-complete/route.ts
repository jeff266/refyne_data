/**
 * Dedup Calibration Complete - Onboarding
 *
 * POST: Analyze feedback, suggest survivorship rules, mark complete
 *
 * Admin only.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, authError } from '@/lib/auth/clerk-helpers';
import { supabaseAdmin } from '@/lib/db/admin-client';
import { analyzeFeedback, type CalibrationDecision, type DedupSamplePair } from '@/lib/dedup/calibration-analyzer';
import { triggerContextRebuild } from '@/lib/assistant/context-triggers';

export async function POST(request: NextRequest) {
  let ctx;
  try {
    ctx = await requireAdmin();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  try {
    // Fetch all decisions with source='onboarding_calibration'
    const { data: decisionsData } = await supabaseAdmin
      .from('dedup_decisions')
      .select('*')
      .eq('org_id', ctx.orgId)
      .eq('source', 'onboarding_calibration');

    // Fetch sample pairs
    const { data: progress } = await supabaseAdmin
      .from('onboarding_progress')
      .select('dedup_sample_pairs')
      .eq('org_id', ctx.orgId)
      .single();

    const samples = progress?.dedup_sample_pairs as DedupSamplePair[] | null;
    if (!samples) {
      return NextResponse.json(
        { error: 'No sample pairs found' },
        { status: 400 }
      );
    }

    // Transform decisions to calibration format
    const decisions: CalibrationDecision[] = decisionsData?.map(d => ({
      pair_id: d.metadata?.pair_id || '',
      verdict: d.decision === 'merge' ? 'duplicate' : d.decision === 'reject' ? 'not_duplicate' : 'unsure',
      survivor_preference: d.metadata?.survivor_preference,
      company_a_id: d.record_a_id,
      company_b_id: d.record_b_id,
    })) || [];

    // Run heuristic analysis
    const suggestedRules = analyzeFeedback(decisions, samples);

    // Mark calibration as complete
    const { error: updateError } = await supabaseAdmin
      .from('onboarding_progress')
      .update({
        dedup_calibration_completed: true,
        dedup_calibration_completed_at: new Date().toISOString(),
        dedup_calibration_result: {
          suggested_rules: suggestedRules,
          total_decisions: decisions.length,
          merge_decisions: decisions.filter(d => d.verdict === 'duplicate').length,
          reject_decisions: decisions.filter(d => d.verdict === 'not_duplicate').length,
        },
        updated_at: new Date().toISOString(),
      })
      .eq('org_id', ctx.orgId);

    if (updateError) {
      console.error('[Calibration Complete] Failed to update progress:', updateError);
      return NextResponse.json(
        { error: 'Failed to mark calibration complete' },
        { status: 500 }
      );
    }

    console.log(`[Calibration Complete] Completed for org ${ctx.orgId}, ${suggestedRules.length} rules suggested`);

    // Trigger context rebuild (fire-and-forget)
    triggerContextRebuild(ctx.orgId, 'calibration_completed');

    return NextResponse.json({
      done: true,
      suggestion: suggestedRules.length > 0 ? suggestedRules[0] : null,
      all_suggestions: suggestedRules,
      stats: {
        total: decisions.length,
        merged: decisions.filter(d => d.verdict === 'duplicate').length,
        rejected: decisions.filter(d => d.verdict === 'not_duplicate').length,
      },
    });
  } catch (error) {
    console.error('[Calibration Complete] Error:', error);
    return NextResponse.json(
      { error: 'Failed to complete calibration' },
      { status: 500 }
    );
  }
}
