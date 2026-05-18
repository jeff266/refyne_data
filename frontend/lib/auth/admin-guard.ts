/**
 * Admin Guard Utilities
 *
 * Provides safety checks for admin operations like member removal and role changes.
 */

import { clerkClient } from '@clerk/nextjs/server';

/**
 * Check if removing this user would remove the last admin from the organization.
 *
 * @param orgId - The organization ID
 * @param userId - The user ID being removed or demoted
 * @returns true if this would remove the last admin, false otherwise
 */
export async function wouldRemoveLastAdmin(orgId: string, userId: string): Promise<boolean> {
  try {
    const client = await clerkClient();

    // Get all members of the organization
    const { data: members } = await client.organizations.getOrganizationMembershipList({
      organizationId: orgId,
    });

    // Count admins (excluding the user being removed/demoted)
    const adminCount = members.filter(
      (m) => m.role === 'org:admin' && m.publicUserData?.userId !== userId
    ).length;

    // If there are no other admins, this would remove the last admin
    return adminCount === 0;
  } catch (error) {
    console.error('Error checking admin count:', error);
    // Fail safe: assume it would remove last admin to prevent accidental lockout
    return true;
  }
}

/**
 * Check if a user is the only admin in the organization.
 *
 * @param orgId - The organization ID
 * @param userId - The user ID to check
 * @returns true if user is the only admin, false otherwise
 */
export async function isOnlyAdmin(orgId: string, userId: string): Promise<boolean> {
  try {
    const client = await clerkClient();

    // Get all members
    const { data: members } = await client.organizations.getOrganizationMembershipList({
      organizationId: orgId,
    });

    // Find all admins
    const admins = members.filter((m) => m.role === 'org:admin');

    // Check if this user is the only admin
    return admins.length === 1 && admins[0].publicUserData?.userId === userId;
  } catch (error) {
    console.error('Error checking if only admin:', error);
    return true; // Fail safe
  }
}
