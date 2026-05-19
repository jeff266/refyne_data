import { NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { captureWithOrgContext } from '@/lib/monitoring/sentry';

interface WorkspaceMembership {
  orgId: string;
  orgName: string;
  role: string;
}

/**
 * GET /api/profile/workspaces
 *
 * Get all workspace memberships for the current user.
 * Auth: any authenticated user
 */
export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Get all org memberships for this user
    const memberships = await clerkClient().users.getOrganizationMembershipList({
      userId,
    });

    const workspaces: WorkspaceMembership[] = memberships.data.map((membership) => ({
      orgId: membership.organization.id,
      orgName: membership.organization.name,
      role: membership.role,
    }));

    return NextResponse.json({ memberships: workspaces });
  } catch (error) {
    console.error('Failed to get workspace memberships:', error);
    return NextResponse.json(
      { error: 'Failed to get workspaces' },
      { status: 500 }
    );
  }
}
