import { supabaseAdmin } from '@/lib/db/admin-client';

/**
 * Job Priority System
 *
 * Priority determines job execution order in BullMQ (lower number = higher priority)
 *
 * Tier 1 (Priority 1): Scale + Internal + Exempt orgs - highest priority
 * Tier 2 (Priority 2): Starter + Growth orgs - medium priority
 * Tier 3 (Priority 3): Trial orgs + cancelled/past_due - lowest priority
 */

export const JOB_PRIORITY = {
  SCALE: 1,
  GROWTH: 2,
  TRIAL: 3,
} as const;

export type JobPriority = typeof JOB_PRIORITY[keyof typeof JOB_PRIORITY];

/**
 * Get job priority for an organization based on subscription tier
 *
 * @param orgId - Organization ID (Clerk org_xxx format)
 * @returns Priority level (1 = highest, 3 = lowest)
 */
export async function getJobPriority(orgId: string): Promise<JobPriority> {
  const { data, error } = await supabaseAdmin
    .from('org_billing')
    .select('subscription_tier, subscription_status')
    .eq('org_id', orgId)
    .single();

  if (error || !data) {
    console.warn(`[Job Priority] Failed to get billing info for ${orgId}, defaulting to trial priority`);
    return JOB_PRIORITY.TRIAL;
  }

  // Cancelled or past_due orgs get lowest priority
  if (data.subscription_status === 'cancelled' || data.subscription_status === 'past_due') {
    return JOB_PRIORITY.TRIAL;
  }

  // Map subscription tier to priority
  switch (data.subscription_tier) {
    case 'scale':
      return JOB_PRIORITY.SCALE;
    case 'internal':
      return JOB_PRIORITY.SCALE; // Internal orgs get high priority
    case 'exempt':
      return JOB_PRIORITY.SCALE; // Exempt orgs get high priority
    case 'growth':
      return JOB_PRIORITY.GROWTH;
    case 'starter':
      return JOB_PRIORITY.GROWTH;
    case 'trial':
      return JOB_PRIORITY.TRIAL;
    default:
      console.warn(`[Job Priority] Unknown tier "${data.subscription_tier}" for ${orgId}, defaulting to trial`);
      return JOB_PRIORITY.TRIAL;
  }
}

/**
 * Get human-readable priority label
 */
export function getPriorityLabel(priority: JobPriority): string {
  switch (priority) {
    case JOB_PRIORITY.SCALE:
      return 'Scale';
    case JOB_PRIORITY.GROWTH:
      return 'Starter/Growth';
    case JOB_PRIORITY.TRIAL:
      return 'Trial';
    default:
      return 'Unknown';
  }
}
