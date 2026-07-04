import Link from 'next/link';
import { auth } from '@clerk/nextjs/server';
import { C, F } from '@/lib/design-tokens';

export default async function DashboardPage() {
  const { userId } = await auth();

  if (!userId) {
    return <div>Not authenticated</div>;
  }

  const currentDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric'
  });

  return (
    <div style={{ padding: 32, maxWidth: 1400 }}>
      {/* Greeting */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <h2 style={{ fontSize: 24, fontWeight: 600, color: C.text, margin: 0 }}>
            Good morning, Jeff
          </h2>
          <p style={{ fontSize: 14, color: C.text2, margin: 0 }}>{currentDate}</p>
        </div>
        <p style={{ fontSize: 14, color: C.text2, margin: 0 }}>
          Frontera Health · 2,835 companies · 8,199 contacts
        </p>
      </div>

      {/* Data Health Cards */}
      <div style={{
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: 10,
        padding: 24,
        marginBottom: 24
      }}>
        <h3 style={{
          fontSize: 11,
          fontWeight: 600,
          color: C.text3,
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          marginBottom: 24
        }}>
          Data Health
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          {/* Normalize Card */}
          <div style={{
            border: `1px solid ${C.border}`,
            borderRadius: 10,
            padding: 24
          }}>
            <h4 style={{
              fontSize: 11,
              fontWeight: 600,
              color: C.text3,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              marginBottom: 16
            }}>
              Normalize
            </h4>
            <div style={{ marginBottom: 16 }}>
              <div style={{
                fontSize: 28,
                fontWeight: 600,
                color: C.text,
                letterSpacing: '-0.5px',
                marginBottom: 4,
                fontFamily: F.mono
              }}>
                1,204
              </div>
              <div style={{ fontSize: 13, color: C.text2 }}>
                issues found
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <p style={{ fontSize: 11, color: C.text3, margin: '0 0 4px 0' }}>Last run</p>
              <p style={{ fontSize: 13, color: C.text, margin: 0 }}>May 30</p>
            </div>
            <Link
              href="/normalize"
              style={{
                display: 'block',
                padding: '8px 16px',
                textAlign: 'center',
                border: `1px solid ${C.border}`,
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 500,
                color: C.text,
                textDecoration: 'none',
                background: 'transparent',
                transition: 'all 0.15s'
              }}
            >
              Normalize →
            </Link>
          </div>

          {/* Dedup Card */}
          <div style={{
            border: `1px solid ${C.border}`,
            borderRadius: 10,
            padding: 24
          }}>
            <h4 style={{
              fontSize: 11,
              fontWeight: 600,
              color: C.text3,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              marginBottom: 16
            }}>
              Dedup
            </h4>
            <div style={{ marginBottom: 16 }}>
              <div style={{
                fontSize: 28,
                fontWeight: 600,
                color: C.text,
                letterSpacing: '-0.5px',
                marginBottom: 4,
                fontFamily: F.mono
              }}>
                262
              </div>
              <div style={{ fontSize: 13, color: C.text2 }}>
                open clusters
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <p style={{ fontSize: 11, color: C.text3, margin: '0 0 4px 0' }}>Last scan</p>
              <p style={{ fontSize: 13, color: C.text, margin: 0 }}>2h ago</p>
            </div>
            <Link
              href="/dedup"
              style={{
                display: 'block',
                padding: '8px 16px',
                textAlign: 'center',
                border: `1px solid ${C.border}`,
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 500,
                color: C.text,
                textDecoration: 'none',
                background: 'transparent',
                transition: 'all 0.15s'
              }}
            >
              Review →
            </Link>
          </div>

          {/* Enrich Card */}
          <div style={{
            border: `1px solid ${C.border}`,
            borderRadius: 10,
            padding: 24
          }}>
            <h4 style={{
              fontSize: 11,
              fontWeight: 600,
              color: C.text3,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              marginBottom: 16
            }}>
              Enrich
            </h4>
            <div style={{ marginBottom: 16 }}>
              <div style={{
                fontSize: 28,
                fontWeight: 600,
                color: C.text,
                letterSpacing: '-0.5px',
                marginBottom: 4,
                fontFamily: F.mono
              }}>
                0
              </div>
              <div style={{ fontSize: 13, color: C.text2 }}>
                credits used
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <p style={{ fontSize: 13, color: C.text, margin: 0 }}>
                500 / 500 trial
              </p>
            </div>
            <Link
              href="/enrich"
              style={{
                display: 'block',
                padding: '8px 16px',
                textAlign: 'center',
                border: `1px solid ${C.border}`,
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 500,
                color: C.text,
                textDecoration: 'none',
                background: 'transparent',
                transition: 'all 0.15s'
              }}
            >
              Enrich →
            </Link>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
        {/* Recent Activity */}
        <div style={{
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderRadius: 10,
          padding: 24
        }}>
          <h3 style={{
            fontSize: 11,
            fontWeight: 600,
            color: C.text3,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            marginBottom: 16
          }}>
            Recent Activity
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ fontSize: 13, color: C.text2, width: 50 }}>Jun 6</div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 13, fontWeight: 500, color: C.text, margin: '0 0 4px 0' }}>
                  Dedup scan ran
                </p>
                <p style={{ fontSize: 13, color: C.text2, margin: 0 }}>
                  262 clusters found
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ fontSize: 13, color: C.text2, width: 50 }}>May 30</div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 13, fontWeight: 500, color: C.text, margin: '0 0 4px 0' }}>
                  Normalize applied
                </p>
                <p style={{ fontSize: 13, color: C.text2, margin: 0 }}>
                  847 companies
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ fontSize: 13, color: C.text2, width: 50 }}>May 29</div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 13, fontWeight: 500, color: C.text, margin: '0 0 4px 0' }}>
                  Dedup scan ran
                </p>
                <p style={{ fontSize: 13, color: C.text2, margin: 0 }}>
                  57 clusters found
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ fontSize: 13, color: C.text2, width: 50 }}>May 26</div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 13, fontWeight: 500, color: C.text, margin: '0 0 4px 0' }}>
                  Enrich run applied
                </p>
                <p style={{ fontSize: 13, color: C.text2, margin: 0 }}>
                  44 companies
                </p>
              </div>
            </div>
          </div>

          <Link
            href="/history"
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

        {/* Trial Status */}
        <div style={{
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderRadius: 10,
          padding: 24
        }}>
          <h3 style={{
            fontSize: 11,
            fontWeight: 600,
            color: C.text3,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            marginBottom: 16
          }}>
            Trial Status
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <p style={{ fontSize: 13, fontWeight: 500, color: C.text, margin: '0 0 4px 0' }}>
                Free Trial
              </p>
              <p style={{ fontSize: 13, color: C.text2, margin: 0 }}>
                8 days remaining
              </p>
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <p style={{ fontSize: 13, color: C.text, margin: 0 }}>Dedup merges</p>
                <p style={{ fontSize: 13, color: C.text2, margin: 0 }}>0/10</p>
              </div>
              <div style={{ width: '100%', background: C.border, borderRadius: 999, height: 8 }}>
                <div style={{ background: C.text3, height: 8, borderRadius: 999, width: '0%' }} />
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <p style={{ fontSize: 13, color: C.text, margin: 0 }}>Normalize writes</p>
                <p style={{ fontSize: 13, color: C.text2, margin: 0 }}>0/500</p>
              </div>
              <div style={{ width: '100%', background: C.border, borderRadius: 999, height: 8 }}>
                <div style={{ background: C.text3, height: 8, borderRadius: 999, width: '0%' }} />
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <p style={{ fontSize: 13, color: C.text, margin: 0 }}>Enrich credits</p>
                <p style={{ fontSize: 13, color: C.text2, margin: 0 }}>500/500</p>
              </div>
              <div style={{ width: '100%', background: C.border, borderRadius: 999, height: 8 }}>
                <div style={{ background: C.indigo, height: 8, borderRadius: 999, width: '100%' }} />
              </div>
              <p style={{ fontSize: 11, color: C.text3, marginTop: 4, margin: '4px 0 0 0' }}>← exhausted</p>
            </div>

            <Link
              href="/upgrade"
              style={{
                width: '100%',
                marginTop: 8,
                padding: '10px 16px',
                background: C.indigo,
                color: 'white',
                border: 'none',
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 500,
                textAlign: 'center',
                textDecoration: 'none',
                display: 'block'
              }}
            >
              Upgrade to Growth
            </Link>
          </div>
        </div>
      </div>

      {/* Top Issues */}
      <div style={{
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: 10,
        padding: 24
      }}>
        <h3 style={{
          fontSize: 11,
          fontWeight: 600,
          color: C.text3,
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          marginBottom: 24
        }}>
          Top Issues to Fix
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Normalize Issues */}
          <div>
            <h4 style={{
              fontSize: 11,
              fontWeight: 600,
              color: C.text3,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              marginBottom: 12
            }}>
              Normalize
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0' }}>
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: 13, fontFamily: F.mono, color: C.text }}>phone</span>
                  <span style={{ fontSize: 13, color: C.text2, marginLeft: 16 }}>
                    22 companies need formatting
                  </span>
                </div>
                <Link
                  href="/normalize?field=phone"
                  style={{
                    padding: '6px 12px',
                    border: `1px solid ${C.border}`,
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 500,
                    color: C.text,
                    textDecoration: 'none',
                    background: 'transparent'
                  }}
                >
                  Fix →
                </Link>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0' }}>
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: 13, fontFamily: F.mono, color: C.text }}>linkedin_url</span>
                  <span style={{ fontSize: 13, color: C.text2, marginLeft: 16 }}>
                    40 companies need normalization
                  </span>
                </div>
                <Link
                  href="/normalize?field=linkedin_url"
                  style={{
                    padding: '6px 12px',
                    border: `1px solid ${C.border}`,
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 500,
                    color: C.text,
                    textDecoration: 'none',
                    background: 'transparent'
                  }}
                >
                  Fix →
                </Link>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0' }}>
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: 13, fontFamily: F.mono, color: C.text }}>company_name</span>
                  <span style={{ fontSize: 13, color: C.text2, marginLeft: 16 }}>
                    3 companies need title case
                  </span>
                </div>
                <Link
                  href="/normalize?field=company_name"
                  style={{
                    padding: '6px 12px',
                    border: `1px solid ${C.border}`,
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 500,
                    color: C.text,
                    textDecoration: 'none',
                    background: 'transparent'
                  }}
                >
                  Fix →
                </Link>
              </div>
            </div>
          </div>

          {/* Dedup Issues */}
          <div>
            <h4 style={{
              fontSize: 11,
              fontWeight: 600,
              color: C.text3,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              marginBottom: 12
            }}>
              Dedup
            </h4>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0' }}>
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: 13, color: C.text }}>
                  262 open clusters · 17 Grade A · 245 Grade B
                </span>
              </div>
              <Link
                href="/dedup"
                style={{
                  padding: '6px 12px',
                  border: `1px solid ${C.border}`,
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 500,
                  color: C.text,
                  textDecoration: 'none',
                  background: 'transparent'
                }}
              >
                Review →
              </Link>
            </div>
          </div>

          {/* Enrich Issues */}
          <div>
            <h4 style={{
              fontSize: 11,
              fontWeight: 600,
              color: C.text3,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              marginBottom: 12
            }}>
              Enrich
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0' }}>
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: 13, color: C.text }}>
                    Phone missing on 6,155 companies (25% coverage)
                  </span>
                </div>
                <Link
                  href="/enrich?field=phone"
                  style={{
                    padding: '6px 12px',
                    border: `1px solid ${C.border}`,
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 500,
                    color: C.text,
                    textDecoration: 'none',
                    background: 'transparent'
                  }}
                >
                  Enrich →
                </Link>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0' }}>
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: 13, color: C.text }}>
                    City missing on 6,531 companies (20% coverage)
                  </span>
                </div>
                <Link
                  href="/enrich?field=city"
                  style={{
                    padding: '6px 12px',
                    border: `1px solid ${C.border}`,
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 500,
                    color: C.text,
                    textDecoration: 'none',
                    background: 'transparent'
                  }}
                >
                  Enrich →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
