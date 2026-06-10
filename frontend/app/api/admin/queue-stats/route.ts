/**
 * Queue Statistics API
 *
 * Returns priority breakdown for all BullMQ worker queues.
 * Shows waiting jobs grouped by priority tier (1=Scale, 2=Growth, 3=Trial).
 */

import { NextResponse } from 'next/server';
import { clerkClient } from '@clerk/nextjs/server';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { getImportQueue } from '@/lib/queue/import-queue';
import { getEnrichmentQueue } from '@/lib/queue/enrichment-queue';
import { getArrangementQueue } from '@/lib/queue/arrangement-queue';
import { getCompanyDedupScanQueue } from '@/lib/dedup/company-dedup-scanner';
import { getContactDedupScanQueue } from '@/lib/dedup/contact-dedup-scanner';
import { getWebhookQueue } from '@/lib/queue/webhook-queue';
import { getDigestQueue } from '@/lib/queue/digest-queue';
import { getHarmonyScanQueue } from '@/lib/queue/harmony-scan-queue';
import { getNormalizeQueue } from '@/lib/queue/normalize-worker';
import { jobSegmentationQueue } from '@/lib/queue/job-segmentation-worker';
import { JOB_PRIORITY } from '@/lib/billing/job-priority';

interface QueueStats {
  name: string;
  waiting: number;
  active: number;
  priority1: number; // Scale
  priority2: number; // Growth
  priority3: number; // Trial
}

export async function GET() {
  // Staff-only endpoint
  let ctx;
  try {
    ctx = await getOrgContext();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  const client = await clerkClient();
  const user = await client.users.getUser(ctx.userId);
  const isStaff = user.publicMetadata?.isRefyneStaff === true;

  if (!isStaff) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const stats: QueueStats[] = [];

    // Helper to get queue stats
    const getQueueStats = async (
      queueGetter: () => any | null,
      name: string
    ): Promise<QueueStats | null> => {
      const queue = queueGetter();
      if (!queue) return null;

      const [waiting, active] = await Promise.all([
        queue.getWaitingCount(),
        queue.getActiveCount(),
      ]);

      // Get waiting jobs to check priorities
      const waitingJobs = await queue.getJobs(['waiting'], 0, 500);

      let priority1 = 0;
      let priority2 = 0;
      let priority3 = 0;

      for (const job of waitingJobs) {
        const priority = job.opts?.priority || JOB_PRIORITY.TRIAL;
        if (priority === JOB_PRIORITY.SCALE) priority1++;
        else if (priority === JOB_PRIORITY.GROWTH) priority2++;
        else if (priority === JOB_PRIORITY.TRIAL) priority3++;
      }

      return { name, waiting, active, priority1, priority2, priority3 };
    };

    // Collect stats from all queues
    const queueResults = await Promise.all([
      getQueueStats(getImportQueue, 'Import'),
      getQueueStats(getEnrichmentQueue, 'Enrichment'),
      getQueueStats(getArrangementQueue, 'Arrangement'),
      getQueueStats(getCompanyDedupScanQueue, 'Company Dedup'),
      getQueueStats(getContactDedupScanQueue, 'Contact Dedup'),
      getQueueStats(getWebhookQueue, 'Webhook'),
      getQueueStats(getDigestQueue, 'Digest'),
      getQueueStats(getHarmonyScanQueue, 'Harmony Scan'),
      getQueueStats(getNormalizeQueue, 'Normalize'),
      getQueueStats(() => jobSegmentationQueue, 'Job Segmentation'),
    ]);

    // Filter out null results
    for (const result of queueResults) {
      if (result) stats.push(result);
    }

    return NextResponse.json({ stats });
  } catch (error) {
    console.error('[Queue Stats] Error fetching stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch queue stats' },
      { status: 500 }
    );
  }
}
