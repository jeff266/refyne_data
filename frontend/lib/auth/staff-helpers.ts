/**
 * Staff Authorization Helpers
 *
 * Checks if a user has Refyne staff permissions via Clerk publicMetadata
 */

import { clerkClient } from '@clerk/nextjs/server';

/**
 * Check if a user is Refyne staff
 * @param userId - Clerk user ID
 * @returns true if user has isRefyneStaff = true in publicMetadata
 */
export async function isRefyneStaff(userId: string): Promise<boolean> {
  try {
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    return user.publicMetadata?.isRefyneStaff === true;
  } catch (error) {
    console.error('[Staff Check] Failed to check staff status:', error);
    return false;
  }
}

/**
 * Require staff access - throws if not staff
 * @param userId - Clerk user ID
 * @throws Error if user is not staff
 */
export async function requireRefyneStaff(userId: string): Promise<void> {
  const isStaff = await isRefyneStaff(userId);
  if (!isStaff) {
    throw new Error('Staff access required');
  }
}
