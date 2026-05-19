import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

/**
 * PUT /api/profile/workspace/activate
 *
 * Activate a workspace (set as active organization).
 * Auth: any authenticated user
 */
export async function PUT(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { orgId } = body;

    if (!orgId) {
      return NextResponse.json(
        { error: 'orgId is required' },
        { status: 400 }
      );
    }

    // Note: setActive() is a client-side method, so this endpoint
    // just validates the request. The actual activation happens
    // client-side using Clerk's useOrganization() hook.
    // This endpoint can be used for logging/analytics if needed.

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to activate workspace:', error);
    return NextResponse.json(
      { error: 'Failed to activate workspace' },
      { status: 500 }
    );
  }
}
