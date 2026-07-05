'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useUser, useOrganization } from '@clerk/nextjs';
import { C, F } from '@/lib/design-tokens';

const ACTION_LABELS: Record<string, string> = {
  'normalize.run.applied':   'Normalize applied',
  'dedup.cluster.merged':    'Cluster merged',
  'dedup.scan.triggered':    'Dedup scan ran',
  'harmony.created':         'Harmony created',
  'harmony.updated':         'Harmony updated',
  'enrich.run.applied':      'Enrichment applied',
  'settings.dedup_policy.updated': 'Dedup policy updated',
};

interface DashboardData {
  portal: {
    companyCount: number | null;
    contactCount: number | null;
  };
  dataHealth: {
    score: number;
    delta: number;
  };
  normalize: {
    issueCount: number;
    lastRunAt: string | null;
    topIssues: Array<{ field: string; label: string; count: number }>;
  };
  dedup: {
    openClusters: number;
    gradeA: number;
    gradeB: number;
    lastScanAt: string | null;
  };
  enrich: {
    creditsUsed: number;
    creditsIncluded: number;
    topGaps: Array<{ field: string; missing: number; coverage: number }>;
  };
  recentActivity: Array<{
    action: string;
    objectLabel: string;
    metadata: any;
    createdAt: string;
  }>;
  billing: {
    planType: string;
    daysRemaining: number | null;
    trialLimits: {
      mergesUsed: number;
      mergesLimit: number;
      writesUsed: number;
      writesLimit: number;
      creditsUsed: number;
      creditsLimit: number;
    } | null;
  };
}

function getGrade(score: number): { letter: string; color: string } {
  if (score >= 97) return { letter: 'A', color: '#10b981' };
  if (score >= 85) return { letter: 'B', color: '#f59e0b' };
  if (score >= 70) return { letter: 'C', color: '#f59e0b' };
  if (score >= 60) return { letter: 'D', color: '#ef4444' };
  return { letter: 'F', color: '#ef4444' };
}

