import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, authError } from '@/lib/auth/clerk-helpers';
import { clerkClient } from '@clerk/nextjs/server';

export const dynamic = 'force-dynamic';

/**
 * PATCH /api/team/members/[userId]
 *
 * Update a member's role.
 * Auth: Admin only
 * Validations: Cannot demote last admin, cannot modify yourself
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  let ctx;
  try {
    ctx = await requireAdmin();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  const { userId } = params;

  try {
    const body = await request.json();
    const { role } = body;

    if (!role || !['org:admin', 'org:member'].includes(role)) {
      return NextResponse.json(
        { error: 'Invalid role. Must be org:admin or org:member' },
        { status: 400 }
      );
    }

    // Cannot modify yourself
    if (userId === ctx.userId) {
      return NextResponse.json(
        { error: 'Cannot change your own role' },
        { status: 400 }
      );
    }

    // If demoting to member, verify not the last admin
    if (role === 'org:member') {
      const { data: memberships } = await clerkClient.organizations.getOrganizationMembershipList({
        organizationId: ctx.orgId,
      });

      const adminCount = memberships.filter((m) => m.role === 'org:admin').length;

      if (adminCount <= 1) {
        return NextResponse.json(
          { error: 'Cannot demote the last admin. Promote another member first.' },
          { status: 400 }
        );
      }
    }

    // Update role via Clerk
    await clerkClient.organizations.updateOrganizationMembership({
      organizationId: ctx.orgId,
      userId,
      role,
    });

    console.log(`[Team] Updated ${userId} to role ${role} in org ${ctx.orgId}`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Team Members] Error updating member:', error);
    return NextResponse.json(
      { error: 'Failed to update member role' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/team/members/[userId]
 *
 * Remove a member from the organization.
 * Auth: Admin only
 * Validations: Cannot remove yourself, cannot remove last admin
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  let ctx;
  try {
    ctx = await requireAdmin();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  const { userId } = params;

  try {
    // Cannot remove yourself
    if (userId === ctx.userId) {
      return NextResponse.json(
        { error: 'Cannot remove yourself from the organization' },
        { status: 400 }
      );
    }

    // Get member to check if they're an admin
    const { data: memberships } = await clerkClient.organizations.getOrganizationMembershipList({
      organizationId: ctx.orgId,
    });

    const targetMember = memberships.find((m) => m.publicUserData.userId === userId);

    if (!targetMember) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    // If removing an admin, verify not the last admin
    if (targetMember.role === 'org:admin') {
      const adminCount = memberships.filter((m) => m.role === 'org:admin').length;

      if (adminCount <= 1) {
        return NextResponse.json(
          { error: 'Cannot remove the last admin. Promote another member first.' },
          { status: 400 }
        );
      }
    }

    // Delete membership via Clerk
    await clerkClient.organizations.deleteOrganizationMembership({
      organizationId: ctx.orgId,
      userId,
    });

    console.log(`[Team] Removed ${userId} from org ${ctx.orgId}`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Team Members] Error removing member:', error);
    return NextResponse.json(
      { error: 'Failed to remove member' },
      { status: 500 }
    );
  }
}
