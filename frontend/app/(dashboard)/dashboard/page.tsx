import { Suspense } from 'react';
import { C, F } from '@/lib/design-tokens';
import { Card, StatCard, HarmonyBar, InsightRow, StatusDot, OnboardingChecklist } from '@/components/refyne';
import {
  StatCardsSkeleton,
  HarmonyBarsSkeleton,
  TrendChartSkeleton,
  InsightsSkeleton,
  PortalsSkeleton,
} from '@/components/refyne';
import { TrendChart } from './TrendChart';
import { OnboardingWrapper } from './OnboardingWrapper';
import { DashboardClient } from './DashboardClient';

// Default org ID for development - in production this would come from session
const DEFAULT_ORG_ID = process.env.DEFAULT_ORG_ID || 'demo-org';

// ─────────────────────────────────────────────────────────────
// Data Fetching Functions
// ─────────────────────────────────────────────────────────────

async function fetchScore(orgId: string) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  try {
    const res = await fetch(`${baseUrl}/api/compliance/score?orgId=${orgId}`, {
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

async function fetchBreakdown(orgId: string) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  try {
    const res = await fetch(`${baseUrl}/api/compliance/breakdown?orgId=${orgId}&by=harmony`, {
      cache: 'no-store',
    });
    if (!res.ok) return { items: [] };
    return res.json();
  } catch {
    return { items: [] };
  }
}

async function fetchTrend(orgId: string) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  try {
    const res = await fetch(`${baseUrl}/api/compliance/trend?orgId=${orgId}&days=180`, {
      cache: 'no-store',
    });
    if (!res.ok) return { trend: [] };
    return res.json();
  } catch {
    return { trend: [] };
  }
}

async function fetchInsights(orgId: string) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  try {
    const res = await fetch(`${baseUrl}/api/compliance/insights?orgId=${orgId}`, {
      cache: 'no-store',
    });
    if (!res.ok) return { insights: [] };
    return res.json();
  } catch {
    return { insights: [] };
  }
}

async function fetchConnections() {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  try {
    const res = await fetch(`${baseUrl}/api/connections`, {
      cache: 'no-store',
    });
    if (!res.ok) return { connections: [] };
    return res.json();
  } catch {
    return { connections: [] };
  }
}

async function fetchActions(orgId: string) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  try {
    const res = await fetch(`${baseUrl}/api/dashboard/actions?orgId=${orgId}`, {
      cache: 'no-store',
    });
    if (!res.ok) return { actions: [] };
    return res.json();
  } catch {
    return { actions: [] };
  }
}

async function fetchDedupCounts(orgId: string) {
  // Simplified - would need real API endpoint
  return {
    gradeA: 12,
    gradeB: 14,
    gradeC: 8,
  };
}

async function fetchQuarantineData(orgId: string) {
  // Simplified - would need real API endpoint
  return {
    count: 3,
    oldestDays: 4,
  };
}

// ─────────────────────────────────────────────────────────────
// Server Components
// ─────────────────────────────────────────────────────────────

