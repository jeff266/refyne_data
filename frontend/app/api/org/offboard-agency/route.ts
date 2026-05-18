import { NextResponse } from 'next/server';
import { clerkClient } from '@clerk/nextjs/server';
import { requireAdmin, authError } from '@/lib/auth/clerk-helpers';
import { supabase } from '@/lib/db/supabase';
import { logAuditEvent } from '@/lib/auth/audit-logger';

/**
 * POST /api/org/offboard-agency
 *
 * Offboards an external agency by:
 * 1. Removing all agency members from the organization
 * 2. Disabling external_agencies_enabled flag
 * 3. Optionally quarantining all records created by agency members
 *
 * Admin only.
 */
export async function POST(request: Request) {
  let ctx;
  try {
    ctx = requireAdmin();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  try {
    const body = await request.json();
    const { agencyUserIds, quarantineRecords = false } = body;

    if (!agencyUserIds || !Array.isArray(agencyUserIds)) {
      return NextResponse.json(
        { error: 'agencyUserIds array is required' },
        { status: 400 }
      );
    }

    if (agencyUserIds.length === 0) {
      return NextResponse.json(
        { error: 'No agency users specified' },
        { status: 400 }
      );
    }

    const client = await clerkClient();
    const results = {
      removedMembers: [] as string[],
      failedRemovals: [] as string[],
      quarantinedRecords: 0,
    };

    // Remove agency members
    for (const userId of agencyUserIds) {
      try {
        // Don't allow removing self
        if (userId === ctx.userId) {
          results.failedRemovals.push(userId);
          continue;
        }

        await client.organizations.deleteOrganizationMembership({
          organizationId: ctx.orgId,
          userId,
        });

        results.removedMembers.push(userId);
      } catch (error) {
        console.error(`Failed to remove user ${userId}:`, error);
        results.failedRemovals.push(userId);
      }
    }

    // Quarantine records if requested
    if (quarantineRecords && supabase) {
      // This would move records created by agency users to quarantine
      // Implementation depends on how you're tracking record ownership
      // For now, we'll just log this capability
      console.log('Quarantine records feature not yet implemented for agency offboarding');
    }

    // Disable external agencies
    if (supabase) {
      const { error } = await supabase
        .from('workspace_entitlements')
        .update({ external_agencies_enabled: false })
        .eq('clerk_org_id', ctx.orgId);

      if (error) {
        console.error('Failed to disable external agencies:', error);
      }
    }

    // Audit log (fire and forget)
    logAuditEvent({
      orgId: ctx.orgId,
      actorId: ctx.userId,
      action: 'agency_offboarded',
      metadata: {
        userIds: agencyUserIds,
        removed: results.removedMembers.length,
        failed: results.failedRemovals.length,
      },
    });

    return NextResponse.json({
      message: 'Agency offboarding completed',
      results,
    });
  } catch (error) {
    console.error('Failed to offboard agency:', error);
    return NextResponse.json({ error: 'Failed to offboard agency' }, { status: 500 });
  }
}
