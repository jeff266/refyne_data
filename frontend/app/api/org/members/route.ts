import { NextResponse } from 'next/server';
import { clerkClient } from '@clerk/nextjs/server';
import { getOrgContext, requireAdmin, authError } from '@/lib/auth/clerk-helpers';
import { logAuditEvent } from '@/lib/auth/audit-logger';
import { getBillingContext } from '@/lib/billing/check-feature';
import { getPlanFeatures, getNextPlanWithMoreSeats } from '@/lib/billing/plan-features';

/**
 * GET /api/org/members
 *
 * Returns list of organization members.
 */
export async function GET() {
  let ctx;
  try {
    ctx = await getOrgContext();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  try {
    const client = await clerkClient();

    const { data: members } = await client.organizations.getOrganizationMembershipList({
      organizationId: ctx.orgId,
    });

    const formattedMembers = members.map((m) => ({
      userId: m.publicUserData?.userId || '',
      firstName: m.publicUserData?.firstName || '',
      lastName: m.publicUserData?.lastName || '',
      email: m.publicUserData?.identifier || '',
      imageUrl: m.publicUserData?.imageUrl || '',
      role: m.role,
      createdAt: m.createdAt,
    }));

    return NextResponse.json({ members: formattedMembers });
  } catch (error) {
    console.error('Failed to get org members:', error);
    return NextResponse.json({ error: 'Failed to get members' }, { status: 500 });
  }
}

/**
 * POST /api/org/members
 *
 * Invites a new member to the organization (admin only).
 */
export async function POST(request: Request) {
  let ctx;
  try {
    ctx = await requireAdmin();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  try {
    const body = await request.json();
    const { email, role } = body;

    if (!email || !role) {
      return NextResponse.json({ error: 'email and role are required' }, { status: 400 });
    }

    if (!['org:admin', 'org:operator', 'org:viewer'].includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    const client = await clerkClient();

    // Check seat limits for non-viewer invitations
    if (role !== 'org:viewer') {
      const billing = await getBillingContext(ctx.orgId);
      const features = getPlanFeatures(billing.plan, billing.alwaysOnAddon);

      // Get current member count
      const { data: members } = await client.organizations.getOrganizationMembershipList({
        organizationId: ctx.orgId,
      });

      // Count non-viewer members
      const nonViewerCount = members.filter(
        (m) => m.role === 'org:admin' || m.role === 'org:operator'
      ).length;

      // Check if at limit
      if (nonViewerCount >= features.max_operators) {
        const upgradeTo = getNextPlanWithMoreSeats(billing.plan);
        return NextResponse.json(
          {
            error: 'seat_limit_reached',
            current: nonViewerCount,
            limit: features.max_operators,
            upgradeTo,
          },
          { status: 409 }
        );
      }
    }

    const invitation = await client.organizations.createOrganizationInvitation({
      organizationId: ctx.orgId,
      inviterUserId: ctx.userId,
      emailAddress: email,
      role,
    });

    // Audit log (fire and forget)
    logAuditEvent({
      orgId: ctx.orgId,
      actorId: ctx.userId,
      action: 'member_invited',
      metadata: { email, role },
    });

    return NextResponse.json({
      message: 'Invitation sent',
      invitationId: invitation.id,
    });
  } catch (error: any) {
    console.error('Failed to invite member:', error);

    if (error.errors?.[0]?.code === 'duplicate_record') {
      return NextResponse.json(
        { error: 'User is already a member or has a pending invitation' },
        { status: 409 }
      );
    }

    return NextResponse.json({ error: 'Failed to invite member' }, { status: 500 });
  }
}