async function StatCards() {
  const scoreData = await fetchScore(DEFAULT_ORG_ID);
  const connectionsData = await fetchConnections();

  // Fallback to mock data if API returns nothing
  const score = scoreData?.score ?? 82;
  const total = scoreData?.total ?? 23100;
  const trendDelta = scoreData?.trendDelta ?? 5;
  const breakpoint = scoreData?.breakpoint || 'good';
  const benchmark = scoreData?.benchmark;
  const portalCount = connectionsData?.connections?.length ?? 0;
  const lastScanMinutes = scoreData?.lastComputedAt
    ? Math.floor((Date.now() - new Date(scoreData.lastComputedAt).getTime()) / 60000)
    : 14;

  // Breakpoint label with color
  const breakpointLabels: Record<string, { text: string; color: string }> = {
    critical: { text: 'Critical', color: C.red },
    needs_work: { text: 'Needs work', color: C.amber },
    good: { text: 'Good', color: C.indigoLt },
    great: { text: 'Great', color: C.green },
    excellent: { text: 'Excellent', color: C.green },
  };
  const breakpointInfo = breakpointLabels[breakpoint] || breakpointLabels.good;

  const trendText = trendDelta !== null && trendDelta !== 0
    ? `${trendDelta > 0 ? '↑' : '↓'} ${Math.abs(trendDelta)}pts from last scan`
    : 'no change';

  // Portal text (fixed bug)
  const portalText = portalCount === 1
    ? `from ${connectionsData?.connections?.[0]?.name || 'portal'}`
    : `across ${portalCount} portals`;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 28 }}>
      <StatCard
        label="Total records"
        value={total.toLocaleString()}
        sub={portalText}
        accent={C.text}
      />
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <StatCard
          label="Compliance"
          value={`${Math.round(score)}%`}
          sub={`${trendText} · ${breakpointInfo.text}`}
          accent={breakpointInfo.color}
        />
        {benchmark && (
          <div style={{ fontSize: 11, color: C.text3, marginTop: 6, textAlign: 'center' }}>
            Better than {benchmark.percentile}% of similar portals
          </div>
        )}
      </div>
      <StatCard
        label="Active harmonies"
        value="4"
        sub="of 12 in library"
        accent={C.text}
      />
      <StatCard
        label="Last scan"
        value={lastScanMinutes < 60 ? `${lastScanMinutes}m` : `${Math.floor(lastScanMinutes / 60)}h`}
        sub="auto-scan enabled"
        accent={C.text}
      />
    </div>
  );
}

async function HarmonyBarsSection() {
  const [breakdownData, scoreData] = await Promise.all([
    fetchBreakdown(DEFAULT_ORG_ID),
    fetchScore(DEFAULT_ORG_ID),
  ]);

  const total = scoreData?.total ?? 23100;

  // Transform API data to component format with enhanced fields
  const harmonies = (breakdownData?.items || []).map((item: {
    harmonyId?: string;
    harmonyName?: string;
    description?: string;
    rate?: number;
    unprocessed?: number;
    recordsAffected?: number;
    delta?: number | null;
    estimatedScoreImpact?: number;
    actionable?: boolean;
    actionRoute?: string | null;
  }) => ({
    name: item.harmonyName || item.harmonyId || 'unknown',
    score: Math.round(item.rate || 0),
    note: item.recordsAffected && item.recordsAffected > 10 ? `${item.recordsAffected} unmatched` : undefined,
    delta: item.delta,
    description: item.description,
    recordsAffected: item.recordsAffected,
    estimatedScoreImpact: item.estimatedScoreImpact,
    actionable: item.actionable,
    actionRoute: item.actionRoute,
    harmonyId: item.harmonyId,
  }));

  // Fallback if no data
  if (harmonies.length === 0) {
    harmonies.push(
      { name: 'company-name', score: 99 },
      { name: 'phone-e164', score: 95 },
      { name: 'company-industry', score: 82, note: '82 unmatched', delta: 2 },
      { name: 'linkedin-url', score: 77, note: '12 missing', delta: -1 },
      { name: 'person-title', score: 41, actionable: true },
    );
  }

  return (
    <Card style={{ padding: '20px 24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: C.text, letterSpacing: '-0.01em' }}>
          Compliance by harmony
        </span>
        <span style={{ fontSize: 11, fontFamily: F.mono, color: C.text3 }}>
          {total.toLocaleString()} records
        </span>
      </div>
      {harmonies.map((h: any) => (
        <div key={h.name} style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <div
              style={{ flex: 1, position: 'relative', cursor: 'help' }}
              title={h.description || h.name}
            >
              <span style={{ fontSize: 12, fontFamily: F.mono, color: C.text3 }}>
                {h.name}
              </span>
              {/* Tooltip on hover - description would show in actual implementation */}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, fontFamily: F.mono, fontWeight: 500, color: C.text }}>
                {h.score}%
              </span>
              {h.delta !== null && h.delta !== undefined && h.delta !== 0 && (
                <span
                  style={{
                    fontSize: 10,
                    color: h.delta > 0 ? C.green : C.red,
                    fontFamily: F.mono,
                  }}
                >
                  {h.delta > 0 ? '↑' : '↓'}{Math.abs(h.delta)}% since last scan
                </span>
              )}
              {h.actionable && h.score < 60 && (
                <a
                  href={h.actionRoute || `/harmonies?harmony=${h.harmonyId}`}
                  style={{
                    padding: '2px 8px',
                    background: C.indigoDim,
                    border: `1px solid ${C.indigoBrd}`,
                    borderRadius: 4,
                    fontSize: 10,
                    color: C.indigo,
                    textDecoration: 'none',
                    fontWeight: 600,
                  }}
                >
                  Fix this →
                </a>
              )}
            </div>
          </div>
          <HarmonyBar name={h.name} score={h.score} note={h.note} />
        </div>
      ))}
    </Card>
  );
}

