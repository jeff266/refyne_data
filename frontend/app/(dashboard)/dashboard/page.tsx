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
  const portalCount = connectionsData?.connections?.length ?? 2;
  const lastScanMinutes = scoreData?.lastComputedAt
    ? Math.floor((Date.now() - new Date(scoreData.lastComputedAt).getTime()) / 60000)
    : 14;

  const trendText = trendDelta !== null && trendDelta !== 0
    ? `${trendDelta > 0 ? '↑' : '↓'} ${Math.abs(trendDelta)}pts from last scan`
    : 'no change';

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 28 }}>
      <StatCard
        label="Total records"
        value={total.toLocaleString()}
        sub={`across ${portalCount} portal${portalCount !== 1 ? 's' : ''}`}
        accent={C.text}
      />
      <StatCard
        label="Compliance"
        value={`${Math.round(score)}%`}
        sub={trendText}
        accent={C.indigoLt}
      />
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

  // Transform API data to component format
  const harmonies = (breakdownData?.items || []).map((item: {
    harmonyId?: string;
    harmonyName?: string;
    rate?: number;
    unprocessed?: number;
  }) => ({
    name: item.harmonyId || item.harmonyName || 'unknown',
    score: Math.round(item.rate || 0),
    note: item.unprocessed && item.unprocessed > 10 ? `${item.unprocessed} unmatched` : undefined,
  }));

  // Fallback if no data
  if (harmonies.length === 0) {
    harmonies.push(
      { name: 'company-name', score: 99 },
      { name: 'phone-e164', score: 95 },
      { name: 'company-industry', score: 82, note: '82 unmatched' },
      { name: 'linkedin-url', score: 77, note: '12 missing' },
      { name: 'person-title', score: 41 },
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
      {harmonies.map((h: { name: string; score: number; note?: string }) => (
        <HarmonyBar key={h.name} {...h} />
      ))}
    </Card>
  );
}

async function TrendChartSection() {
  const trendData = await fetchTrend(DEFAULT_ORG_ID);

  // Transform API data to chart format (group by month)
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const trend = (trendData?.trend || [])
    .slice(-6) // Last 6 data points
    .map((point: { computedAt?: string; score?: number }) => {
      const date = point.computedAt ? new Date(point.computedAt) : new Date();
      return {
        m: monthNames[date.getMonth()],
        v: Math.round(point.score || 0),
      };
    });

  // Fallback if no data
  if (trend.length === 0) {
    trend.push(
      { m: 'Oct', v: 71 },
      { m: 'Nov', v: 74 },
      { m: 'Dec', v: 76 },
      { m: 'Jan', v: 79 },
      { m: 'Feb', v: 77 },
      { m: 'Mar', v: 82 },
    );
  }

  return (
    <Card style={{ padding: '20px 24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: C.text, letterSpacing: '-0.01em' }}>Score trend</span>
        <span style={{ fontSize: 11, color: C.text3 }}>6 months</span>
      </div>
      <TrendChart data={trend} />
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

  // Transform API data
  const portals = (connectionsData?.connections || []).map((conn: {
    name?: string;
    companyCount?: number;
    lastSync?: string;
  }) => ({
    name: conn.name || 'Unknown Portal',
    count: conn.companyCount || 0,
    sync: conn.lastSync || 'never',
  }));

  // Fallback if no data
  if (portals.length === 0) {
    portals.push(
      { name: 'Frontera Health', count: 2798, sync: '2m ago' },
      { name: 'GrowthBook', count: 20302, sync: '14m ago' },
    );
  }

  return (
    <Card style={{ padding: '16px 20px' }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 14, letterSpacing: '-0.01em' }}>
        Portals
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {portals.map((p: { name: string; count: number; sync: string }, i: number) => (
          <div
            key={i}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '10px 12px',
              background: C.hover,
              borderRadius: 8,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <StatusDot />
              <div>
                <div style={{ fontSize: 12, color: C.text, fontWeight: 500 }}>{p.name}</div>
                <div style={{ fontSize: 10, fontFamily: F.mono, color: C.text3 }}>
                  {p.count.toLocaleString()} companies
                </div>
              </div>
            </div>
            <span style={{ fontSize: 10, color: C.text3 }}>{p.sync}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────
// Main Page Component
// ─────────────────────────────────────────────────────────────

export default function DashboardPage() {
  return (
    <div style={{ padding: '28px 32px', fontFamily: F.sans }}>
      <Suspense fallback={<StatCardsSkeleton />}>
        <StatCards />
      </Suspense>

      {/* Onboarding Checklist */}
      <OnboardingWrapper />

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
