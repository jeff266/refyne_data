'use client';

import Link from 'next/link';
import { C, F } from '@/lib/design-tokens';
import { Check } from 'lucide-react';

// ── Sub-components ──────────────────────────────────────────────────

const RefyneMark = ({ size = 34 }: { size?: number }) => (
  <div style={{
    width: size,
    height: size,
    borderRadius: 0,
    background: `linear-gradient(135deg, ${C.indigo}, #5a59e0)`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: size * 0.56,
    fontWeight: 700,
    fontFamily: F.serif,
    color: '#fff',
    boxShadow: '0 4px 14px rgba(98,96,230,.45)',
  }}>
    R
  </div>
);

// ── Page ────────────────────────────────────────────────────────────

export default function HomePage() {
  return (
    <div style={{
      minHeight: '100vh',
      background: C.bg,
      fontFamily: F.sans,
      color: C.text,
    }}>

      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        a { text-decoration: none; }
      `}</style>

      {/* ── Header ───────────────────────────────────────────────── */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 50,
        borderBottom: `1px solid ${C.border}`,
        background: C.sidebar,
      }}>
        <div style={{
          maxWidth: 1280, margin: '0 auto',
          padding: '20px 48px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 11, textDecoration: 'none' }}>
            <RefyneMark size={34} />
            <span style={{
              fontSize: 20, fontWeight: 700, color: C.text,
              letterSpacing: '-.01em',
              fontFamily: F.serif,
            }}>
              Refyne
            </span>
          </Link>

          <nav style={{ display: 'flex', alignItems: 'center', gap: 34 }}>
            <Link href="/pricing" style={{ fontSize: 15, color: C.text2, fontWeight: 500 }}>
              Pricing
            </Link>
            <Link href="/docs" style={{ fontSize: 15, color: C.text2, fontWeight: 500 }}>
              Docs
            </Link>
            <Link href="/sign-in" style={{ fontSize: 15, color: C.text2, fontWeight: 500 }}>
              Sign in
            </Link>
            <Link href="/sign-up" style={{
              fontSize: 15,
              fontWeight: 600,
              color: '#fff',
              background: `linear-gradient(135deg, #7c7bff, #6260e6)`,
              padding: '11px 20px',
              borderRadius: 0,
              textDecoration: 'none',
              boxShadow: '0 6px 18px rgba(98,96,230,.4)',
            }}>
              Get started
            </Link>
          </nav>
        </div>
      </header>

      {/* ── Hero + Portal Health Card (Side by Side) ─────────────── */}
      <section style={{
        maxWidth: 1280, margin: '0 auto',
        padding: '96px 48px 80px',
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 64,
        alignItems: 'center',
      }}>
        {/* Left: Hero */}
        <div>
          {/* Badge */}
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 14px',
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 0,
            marginBottom: 28,
          }}>
            <Check size={15} color="#9dffe5" strokeWidth={2.5} />
            <span style={{
              fontSize: 13,
              fontWeight: 600,
              color: '#ccc',
              letterSpacing: '0.02em',
            }}>
              OFFICIAL HUBSPOT TECHNOLOGY PARTNER
            </span>
          </div>

          {/* Headline */}
          <h1 style={{
            fontSize: 56,
            fontWeight: 700,
            fontFamily: F.serif,
            color: C.text,
            lineHeight: 1.1,
            marginBottom: 24,
            letterSpacing: '-0.02em',
          }}>
            Your HubSpot data, <span style={{ color: C.indigo }}>graded</span> and <span style={{ color: C.indigo }}>clean</span>.
          </h1>

          {/* Subheadline */}
          <p style={{
            fontSize: 18,
            fontFamily: F.sans,
            color: C.text2,
            lineHeight: 1.6,
            marginBottom: 40,
          }}>
            Refyne scores every record, fixes what's broken, and keeps your portal at an A. Automatically, every night.
          </p>

          {/* CTAs */}
          <div style={{
            display: 'flex',
            gap: 12,
            marginBottom: 12,
          }}>
            <Link
              href="/sign-up"
              style={{
                padding: '14px 28px',
                background: `linear-gradient(135deg, #7c7bff, #6260e6)`,
                border: 'none',
                borderRadius: 0,
                fontSize: 15,
                fontWeight: 600,
                fontFamily: F.sans,
                color: '#fff',
                textDecoration: 'none',
                boxShadow: '0 6px 18px rgba(98,96,230,.4)',
              }}
            >
              Start free trial
            </Link>
            <Link
              href="/pricing"
              style={{
                padding: '14px 28px',
                background: 'transparent',
                border: `1px solid ${C.border}`,
                borderRadius: 0,
                fontSize: 15,
                fontWeight: 600,
                fontFamily: F.sans,
                color: C.text,
                textDecoration: 'none',
              }}
            >
              View pricing →
            </Link>
          </div>

          <p style={{
            fontSize: 13,
            color: C.text3,
            fontFamily: F.sans,
          }}>
            No credit card · 14-day trial · Cancel anytime
          </p>
        </div>

        {/* Right: Portal Health Card */}
        <div style={{
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderRadius: 12,
          padding: 32,
        }}>
          {/* Card header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <h3 style={{ fontSize: 18, fontWeight: 600, color: C.text, fontFamily: F.sans }}>
              Portal health
            </h3>
            <div style={{ fontSize: 12, color: C.text3, display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e' }} />
              Synced 4m ago
            </div>
          </div>

          {/* Grade display with circular progress */}
          <div style={{ display: 'flex', gap: 24, marginBottom: 24, alignItems: 'center' }}>
            {/* Circular progress indicator */}
            <div style={{ position: 'relative', width: 120, height: 120 }}>
              <svg width="120" height="120" style={{ transform: 'rotate(-90deg)' }}>
                {/* Background circle */}
                <circle
                  cx="60"
                  cy="60"
                  r="54"
                  fill="none"
                  stroke="rgba(34,197,94,0.2)"
                  strokeWidth="8"
                />
                {/* Progress circle (94% = 0.94 * 339 = 319) */}
                <circle
                  cx="60"
                  cy="60"
                  r="54"
                  fill="none"
                  stroke="#22c55e"
                  strokeWidth="8"
                  strokeDasharray="339"
                  strokeDashoffset="32"
                  strokeLinecap="round"
                />
              </svg>
              {/* Center text */}
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <div style={{ fontSize: 48, fontWeight: 700, color: '#22c55e', fontFamily: F.mono, lineHeight: 1 }}>
                  A
                </div>
                <div style={{ fontSize: 14, color: C.text3, fontFamily: F.mono }}>
                  94/100
                </div>
              </div>
            </div>

            {/* Health info */}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: C.text, marginBottom: 8 }}>
                Data health: Excellent
              </div>
              <div style={{ fontSize: 14, color: C.text2, marginBottom: 16 }}>
                +18 points since you connected. 312 issues fixed this week.
              </div>
              <div style={{ display: 'flex', gap: 24 }}>
                <div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: C.text, fontFamily: F.mono }}>0</div>
                  <div style={{ fontSize: 11, color: C.text3, textTransform: 'lowercase' }}>duplicates</div>
                </div>
                <div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: C.text, fontFamily: F.mono }}>100%</div>
                  <div style={{ fontSize: 11, color: C.text3, textTransform: 'lowercase' }}>formatted</div>
                </div>
                <div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: C.text, fontFamily: F.mono }}>87%</div>
                  <div style={{ fontSize: 11, color: C.text3, textTransform: 'lowercase' }}>enriched</div>
                </div>
              </div>
            </div>
          </div>

          {/* Activity feed */}
          <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 16 }}>
            {[
              { icon: '✓', action: 'Merged Acme Corp', detail: '2 records', time: '02:14' },
              { icon: '✓', action: 'Normalized 128 phone numbers', detail: '', time: '02:14' },
              { icon: '↑', action: 'Enriched 41 industry fields', detail: '', time: '02:13' },
            ].map((item, i) => (
              <div key={i} style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px 0',
                borderBottom: i < 2 ? `1px solid rgba(255,255,255,0.05)` : 'none',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 20,
                    height: 20,
                    borderRadius: 4,
                    background: item.icon === '↑' ? 'rgba(99,102,241,0.15)' : 'rgba(34,197,94,0.15)',
                    border: item.icon === '↑' ? '1px solid rgba(99,102,241,0.4)' : '1px solid rgba(34,197,94,0.4)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 11,
                    color: item.icon === '↑' ? C.indigo : '#22c55e',
                  }}>
                    {item.icon}
                  </div>
                  <span style={{ fontSize: 13, color: C.text }}>
                    {item.action}
                    {item.detail && <span style={{ color: C.text3 }}> · {item.detail}</span>}
                  </span>
                </div>
                <span style={{ fontSize: 12, color: C.text3 }}>{item.time}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Stats Bar ────────────────────────────────────────────── */}
      <section style={{
        maxWidth: 1280, margin: '0 auto',
        padding: '0 48px 80px',
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 1,
          background: C.border,
          borderRadius: 12,
          overflow: 'hidden',
        }}>
          {[
            { label: 'CRM data decays per year', value: '30%' },
            { label: 'records cleaned to date', value: '2.1M' },
            { label: 'to connect your portal', value: '60s' },
            { label: 'average portal grade', value: 'A' },
          ].map((stat, i) => (
            <div key={i} style={{
              padding: 28,
              background: C.surface,
              textAlign: 'center',
            }}>
              <div style={{ fontSize: 36, fontWeight: 700, color: C.indigo, fontFamily: F.mono, marginBottom: 8 }}>
                {stat.value}
              </div>
              <div style={{ fontSize: 12, color: C.text2 }}>
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Field Preview ────────────────────────────────────────── */}
      <section style={{
        maxWidth: 1280, margin: '0 auto',
        padding: '80px 48px',
        borderTop: `1px solid ${C.border}`,
      }}>
        <div style={{ textAlign: 'center', marginBottom: 52 }}>
          <h2 style={{
            fontSize: 38,
            fontWeight: 700,
            fontFamily: F.serif,
            color: C.text,
            lineHeight: 1.15,
            marginBottom: 16,
            letterSpacing: '-0.03em',
          }}>
            Field-by-field
          </h2>
          <p style={{
            fontSize: 18,
            color: C.text2,
            lineHeight: 1.6,
            maxWidth: 600,
            margin: '0 auto',
          }}>
            Every change, previewed before it ships.
          </p>
        </div>

        <div style={{
          maxWidth: 900,
          margin: '0 auto',
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderRadius: 0,
          overflow: 'hidden',
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'rgba(0,0,0,0.2)' }}>
                <th style={{
                  padding: 16,
                  textAlign: 'left',
                  fontSize: 11,
                  fontWeight: 600,
                  color: C.text3,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  borderBottom: `1px solid ${C.border}`,
                }}>
                  Field
                </th>
                <th style={{
                  padding: 16,
                  textAlign: 'left',
                  fontSize: 11,
                  fontWeight: 600,
                  color: C.text3,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  borderBottom: `1px solid ${C.border}`,
                }}>
                  Before
                </th>
                <th style={{
                  padding: 16,
                  textAlign: 'left',
                  fontSize: 11,
                  fontWeight: 600,
                  color: C.text3,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  borderBottom: `1px solid ${C.border}`,
                }}>
                  After
                </th>
              </tr>
            </thead>
            <tbody>
              {[
                { field: 'company', before: 'ACME CORP.', after: 'Acme Corp' },
                { field: 'phone', before: '(415) 555-2671', after: '+1 415-555-2671' },
                { field: 'industry', before: '(empty)', after: 'B2B SaaS' },
                { field: 'linkedin', before: '/company/acme/about/', after: '/company/acme' },
              ].map((row, i) => (
                <tr key={i} style={{ borderBottom: `1px solid rgba(255,255,255,0.05)` }}>
                  <td style={{ padding: '14px 16px', fontSize: 13, color: C.text2, fontWeight: 600 }}>
                    {row.field}
                  </td>
                  <td style={{ padding: '14px 16px', fontSize: 13, color: C.text3, fontFamily: F.mono }}>
                    {row.before}
                  </td>
                  <td style={{ padding: '14px 16px', fontSize: 13, color: C.indigo, fontFamily: F.mono }}>
                    {row.after}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────────── */}
      <section style={{
        maxWidth: 1280, margin: '0 auto',
        padding: '80px 48px',
        borderTop: `1px solid ${C.border}`,
      }}>
        <div style={{ textAlign: 'center', marginBottom: 52 }}>
          <h2 style={{
            fontSize: 38,
            fontWeight: 700,
            fontFamily: F.serif,
            color: C.text,
            lineHeight: 1.15,
            marginBottom: 16,
            letterSpacing: '-0.03em',
          }}>
            Everything your HubSpot data needs.
          </h2>
          <p style={{
            fontSize: 18,
            color: C.text2,
            lineHeight: 1.6,
            maxWidth: 600,
            margin: '0 auto',
          }}>
            Everything your CRM data needs.
          </p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 20,
        }}>
          {[
            {
              title: 'Normalize',
              description: 'Phone numbers, LinkedIn URLs, and industry values standardized across every record. Define your rules once; Refyne applies them everywhere.',
              badge: 'ACTIVE',
              badgeColor: 'rgba(34,197,94,1)',
            },
            {
              title: 'Dedup',
              description: 'Refyne scans HubSpot nightly, groups duplicates by confidence grade, and applies your merge rules automatically.',
              badge: 'ACTIVE',
              badgeColor: 'rgba(34,197,94,1)',
            },
            {
              title: 'Enrich',
              description: 'Empty fields filled from your own provider accounts like Apollo, ZoomInfo, and Cognism, or Refyne Search. Bring your keys, no markup.',
              badge: 'ACTIVE',
              badgeColor: 'rgba(34,197,94,1)',
            },
            {
              title: 'Always On',
              description: 'Nightly scans surface new issues before they hit your pipeline. Weekly digests show exactly what changed and what was fixed.',
              badge: 'NIGHTLY',
              badgeColor: C.indigo,
            },
          ].map((feature, i) => (
            <div key={i} style={{
              padding: 28,
              background: C.surface,
              border: `1px solid ${C.border}`,
              borderRadius: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                <h3 style={{
                  fontSize: 20,
                  fontWeight: 600,
                  color: C.text,
                  fontFamily: F.serif,
                }}>
                  {feature.title}
                </h3>
                <div style={{
                  padding: '4px 8px',
                  background: `${feature.badgeColor}22`,
                  border: `1px solid ${feature.badgeColor}66`,
                  borderRadius: 0,
                  fontSize: 10,
                  fontWeight: 700,
                  color: feature.badgeColor,
                  letterSpacing: '0.05em',
                }}>
                  {feature.badge}
                </div>
              </div>
              <p style={{
                fontSize: 14,
                color: C.text2,
                lineHeight: 1.6,
              }}>
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────── */}
      <section style={{
        maxWidth: 1280, margin: '0 auto',
        padding: '80px 48px',
        borderTop: `1px solid ${C.border}`,
      }}>
        <div style={{ textAlign: 'center', marginBottom: 52 }}>
          <h2 style={{
            fontSize: 38,
            fontWeight: 700,
            fontFamily: F.serif,
            color: C.text,
            lineHeight: 1.15,
            marginBottom: 16,
            letterSpacing: '-0.03em',
          }}>
            Up and running in minutes.
          </h2>
          <p style={{
            fontSize: 18,
            color: C.text2,
            lineHeight: 1.6,
            maxWidth: 600,
            margin: '0 auto',
          }}>
            No data team required. No manual configuration.
          </p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: 20,
        }}>
          {[
            {
              number: '01',
              title: 'Connect HubSpot',
              description: 'OAuth in 60 seconds. No private app tokens, no manual config.',
            },
            {
              number: '02',
              title: 'Set your standards',
              description: 'Pick pre-built rules or define your own. Preview every change first.',
            },
            {
              number: '03',
              title: 'Watch it run',
              description: 'Refyne scans nightly and writes clean values back to HubSpot.',
            },
          ].map((step, i) => (
            <div key={i} style={{
              padding: 28,
              background: C.surface,
              border: `1px solid ${C.border}`,
              borderRadius: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
            }}>
              <div style={{
                fontSize: 48,
                fontWeight: 700,
                fontFamily: F.mono,
                color: C.indigoBrd,
                lineHeight: 1,
                letterSpacing: '-0.04em',
              }}>
                {step.number}
              </div>
              <div>
                <h3 style={{
                  fontSize: 18,
                  fontWeight: 600,
                  color: C.text,
                  marginBottom: 8,
                  fontFamily: F.serif,
                }}>
                  {step.title}
                </h3>
                <p style={{
                  fontSize: 14,
                  color: C.text2,
                  lineHeight: 1.6,
                }}>
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Pricing Teaser ───────────────────────────────────────── */}
      <section style={{
        maxWidth: 1280, margin: '0 auto',
        padding: '80px 48px 96px',
        borderTop: `1px solid ${C.border}`,
      }}>
        <div style={{
          padding: 48,
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderRadius: 0,
          textAlign: 'center',
        }}>
          <h2 style={{
            fontSize: 38,
            fontWeight: 700,
            fontFamily: F.serif,
            color: C.text,
            lineHeight: 1.15,
            marginBottom: 16,
            letterSpacing: '-0.03em',
          }}>
            One price. Unlimited seats.
          </h2>
          <p style={{
            fontSize: 18,
            color: C.text2,
            lineHeight: 1.6,
            marginBottom: 32,
            maxWidth: 600,
            margin: '0 auto 32px',
          }}>
            Priced per HubSpot portal with simple record tiers, and unlimited seats on every plan. Starting at $149/mo.
          </p>
          <Link
            href="/pricing"
            style={{
              display: 'inline-block',
              padding: '14px 28px',
              background: `linear-gradient(135deg, #7c7bff, #6260e6)`,
              border: 'none',
              borderRadius: 0,
              fontSize: 15,
              fontWeight: 600,
              fontFamily: F.sans,
              color: '#fff',
              textDecoration: 'none',
              boxShadow: '0 6px 18px rgba(98,96,230,.4)',
            }}
          >
            View pricing
          </Link>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────── */}
      <footer style={{
        borderTop: `1px solid ${C.border}`,
        background: C.sidebar,
        padding: '26px 48px',
      }}>
        <div style={{
          maxWidth: 1280, margin: '0 auto',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 11, textDecoration: 'none' }}>
              <RefyneMark size={28} />
              <span style={{
                fontSize: 16, fontWeight: 600, color: C.text,
                letterSpacing: '-.01em',
                fontFamily: F.serif,
              }}>
                Refyne
              </span>
            </Link>
            <span style={{ fontSize: 13, color: C.text3, marginLeft: 8 }}>
              © 2026 RevOps Impact LLC
            </span>
          </div>
          <div style={{ display: 'flex', gap: 26 }}>
            {[
              { label: 'Pricing', href: '/pricing' },
              { label: 'Privacy', href: '/privacy' },
              { label: 'Terms', href: '/terms' },
              { label: 'Docs', href: '/docs' },
              { label: 'Support', href: '/support' },
            ].map(link => (
              <Link key={link.href} href={link.href} style={{
                fontSize: 13, color: C.text2, textDecoration: 'none',
              }}>
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </footer>

    </div>
  );
}