async function TrendChartSection() {
  const [trendData, scoreData] = await Promise.all([
    fetchTrend(DEFAULT_ORG_ID),
    fetchScore(DEFAULT_ORG_ID),
  ]);

  const benchmark = scoreData?.benchmark?.average;

  // Transform API data to chart format (group by month)
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const trend = (trendData?.trend || [])
    .slice(-6) // Last 6 data points
    .map((point: { computedAt?: string; score?: number }) => {
      const date = point.computedAt ? new Date(point.computedAt) : new Date();
      return {
        m: monthNames[date.getMonth()],
        v: Math.round(point.score || 0),
        date: `${monthNames[date.getMonth()]} ${date.getDate()}`,
      };
    });

  // Fallback if no data
  if (trend.length === 0) {
    trend.push(
      { m: 'Oct', v: 71, date: 'Oct 1' },
      { m: 'Nov', v: 74, date: 'Nov 1' },
      { m: 'Dec', v: 76, date: 'Dec 1' },
      { m: 'Jan', v: 79, date: 'Jan 1' },
      { m: 'Feb', v: 77, date: 'Feb 1' },
      { m: 'Mar', v: 82, date: 'Mar 1' },
    );
  }

  return (
    <Card style={{ padding: '20px 24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: C.text, letterSpacing: '-0.01em' }}>Score trend</span>
      </div>
      <TrendChart data={trend} benchmark={benchmark} />
    </Card>
  );
}

async function InsightsSection() {
  const insightsData = await fetchInsights(DEFAULT_ORG_ID);

  // Transform API data to component format
  const insights = (insightsData?.insights || []).map((insight: {
    harmonyId?: string;
    field?: string;
    message?: string;
    type?: string;
  }) => ({
    type: insight.type === 'pattern_gap' ? 'warn' as const : 'ok' as const,
    harmony: insight.harmonyId || insight.field || 'unknown',
    text: insight.message || '',
    action: insight.type === 'pattern_gap' ? 'Edit rule' : 'View records',
  }));

  // Fallback if no data
  if (insights.length === 0) {
    insights.push(
      { type: 'warn' as const, harmony: 'company-industry', text: '82 records match "(Fintech)" pattern — no rule covers it', action: 'Edit rule' },
      { type: 'warn' as const, harmony: 'linkedin-url', text: '12 records missing LinkedIn URL after March 14 import', action: 'View records' },
      { type: 'ok' as const, harmony: 'phone-e164', text: 'Normalization run complete on GrowthBook — 1,247 updated', action: 'View run' },
    );
  }

  return (
    <Card>
      <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.border}` }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: C.text, letterSpacing: '-0.01em' }}>Insights</span>
      </div>
      {insights.map((ins: { type: 'ok' | 'warn' | 'error'; harmony: string; text: string; action: string }, i: number) => (
        <InsightRow key={i} {...ins} />
      ))}
    </Card>
  );
}

async function PortalsSection() {
  const connectionsData = await fetchConnections();

  // Transform API data with health scores (would need per-portal score API)
  const portals = (connectionsData?.connections || []).map((conn: {
    name?: string;
    companyCount?: number;
    lastSync?: string;
    portalId?: string;
  }) => {
    // Mock health score - in production would fetch per portal
    const mockScore = 70 + Math.floor(Math.random() * 25);
    return {
      name: conn.name || 'Unknown Portal',
      count: conn.companyCount || 0,
      sync: conn.lastSync || 'never',
      score: mockScore,
      portalId: conn.portalId || '',
    };
  });

  // Fallback if no data
  if (portals.length === 0) {
    portals.push(
      { name: 'Frontera Health', count: 2798, sync: '2m ago', score: 82, portalId: 'portal1' },
      { name: 'GrowthBook', count: 20302, sync: '14m ago', score: 71, portalId: 'portal2' },
    );
  }

  return (
    <Card style={{ padding: '16px 20px' }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 14, letterSpacing: '-0.01em' }}>
        Portals
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {portals.map((p: any, i: number) => {
          // Calculate health dots (5 dots based on score)
          const filledDots = Math.round((p.score / 100) * 5);
          return (
            <div
              key={i}
              style={{
                padding: '12px',
                background: C.hover,
                borderRadius: 8,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <div style={{ fontSize: 12, color: C.text, fontWeight: 500 }}>{p.name}</div>
                <span style={{ fontSize: 10, color: C.text3 }}>{p.sync}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ fontSize: 10, fontFamily: F.mono, color: C.text3 }}>
                    {p.count.toLocaleString()} companies
                  </div>
                  <span style={{ color: C.text3 }}>·</span>
                  <div style={{ fontSize: 11, fontFamily: F.mono, color: C.text }}>{p.score}%</div>
                  <div style={{ display: 'flex', gap: 2 }}>
                    {Array.from({ length: 5 }).map((_, dotIdx) => (
                      <div
                        key={dotIdx}
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: '50%',
                          background: dotIdx < filledDots ? C.indigo : C.border2,
                        }}
                      />
                    ))}
                  </div>
                </div>
                <a
                  href={`/dashboard?portal=${p.portalId}`}
                  style={{
                    fontSize: 10,
                    color: C.indigo,
                    textDecoration: 'none',
                    fontWeight: 500,
                  }}
                >
                  View →
                </a>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────
// Main Page Component
// ─────────────────────────────────────────────────────────────

async function ClientData() {
  const [connectionsData, actionsData, dedupData, quarantineData] = await Promise.all([
    fetchConnections(),
    fetchActions(DEFAULT_ORG_ID),
    fetchDedupCounts(DEFAULT_ORG_ID),
    fetchQuarantineData(DEFAULT_ORG_ID),
  ]);

  // Transform connections to portal format
  const portals = (connectionsData?.connections || []).map((conn: any) => ({
    id: conn.portalId || conn.id || String(Math.random()),
    name: conn.name || 'Unknown Portal',
    recordCount: conn.companyCount || 0,
  }));

  return (
    <DashboardClient
      portals={portals}
      initialActions={actionsData?.actions || []}
      dedupCounts={dedupData}
      quarantine={quarantineData}
    />
  );
}

export default function DashboardPage() {
  return (
    <div style={{ padding: '28px 32px', fontFamily: F.sans, position: 'relative' }}>
      <Suspense fallback={<StatCardsSkeleton />}>
        <StatCards />
      </Suspense>

      {/* Onboarding Checklist */}
      <OnboardingWrapper />

      <Suspense fallback={null}>
        <ClientData />
      </Suspense>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Suspense fallback={<HarmonyBarsSkeleton />}>
            <HarmonyBarsSection />
          </Suspense>

          <Suspense fallback={<TrendChartSkeleton />}>
            <TrendChartSection />
          </Suspense>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Suspense fallback={<InsightsSkeleton />}>
            <InsightsSection />
          </Suspense>

          <Suspense fallback={<PortalsSkeleton />}>
            <PortalsSection />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
