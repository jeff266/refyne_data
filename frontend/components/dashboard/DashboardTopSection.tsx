'use client';

import { useEffect, useState } from 'react';
import { SinceYesterdaySection } from './SinceYesterdaySection';
import { AlwaysOnUpsell } from './AlwaysOnUpsell';

interface DashboardTopSectionProps {
  orgId: string;
}

export function DashboardTopSection({ orgId }: DashboardTopSectionProps) {
  const [alwaysOnEnabled, setAlwaysOnEnabled] = useState<boolean | null>(null);
  const [upsellData, setUpsellData] = useState({
    recordsToNormalize: 0,
    potentialDuplicates: 0,
    fieldsToFill: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAlwaysOnStatus = async () => {
      try {
        // Check if Always On is enabled
        const statusRes = await fetch('/api/settings/always-on-status');
        const statusData = await statusRes.json();

        setAlwaysOnEnabled(statusData.enabled);

        // If not enabled, fetch upsell data
        if (!statusData.enabled) {
          const summaryRes = await fetch('/api/dashboard/summary');
          const summaryData = await summaryRes.json();

          // Calculate upsell metrics from pending attention items
          let recordsToNormalize = 0;
          let potentialDuplicates = 0;
          let fieldsToFill = 0;

          summaryData.pendingAttention?.forEach((item: any) => {
            if (item.type === 'normalize_issues') recordsToNormalize = item.count;
            if (item.type === 'grade_a_dupes') potentialDuplicates = item.count;
            if (item.type === 'stale_arrangements') fieldsToFill = item.count;
          });

          setUpsellData({
            recordsToNormalize,
            potentialDuplicates,
            fieldsToFill,
          });
        }

        setLoading(false);
      } catch (error) {
        console.error('Failed to check Always On status:', error);
        setAlwaysOnEnabled(false);
        setLoading(false);
      }
    };

    checkAlwaysOnStatus();
  }, [orgId]);

  if (loading) {
    return <SinceYesterdaySection />;
  }

  if (!alwaysOnEnabled) {
    return <AlwaysOnUpsell {...upsellData} />;
  }

  return <SinceYesterdaySection />;
}
