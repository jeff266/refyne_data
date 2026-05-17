import { NextRequest, NextResponse } from 'next/server';
import { executeHarmoniesPreview } from '@/lib/mcp';
import type { HarmoniesPreviewInput } from '@/lib/mcp/types';

/**
 * POST /api/harmonies/preview
 *
 * Runs harmonies_preview tool via API route.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as HarmoniesPreviewInput;

    const result = await executeHarmoniesPreview(body);

    if (result.success) {
      return NextResponse.json(result);
    } else {
      return NextResponse.json(result, { status: 400 });
    }
  } catch (error) {
    console.error('Harmonies preview error:', error);
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
