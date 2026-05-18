import { NextResponse } from 'next/server';
import { clerkClient } from '@clerk/nextjs/server';
import { requireAdmin, authError } from '@/lib/auth/clerk-helpers';
import { wouldRemoveLastAdmin } from '@/lib/auth/admin-guard';
import { logAuditEvent } from '@/lib/auth/audit-logger';

/**
 * PUT /api/org/members/[userId]/role
 *
 * Changes a member's role (admin only).
 * Prevents demoting the last admin.
 */
export async function PUT(
  request: Request,
  { params }: { params: { userId: string } }
) {
  let ctx;
  try {
    ctx = requireAdmin();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  try {
    const { userId } = params;
    const body = await request.json();
    const { role } = body;

    if (!userId || !role) {
      return NextResponse.json({ error: 'userId and role are required' }, { status: 400 });
    }

    if (!['org:admin', 'org:operator', 'org:viewer'].includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    const client = await clerkClient();

    // Get current member info
    const { data: members } = await client.organizations.getOrganizationMembershipList({
      organizationId: ctx.orgId,
    });

    const currentMember = members.find((m) => m.publicUserData?.userId === userId);

    if (!currentMember) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    // If demoting from admin, check if this would remove the last admin
    if (currentMember.role === 'org:admin' && role !== 'org:admin') {
      const isLastAdmin = await wouldRemoveLastAdmin(ctx.orgId, userId);
      if (isLastAdmin) {
        return NextResponse.json(
          { error: 'Cannot demote the last admin. Promote another member to admin first.' },
          { status: 400 }
        );
      }
    }

    // Capture before state
    const beforeRole = currentMember.role;

    // Update the role
    await client.organizations.updateOrganizationMembership({
      organizationId: ctx.orgId,
      userId,
      role,
    });

    // Audit log (fire and forget)
    logAuditEvent({
      orgId: ctx.orgId,
      actorId: ctx.userId,
      action: 'role_changed',
      targetId: userId,
      metadata: { before: beforeRole, after: role },
    });

    return NextResponse.json({
      message: 'Role updated successfully',
      userId,
      role,
    });
  } catch (error) {
    console.error('Failed to update role:', error);
    return NextResponse.json({ error: 'Failed to update role' }, { status: 500 });
  }
}
