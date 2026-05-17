import { NextResponse } from 'next/server';
import { getLibrarySummary } from '@/lib/harmonies/library';

/**
 * GET /api/harmonies
 *
 * Returns a summary of all Harmonies in the library.
 */
export async function GET() {
  try {
    const summary = getLibrarySummary();
    return NextResponse.json(summary);
  } catch (error) {
    console.error('Failed to get harmonies:', error);
    return NextResponse.json(
      { error: 'Failed to load harmonies' },
      { status: 500 }
    );
  }
}
