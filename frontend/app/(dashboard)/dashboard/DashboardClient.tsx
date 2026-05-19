'use client';

import { useState, useEffect } from 'react';
import { PortalFilter } from './PortalFilter';
import { TodaysActions } from './TodaysActions';
import { DedupSummary } from './DedupSummary';
import { QuarantineAlert } from './QuarantineAlert';
import { InsightsSlideOver } from './InsightsSlideOver';

interface Portal {
  id: string;
  name: string;
  recordCount: number;
}

interface Action {
  type: 'fix_harmony' | 'review_dedup' | 'quarantine' | 'enrich';
  label: string;
  description: string;
  estimatedMinutes: number;
  estimatedScoreImpact: number;
  route: string;
  primaryCta: string;
  count?: number;
}

interface DashboardClientProps {
  portals: Portal[];
  initialActions?: Action[];
  dedupCounts?: { gradeA: number; gradeB: number; gradeC: number };
  quarantine?: { count: number; oldestDays: number };
}

export function DashboardClient({
  portals,
  initialActions = [],
  dedupCounts = { gradeA: 0, gradeB: 0, gradeC: 0 },
  quarantine = { count: 0, oldestDays: 0 },
}: DashboardClientProps) {
  const [selectedPortalId, setSelectedPortalId] = useState<string | null>(null);
  const [actions, setActions] = useState<Action[]>(initialActions);
  const [slideOverOpen, setSlideOverOpen] = useState(false);
  const [slideOverData, setSlideOverData] = useState<{
    harmonyId: string;
    harmonyName: string;
    recordCount: number;
  } | null>(null);

  // Fetch actions on mount
  useEffect(() => {
    fetchActions();
  }, [selectedPortalId]);

  async function fetchActions() {
    try {
      const url = selectedPortalId
        ? `/api/dashboard/actions?portalId=${selectedPortalId}`
        : '/api/dashboard/actions';
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setActions(data.actions || []);
      }
    } catch (error) {
      console.error('Failed to fetch actions:', error);
    }
  }

  function handleViewRecords(harmonyId: string, harmonyName: string, recordCount: number) {
    setSlideOverData({ harmonyId, harmonyName, recordCount });
    setSlideOverOpen(true);
  }

  return (
    <>
      {/* Portal Filter - positioned in top bar area */}
      <div style={{ position: 'absolute', top: 28, right: 140, zIndex: 10 }}>
        <PortalFilter
          portals={portals}
          selectedPortalId={selectedPortalId}
          onSelectPortal={setSelectedPortalId}
        />
      </div>

      {/* Quarantine Alert */}
      {quarantine.count > 0 && (
        <QuarantineAlert count={quarantine.count} oldestDays={quarantine.oldestDays} />
      )}

      {/* Right Column Components */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <TodaysActions actions={actions} />
        <DedupSummary {...dedupCounts} />
      </div>

      {/* Insights Slide-over */}
      {slideOverData && (
        <InsightsSlideOver
          {...slideOverData}
          isOpen={slideOverOpen}
          onClose={() => setSlideOverOpen(false)}
        />
      )}
    </>
  );
}
