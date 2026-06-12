/**
 * Dedup Feedback - Onboarding Calibration
 *
 * POST: Record user's merge/reject decision on a sample pair
 *
 * Admin only. Writes to dedup_decisions with source='onboarding_calibration'.
 * NEVER creates merge jobs or cluster records.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, authError } from '@/lib/auth/clerk-helpers';
import { supabaseAdmin } from '@/lib/db/admin-client';
import type { DedupSamplePair } from '@/lib/dedup/calibration-analyzer';
import { z } from 'zod';

const FeedbackSchema = z.object({
  pair_id: z.string().uuid(),
  verdict: z.enum(['duplicate', 'not_duplicate', 'unsure']),
  survivor_preference: z.enum(['a', 'b', 'auto']).optional(),
});

export async function POST(request: NextRequest) {
  let ctx;
  try {
    ctx = await requireAdmin();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  try {
    const body = await request.json();
    const feedback = FeedbackSchema.parse(body);

    // Validate pair_id exists in dedup_sample_pairs
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

    const pair = samples.find(s => s.pair_id === feedback.pair_id);
    if (!pair) {
      return NextResponse.json(
        { error: 'Invalid pair_id' },
        { status: 400 }
      );
    }

    // Map verdict to decision
    let decision: 'merge' | 'reject' | 'skip';
    switch (feedback.verdict) {
      case 'duplicate':
        decision = 'merge';
        break;
      case 'not_duplicate':
        decision = 'reject';
        break;
      case 'unsure':
        decision = 'skip';
        break;
    }

    // Write to dedup_decisions
    const { error } = await supabaseAdmin
      .from('dedup_decisions')
      .insert({
        org_id: ctx.orgId,
        record_a_id: pair.company_a.id,
        record_b_id: pair.company_b.id,
        decision,
        source: 'onboarding_calibration',
        decided_by: ctx.userId,
        decided_at: new Date().toISOString(),
        confidence_at_decision: pair.confidence,
        signals_fired: pair.signals_fired,
        metadata: {
          pair_id: feedback.pair_id,
          survivor_preference: feedback.survivor_preference,
          grade: pair.grade,
        },
      });

    if (error) {
      console.error('[Dedup Feedback] Failed to record decision:', error);
      return NextResponse.json(
        { error: 'Failed to record decision' },
        { status: 500 }
      );
    }

    console.log(`[Dedup Feedback] Recorded decision: ${decision} for pair ${feedback.pair_id}`);

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request body', details: error.issues },
        { status: 400 }
      );
    }

    console.error('[Dedup Feedback] Error:', error);
    return NextResponse.json(
      { error: 'Failed to process feedback' },
      { status: 500 }
    );
  }
}
