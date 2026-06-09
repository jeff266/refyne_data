import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { requireAdmin } from '@/lib/auth/roles';
import { clerkClient } from '@clerk/nextjs/server';

export const dynamic = 'force-dynamic';

interface InviteRequest {
  invites: Array<{
    email: string;
    role: 'org:admin' | 'org:member';
  }>;
}

/**
 * POST /api/onboarding/invite
 *
 * Send organization invitations via Clerk.
 * Auth: Admin only
 */
export async function POST(request: NextRequest) {
  let ctx;
  try {
    ctx = await getOrgContext();
    requireAdmin(ctx.orgRole);
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  try {
    const body: InviteRequest = await request.json();
    const { invites } = body;

    if (!Array.isArray(invites) || invites.length === 0) {
      return NextResponse.json({ error: 'No invites provided' }, { status: 400 });
    }

    const results = await Promise.allSettled(
      invites.map(async (invite) => {
        await clerkClient.organizations.createOrganizationInvitation({
          organizationId: ctx.orgId,
          emailAddress: invite.email,
          role: invite.role,
          redirectUrl: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`,
        });
        return invite.email;
      })
    );

    const sent = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results
      .filter((r) => r.status === 'rejected')
      .map((r, i) => ({
        email: invites[i].email,
        error: r.status === 'rejected' ? r.reason.message : 'Unknown error',
      }));

    console.log(`[Invite] Sent ${sent}/${invites.length} invitations for org ${ctx.orgId}`);

    return NextResponse.json({ sent, failed });
  } catch (error) {
    console.error('[Invite] Error:', error);
    return NextResponse.json(
      { error: 'Failed to send invitations' },
      { status: 500 }
    );
  }
}
