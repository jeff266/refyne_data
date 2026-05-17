import { NextRequest, NextResponse } from 'next/server';
import { executeHarmoniesApply } from '@/lib/mcp';
import type { HarmoniesApplyInput } from '@/lib/mcp/types';

/**
 * POST /api/harmonies/apply
 *
 * Runs harmonies_apply tool via API route.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as HarmoniesApplyInput;

    const result = await executeHarmoniesApply(body);

    if (result.success) {
      return NextResponse.json(result);
    } else {
      return NextResponse.json(result, { status: 400 });
    }
  } catch (error) {
    console.error('Harmonies apply error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'server_error',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      },
      { status: 500 }
    );
  }
}
