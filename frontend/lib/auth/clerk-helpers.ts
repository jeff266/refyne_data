import { auth, clerkClient } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

export type OrgRole = 'org:admin' | 'org:operator' | 'org:viewer';

export interface OrgContext {
  orgId: string;
  orgRole: OrgRole;
  userId: string;
  userEmail?: string;
}

export async function getOrgContext(): Promise<OrgContext> {
  const { orgId, orgRole, userId, sessionClaims } = await auth();

  if (!userId) {
    throw new Error('UNAUTHENTICATED');
  }

  const userEmail = sessionClaims?.email as string | undefined;

  // If no active org, fall back to user's first org membership
  if (!orgId) {
    const client = await clerkClient();
    const userMemberships = await client.users.getOrganizationMembershipList({ userId });
    const firstMembership = userMemberships.data[0];

    if (!firstMembership) {
      throw new Error('UNAUTHENTICATED');
    }

    return {
      orgId: firstMembership.organization.id,
      orgRole: firstMembership.role as OrgRole,
      userId,
      userEmail,
    };
  }

  return { orgId, orgRole: orgRole as OrgRole, userId, userEmail };
}

export async function requireAdmin(): Promise<OrgContext> {
  const ctx = await getOrgContext();
  if (ctx.orgRole !== 'org:admin') {
    throw new Error('FORBIDDEN');
  }
  return ctx;
}

export async function requireOperatorOrAbove(): Promise<OrgContext> {
  const ctx = await getOrgContext();
  if (ctx.orgRole === 'org:viewer') {
    throw new Error('FORBIDDEN');
  }
  return ctx;
}

export function authError(error: unknown): NextResponse | null {
  if (error instanceof Error) {
    if (error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    if (error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }
  }
  return null;
}
