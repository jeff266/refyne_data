import { NextResponse } from 'next/server';
import { requireAdmin, authError } from '@/lib/auth/clerk-helpers';
import { clerkClient } from '@clerk/nextjs/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/team/invitations
 *
 * List all pending invitations for the organization.
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
    // Get organization invitations from Clerk
    const { data: invitations } = await clerkClient.organizations.getOrganizationInvitationList({
      organizationId: ctx.orgId,
      status: ['pending'],
    });

    // Transform to simpler format
    const pendingInvitations = invitations.map((invitation) => ({
      id: invitation.id,
      emailAddress: invitation.emailAddress,
      role: invitation.role,
      createdAt: invitation.createdAt,
    }));

    return NextResponse.json({ invitations: pendingInvitations });
  } catch (error) {
    console.error('[Team Invitations] Error fetching invitations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch invitations' },
      { status: 500 }
    );
  }
}
