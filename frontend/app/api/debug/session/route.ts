import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

/**
 * GET /api/debug/session
 *
 * Debug endpoint to inspect session claims
 */
export async function GET() {
  const { sessionClaims, userId } = await auth();

  return NextResponse.json({
    userId,
    sessionClaims,
    publicMetadata: sessionClaims?.public_metadata,
    refyneRole: (sessionClaims?.public_metadata as any)?.refyne_role,
  }, {
    headers: {
      'Content-Type': 'application/json',
    },
  });
}
