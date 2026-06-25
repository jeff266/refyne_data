import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

/**
 * Super Admin Auth Guard
 *
 * Checks if the current user is a super admin based on Clerk publicMetadata.
 * Super admins have refyne_role: 'super_admin' in their Clerk user metadata.
 *
 * Usage in API routes:
 *   await requireSuperAdmin();
 *
 * Usage in page components:
 *   const isSuperAdmin = await checkIsSuperAdmin();
 *   if (!isSuperAdmin) redirect('/dashboard');
 */

/**
 * Throws 403 if user is not a super admin.
 * Use in API routes to protect admin endpoints.
 */
export async function requireSuperAdmin(): Promise<void> {
  const { sessionClaims } = await auth();

  if (!sessionClaims) {
    throw NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  const metadata = sessionClaims.public_metadata as { refyne_role?: string } | undefined;
  const refyneRole = metadata?.refyne_role;

  if (refyneRole !== 'super_admin') {
    throw NextResponse.json(
      { error: 'Forbidden: Super admin access required' },
      { status: 403 }
    );
  }
}

/**
 * Returns true if user is a super admin.
 * Use in page components for conditional rendering or redirects.
 */
export async function checkIsSuperAdmin(): Promise<boolean> {
  const { sessionClaims } = await auth();

  if (!sessionClaims) {
    return false;
  }

  const metadata = sessionClaims.public_metadata as { refyne_role?: string } | undefined;
  const refyneRole = metadata?.refyne_role;
  return refyneRole === 'super_admin';
}

/**
 * Gets the current user ID if they are a super admin.
 * Returns null if not authenticated or not a super admin.
 */
export async function getSuperAdminUserId(): Promise<string | null> {
  const { sessionClaims, userId } = await auth();

  if (!sessionClaims || !userId) {
    return null;
  }

  const metadata = sessionClaims.public_metadata as { refyne_role?: string } | undefined;
  const refyneRole = metadata?.refyne_role;
  return refyneRole === 'super_admin' ? userId : null;
}
