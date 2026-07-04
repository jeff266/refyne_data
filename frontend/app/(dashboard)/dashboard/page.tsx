import Link from 'next/link';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { C, F } from '@/lib/design-tokens';
import { supabaseAdmin } from '@/lib/db/admin-client';

async function getDashboardData(orgId: string) {
  console.log('[Dashboard] Fetching data for orgId:', orgId);

  try {
    // 1. Get org name and billing info from workspace_entitlements
    const { data: orgData, error: orgError } = await supabaseAdmin
      .from('workspace_entitlements')
      .select('org_name, plan, subscription_status, enrich_credits_used, enrich_credits_limit, trial_ends_at')
      .eq('clerk_org_id', orgId)
      .single();

    if (orgError) console.error('[Dashboard] org_name query error:', orgError);
    console.log('[Dashboard] Org data:', orgData);

    // 2. Get company count
    const { count: companyCount, error: companyError } = await supabaseAdmin
      .from('normalized_records')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .eq('record_type', 'company');

    if (companyError) console.error('[Dashboard] company count error:', companyError);
    console.log('[Dashboard] Company count:', companyCount);

    // 3. Get contact count
    const { count: contactCount, error: contactError } = await supabaseAdmin
      .from('normalized_records')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .eq('record_type', 'contact');

    if (contactError) console.error('[Dashboard] contact count error:', contactError);
    console.log('[Dashboard] Contact count:', contactCount);

    // 4. Get open dedup clusters
    const { count: dedupClusters, error: dedupError } = await supabaseAdmin
      .from('dedup_clusters')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .eq('status', 'open');

    if (dedupError) console.error('[Dashboard] dedup count error:', dedupError);
    console.log('[Dashboard] Dedup clusters:', dedupClusters);

    // 5. Get normalize issues - query harmony_field_assignments to count pending normalizations
    const { data: harmonies, error: harmoniesError } = await supabaseAdmin
      .from('harmony_field_assignments')
      .select('canonical_field')
      .eq('org_id', orgId)
      .eq('is_active', true);

    if (harmoniesError) console.error('[Dashboard] harmonies error:', harmoniesError);

    // For each harmony, count companies that need normalization
    let normalizeIssues = 0;
    if (harmonies && harmonies.length > 0) {
      // Simplified: just count total active harmonies as a proxy
      // TODO: Actually count records that need normalization
      normalizeIssues = harmonies.length * 10; // Rough estimate
    }
    console.log('[Dashboard] Normalize issues estimate:', normalizeIssues);

    // 6. Calculate data health score (simple formula based on data quality)
    const totalRecords = (companyCount || 0) + (contactCount || 0);
    const issueRate = totalRecords > 0 ? ((normalizeIssues || 0) / totalRecords) : 0;
    const dataHealthScore = Math.max(0, Math.min(100, Math.round(100 - (issueRate * 100))));

    console.log('[Dashboard] Calculated data health:', { totalRecords, issueRate, dataHealthScore });

    // 7. Get enrichment usage from workspace_entitlements
    const enrichCreditsUsed = orgData?.enrich_credits_used || 0;
    const enrichCreditsTotal = orgData?.enrich_credits_limit || 500;

    // 8. Calculate trial days remaining
    const now = new Date();
    const trialEndsAt = orgData?.trial_ends_at ? new Date(orgData.trial_ends_at) : null;
    const trialDaysLeft = trialEndsAt
      ? Math.max(0, Math.ceil((trialEndsAt.getTime() - now.getTime()) / 86400000))
      : null;

    const result = {
      orgName: orgData?.org_name || 'Your Workspace',
      companyCount: companyCount || 0,
      contactCount: contactCount || 0,
      dataHealthScore,
      dataHealthDelta: 6, // TODO: Calculate week-over-week change
      normalizeIssues: normalizeIssues || 0,
      dedupClusters: dedupClusters || 0,
      enrichCreditsUsed,
      enrichCreditsTotal,
      trialDaysLeft,
      plan: orgData?.plan || 'trialing',
      subscriptionStatus: orgData?.subscription_status || 'trialing',
    };

    console.log('[Dashboard] Final result:', result);
    return result;
  } catch (error) {
    console.error('[Dashboard] Failed to fetch dashboard data:', error);
    // Return safe defaults on error
    return {
      orgName: 'Your Workspace',
      companyCount: 0,
      contactCount: 0,
      dataHealthScore: 100,
      dataHealthDelta: 6,
      normalizeIssues: 0,
      dedupClusters: 0,
      enrichCreditsUsed: 500,
      enrichCreditsTotal: 500,
      trialDaysLeft: 14,
      plan: 'trialing',
      subscriptionStatus: 'trialing',
    };
  }
}

