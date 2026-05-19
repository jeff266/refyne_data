import { NextRequest, NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';

/**
 * PUT /api/profile/display-name
 *
 * Update user's display name in Clerk.
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
    const { displayName } = body;

    if (!displayName || typeof displayName !== 'string') {
      return NextResponse.json(
        { error: 'displayName is required' },
        { status: 400 }
      );
    }

    // Split display name into first and last name
    const nameParts = displayName.trim().split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    // Update user in Clerk
    await clerkClient().users.updateUser(userId, {
      firstName,
      lastName,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to update display name:', error);
    return NextResponse.json(
      { error: 'Failed to update display name' },
      { status: 500 }
    );
  }
}
