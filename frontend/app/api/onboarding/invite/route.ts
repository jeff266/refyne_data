import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { requireAdmin } from '@/lib/auth/roles';
import { clerkClient } from '@clerk/nextjs/server';
import { checkRateLimit, rateLimiters } from '@/lib/api/rate-limit';

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

  // Rate limiting: prevent invitation spam
  const rateLimitResult = await checkRateLimit(rateLimiters.invite, ctx.orgId);
  if (rateLimitResult) return rateLimitResult;

  try {
    const body: InviteRequest = await request.json();
    const { invites } = body;

    if (!Array.isArray(invites) || invites.length === 0) {
      return NextResponse.json({ error: 'No invites provided' }, { status: 400 });
    }

    // Filter out self-invitations
    const currentUserEmail = ctx.userEmail?.toLowerCase();
    const filteredInvites = invites.filter(invite => {
      if (currentUserEmail && invite.email.toLowerCase() === currentUserEmail) {
        console.log(`[Invite] Blocked self-invitation attempt: ${invite.email}`);
        return false;
      }
      return true;
    });

    if (filteredInvites.length === 0) {
      return NextResponse.json({
        error: 'cannot_invite_self',
        message: 'You cannot invite yourself to the organization'
      }, { status: 400 });
    }

    const results = await Promise.allSettled(
      filteredInvites.map(async (invite) => {
        await clerkClient.organizations.createOrganizationInvitation({
          organizationId: ctx.orgId,
          inviterUserId: ctx.userId,
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
      .map((r, i) => {
        const reason = r.status === 'rejected' ? r.reason : null;
        return {
          email: filteredInvites[i].email,
          error: reason?.errors?.[0]?.message || reason?.message || 'Unknown error',
          code: reason?.errors?.[0]?.code || reason?.code,
          details: reason?.errors?.[0]?.longMessage,
        };
      });

    console.log(`[Invite] Sent ${sent}/${filteredInvites.length} invitations for org ${ctx.orgId}`);

    if (failed.length > 0) {
      console.error('[Invite] Failed invitations with details:', failed);
    }

    return NextResponse.json({ sent, failed });
  } catch (error: any) {
    console.error('[Invite] Error details:', {
      message: error?.message,
      errors: error?.errors,
      status: error?.status,
      clerkTraceId: error?.clerkTraceId,
      fullError: JSON.stringify(error, null, 2)
    });
    return NextResponse.json(
      { error: 'Failed to send invitations' },
      { status: 500 }
    );
  }
}
