/**
 * Record Limit Notifier
 *
 * Sends email notifications when orgs approach or exceed their record limits.
 * Tracks sent notifications to avoid duplicates within billing periods.
 */

import { Resend } from 'resend';
import { supabaseAdmin } from '@/lib/db/admin-client';
import { clerkClient } from '@clerk/nextjs/server';
import { buildEmailTemplate, buildHeading, buildParagraph } from '../emails/template';

// Lazy load Resend client
function getResendClient() {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[RecordLimitNotifier] RESEND_API_KEY not set - notifications disabled');
    return null;
  }
  return new Resend(process.env.RESEND_API_KEY);
}

type NotificationType = 'near_limit' | 'over_limit' | 'grace_period_warning' | 'grace_period_expired';

interface NotificationContext {
  orgId: string;
  totalRecords: number;
  planLimit: number;
  currentPlan: string;
  gracePeriodEndsAt?: string | null;
}

/**
 * Get organization admin email from Clerk
 */
async function getOrgAdminEmail(orgId: string): Promise<string | null> {
  try {
    const client = await clerkClient();
    const memberships = await client.organizations.getOrganizationMembershipList({
      organizationId: orgId,
    });

    // Find admin member
    const admin = memberships.data.find(m => m.role === 'org:admin');

    if (!admin) {
      console.warn(`[RecordLimitNotifier] No admin found for org ${orgId}`);
      return null;
    }

    const user = await client.users.getUser(admin.publicUserData?.userId || '');
    const email = user.emailAddresses.find(e => e.id === user.primaryEmailAddressId)?.emailAddress;

    return email || null;
  } catch (error) {
    console.error('[RecordLimitNotifier] Failed to fetch admin email:', error);
    return null;
  }
}

/**
 * Check if notification was sent recently (last 30 days)
 */
async function wasRecentlySent(
  orgId: string,
  notificationType: NotificationType
): Promise<boolean> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const { data, error } = await supabaseAdmin
    .from('record_limit_notifications')
    .select('id')
    .eq('org_id', orgId)
    .eq('notification_type', notificationType)
    .gte('sent_at', thirtyDaysAgo.toISOString())
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('[RecordLimitNotifier] Failed to check recent notifications:', error);
    return false; // Fail open - allow sending
  }

  return !!data;
}

/**
 * Record that a notification was sent
 */
async function recordNotification(
  orgId: string,
  notificationType: NotificationType,
  totalRecords: number,
  planLimit: number
): Promise<void> {
  const { error } = await supabaseAdmin
    .from('record_limit_notifications')
    .insert({
      org_id: orgId,
      notification_type: notificationType,
      total_records: totalRecords,
      plan_limit: planLimit,
      sent_at: new Date().toISOString(),
    });

  if (error) {
    console.error('[RecordLimitNotifier] Failed to record notification:', error);
  }
}

/**
 * Get next plan suggestion
 */
function getNextPlan(currentPlan: string): { name: string; price: string } {
  const planMap: Record<string, { name: string; price: string }> = {
    trial: { name: 'Starter', price: '$149' },
    starter: { name: 'Growth', price: '$249' },
    growth: { name: 'Scale', price: '$399' },
    scale: { name: 'Enterprise', price: 'Contact us' },
  };

  return planMap[currentPlan] || { name: 'Enterprise', price: 'Contact us' };
}

/**
 * Send near limit notification (90% threshold)
 */
async function sendNearLimitEmail(
  email: string,
  ctx: NotificationContext
): Promise<void> {
  const resend = getResendClient();
  if (!resend) return;

  const nextPlan = getNextPlan(ctx.currentPlan);
  const pct = Math.round((ctx.totalRecords / ctx.planLimit) * 100);

  const content = `
    ${buildHeading('Your portal is approaching its record limit', 1)}
    ${buildParagraph(`Your HubSpot portal has <strong>${ctx.totalRecords.toLocaleString()}</strong> records, which is <strong>${pct}%</strong> of your ${ctx.currentPlan.charAt(0).toUpperCase() + ctx.currentPlan.slice(1)} plan limit of <strong>${ctx.planLimit.toLocaleString()}</strong> records.`)}
    ${buildParagraph('To avoid interruption, consider upgrading to our ' + nextPlan.name + ' plan at ' + nextPlan.price + '/mo.')}
    ${buildParagraph('<a href="' + process.env.NEXT_PUBLIC_APP_URL + '/settings/billing" style="display: inline-block; margin-top: 16px; padding: 12px 24px; background: linear-gradient(135deg, #7c7bff, #6260e6); color: white; text-decoration: none; border-radius: 6px; font-weight: 600;">View Plans</a>')}
  `;

  const html = buildEmailTemplate({
    title: 'Approaching Record Limit',
    preheader: `Your portal is at ${pct}% of its record limit`,
    content,
    showUnsubscribe: false,
  });

  await resend.emails.send({
    from: 'Refyne <noreply@refynedata.com>',
    to: email,
    subject: 'Your Refyne portal is approaching its record limit',
    html,
  });

  console.log(`[RecordLimitNotifier] Sent near_limit email to ${email} for org ${ctx.orgId}`);
}

