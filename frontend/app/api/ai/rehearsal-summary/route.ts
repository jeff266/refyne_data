import { NextRequest, NextResponse } from 'next/server';
import { requireOperatorOrAbove, authError } from '@/lib/auth/clerk-helpers';
import { captureWithOrgContext } from '@/lib/monitoring/sentry';

/**
 * POST /api/ai/rehearsal-summary
 *
 * Generates an AI summary of rehearsal results.
 * This is a placeholder for Step 4 of the builder wizard.
 * Auth: org:operator or above
 */
export async function POST(request: NextRequest) {
  let ctx;
  try {
    ctx = await requireOperatorOrAbove();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  try {
    const body = await request.json();

    if (!body.rehearsalResults) {
      return NextResponse.json(
        { error: 'Missing rehearsal results' },
        { status: 400 }
      );
    }

    // Stub: In production, this would call an AI service (OpenAI, Anthropic, etc.)
    // to analyze the rehearsal results and provide insights
    const summary = {
      quality_score: 85,
      insights: [
        'Successfully enriched 100% of sample records',
        'Average enrichment time: 2.3 seconds per record',
        'Estimated cost for full run: ' + (body.rehearsalResults.estimatedCredits || 0) + ' credits',
      ],
      recommendations: [
        'Consider adding more fields to maximize value per API call',
        'Review failed records before running on full dataset',
      ],
      estimated_completion_time: '~15 minutes',
    };

    return NextResponse.json({ summary });

  } catch (error) {
    captureWithOrgContext(error, ctx.orgId, { route: '/api/ai/rehearsal-summary' });
    console.error('Failed to generate rehearsal summary:', error);
    return NextResponse.json(
      { error: 'Failed to generate summary' },
      { status: 500 }
    );
  }
}