// Helper function to calculate letter grade from score
function getGrade(score: number): { letter: string; color: string } {
  if (score >= 97) return { letter: 'A', color: '#10b981' }; // green
  if (score >= 85) return { letter: 'B', color: '#f59e0b' }; // amber
  if (score >= 70) return { letter: 'C', color: '#f59e0b' }; // amber
  if (score >= 60) return { letter: 'D', color: '#ef4444' }; // red
  return { letter: 'F', color: '#ef4444' }; // red
}

export default async function DashboardPage() {
  const { userId, orgId } = await auth();

  if (!userId) {
    return <div>Not authenticated</div>;
  }

  const data = await getDashboardData(orgId || '');
  const grade = getGrade(data.dataHealthScore);

  const currentDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric'
  });

  // Get user's first name from Clerk
  let userName = 'there';
  try {
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    userName = user.firstName || user.emailAddresses[0]?.emailAddress?.split('@')[0] || 'there';
  } catch (error) {
    console.error('Failed to fetch user name:', error);
  }

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
          <p style={{ fontSize: 14, color: C.text2, margin: 0 }}>{currentDate}</p>
        </div>
        <p style={{ fontSize: 14, color: C.text2, margin: 0 }}>
          {data.orgName} · {data.companyCount.toLocaleString()} companies · {data.contactCount.toLocaleString()} contacts
        </p>
      </div>

      {/* Stats Cards Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16, marginBottom: 24 }}>
        {/* Data Health Score */}
        <div style={{
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderRadius: 10,
          padding: 20
        }}>
          <div style={{
            fontSize: 10,
            fontWeight: 600,
            color: C.text3,
            textTransform: 'uppercase',
            letterSpacing: '0.8px',
            marginBottom: 16
          }}>
            Data Health
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
            <svg width="100" height="100" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke={C.border}
                strokeWidth="8"
              />
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke={grade.color}
                strokeWidth="8"
                strokeDasharray={`${data.dataHealthScore * 2.51} 251`}
                strokeLinecap="round"
                transform="rotate(-90 50 50)"
              />
              <text
                x="50"
                y="45"
                textAnchor="middle"
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  fill: grade.color,
                  letterSpacing: '-0.5px'
                }}
              >
                {grade.letter}
              </text>
              <text
                x="50"
                y="60"
                textAnchor="middle"
                style={{
                  fontSize: 18,
                  fontWeight: 600,
                  fill: C.text,
                  fontFamily: F.mono
                }}
              >
                {data.dataHealthScore}/100
              </text>
            </svg>
          </div>
          <div style={{
            fontSize: 11,
            color: '#10b981',
            textAlign: 'center',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4
          }}>
            <span>▲</span>
            <span>+{data.dataHealthDelta} this week</span>
          </div>
        </div>

        {/* Normalize */}
        <div style={{
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderRadius: 10,
          padding: 20
        }}>
          <div style={{
            fontSize: 10,
            fontWeight: 600,
            color: C.text3,
            textTransform: 'uppercase',
            letterSpacing: '0.8px',
            marginBottom: 12
          }}>
            Normalize
          </div>
          <div style={{
            fontSize: 32,
            fontWeight: 600,
            color: C.text,
            fontFamily: F.mono,
            letterSpacing: '-1px',
            marginBottom: 8
          }}>
            {data.normalizeIssues.toLocaleString()}
          </div>
          <div style={{ display: 'flex', gap: 2, marginBottom: 8, height: 24, alignItems: 'flex-end' }}>
            {[40, 60, 45, 70, 55, 80, 65].map((height, i) => (
              <div
                key={i}
                style={{
                  flex: 1,
                  background: i >= 5 ? '#8b5cf6' : '#4c1d95',
                  borderRadius: 2,
                  height: `${height}%`
                }}
              />
            ))}
          </div>
          <div style={{ fontSize: 11, color: C.text3 }}>
            issues found
          </div>
        </div>

        {/* Dedup */}
        <div style={{
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderRadius: 10,
          padding: 20
        }}>
          <div style={{
            fontSize: 10,
            fontWeight: 600,
            color: C.text3,
            textTransform: 'uppercase',
            letterSpacing: '0.8px',
            marginBottom: 12
          }}>
            Dedup
          </div>
          <div style={{
            fontSize: 32,
            fontWeight: 600,
            color: C.text,
            fontFamily: F.mono,
            letterSpacing: '-1px',
            marginBottom: 8
          }}>
            {data.dedupClusters}
          </div>
          <div style={{ display: 'flex', gap: 2, marginBottom: 8, height: 24, alignItems: 'flex-end' }}>
            {[50, 70, 60, 85, 65, 90, 75].map((height, i) => (
              <div
                key={i}
                style={{
                  flex: 1,
                  background: i >= 5 ? '#8b5cf6' : '#4c1d95',
                  borderRadius: 2,
                  height: `${height}%`
                }}
              />
            ))}
          </div>
          <div style={{ fontSize: 11, color: C.text3 }}>
            open clusters
          </div>
        </div>

        {/* Enrich */}
        <div style={{
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderRadius: 10,
          padding: 20
        }}>
          <div style={{
            fontSize: 10,
            fontWeight: 600,
            color: C.text3,
            textTransform: 'uppercase',
            letterSpacing: '0.8px',
            marginBottom: 12
          }}>
            Enrich
          </div>
          <div style={{
            fontSize: 32,
            fontWeight: 600,
            color: C.text,
            fontFamily: F.mono,
            letterSpacing: '-1px',
            marginBottom: 8
          }}>
            {data.enrichCreditsUsed}
          </div>
          <div style={{ marginBottom: 8 }}>
            <div style={{
              width: '100%',
              height: 8,
              background: C.border,
              borderRadius: 4,
              overflow: 'hidden'
            }}>
              <div style={{
                width: `${(data.enrichCreditsUsed / data.enrichCreditsTotal) * 100}%`,
                height: '100%',
                background: '#f59e0b',
                borderRadius: 4
              }} />
            </div>
          </div>
          <div style={{ fontSize: 11, color: C.text3 }}>
            {data.enrichCreditsUsed}/{data.enrichCreditsTotal} · exhausted
          </div>
        </div>

        {/* Contacts */}
        <div style={{
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderRadius: 10,
          padding: 20
        }}>
          <div style={{
            fontSize: 10,
            fontWeight: 600,
            color: C.text3,
            textTransform: 'uppercase',
            letterSpacing: '0.8px',
            marginBottom: 12
          }}>
            Contacts
          </div>
          <div style={{
            fontSize: 32,
            fontWeight: 600,
            color: C.text,
            fontFamily: F.mono,
            letterSpacing: '-1px',
            marginBottom: 8
          }}>
            {data.contactCount.toLocaleString()}
          </div>
          <div style={{ display: 'flex', gap: 2, marginBottom: 8, height: 24, alignItems: 'flex-end' }}>
            {[60, 75, 70, 80, 68, 85, 78].map((height, i) => (
              <div
                key={i}
                style={{
                  flex: 1,
                  background: i >= 5 ? '#10b981' : '#065f46',
                  borderRadius: 2,
                  height: `${height}%`
                }}
              />
            ))}
          </div>
          <div style={{ fontSize: 11, color: C.text3 }}>
            across {data.companyCount.toLocaleString()} cos
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24 }}>
        {/* Left Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Top Issues to Fix */}
          <div style={{
            background: C.surface,
            border: `1px solid ${C.border}`,
            borderRadius: 10,
            padding: 24
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: C.text, margin: 0 }}>
                Top issues to fix
              </h3>
              <Link href="/normalize" style={{ fontSize: 12, color: C.indigo, textDecoration: 'none' }}>
                View all →
              </Link>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                  <th style={{
                    padding: '8px 12px',
                    textAlign: 'left',
                    fontSize: 10,
                    fontWeight: 600,
                    color: C.text3,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>
                    Field
                  </th>
                  <th style={{
                    padding: '8px 12px',
                    textAlign: 'left',
                    fontSize: 10,
                    fontWeight: 600,
                    color: C.text3,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>
                    Issue
                  </th>
                  <th style={{
                    padding: '8px 12px',
                    textAlign: 'right',
                    fontSize: 10,
                    fontWeight: 600,
                    color: C.text3,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>
                    Count
                  </th>
                  <th style={{ width: 80 }}></th>
                </tr>
              </thead>
              <tbody>
                {data.dedupClusters > 0 && (
                  <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                    <td style={{ padding: '12px', fontSize: 13, fontFamily: F.mono, color: C.text }}>dedup</td>
                    <td style={{ padding: '12px', fontSize: 13, color: C.text2 }}>Open duplicate clusters</td>
                    <td style={{ padding: '12px', fontSize: 13, color: C.text, textAlign: 'right', fontFamily: F.mono }}>{data.dedupClusters}</td>
                    <td style={{ padding: '12px', textAlign: 'right' }}>
                      <Link href="/dedup" style={{ fontSize: 12, color: C.indigo, textDecoration: 'none' }}>Fix →</Link>
                    </td>
                  </tr>
                )}
                {data.normalizeIssues > 0 && (
                  <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                    <td style={{ padding: '12px', fontSize: 13, fontFamily: F.mono, color: C.text }}>normalize</td>
                    <td style={{ padding: '12px', fontSize: 13, color: C.text2 }}>Fields need normalization</td>
                    <td style={{ padding: '12px', fontSize: 13, color: C.text, textAlign: 'right', fontFamily: F.mono }}>{data.normalizeIssues}</td>
                    <td style={{ padding: '12px', textAlign: 'right' }}>
                      <Link href="/normalize" style={{ fontSize: 12, color: C.indigo, textDecoration: 'none' }}>Fix →</Link>
                    </td>
                  </tr>
                )}
                {data.dedupClusters === 0 && data.normalizeIssues === 0 && (
                  <tr>
                    <td colSpan={4} style={{ padding: '24px', fontSize: 13, color: C.text2, textAlign: 'center' }}>
                      No issues found — your data is clean! 🎉
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Recent Activity */}
          <div style={{
            background: C.surface,
            border: `1px solid ${C.border}`,
            borderRadius: 10,
            padding: 24
          }}>
            <h3 style={{
              fontSize: 10,
              fontWeight: 600,
              color: C.text3,
              textTransform: 'uppercase',
              letterSpacing: '0.8px',
              marginBottom: 16
            }}>
              Recent Activity
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: '#10b981',
                  flexShrink: 0
                }} />
                <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontSize: 13, fontWeight: 500, color: C.text }}>Dedup scan</span>
                    <span style={{ fontSize: 13, color: C.text3, margin: '0 6px' }}>·</span>
                    <span style={{ fontSize: 13, color: C.text2 }}>262 clusters</span>
                  </div>
                  <div style={{ fontSize: 12, color: C.text3 }}>Jun 6</div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: C.text3,
                  flexShrink: 0
                }} />
                <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontSize: 13, fontWeight: 500, color: C.text }}>Normalize</span>
                    <span style={{ fontSize: 13, color: C.text3, margin: '0 6px' }}>·</span>
                    <span style={{ fontSize: 13, color: C.text2 }}>847 companies</span>
                  </div>
                  <div style={{ fontSize: 12, color: C.text3 }}>May 30</div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: C.text3,
                  flexShrink: 0
                }} />
                <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontSize: 13, fontWeight: 500, color: C.text }}>Dedup scan</span>
                    <span style={{ fontSize: 13, color: C.text3, margin: '0 6px' }}>·</span>
                    <span style={{ fontSize: 13, color: C.text2 }}>57 clusters</span>
                  </div>
                  <div style={{ fontSize: 12, color: C.text3 }}>May 29</div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: C.text3,
                  flexShrink: 0
                }} />
                <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontSize: 13, fontWeight: 500, color: C.text }}>Enrich</span>
                    <span style={{ fontSize: 13, color: C.text3, margin: '0 6px' }}>·</span>
                    <span style={{ fontSize: 13, color: C.text2 }}>44 companies</span>
                  </div>
                  <div style={{ fontSize: 12, color: C.text3 }}>May 26</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Plan Status */}
        <div style={{
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderRadius: 10,
          padding: 24,
          height: 'fit-content'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{
              fontSize: 10,
              fontWeight: 600,
              color: C.text3,
              textTransform: 'uppercase',
              letterSpacing: '0.8px',
              margin: 0
            }}>
              {data.plan === 'trialing' ? 'Trial Status' : 'Plan Status'}
            </h3>
            {data.trialDaysLeft !== null && (
              <div style={{
                padding: '2px 8px',
                background: '#f59e0b',
                color: '#000',
                borderRadius: 4,
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: '0.5px'
              }}>
                {data.trialDaysLeft} DAYS LEFT
              </div>
            )}
          </div>

          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: C.text, marginBottom: 4 }}>
              {data.plan === 'trialing' ? 'Free Trial' : data.plan === 'growth' ? 'Growth Plan' : data.plan.charAt(0).toUpperCase() + data.plan.slice(1)}
            </div>
            <div style={{ fontSize: 12, color: C.text2 }}>
              {data.enrichCreditsUsed >= data.enrichCreditsTotal
                ? 'Enrich credits exhausted — upgrade to keep enriching.'
                : `${data.enrichCreditsTotal - data.enrichCreditsUsed} enrich credits remaining.`}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Dedup merges */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <div style={{ fontSize: 12, color: C.text }}>Dedup merges</div>
                <div style={{ fontSize: 12, color: C.text2, fontFamily: F.mono }}>0/10</div>
              </div>
              <div style={{ width: '100%', height: 6, background: C.border, borderRadius: 3 }}>
                <div style={{ width: '0%', height: '100%', background: C.text3, borderRadius: 3 }} />
              </div>
            </div>

            {/* Normalize writes */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <div style={{ fontSize: 12, color: C.text }}>Normalize writes</div>
                <div style={{ fontSize: 12, color: C.text2, fontFamily: F.mono }}>0/500</div>
              </div>
              <div style={{ width: '100%', height: 6, background: C.border, borderRadius: 3 }}>
                <div style={{ width: '0%', height: '100%', background: C.text3, borderRadius: 3 }} />
              </div>
            </div>

            {/* Enrich credits */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <div style={{ fontSize: 12, color: C.text }}>Enrich credits</div>
                <div style={{ fontSize: 12, color: C.text2, fontFamily: F.mono }}>
                  {data.enrichCreditsUsed}/{data.enrichCreditsTotal}
                </div>
              </div>
              <div style={{ width: '100%', height: 6, background: C.border, borderRadius: 3, overflow: 'hidden' }}>
                <div style={{
                  width: `${(data.enrichCreditsUsed / data.enrichCreditsTotal) * 100}%`,
                  height: '100%',
                  background: '#8b5cf6',
                  borderRadius: 3
                }} />
              </div>
            </div>
          </div>

          {(data.plan === 'trialing' || data.plan === 'trial_expired') && (
            <Link
              href="/upgrade"
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
              Upgrade to Growth
            </Link>
          )}

          <Link
            href="/pricing"
            style={{
              display: 'block',
              marginTop: 12,
              fontSize: 12,
              color: C.text2,
              textAlign: 'center',
              textDecoration: 'none'
            }}
          >
            Compare plans →
          </Link>
        </div>
      </div>
    </div>
  );
}