/**
 * Send over limit notification (day 1)
 */
async function sendOverLimitEmail(
  email: string,
  ctx: NotificationContext
): Promise<void> {
  const resend = getResendClient();
  if (!resend) return;

  const nextPlan = getNextPlan(ctx.currentPlan);
  const gracePeriodEnd = ctx.gracePeriodEndsAt
    ? new Date(ctx.gracePeriodEndsAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : '(calculating)';

  const content = `
    ${buildHeading('Your portal has exceeded its record limit', 1)}
    ${buildParagraph(`Your HubSpot portal has <strong>${ctx.totalRecords.toLocaleString()}</strong> records, which exceeds your ${ctx.currentPlan.charAt(0).toUpperCase() + ctx.currentPlan.slice(1)} plan limit of <strong>${ctx.planLimit.toLocaleString()}</strong> records.`)}
    ${buildParagraph(`You have a <strong>14-day grace period</strong> (ending ${gracePeriodEnd}) before write operations are paused. Upgrade now to avoid interruption.`)}
    ${buildParagraph('Recommended: ' + nextPlan.name + ' plan at ' + nextPlan.price + '/mo.')}
    ${buildParagraph('<a href="' + process.env.NEXT_PUBLIC_APP_URL + '/settings/billing" style="display: inline-block; margin-top: 16px; padding: 12px 24px; background: linear-gradient(135deg, #7c7bff, #6260e6); color: white; text-decoration: none; border-radius: 6px; font-weight: 600;">Upgrade Now</a>')}
  `;

  const html = buildEmailTemplate({
    title: 'Record Limit Exceeded',
    preheader: 'Your portal has exceeded its record limit',
    content,
    showUnsubscribe: false,
  });

  await resend.emails.send({
    from: 'Refyne <noreply@refynedata.com>',
    to: email,
    subject: 'Your Refyne portal has exceeded its record limit',
    html,
  });

  console.log(`[RecordLimitNotifier] Sent over_limit email to ${email} for org ${ctx.orgId}`);
}

/**
 * Send grace period warning (day 7)
 */
async function sendGracePeriodWarningEmail(
  email: string,
  ctx: NotificationContext
): Promise<void> {
  const resend = getResendClient();
  if (!resend) return;

  const gracePeriodEnd = ctx.gracePeriodEndsAt
    ? new Date(ctx.gracePeriodEndsAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : '(calculating)';

  const content = `
    ${buildHeading('7 days left before write operations pause', 1)}
    ${buildParagraph(`Your HubSpot portal has <strong>${ctx.totalRecords.toLocaleString()}</strong> records, exceeding your ${ctx.currentPlan.charAt(0).toUpperCase() + ctx.currentPlan.slice(1)} plan limit of <strong>${ctx.planLimit.toLocaleString()}</strong>.`)}
    ${buildParagraph(`Your grace period ends on <strong>${gracePeriodEnd}</strong>. After this date, normalize, dedup, and enrich operations will be paused until you upgrade.`)}
    ${buildParagraph('<a href="' + process.env.NEXT_PUBLIC_APP_URL + '/settings/billing" style="display: inline-block; margin-top: 16px; padding: 12px 24px; background: linear-gradient(135deg, #ff6b6b, #ee5a52); color: white; text-decoration: none; border-radius: 6px; font-weight: 600;">Upgrade Now</a>')}
  `;

  const html = buildEmailTemplate({
    title: '7 Days Until Write Operations Pause',
    preheader: 'Urgent: Your grace period is ending soon',
    content,
    showUnsubscribe: false,
  });

  await resend.emails.send({
    from: 'Refyne <noreply@refynedata.com>',
    to: email,
    subject: '7 days left before Refyne write operations pause',
    html,
  });

  console.log(`[RecordLimitNotifier] Sent grace_period_warning email to ${email} for org ${ctx.orgId}`);
}

/**
 * Send grace period expired notification
 */
async function sendGracePeriodExpiredEmail(
  email: string,
  ctx: NotificationContext
): Promise<void> {
  const resend = getResendClient();
  if (!resend) return;

  const content = `
    ${buildHeading('Write operations have been paused', 1)}
    ${buildParagraph(`Your 14-day grace period has ended. Your HubSpot portal has <strong>${ctx.totalRecords.toLocaleString()}</strong> records, exceeding your ${ctx.currentPlan.charAt(0).toUpperCase() + ctx.currentPlan.slice(1)} plan limit of <strong>${ctx.planLimit.toLocaleString()}</strong>.`)}
    ${buildParagraph('Normalize, dedup, and enrich runs are now paused until you upgrade your plan. You can still view your data and history.')}
    ${buildParagraph('<a href="' + process.env.NEXT_PUBLIC_APP_URL + '/settings/billing" style="display: inline-block; margin-top: 16px; padding: 12px 24px; background: linear-gradient(135deg, #ff6b6b, #ee5a52); color: white; text-decoration: none; border-radius: 6px; font-weight: 600;">Upgrade to Resume</a>')}
  `;

  const html = buildEmailTemplate({
    title: 'Write Operations Paused',
    preheader: 'Your write operations have been paused',
    content,
    showUnsubscribe: false,
  });

  await resend.emails.send({
    from: 'Refyne <noreply@refynedata.com>',
    to: email,
    subject: 'Refyne write operations have been paused',
    html,
  });

  console.log(`[RecordLimitNotifier] Sent grace_period_expired email to ${email} for org ${ctx.orgId}`);
}

/**
 * Send appropriate notification based on threshold status
 */
export async function sendRecordLimitNotifications(
  ctx: NotificationContext,
  isNearLimit: boolean,
  isOverLimit: boolean,
  gracePeriodExpired: boolean
): Promise<void> {
  // Get org admin email
  const email = await getOrgAdminEmail(ctx.orgId);
  if (!email) {
    console.warn(`[RecordLimitNotifier] No admin email for org ${ctx.orgId} - skipping notifications`);
    return;
  }

  // Grace period expired (highest priority)
  if (gracePeriodExpired) {
    const sent = await wasRecentlySent(ctx.orgId, 'grace_period_expired');
    if (!sent) {
      await sendGracePeriodExpiredEmail(email, ctx);
      await recordNotification(ctx.orgId, 'grace_period_expired', ctx.totalRecords, ctx.planLimit);
    }
    return; // Don't send other notifications if grace period expired
  }

  // Over limit
  if (isOverLimit) {
    // Check if we're at day 7 (halfway through grace period)
    if (ctx.gracePeriodEndsAt) {
      const now = new Date();
      const gracePeriodEnd = new Date(ctx.gracePeriodEndsAt);
      const daysRemaining = (gracePeriodEnd.getTime() - now.getTime()) / (24 * 60 * 60 * 1000);

      if (daysRemaining <= 7 && daysRemaining > 6) {
        // Day 7 warning
        const sent = await wasRecentlySent(ctx.orgId, 'grace_period_warning');
        if (!sent) {
          await sendGracePeriodWarningEmail(email, ctx);
          await recordNotification(ctx.orgId, 'grace_period_warning', ctx.totalRecords, ctx.planLimit);
        }
      }
    }

    // Send initial over limit notification
    const sent = await wasRecentlySent(ctx.orgId, 'over_limit');
    if (!sent) {
      await sendOverLimitEmail(email, ctx);
      await recordNotification(ctx.orgId, 'over_limit', ctx.totalRecords, ctx.planLimit);
    }
    return;
  }

  // Near limit (90%)
  if (isNearLimit) {
    const sent = await wasRecentlySent(ctx.orgId, 'near_limit');
    if (!sent) {
      await sendNearLimitEmail(email, ctx);
      await recordNotification(ctx.orgId, 'near_limit', ctx.totalRecords, ctx.planLimit);
    }
  }
}
