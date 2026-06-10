import { NextResponse } from 'next/server';
import { requireAdmin, authError } from '@/lib/auth/clerk-helpers';
import { clerkClient } from '@clerk/nextjs/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/team/members
 *
 * List all members in the organization.
 * Auth: Admin only
 */
export async function GET() {
  let ctx;
  try {
    ctx = await requireAdmin();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  try {
    // Get organization memberships from Clerk
    const { data: memberships } = await clerkClient.organizations.getOrganizationMembershipList({
      organizationId: ctx.orgId,
    });

    // Transform to simpler format
    const members = memberships
      .filter((membership) => membership.publicUserData != null)
      .map((membership) => ({
        userId: membership.publicUserData!.userId,
        email: membership.publicUserData!.identifier,
        firstName: membership.publicUserData!.firstName || '',
        lastName: membership.publicUserData!.lastName || '',
        role: membership.role,
        joinedAt: membership.createdAt,
      }));

    return NextResponse.json({ members });
  } catch (error) {
    console.error('[Team Members] Error fetching members:', error);
    return NextResponse.json(
      { error: 'Failed to fetch team members' },
      { status: 500 }
    );
  }
}
