#!/usr/bin/env tsx
/**
 * Set Refyne Staff Flag
 *
 * Sets publicMetadata.isRefyneStaff = true for a user in Clerk.
 *
 * Usage:
 *   USER_ID=user_xxx npx tsx scripts/set-refyne-staff.ts
 *   npx tsx scripts/set-refyne-staff.ts user_xxx
 */

import { clerkClient } from '@clerk/nextjs/server';

async function setRefyneStaff() {
  // Get userId from env or command line
  const userId = process.env.USER_ID || process.argv[2];

  if (!userId) {
    console.error('Error: USER_ID is required');
    console.error('Usage: USER_ID=user_xxx npx tsx scripts/set-refyne-staff.ts');
    console.error('   or: npx tsx scripts/set-refyne-staff.ts user_xxx');
    process.exit(1);
  }

  if (!userId.startsWith('user_')) {
    console.error(`Error: Invalid user ID format: ${userId}`);
    console.error('User IDs should start with "user_"');
    process.exit(1);
  }

  console.log(`Setting isRefyneStaff = true for ${userId}...`);

  try {
    const client = await clerkClient();

    // Update user metadata
    const user = await client.users.updateUser(userId, {
      publicMetadata: {
        isRefyneStaff: true,
      },
    });

    console.log(`✅ Done - isRefyneStaff set to true for ${userId}`);

    // Show current metadata for verification
    if (user.publicMetadata) {
      console.log('Current publicMetadata:', JSON.stringify(user.publicMetadata, null, 2));
    }

  } catch (error: any) {
    console.error('❌ Failed to update user:', error.message);

    if (error.status === 404) {
      console.error(`User ${userId} not found in Clerk`);
    }

    process.exit(1);
  }
}

setRefyneStaff();
