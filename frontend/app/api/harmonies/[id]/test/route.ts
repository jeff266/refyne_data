import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { captureWithOrgContext } from '@/lib/monitoring/sentry';
import { getHarmonyById } from '@/lib/harmonies/library';
import { HarmonyExecutor } from '@/lib/harmonies/engine/harmony-executor';

/**
 * POST /api/harmonies/:id/test
 *
 * Tests a harmony transformation with a given input value.
 * Returns the transformed output and metadata about which rule matched.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // Auth check
  let ctx;
  try {
    ctx = await getOrgContext();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  try {
    const harmonyId = params.id;
    const body = await request.json();
    const { input } = body;

    if (input === undefined) {
      return NextResponse.json({ error: 'Input is required' }, { status: 400 });
    }

    // Load the harmony from the library
    const harmony = getHarmonyById(harmonyId);

    if (!harmony) {
      return NextResponse.json({ error: 'Harmony not found' }, { status: 404 });
    }

    // Apply the harmony transformation
    try {
      const executor = new HarmonyExecutor(harmony);
      const result = await executor.execute({
        value: input,
        source: 'test' // Testing source
      });

      // Check if the value was transformed
      const matched = result.value !== input;
      const output = result.value;

      // Find which rule matched (if any)
      let matchedRule = result.ruleApplied;
      let explanation = '';

      if (result.ruleApplied) {
        explanation = 'Transformation applied';
      } else {
        explanation = 'No matching rule found - value would pass through unchanged';
      }

      return NextResponse.json({
        matched,
        output,
        rule: matchedRule,
        explanation,
      });
    } catch (error) {
      // Transformation error
      const msg = error instanceof Error ? error.message : 'Transformation failed';
      return NextResponse.json({
        matched: false,
        output: null,
        rule: null,
        explanation: `Error: ${msg}`,
      });
    }
  } catch (error) {
    captureWithOrgContext(error, ctx.orgId, {
      route: '/api/harmonies/[id]/test',
      harmonyId: params.id,
    });
    console.error('Failed to test harmony:', error);
    return NextResponse.json({ error: 'Failed to test harmony' }, { status: 500 });
  }
}
