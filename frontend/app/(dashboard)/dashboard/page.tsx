import Link from 'next/link';
import { auth } from '@clerk/nextjs/server';
import { C, F } from '@/lib/design-tokens';

// TODO: Fetch real data from API
async function getDashboardData(orgId: string) {
  // This should call your API endpoints to get real data
  return {
    orgName: 'RevOps Impact', // TODO: Get from org settings
    companyCount: 2835,
    contactCount: 8199,
    dataHealthScore: 74,
    dataHealthDelta: 6,
    normalizeIssues: 1204,
    dedupClusters: 262,
    enrichCreditsUsed: 500,
    enrichCreditsTotal: 500,
    trialDaysLeft: 8,
  };
}

export default async function DashboardPage() {
  const { userId, orgId } = await auth();

  if (!userId) {
    return <div>Not authenticated</div>;
  }

  const data = await getDashboardData(orgId || '');

  const currentDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric'
  });

  const userName = 'Jeff'; // TODO: Get from user profile

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
                stroke="#f59e0b"
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
                  fill: '#f59e0b',
                  letterSpacing: '-0.5px'
                }}
              >
                B
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
                <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                  <td style={{ padding: '12px', fontSize: 13, fontFamily: F.mono, color: C.text }}>dedup</td>
                  <td style={{ padding: '12px', fontSize: 13, color: C.text2 }}>Open duplicate clusters</td>
                  <td style={{ padding: '12px', fontSize: 13, color: C.text, textAlign: 'right', fontFamily: F.mono }}>262</td>
                  <td style={{ padding: '12px', textAlign: 'right' }}>
                    <Link href="/dedup" style={{ fontSize: 12, color: C.indigo, textDecoration: 'none' }}>Fix →</Link>
                  </td>
                </tr>
                <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                  <td style={{ padding: '12px', fontSize: 13, fontFamily: F.mono, color: C.text }}>linkedin_url</td>
                  <td style={{ padding: '12px', fontSize: 13, color: C.text2 }}>Need normalization</td>
                  <td style={{ padding: '12px', fontSize: 13, color: C.text, textAlign: 'right', fontFamily: F.mono }}>40</td>
                  <td style={{ padding: '12px', textAlign: 'right' }}>
                    <Link href="/normalize?field=linkedin_url" style={{ fontSize: 12, color: C.indigo, textDecoration: 'none' }}>Fix →</Link>
                  </td>
                </tr>
                <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                  <td style={{ padding: '12px', fontSize: 13, fontFamily: F.mono, color: C.text }}>phone</td>
                  <td style={{ padding: '12px', fontSize: 13, color: C.text2 }}>Need formatting</td>
                  <td style={{ padding: '12px', fontSize: 13, color: C.text, textAlign: 'right', fontFamily: F.mono }}>22</td>
                  <td style={{ padding: '12px', textAlign: 'right' }}>
                    <Link href="/normalize?field=phone" style={{ fontSize: 12, color: C.indigo, textDecoration: 'none' }}>Fix →</Link>
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: '12px', fontSize: 13, fontFamily: F.mono, color: C.text }}>company_name</td>
                  <td style={{ padding: '12px', fontSize: 13, color: C.text2 }}>Need title case</td>
                  <td style={{ padding: '12px', fontSize: 13, color: C.text, textAlign: 'right', fontFamily: F.mono }}>3</td>
                  <td style={{ padding: '12px', textAlign: 'right' }}>
                    <Link href="/normalize?field=company_name" style={{ fontSize: 12, color: C.indigo, textDecoration: 'none' }}>Fix →</Link>
                  </td>
                </tr>
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

        {/* Right Column - Trial Status */}
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
              Trial Status
            </h3>
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
          </div>

          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: C.text, marginBottom: 4 }}>
              Free Trial
            </div>
            <div style={{ fontSize: 12, color: C.text2 }}>
              Enrich credits exhausted — upgrade to keep enriching.
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
                <div style={{ fontSize: 12, color: C.text2, fontFamily: F.mono }}>500/500</div>
              </div>
              <div style={{ width: '100%', height: 6, background: C.border, borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ width: '100%', height: '100%', background: '#8b5cf6', borderRadius: 3 }} />
              </div>
            </div>
          </div>

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
