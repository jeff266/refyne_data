import { NextRequest, NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { z } from 'zod';

/**
 * PUT /api/profile/workspace/activate
 *
 * Activate a workspace (set as active organization).
 * Auth: any authenticated user who is a member of the target organization
 *
 * SECURITY: Validates orgId with Zod and verifies user membership via Clerk.
 */

const activateWorkspaceSchema = z.object({
  orgId: z.string().min(1, 'orgId is required').startsWith('org_', 'orgId must be a valid Clerk organization ID'),
});

export async function PUT(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Parse and validate request body with Zod
    const body = await request.json();
    const validation = activateWorkspaceSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Invalid request',
          details: validation.error.flatten().fieldErrors
        },
        { status: 400 }
      );
    }

    const { orgId } = validation.data;

    // SECURITY: Verify user is a member of this organization via Clerk
    try {
      const client = await clerkClient();
      const { data: memberships } = await client.organizations.getOrganizationMembershipList({
        organizationId: orgId,
      });

      const membership = memberships.find((m) => m.publicUserData?.userId === userId);

      if (!membership) {
        return NextResponse.json(
          { error: 'You are not a member of this organization' },
          { status: 403 }
        );
      }
    } catch (clerkError: any) {
      // If Clerk returns 404, user is not a member
      if (clerkError?.status === 404 || clerkError?.errors?.[0]?.code === 'resource_not_found') {
        return NextResponse.json(
          { error: 'You are not a member of this organization' },
          { status: 403 }
        );
      }
      // Other Clerk errors
      console.error('Clerk membership check failed:', clerkError);
      return NextResponse.json(
        { error: 'Failed to verify organization membership' },
        { status: 500 }
      );
    }

    // Note: setActive() is a client-side method, so this endpoint
    // just validates the request. The actual activation happens
    // client-side using Clerk's useOrganization() hook.
    // This endpoint can be used for logging/analytics if needed.

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to activate workspace:', error);
    return NextResponse.json(
      { error: 'Failed to activate workspace' },
      { status: 500 }
    );
  }
}