export default function DashboardPage() {
  const { user } = useUser();
  const { organization } = useOrganization();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/dashboard/summary');
      if (!response.ok) {
        throw new Error('Failed to fetch dashboard data');
      }
      const result = await response.json();
      setData(result);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const currentDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric'
  });

  const userName = user?.firstName || 'there';
  const orgName = organization?.name || 'Your Workspace';

  // Loading skeleton
  if (loading) {
    return (
      <div style={{ padding: 32, maxWidth: 1600, background: C.bg }}>
        <div style={{ marginBottom: 32 }}>
          <div style={{ width: 300, height: 40, background: C.surface, marginBottom: 12, borderRadius: 4 }} />
          <div style={{ width: 400, height: 20, background: C.surface, borderRadius: 4 }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16, marginBottom: 24 }}>
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 20, height: 200 }} />
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (error || !data) {
    return (
      <div style={{ padding: 32, maxWidth: 1600, background: C.bg }}>
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 40, textAlign: 'center' }}>
          <div style={{ fontSize: 18, fontWeight: 600, color: C.text, marginBottom: 8 }}>Failed to load dashboard</div>
          <div style={{ fontSize: 14, color: C.text2, marginBottom: 20 }}>{error || 'Unknown error'}</div>
          <button onClick={fetchData} style={{ padding: '12px 24px', background: '#8b5cf6', color: 'white', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  const showCompanyCount = data.portal.companyCount !== null;
  const companyCount = data.portal.companyCount || 0;
  const contactCount = data.portal.contactCount || 0;
  const grade = getGrade(data.dataHealth.score);

  return (
    <div style={{ padding: 32, maxWidth: 1600, background: C.bg }}>
      {/* Greeting */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h1 style={{ fontSize: 32, fontWeight: 600, color: C.text, margin: 0, letterSpacing: '-0.5px' }}>
            Good morning, {userName}
          </h1>
          <div style={{ fontSize: 14, color: C.text2 }}>{currentDate}</div>
        </div>
        <div style={{ fontSize: 14, color: C.text2 }}>
          {orgName} · {showCompanyCount ? `${companyCount.toLocaleString()} companies` : 'Run a scan to see company count'} · {contactCount.toLocaleString()} contacts
        </div>
      </div>

      {/* 5 Cards Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16, marginBottom: 24 }}>
        {/* Data Health Card */}
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 20 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: C.text3, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 16 }}>
            DATA HEALTH
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
            <svg width="100" height="100" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="40" fill="none" stroke={C.border} strokeWidth="8" />
              <circle cx="50" cy="50" r="40" fill="none" stroke={grade.color} strokeWidth="8" strokeDasharray={`${data.dataHealth.score * 2.51} 251`} strokeLinecap="round" transform="rotate(-90 50 50)" />
              <text x="50" y="45" textAnchor="middle" style={{ fontSize: 24, fontWeight: 700, fill: grade.color }}>{grade.letter}</text>
              <text x="50" y="60" textAnchor="middle" style={{ fontSize: 11, fontWeight: 600, fill: C.text, fontFamily: F.mono }}>{data.dataHealth.score}/100</text>
            </svg>
          </div>
          {data.dataHealth.delta !== 0 && (
            <div style={{ fontSize: 11, color: data.dataHealth.delta > 0 ? '#10b981' : '#ef4444', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
              <span>{data.dataHealth.delta > 0 ? '▲' : '▼'}</span>
              <span>{data.dataHealth.delta > 0 ? '+' : ''}{data.dataHealth.delta} this week</span>
            </div>
          )}
        </div>

        {/* Normalize Card */}
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 20 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: C.text3, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 12 }}>
            NORMALIZE
          </div>
          <div style={{ fontSize: 32, fontWeight: 600, color: C.text, fontFamily: F.mono, letterSpacing: '-1px', marginBottom: 8 }}>
            {data.normalize.issueCount.toLocaleString()}
          </div>
          <div style={{ display: 'flex', gap: 2, marginBottom: 8, height: 24, alignItems: 'flex-end' }}>
            {[40, 60, 45, 70, 55, 80, 65].map((height, i) => (
              <div key={i} style={{ flex: 1, background: i >= 5 ? '#8b5cf6' : '#4c1d95', borderRadius: 0, height: `${height}%` }} />
            ))}
          </div>
          <div style={{ fontSize: 11, color: C.text3 }}>
            issues found
          </div>
        </div>

        {/* Dedup Card */}
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 20 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: C.text3, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 12 }}>
            DEDUP
          </div>
          <div style={{ fontSize: 32, fontWeight: 600, color: C.text, fontFamily: F.mono, letterSpacing: '-1px', marginBottom: 8 }}>
            {data.dedup.openClusters}
          </div>
          <div style={{ display: 'flex', gap: 2, marginBottom: 8, height: 24, alignItems: 'flex-end' }}>
            {[50, 70, 60, 85, 65, 90, 75].map((height, i) => (
              <div key={i} style={{ flex: 1, background: i >= 5 ? '#8b5cf6' : '#4c1d95', borderRadius: 0, height: `${height}%` }} />
            ))}
          </div>
          <div style={{ fontSize: 11, color: C.text3 }}>
            open clusters
          </div>
        </div>

        {/* Enrich Card */}
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 20 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: C.text3, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 12 }}>
            ENRICH
          </div>
          <div style={{ fontSize: 32, fontWeight: 600, color: C.text, fontFamily: F.mono, letterSpacing: '-1px', marginBottom: 8 }}>
            {data.enrich.creditsUsed}
          </div>
          <div style={{ marginBottom: 8 }}>
            <div style={{ width: '100%', height: 8, background: C.border, borderRadius: 0, overflow: 'hidden' }}>
              <div style={{ width: `${Math.min((data.enrich.creditsUsed / data.enrich.creditsIncluded) * 100, 100)}%`, height: '100%', background: '#f59e0b', borderRadius: 0 }} />
            </div>
          </div>
          <div style={{ fontSize: 11, color: C.text3 }}>
            {data.enrich.creditsUsed}/{data.enrich.creditsIncluded} · exhausted
          </div>
        </div>

        {/* Contacts Card */}
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 20 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: C.text3, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 12 }}>
            CONTACTS
          </div>
          <div style={{ fontSize: 32, fontWeight: 600, color: C.text, fontFamily: F.mono, letterSpacing: '-1px', marginBottom: 8 }}>
            {contactCount.toLocaleString()}
          </div>
          <div style={{ display: 'flex', gap: 2, marginBottom: 8, height: 24, alignItems: 'flex-end' }}>
            {[60, 75, 70, 80, 68, 85, 78].map((height, i) => (
              <div key={i} style={{ flex: 1, background: i >= 5 ? '#10b981' : '#065f46', borderRadius: 0, height: `${height}%` }} />
            ))}
          </div>
          <div style={{ fontSize: 11, color: C.text3 }}>
            across {showCompanyCount ? companyCount.toLocaleString() : '0'} cos
          </div>
        </div>
      </div>

      {/* Two columns: Top Issues + Trial Status */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24, marginBottom: 24 }}>
        {/* Top Issues to Fix */}
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: C.text, margin: 0 }}>Top issues to fix</h3>
            <Link href="/normalize" style={{ fontSize: 12, color: '#6366f1', textDecoration: 'none' }}>View all →</Link>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10, fontWeight: 600, color: C.text3, textTransform: 'uppercase', letterSpacing: '0.5px' }}>FIELD</th>
                <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10, fontWeight: 600, color: C.text3, textTransform: 'uppercase', letterSpacing: '0.5px' }}>ISSUE</th>
                <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: 10, fontWeight: 600, color: C.text3, textTransform: 'uppercase', letterSpacing: '0.5px' }}>COUNT</th>
                <th style={{ width: 80 }}></th>
              </tr>
            </thead>
            <tbody>
              {data.dedup.openClusters > 0 && (
                <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                  <td style={{ padding: '12px', fontSize: 13, fontFamily: F.mono, color: C.text }}>dedup</td>
                  <td style={{ padding: '12px', fontSize: 13, color: C.text2 }}>Open duplicate clusters</td>
                  <td style={{ padding: '12px', fontSize: 13, color: C.text, textAlign: 'right', fontFamily: F.mono }}>{data.dedup.openClusters}</td>
                  <td style={{ padding: '12px', textAlign: 'right' }}>
                    <Link href="/dedup" style={{ fontSize: 12, color: '#6366f1', textDecoration: 'none' }}>Fix →</Link>
                  </td>
                </tr>
              )}
              {data.normalize.topIssues.slice(0, 4).map((issue, idx) => (
                <tr key={idx} style={{ borderBottom: `1px solid ${C.border}` }}>
                  <td style={{ padding: '12px', fontSize: 13, fontFamily: F.mono, color: C.text }}>{issue.field}</td>
                  <td style={{ padding: '12px', fontSize: 13, color: C.text2 }}>Need normalization</td>
                  <td style={{ padding: '12px', fontSize: 13, color: C.text, textAlign: 'right', fontFamily: F.mono }}>{issue.count}</td>
                  <td style={{ padding: '12px', textAlign: 'right' }}>
                    <Link href="/normalize" style={{ fontSize: 12, color: '#6366f1', textDecoration: 'none' }}>Fix →</Link>
                  </td>
                </tr>
              ))}
              {data.dedup.openClusters === 0 && data.normalize.topIssues.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ padding: '24px', fontSize: 13, color: C.text2, textAlign: 'center' }}>
                    No issues found - your data is clean!
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Trial Status */}
        {data.billing.trialLimits && data.billing.planType === 'trial' ? (
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 24, height: 'fit-content' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 10, fontWeight: 600, color: C.text3, textTransform: 'uppercase', letterSpacing: '0.8px', margin: 0 }}>
                TRIAL STATUS
              </h3>
              {data.billing.daysRemaining !== null && (
                <div style={{ padding: '2px 8px', background: '#f59e0b', color: '#000', borderRadius: 4, fontSize: 10, fontWeight: 600, letterSpacing: '0.5px' }}>
                  {data.billing.daysRemaining} DAYS LEFT
                </div>
              )}
            </div>
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: C.text, marginBottom: 4 }}>Free Trial</div>
              <div style={{ fontSize: 12, color: C.text2 }}>
                {data.billing.trialLimits.creditsUsed >= data.billing.trialLimits.creditsLimit
                  ? 'Enrich credits exhausted - upgrade to keep enriching.'
                  : `${data.billing.trialLimits.creditsLimit - data.billing.trialLimits.creditsUsed} enrich credits remaining.`}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div style={{ fontSize: 12, color: C.text }}>Dedup merges</div>
                  <div style={{ fontSize: 12, color: C.text2, fontFamily: F.mono }}>
                    {data.billing.trialLimits.mergesUsed}/{data.billing.trialLimits.mergesLimit}
                  </div>
                </div>
                <div style={{ width: '100%', height: 6, background: C.border, borderRadius: 0 }}>
                  <div style={{ width: `${(data.billing.trialLimits.mergesUsed / data.billing.trialLimits.mergesLimit) * 100}%`, height: '100%', background: '#8b5cf6', borderRadius: 0 }} />
                </div>
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div style={{ fontSize: 12, color: C.text }}>Normalize writes</div>
                  <div style={{ fontSize: 12, color: C.text2, fontFamily: F.mono }}>
                    {data.billing.trialLimits.writesUsed}/{data.billing.trialLimits.writesLimit}
                  </div>
                </div>
                <div style={{ width: '100%', height: 6, background: C.border, borderRadius: 0 }}>
                  <div style={{ width: `${(data.billing.trialLimits.writesUsed / data.billing.trialLimits.writesLimit) * 100}%`, height: '100%', background: '#10b981', borderRadius: 0 }} />
                </div>
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div style={{ fontSize: 12, color: C.text }}>Enrich credits</div>
                  <div style={{ fontSize: 12, color: C.text2, fontFamily: F.mono }}>
                    {data.billing.trialLimits.creditsUsed}/{data.billing.trialLimits.creditsLimit}
                  </div>
                </div>
                <div style={{ width: '100%', height: 6, background: C.border, borderRadius: 0, overflow: 'hidden' }}>
                  <div style={{ width: `${(data.billing.trialLimits.creditsUsed / data.billing.trialLimits.creditsLimit) * 100}%`, height: '100%', background: '#8b5cf6', borderRadius: 0 }} />
                </div>
              </div>
            </div>
            <Link href="/upgrade" style={{ display: 'block', marginTop: 20, padding: '12px', background: '#8b5cf6', color: 'white', borderRadius: 8, fontSize: 14, fontWeight: 600, textAlign: 'center', textDecoration: 'none' }}>
              Upgrade to Growth
            </Link>
            <Link href="/pricing" style={{ display: 'block', marginTop: 12, fontSize: 12, color: C.text2, textAlign: 'center', textDecoration: 'none' }}>
              Compare plans →
            </Link>
          </div>
        ) : null}
      </div>

      {/* Recent Activity */}
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 24 }}>
        <h3 style={{ fontSize: 10, fontWeight: 600, color: C.text3, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 16 }}>
          RECENT ACTIVITY
        </h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '32px' }}>
          {data.recentActivity.length > 0 ? (
            data.recentActivity.map((activity, idx) => {
              const date = new Date(activity.createdAt);
              const formattedDate = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
              const label = ACTION_LABELS[activity.action] || activity.action;
              return (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 300 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: idx === 0 ? '#10b981' : C.text3, flexShrink: 0 }} />
                  <div style={{ fontSize: 13, color: C.text2 }}>{formattedDate}</div>
                  <div style={{ fontSize: 13, color: C.text }}>
                    {label} · {activity.objectLabel}
                  </div>
                </div>
              );
            })
          ) : (
            <div style={{ fontSize: 13, color: C.text2, width: '100%', textAlign: 'center', padding: '20px 0' }}>
              No recent activity
            </div>
          )}
        </div>
        <Link href="/history" style={{ display: 'inline-block', marginTop: 16, fontSize: 12, color: '#6366f1', textDecoration: 'none' }}>
          View all activity →
        </Link>
      </div>
    </div>
  );
}
