import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, authError } from '@/lib/auth/clerk-helpers';
import { clerkClient } from '@clerk/nextjs/server';

export const dynamic = 'force-dynamic';

/**
 * DELETE /api/team/invitations/[invitationId]
 *
 * Revoke a pending invitation.
 * Auth: Admin only
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { invitationId: string } }
) {
  let ctx;
  try {
    ctx = await requireAdmin();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  const { invitationId } = params;

  try {
    // Revoke invitation via Clerk
    await clerkClient.organizations.revokeOrganizationInvitation({
      organizationId: ctx.orgId,
      invitationId,
    });

    console.log(`[Team] Revoked invitation ${invitationId} for org ${ctx.orgId}`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Team Invitations] Error revoking invitation:', error);
    return NextResponse.json(
      { error: 'Failed to revoke invitation' },
      { status: 500 }
    );
  }
}
