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

      {/* ── Hero ─────────────────────────────────────────────────── */}
      <section style={{
        maxWidth: 1280, margin: '0 auto',
        padding: '96px 48px 80px',
        textAlign: 'center',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 28,
      }}>
        {/* Badge */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 14px',
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 0,
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
          fontSize: 72,
          fontWeight: 700,
          fontFamily: F.serif,
          color: C.text,
          lineHeight: 1.1,
          marginBottom: 24,
          maxWidth: 900,
          letterSpacing: '-0.02em',
        }}>
          Your HubSpot data, <span style={{ color: C.indigo }}>graded</span> and <span style={{ color: C.indigo }}>clean</span>.
        </h1>

        {/* Subheadline */}
        <p style={{
          fontSize: 20,
          fontFamily: F.sans,
          color: C.text2,
          lineHeight: 1.6,
          marginBottom: 40,
          maxWidth: 640,
        }}>
          Refyne audits your HubSpot data in real time, assigns a grade, and keeps it clean. Automatically.
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
            View pricing
          </Link>
        </div>

        <p style={{
          fontSize: 13,
          color: C.text3,
          fontFamily: F.sans,
        }}>
          14-day free trial · No credit card required
        </p>
      </section>

      {/* ── Portal Health Card ───────────────────────────────────── */}
      <section style={{
        maxWidth: 1280, margin: '0 auto',
        padding: '0 48px 80px',
        display: 'flex', justifyContent: 'center',
      }}>
        <div style={{
          maxWidth: 900,
          width: '100%',
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderRadius: 12,
          padding: 32,
        }}>
          {/* Card header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
            <h3 style={{ fontSize: 18, fontWeight: 600, color: C.text, fontFamily: F.sans }}>
              Portal Health
            </h3>
            <div style={{
              padding: '6px 12px',
              background: 'rgba(34,197,94,0.15)',
              border: '1px solid rgba(34,197,94,0.4)',
              borderRadius: 0,
              fontSize: 12,
              fontWeight: 600,
              color: 'rgba(34,197,94,1)',
            }}>
              ACTIVE
            </div>
          </div>

          {/* Grade display */}
          <div style={{ display: 'flex', gap: 32, marginBottom: 32, alignItems: 'center' }}>
            <div style={{
              width: 120,
              height: 120,
              borderRadius: 0,
              background: 'rgba(34,197,94,0.15)',
              border: '2px solid rgba(34,197,94,0.4)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <div style={{ fontSize: 48, fontWeight: 700, color: 'rgba(34,197,94,1)', fontFamily: F.mono }}>
                A
              </div>
              <div style={{ fontSize: 14, color: C.text3, fontFamily: F.mono }}>
                94/100
              </div>
            </div>

            {/* Stats */}
            <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              <div>
                <div style={{ fontSize: 12, color: C.text3, marginBottom: 4 }}>
                  Clean records
                </div>
                <div style={{ fontSize: 24, fontWeight: 700, color: C.text, fontFamily: F.mono }}>
                  8,247
                </div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: C.text3, marginBottom: 4 }}>
                  Fixed last 7d
                </div>
                <div style={{ fontSize: 24, fontWeight: 700, color: C.text, fontFamily: F.mono }}>
                  142
                </div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: C.text3, marginBottom: 4 }}>
                  Duplicates merged
                </div>
                <div style={{ fontSize: 24, fontWeight: 700, color: C.text, fontFamily: F.mono }}>
                  23
                </div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: C.text3, marginBottom: 4 }}>
                  Compliance
                </div>
                <div style={{ fontSize: 24, fontWeight: 700, color: 'rgba(34,197,94,1)', fontFamily: F.mono }}>
                  98%
                </div>
              </div>
            </div>
          </div>

          {/* Activity feed */}
          <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 20 }}>
            <div style={{ fontSize: 12, color: C.text3, marginBottom: 12, fontWeight: 600 }}>
              RECENT ACTIVITY
            </div>
            {[
              { time: '2m ago', action: 'Normalized 12 company names' },
              { time: '1h ago', action: 'Merged 3 duplicate contacts' },
              { time: '4h ago', action: 'Fixed 8 phone number formats' },
            ].map((item, i) => (
              <div key={i} style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '10px 0',
                borderBottom: i < 2 ? `1px solid rgba(255,255,255,0.05)` : 'none',
              }}>
                <span style={{ fontSize: 13, color: C.text }}>{item.action}</span>
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
            { label: 'Companies normalized', value: '12,482' },
            { label: 'Fields corrected', value: '34,291' },
            { label: 'Duplicates prevented', value: '856' },
            { label: 'Data quality score', value: '94%' },
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
            Field-by-field cleanup.
          </h2>
          <p style={{
            fontSize: 18,
            color: C.text2,
            lineHeight: 1.6,
            maxWidth: 600,
            margin: '0 auto',
          }}>
            See exactly what Refyne fixes before it touches your CRM.
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
                { field: 'Company', before: 'acme corp.', after: 'Acme Corporation' },
                { field: 'Phone', before: '4155551234', after: '+1 (415) 555-1234' },
                { field: 'Industry', before: 'Software / SaaS', after: 'Software' },
                { field: 'LinkedIn', before: 'linkedin.com/company/acme-corp/', after: 'linkedin.com/company/acme-corp' },
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
            Normalize, dedup, and enrich in one place.
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
              description: 'Standardize formats across every field. Phone numbers, company names, industry values - all consistent, all automatic.',
              badge: 'ACTIVE',
              badgeColor: 'rgba(34,197,94,1)',
            },
            {
              title: 'Dedup',
              description: 'Find and merge duplicates with confidence scoring. Grade A matches merge automatically, lower grades queue for review.',
              badge: 'NIGHTLY',
              badgeColor: C.indigo,
            },
            {
              title: 'Enrich',
              description: 'Fill empty fields using Apollo, ZoomInfo, or Refyne Search. Bring your own API keys. No markup, pay providers directly.',
              badge: 'ACTIVE',
              badgeColor: 'rgba(34,197,94,1)',
            },
            {
              title: 'Always On',
              description: 'Nightly scans catch issues before they affect your pipeline. Weekly digest emails show what changed and what was fixed.',
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
              description: 'OAuth connection in 60 seconds. Refyne reads your portal schema and starts analyzing immediately.',
            },
            {
              number: '02',
              title: 'Review & approve',
              description: 'See every proposed change before it touches your CRM. Preview exactly what will be normalized, merged, or enriched.',
            },
            {
              number: '03',
              title: 'Watch it run',
              description: 'Refyne scans nightly, fixes issues automatically, and emails you a summary. Your data quality improves while you sleep.',
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
            Most data tools charge per user or per record. Refyne charges per HubSpot portal, based on your record volume. Starting at $149/mo.
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
              { label: 'Security', href: '/security' },
              { label: 'Terms', href: '/terms' },
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
