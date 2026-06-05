import { NextResponse } from 'next/server';
import { clerkClient } from '@clerk/nextjs/server';
import { supabase } from '@/lib/db/supabase';
import { requireAdmin, authError } from '@/lib/auth/clerk-helpers';
import { captureWithOrgContext } from '@/lib/monitoring/sentry';

const NOTIFICATION_TYPES = [
  'always_on_digest',
  'compliance_threshold_alert',
  'dedup_pairs_detected',
  'enrich_run_complete',
  'normalize_run_complete',
  'credit_limit_warning',
  'member_joined',
] as const;

type NotificationType = (typeof NOTIFICATION_TYPES)[number];

/**
 * GET /api/org/notifications
 *
 * Returns notification subscriptions for all org members.
 * Auth: org:admin
 */
export async function GET() {
  let ctx;
  try {
    ctx = await requireAdmin();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  try {
    if (!supabase) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    const client = await clerkClient();

    // Get org members from Clerk
    const membershipList = await client.organizations.getOrganizationMembershipList({
      organizationId: ctx.orgId,
    });

    // Get all subscriptions for org
    const { data: subscriptions, error } = await supabase
      .from('notification_subscriptions')
      .select('*')
      .eq('org_id', ctx.orgId);

    if (error) {
      captureWithOrgContext(error, ctx.orgId, { route: '/api/org/notifications' });
      console.error('Failed to fetch subscriptions:', error);
      return NextResponse.json({ error: 'Failed to fetch subscriptions' }, { status: 500 });
    }

    // Build subscription map per user
    const subsByUser = new Map<string, Map<NotificationType, { subscribed: boolean; mandatory: boolean }>>();

    for (const sub of subscriptions || []) {
      if (!subsByUser.has(sub.user_id)) {
        subsByUser.set(sub.user_id, new Map());
      }
      subsByUser.get(sub.user_id)!.set(sub.notification_type as NotificationType, {
        subscribed: sub.subscribed,
        mandatory: sub.mandatory,
      });
    }

    // Map members with their subscriptions
    const members = membershipList.data.map((membership) => {
      const userId = membership.publicUserData?.userId || '';
      const userSubs = subsByUser.get(userId) || new Map();

      const subscriptions: Record<NotificationType, { subscribed: boolean; mandatory: boolean }> = {} as any;
      for (const type of NOTIFICATION_TYPES) {
        subscriptions[type] = userSubs.get(type) || { subscribed: false, mandatory: false };
      }

      return {
        userId,
        name: `${membership.publicUserData?.firstName || ''} ${membership.publicUserData?.lastName || ''}`.trim(),
        email: membership.publicUserData?.identifier || '',
        role: membership.role,
        subscriptions,
      };
    });

    return NextResponse.json({ members });
  } catch (error) {
    captureWithOrgContext(error, ctx.orgId, { route: '/api/org/notifications' });
    console.error('Failed to get org notifications:', error);
    return NextResponse.json({ error: 'Failed to get org notifications' }, { status: 500 });
  }
}
