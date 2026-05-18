import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

export type OrgRole = 'org:admin' | 'org:operator' | 'org:viewer';

export interface OrgContext {
  orgId: string;
  orgRole: OrgRole;
  userId: string;
  userEmail?: string;
}

export function getOrgContext(): OrgContext {
  const { orgId, orgRole, userId, sessionClaims } = auth();
  if (!orgId || !userId) {
    throw new Error('UNAUTHENTICATED');
  }
  const userEmail = sessionClaims?.email as string | undefined;
  return { orgId, orgRole: orgRole as OrgRole, userId, userEmail };
}

export function requireAdmin(): OrgContext {
  const ctx = getOrgContext();
  if (ctx.orgRole !== 'org:admin') {
    throw new Error('FORBIDDEN');
  }
  return ctx;
}

export function requireOperatorOrAbove(): OrgContext {
  const ctx = getOrgContext();
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
