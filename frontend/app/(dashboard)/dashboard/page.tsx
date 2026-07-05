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
          <div style={{
            width: 300,
            height: 40,
            background: C.surface,
            marginBottom: 12,
            borderRadius: 4
          }} />
          <div style={{
            width: 400,
            height: 20,
            background: C.surface,
            borderRadius: 4
          }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{
              background: C.surface,
              border: `1px solid ${C.border}`,
              borderRadius: 10,
              padding: 20,
              height: 200
            }} />
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (error || !data) {
    return (
      <div style={{ padding: 32, maxWidth: 1600, background: C.bg }}>
        <div style={{
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderRadius: 10,
          padding: 40,
          textAlign: 'center'
        }}>
          <div style={{ fontSize: 18, fontWeight: 600, color: C.text, marginBottom: 8 }}>
            Failed to load dashboard
          </div>
          <div style={{ fontSize: 14, color: C.text2, marginBottom: 20 }}>
            {error || 'Unknown error'}
          </div>
          <button
            onClick={fetchData}
            style={{
              padding: '12px 24px',
              background: '#8b5cf6',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const showCompanyCount = data.portal.companyCount !== null;
  const companyCount = data.portal.companyCount || 0;
  const contactCount = data.portal.contactCount || 0;

  return (
    <div style={{ padding: 32, maxWidth: 1600, background: C.bg }}>
      {/* Greeting */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h1 style={{
            fontSize: 32,
            fontWeight: 600,
            color: C.text,
            margin: 0,
            letterSpacing: '-0.5px'
          }}>
            Good morning, {userName}
          </h1>
          <div style={{ fontSize: 14, color: C.text2 }}>{currentDate}</div>
        </div>
        <div style={{ fontSize: 14, color: C.text2 }}>
          {orgName} · {showCompanyCount ? `${companyCount.toLocaleString()} companies` : 'Run a scan to see company count'} · {contactCount.toLocaleString()} contacts
        </div>
      </div>

      {/* Data Health Cards (3) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        {/* Normalize Card */}
        <div style={{
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderRadius: 10,
          padding: 24
        }}>
          <div style={{
            fontSize: 11,
            fontWeight: 600,
            color: C.text3,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            marginBottom: 16
          }}>
            NORMALIZE
          </div>
          <div style={{
            fontSize: 32,
            fontWeight: 600,
            color: C.text1,
            fontFamily: F.mono,
            marginBottom: 16
          }}>
            {data.normalize.issueCount === 0 ? (
              <span style={{ fontSize: 18 }}>No issues found ✓</span>
            ) : (
              data.normalize.issueCount.toLocaleString()
            )}
          </div>
          {data.normalize.issueCount > 0 && (
            <div style={{ fontSize: 12, color: C.text3, marginBottom: 16 }}>
              issues found
            </div>
          )}
          {data.normalize.lastRunAt && (
            <div style={{ fontSize: 12, color: C.text3, marginBottom: 16 }}>
              Last run: {new Date(data.normalize.lastRunAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </div>
          )}
          <Link
            href="/normalize"
            style={{
              display: 'inline-block',
              padding: '8px 16px',
              background: C.surface3,
              color: C.text,
              borderRadius: 4,
              fontSize: 12,
              fontWeight: 600,
              textDecoration: 'none'
            }}
          >
            Normalize →
          </Link>
        </div>

        {/* Dedup Card */}
        <div style={{
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderRadius: 10,
          padding: 24
        }}>
          <div style={{
            fontSize: 11,
            fontWeight: 600,
            color: C.text3,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            marginBottom: 16
          }}>
            DEDUP
          </div>
          <div style={{
            fontSize: 32,
            fontWeight: 600,
            color: C.text1,
            fontFamily: F.mono,
            marginBottom: 16
          }}>
            {data.dedup.openClusters}
          </div>
          {data.dedup.gradeA > 0 && (
            <div style={{ fontSize: 12, color: C.text3, marginBottom: 16 }}>
              {data.dedup.gradeA} Grade A
            </div>
          )}
          {data.dedup.lastScanAt && (
            <div style={{ fontSize: 12, color: C.text3, marginBottom: 16 }}>
              Last run: {new Date(data.dedup.lastScanAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </div>
          )}
          <Link
            href="/dedup"
            style={{
              display: 'inline-block',
              padding: '8px 16px',
              background: C.surface3,
              color: C.text,
              borderRadius: 4,
              fontSize: 12,
              fontWeight: 600,
              textDecoration: 'none'
            }}
          >
            Dedup →
          </Link>
        </div>

        {/* Enrich Card */}
        <div style={{
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderRadius: 10,
          padding: 24
        }}>
          <div style={{
            fontSize: 11,
            fontWeight: 600,
            color: C.text3,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            marginBottom: 16
          }}>
            ENRICH
          </div>
          <div style={{
            fontSize: 32,
            fontWeight: 600,
            color: C.text1,
            fontFamily: F.mono,
            marginBottom: 16
          }}>
            {data.enrich.creditsUsed}/{data.enrich.creditsIncluded}
          </div>
          <div style={{ fontSize: 12, color: C.text3, marginBottom: 16 }}>
            {data.billing.planType === 'trial' ? 'Trial' : data.billing.planType}
          </div>
          <Link
            href="/enrich"
            style={{
              display: 'inline-block',
              padding: '8px 16px',
              background: C.surface3,
              color: C.text,
              borderRadius: 4,
              fontSize: 12,
              fontWeight: 600,
              textDecoration: 'none'
            }}
          >
            Enrich →
          </Link>
        </div>
      </div>

      {/* Two columns: Recent Activity + Trial Status */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24, marginBottom: 24 }}>
        {/* Recent Activity */}
        <div style={{
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderRadius: 10,
          padding: 24
        }}>
          <div style={{
            fontSize: 11,
            fontWeight: 600,
            color: C.text3,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            marginBottom: 16
          }}>
            RECENT ACTIVITY
          </div>
          {data.recentActivity.length === 0 ? (
            <div style={{ fontSize: 13, color: C.text2, padding: '20px 0' }}>
              No activity yet. Actions you take will appear here.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {data.recentActivity.map((activity, idx) => {
                const date = new Date(activity.createdAt);
                const formattedDate = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                const label = ACTION_LABELS[activity.action] || activity.action;

                return (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', height: 44 }}>
                    <div style={{ fontSize: 13, color: C.text2, width: 60 }}>{formattedDate}</div>
                    <div style={{ fontSize: 13, color: C.text }}>
                      {label} · {activity.objectLabel}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <Link
            href="/settings/activity"
            style={{
              display: 'inline-block',
              marginTop: 16,
              fontSize: 12,
              color: C.indigo,
              textDecoration: 'none'
            }}
          >
            View all activity →
          </Link>
        </div>

        {/* Trial Status / Credits - only show for trial users */}
        {data.billing.trialLimits && data.billing.planType === 'trial' ? (
          <div style={{
            background: C.surface,
            border: `1px solid ${C.border}`,
            borderRadius: 10,
            padding: 24
          }}>
            <div style={{
              fontSize: 11,
              fontWeight: 600,
              color: C.text3,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              marginBottom: 16
            }}>
              FREE TRIAL · {data.billing.daysRemaining} DAYS REMAINING
            </div>

            {/* Progress bars */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Dedup merges */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div style={{ fontSize: 12, color: C.text2 }}>Dedup merges</div>
                  <div style={{ fontSize: 12, color: C.text2, fontFamily: F.mono }}>
                    {data.billing.trialLimits.mergesUsed} / {data.billing.trialLimits.mergesLimit}
                  </div>
                </div>
                <div style={{ width: '100%', height: 6, background: C.surface3, borderRadius: 0 }}>
                  <div style={{
                    width: `${(data.billing.trialLimits.mergesUsed / data.billing.trialLimits.mergesLimit) * 100}%`,
                    height: '100%',
                    background: (data.billing.trialLimits.mergesUsed / data.billing.trialLimits.mergesLimit) > 0.8 ? '#ef4444' : '#3b82f6',
                    borderRadius: 0
                  }} />
                </div>
              </div>

              {/* Normalize writes */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div style={{ fontSize: 12, color: C.text2 }}>Normalize writes</div>
                  <div style={{ fontSize: 12, color: C.text2, fontFamily: F.mono }}>
                    {data.billing.trialLimits.writesUsed} / {data.billing.trialLimits.writesLimit}
                  </div>
                </div>
                <div style={{ width: '100%', height: 6, background: C.surface3, borderRadius: 0 }}>
                  <div style={{
                    width: `${(data.billing.trialLimits.writesUsed / data.billing.trialLimits.writesLimit) * 100}%`,
                    height: '100%',
                    background: (data.billing.trialLimits.writesUsed / data.billing.trialLimits.writesLimit) > 0.8 ? '#ef4444' : '#3b82f6',
                    borderRadius: 0
                  }} />
                </div>
              </div>

              {/* Enrich credits */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div style={{ fontSize: 12, color: C.text2 }}>Enrich credits</div>
                  <div style={{ fontSize: 12, color: C.text2, fontFamily: F.mono }}>
                    {data.billing.trialLimits.creditsUsed} / {data.billing.trialLimits.creditsLimit}
                  </div>
                </div>
                <div style={{ width: '100%', height: 6, background: C.surface3, borderRadius: 0 }}>
                  <div style={{
                    width: `${(data.billing.trialLimits.creditsUsed / data.billing.trialLimits.creditsLimit) * 100}%`,
                    height: '100%',
                    background: (data.billing.trialLimits.creditsUsed / data.billing.trialLimits.creditsLimit) > 0.8 ? '#ef4444' : '#3b82f6',
                    borderRadius: 0
                  }} />
                </div>
              </div>
            </div>

            <Link
              href="/settings/billing"
              style={{
                display: 'block',
                marginTop: 20,
                padding: '12px',
                background: '#8b5cf6',
                color: 'white',
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 600,
                textAlign: 'center',
                textDecoration: 'none'
              }}
            >
              Upgrade to Growth →
            </Link>
          </div>
        ) : (
          <div style={{
            background: C.surface,
            border: `1px solid ${C.border}`,
            borderRadius: 10,
            padding: 24
          }}>
            <div style={{
              fontSize: 11,
              fontWeight: 600,
              color: C.text3,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              marginBottom: 16
            }}>
              CREDITS THIS PERIOD
            </div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ width: '100%', height: 6, background: C.surface3, borderRadius: 0 }}>
                <div style={{
                  width: `${(data.enrich.creditsUsed / data.enrich.creditsIncluded) * 100}%`,
                  height: '100%',
                  background: '#3b82f6',
                  borderRadius: 0
                }} />
              </div>
            </div>
            <div style={{ fontSize: 14, color: C.text }}>
              {data.enrich.creditsUsed.toLocaleString()} / {data.enrich.creditsIncluded.toLocaleString()}
            </div>
          </div>
        )}
      </div>

      {/* Top Issues to Fix */}
      <div style={{
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: 10,
        padding: 24
      }}>
        <div style={{
          fontSize: 11,
          fontWeight: 600,
          color: C.text3,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          marginBottom: 16
        }}>
          TOP ISSUES TO FIX
        </div>

        {/* NORMALIZE subsection */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: C.text, marginBottom: 8 }}>
            NORMALIZE
          </div>
          {data.normalize.topIssues.length === 0 ? (
            <div style={{ fontSize: 13, color: C.text2 }}>No normalization issues found. ✓</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {data.normalize.topIssues.map((issue, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontSize: 13, fontFamily: F.mono, color: C.text }}>{issue.field}</span>
                    <span style={{ fontSize: 13, color: C.text2, marginLeft: 12 }}>
                      {issue.count} companies need normalization
                    </span>
                  </div>
                  <Link
                    href="/normalize"
                    style={{
                      fontSize: 12,
                      color: C.indigo,
                      textDecoration: 'none'
                    }}
                  >
                    Fix →
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* DEDUP subsection */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: C.text, marginBottom: 8 }}>
            DEDUP
          </div>
          {data.dedup.openClusters === 0 ? (
            <div style={{ fontSize: 13, color: C.text2 }}>No duplicate clusters found. Run a scan to check.</div>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 13, color: C.text }}>
                {data.dedup.openClusters} open clusters · {data.dedup.gradeA} Grade A ready to merge
              </div>
              <Link
                href="/dedup"
                style={{
                  fontSize: 12,
                  color: C.indigo,
                  textDecoration: 'none'
                }}
              >
                Review →
              </Link>
            </div>
          )}
        </div>

        {/* ENRICH subsection */}
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: C.text, marginBottom: 8 }}>
            ENRICH
          </div>
          {data.enrich.topGaps.length === 0 ? (
            <div style={{ fontSize: 13, color: C.text2 }}>Your data looks complete. ✓</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {data.enrich.topGaps.map((gap, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontSize: 13, fontFamily: F.mono, color: C.text }}>{gap.field}</span>
                    <span style={{ fontSize: 13, color: C.text2, marginLeft: 12 }}>
                      missing on {gap.missing.toLocaleString()} companies ({gap.coverage}% coverage)
                    </span>
                  </div>
                  <Link
                    href="/enrich"
                    style={{
                      fontSize: 12,
                      color: C.indigo,
                      textDecoration: 'none'
                    }}
                  >
                    Enrich →
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
