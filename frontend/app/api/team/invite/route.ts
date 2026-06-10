import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, authError } from '@/lib/auth/clerk-helpers';
import { clerkClient } from '@clerk/nextjs/server';
import { checkRateLimit, rateLimiters } from '@/lib/api/rate-limit';

export const dynamic = 'force-dynamic';

interface InviteRequest {
  email: string;
  role: 'org:admin' | 'org:member';
}

/**
 * POST /api/team/invite
 *
 * Send an organization invitation.
 * Auth: Admin only
 */
export async function POST(request: NextRequest) {
  let ctx;
  try {
    ctx = await requireAdmin();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  // Rate limiting: prevent invitation spam
  const rateLimitResult = await checkRateLimit(rateLimiters.invite, ctx.orgId);
  if (rateLimitResult) return rateLimitResult;

  try {
    const body: InviteRequest = await request.json();
    const { email, role } = body;

    if (!email || !role) {
      return NextResponse.json(
        { error: 'Email and role are required' },
        { status: 400 }
      );
    }

    if (!['org:admin', 'org:member'].includes(role)) {
      return NextResponse.json(
        { error: 'Invalid role. Must be org:admin or org:member' },
        { status: 400 }
      );
    }

    // Prevent self-invitation
    if (ctx.userEmail && email.toLowerCase() === ctx.userEmail.toLowerCase()) {
      console.log(`[Team Invite] Blocked self-invitation attempt: ${email}`);
      return NextResponse.json(
        {
          error: 'cannot_invite_self',
          message: 'You cannot invite yourself to the organization'
        },
        { status: 400 }
      );
    }

    // Create invitation via Clerk
    await clerkClient.organizations.createOrganizationInvitation({
      organizationId: ctx.orgId,
      inviterUserId: ctx.userId,
      emailAddress: email,
      role,
      redirectUrl: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`,
    });

    console.log(`[Team Invite] Sent invitation to ${email} as ${role} for org ${ctx.orgId}`);

    return NextResponse.json({ success: true, email });
  } catch (error: any) {
    console.error('[Team Invite] Clerk error details:', {
      message: error?.message,
      errors: error?.errors,
      status: error?.status,
      clerkTraceId: error?.clerkTraceId,
      fullError: JSON.stringify(error, null, 2)
    });

    // Extract detailed error information
    const clerkError = error?.errors?.[0];
    const errorCode = clerkError?.code || error?.code || 'invitation_failed';
    const errorMessage = clerkError?.message || error?.message || 'Failed to send invitation';
    const longMessage = clerkError?.longMessage || null;

    return NextResponse.json(
      {
        error: errorCode,
        message: errorMessage,
        details: longMessage
      },
      { status: 400 }
    );
  }
}
