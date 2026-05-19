import { NextResponse } from 'next/server';
import { clerkClient } from '@clerk/nextjs/server';
import { requireAdmin, authError } from '@/lib/auth/clerk-helpers';
import { wouldRemoveLastAdmin } from '@/lib/auth/admin-guard';
import { logAuditEvent } from '@/lib/auth/audit-logger';

/**
 * DELETE /api/org/members/[userId]
 *
 * Removes a member from the organization (admin only).
 * Prevents removing the last admin.
 */
export async function DELETE(
  request: Request,
  { params }: { params: { userId: string } }
) {
  let ctx;
  try {
    ctx = await requireAdmin();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  try {
    const { userId } = params;

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    // Prevent removing self
    if (userId === ctx.userId) {
      return NextResponse.json(
        { error: 'Cannot remove yourself from the organization' },
        { status: 400 }
      );
    }

    // Check if this would remove the last admin
    const isLastAdmin = await wouldRemoveLastAdmin(ctx.orgId, userId);
    if (isLastAdmin) {
      return NextResponse.json(
        { error: 'Cannot remove the last admin. Promote another member to admin first.' },
        { status: 400 }
      );
    }

    const client = await clerkClient();

    // Get the membership to delete
    const { data: members } = await client.organizations.getOrganizationMembershipList({
      organizationId: ctx.orgId,
    });

    const membership = members.find((m) => m.publicUserData?.userId === userId);

    if (!membership) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    // Delete the membership
    await client.organizations.deleteOrganizationMembership({
      organizationId: ctx.orgId,
      userId,
    });

    // Audit log (fire and forget)
    logAuditEvent({
      orgId: ctx.orgId,
      actorId: ctx.userId,
      action: 'member_removed',
      targetId: userId,
      metadata: { email: membership.publicUserData?.identifier },
    });

    return NextResponse.json({ message: 'Member removed successfully' });
  } catch (error) {
    console.error('Failed to remove member:', error);
    return NextResponse.json({ error: 'Failed to remove member' }, { status: 500 });
  }
}
