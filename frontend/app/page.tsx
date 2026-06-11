'use client';

import { useState } from 'react';
import Link from 'next/link';
import { C, F } from '@/lib/design-tokens';

// ── Sub-components ──────────────────────────────────────────────────

function HubSpotBadge() {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 8,
      padding: '6px 14px',
      background: C.surface,
      border: `1px solid ${C.border2}`,
      borderRadius: 100,
      fontSize: 12, color: C.text2,
      fontFamily: F.sans,
    }}>
      <span style={{
        display: 'inline-block', width: 8, height: 8,
        borderRadius: '50%', background: C.green,
      }} />
      Official HubSpot Technology Partner
    </div>
  );
}

function FeatureCard({ icon, title, description }: {
  icon: string, title: string, description: string
}) {
  return (
    <div style={{
      padding: '28px',
      background: C.surface,
      border: `1px solid ${C.border}`,
      borderRadius: 16,
      display: 'flex', flexDirection: 'column', gap: 14,
    }}>
      <div style={{
        width: 44, height: 44, borderRadius: 10,
        background: C.indigoDim,
        border: `1px solid ${C.indigoBrd}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 20,
      }}>
        {icon}
      </div>
      <div>
        <div style={{
          fontSize: 16, fontWeight: 600, color: C.text,
          marginBottom: 8, letterSpacing: '-0.02em',
          fontFamily: F.sans,
        }}>
          {title}
        </div>
        <div style={{
          fontSize: 14, color: C.text2, lineHeight: 1.6,
          fontFamily: F.sans,
        }}>
          {description}
        </div>
      </div>
    </div>
  );
}

function StepCard({ number, title, description }: {
  number: string, title: string, description: string
}) {
  return (
    <div style={{
      padding: '28px',
      background: C.surface,
      border: `1px solid ${C.border}`,
      borderRadius: 16,
      display: 'flex', flexDirection: 'column', gap: 16,
    }}>
      <div style={{
        fontSize: 48, fontWeight: 700,
        fontFamily: F.mono,
        color: C.indigoBrd,
        lineHeight: 1,
        letterSpacing: '-0.04em',
      }}>
        {number}
      </div>
      <div>
        <div style={{
          fontSize: 16, fontWeight: 600, color: C.text,
          marginBottom: 8, letterSpacing: '-0.02em',
          fontFamily: F.sans,
        }}>
          {title}
        </div>
        <div style={{
          fontSize: 14, color: C.text2, lineHeight: 1.6,
          fontFamily: F.sans,
        }}>
          {description}
        </div>
      </div>
    </div>
  );
}

const RefyneMark = ({ size = 28 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
    <rect width="28" height="28" rx="7" fill="url(#rmark)" />
    <path d="M9 8.5h5.5c2.2 0 3.5 1.2 3.5 3s-1.3 3-3.5 3H9V8.5z"
      stroke="rgba(255,255,255,0.9)" strokeWidth="1.6" strokeLinejoin="round" />
    <path d="M9 14.5l6 5" stroke="rgba(255,255,255,0.9)"
      strokeWidth="1.6" strokeLinecap="round" />
    <defs>
      <linearGradient id="rmark" x1="0" y1="0" x2="28" y2="28" gradientUnits="userSpaceOnUse">
        <stop stopColor="#818CF8" />
        <stop offset="1" stopColor="#4338CA" />
      </linearGradient>
    </defs>
  </svg>
);

// ── Page ────────────────────────────────────────────────────────────

export default function HomePage() {
  const [email, setEmail] = useState('');

  const handleStartTrial = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (email) {
      e.preventDefault();
      window.location.href = `https://app.refynedata.com/sign-up?email=${encodeURIComponent(email)}`;
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: C.bg,
      fontFamily: F.sans,
      color: C.text,
    }}>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500;1,600;1,700&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        a { text-decoration: none; }
      `}</style>

      {/* ── Header ───────────────────────────────────────────────── */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 50,
        borderBottom: `1px solid ${C.border}`,
        background: 'rgba(9,9,11,0.85)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
      }}>
        <div style={{
          maxWidth: 1100, margin: '0 auto',
          padding: '0 24px', height: 60,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <RefyneMark size={28} />
            <span style={{
              fontSize: 16, fontWeight: 700, color: C.text,
              letterSpacing: '-0.02em',
            }}>
              Refyne
            </span>
          </div>

          <nav style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
            <Link href="/pricing" style={{ fontSize: 13, color: C.text2, fontWeight: 500 }}>
              Pricing
            </Link>
            <Link href="/docs" style={{ fontSize: 13, color: C.text2, fontWeight: 500 }}>
              Docs
            </Link>
            <Link href="/sign-in" style={{ fontSize: 13, color: C.text2, fontWeight: 500 }}>
              Sign in
            </Link>
            <Link href="/sign-up" style={{
              display: 'inline-flex', alignItems: 'center',
              padding: '7px 16px',
              background: `linear-gradient(to bottom, ${C.indigo}, ${C.indigoDk})`,
              color: '#fff', borderRadius: 8,
              fontSize: 13, fontWeight: 600,
              letterSpacing: '-0.01em',
              boxShadow: '0 0 0 1px rgba(99,102,241,0.3), 0 1px 3px rgba(0,0,0,0.4)',
            }}>
              Get started
            </Link>
          </nav>
        </div>
      </header>

      {/* ── Hero ─────────────────────────────────────────────────── */}
      <section style={{
        maxWidth: 1100, margin: '0 auto',
        padding: '96px 24px 80px',
        textAlign: 'center',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 28,
      }}>
        <HubSpotBadge />

        <h1 style={{
          fontSize: 'clamp(40px, 6vw, 68px)',
          fontWeight: 800,
          color: C.text,
          lineHeight: 1.05,
          letterSpacing: '-0.04em',
          maxWidth: 700,
        }}>
          Your HubSpot data.{' '}
          <span style={{
            background: `linear-gradient(135deg, ${C.indigoLt} 0%, ${C.indigo} 100%)`,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}>
            Finally clean.
          </span>
        </h1>

        {/* Two-tone subtitle */}
        <h2 style={{
          fontSize: 'clamp(18px, 2.5vw, 24px)',
          fontWeight: 700,
          color: 'rgba(249,248,245,0.4)',
          lineHeight: 1.3,
          letterSpacing: '-0.02em',
          maxWidth: 600,
          marginTop: -16,
        }}>
          No manual cleanup. No spreadsheets. No data team required.
        </h2>

        <p style={{
          fontSize: 18, color: C.text2, lineHeight: 1.65,
          maxWidth: 600, fontWeight: 400,
        }}>
          Refyne normalizes formats, removes duplicates, and fixes data quality issues automatically, so your team always works from a single source of truth.
        </p>

        {/* Email capture */}
        <div style={{ width: '100%', maxWidth: 380, marginTop: 8 }}>
          <input
            type="email"
            placeholder="Work email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{
              width: '100%',
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: 6,
              padding: '12px 16px',
              color: C.text,
              fontFamily: F.sans,
              fontSize: 16,
              marginBottom: 12,
              outline: 'none',
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
          <Link
            href={email ? `https://app.refynedata.com/sign-up?email=${encodeURIComponent(email)}` : '/sign-up'}
            onClick={handleStartTrial}
            style={{
              display: 'inline-flex', alignItems: 'center',
              padding: '13px 32px',
              background: `linear-gradient(to bottom, ${C.indigo}, ${C.indigoDk})`,
              color: '#fff', borderRadius: 10,
              fontSize: 15, fontWeight: 600,
              letterSpacing: '-0.01em',
              boxShadow: '0 0 0 1px rgba(99,102,241,0.3), 0 2px 10px rgba(0,0,0,0.4)',
            }}
          >
            Start free trial
          </Link>
          <Link href="/pricing" style={{
            display: 'inline-flex', alignItems: 'center',
            padding: '13px 32px',
            border: `1px solid ${C.border2}`,
            color: C.text2, borderRadius: 10,
            fontSize: 15, fontWeight: 500,
            letterSpacing: '-0.01em',
          }}>
            View pricing →
          </Link>
        </div>

        {/* Trust Signal */}
        <p style={{
          fontSize: 13, color: C.text2, fontWeight: 400,
          fontFamily: F.sans, marginTop: 8,
        }}>
          No credit card required. 14-day free trial. Cancel anytime.
        </p>

        {/* Product UI Preview Placeholder */}
        <div style={{
          maxWidth: 700,
          marginTop: 48,
          width: '100%',
        }}>
          <div style={{
            background: '#1C3654',
            border: '1px solid rgba(255,255,255,0.1)',
            overflow: 'hidden',
          }}>
            {/* Table header */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '80px 1fr 120px',
              padding: '12px 16px',
              borderBottom: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(0,0,0,0.2)',
              fontSize: 11,
              fontWeight: 600,
              color: C.text3,
              fontFamily: F.sans,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}>
              <div>Grade</div>
              <div>Cluster</div>
              <div>Size</div>
            </div>

            {/* Table rows */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '80px 1fr 120px',
              padding: '14px 16px',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
              alignItems: 'center',
            }}>
              <div style={{
                display: 'inline-block',
                width: 24, height: 24,
                background: 'rgba(34,197,94,0.15)',
                border: '1px solid rgba(34,197,94,0.4)',
                color: 'rgba(34,197,94,1)',
                fontWeight: 700,
                fontSize: 12,
                fontFamily: F.mono,
                textAlign: 'center',
                lineHeight: '24px',
              }}>
                A
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 500, color: C.text, marginBottom: 4 }}>
                  Acme Corp
                </div>
                <div style={{ fontSize: 11, color: C.text3, fontFamily: F.mono }}>
                  Domain exact
                </div>
              </div>
              <div style={{ fontSize: 13, color: C.text2 }}>2 records</div>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: '80px 1fr 120px',
              padding: '14px 16px',
              alignItems: 'center',
            }}>
              <div style={{
                display: 'inline-block',
                width: 24, height: 24,
                background: 'rgba(34,197,94,0.15)',
                border: '1px solid rgba(34,197,94,0.4)',
                color: 'rgba(34,197,94,1)',
                fontWeight: 700,
                fontSize: 12,
                fontFamily: F.mono,
                textAlign: 'center',
                lineHeight: '24px',
              }}>
                A
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 500, color: C.text, marginBottom: 4 }}>
                  Kickstarter
                </div>
                <div style={{ fontSize: 11, color: C.text3, fontFamily: F.mono }}>
                  Domain exact · Name 25%
                </div>
              </div>
              <div style={{ fontSize: 13, color: C.text2 }}>2 records</div>
            </div>
          </div>

          <p style={{
            marginTop: 12,
            fontSize: 11,
            color: C.text3,
            textAlign: 'center',
            fontFamily: F.sans,
          }}>
            Live dedup queue - actual product
          </p>
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────────── */}
      <section style={{
        maxWidth: 1100, margin: '0 auto',
        padding: '72px 24px',
        borderTop: `1px solid ${C.border}`,
      }}>
        <div style={{ textAlign: 'center', marginBottom: 52 }}>
          <div style={{
            fontSize: 11, color: C.indigoLt, fontWeight: 600,
            letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 14,
          }}>
            What Refyne does
          </div>
          <h2 style={{
            fontSize: 'clamp(28px, 4vw, 38px)', fontWeight: 700, color: C.text,
            letterSpacing: '-0.03em', lineHeight: 1.15,
          }}>
            Everything your CRM data needs.
          </h2>
          <h2 style={{
            fontSize: 'clamp(28px, 4vw, 38px)', fontWeight: 700,
            color: 'rgba(249,248,245,0.4)',
            letterSpacing: '-0.03em', lineHeight: 1.15,
            marginTop: 4,
          }}>
            One tool. No integrations required.
          </h2>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
          gap: 16,
        }}>
          <FeatureCard
            icon="↕"
            title="Normalize"
            description='"Acme Corp", "acme corp", and "ACME CORP." are three different companies in your CRM. Refyne makes them one. Phone numbers, LinkedIn URLs, and industry values standardized across every record. Define your rules once. Refyne applies them everywhere, automatically.'
          />
          <FeatureCard
            icon="⚡"
            title="Dedup"
            description="Duplicate records corrupt your pipeline, inflate your contact counts, and send the same email twice. Refyne scans your HubSpot nightly, groups duplicates by confidence grade, and applies your merge rules automatically."
          />
          <FeatureCard
            icon="📊"
            title="Enrich"
            description="Empty fields mean missing context. Refyne fills them using your existing provider accounts - Apollo, ZoomInfo, Cognism - or Refyne Search, our built-in enrichment engine. Bring your own keys. Pay your providers directly. No markup."
          />
          <FeatureCard
            icon="🔔"
            title="Always On"
            description="Your CRM data degrades 30% every year. Refyne watches it while you sleep. Nightly scans surface new issues before they affect your pipeline. Weekly digest emails show exactly what changed and what was fixed. No login required."
          />
        </div>
      </section>

      {/* ── Comparison Table ─────────────────────────────────────── */}
      <section style={{
        maxWidth: 1100, margin: '0 auto',
        padding: '72px 24px',
        borderTop: `1px solid ${C.border}`,
      }}>
        <div style={{ textAlign: 'center', marginBottom: 52 }}>
          <h2 style={{
            fontSize: 'clamp(28px, 4vw, 38px)', fontWeight: 700, color: C.text,
            letterSpacing: '-0.03em', lineHeight: 1.15,
          }}>
            For RevOps teams, not IT projects.
          </h2>
          <h2 style={{
            fontSize: 'clamp(28px, 4vw, 38px)', fontWeight: 700,
            color: 'rgba(249,248,245,0.4)',
            letterSpacing: '-0.03em', lineHeight: 1.15,
            marginTop: 4,
          }}>
            That's the point.
          </h2>
          <p style={{
            fontSize: 16, color: C.text2, lineHeight: 1.6,
            maxWidth: 600, margin: '16px auto 0',
          }}>
            Blank workflows. Implementation fees. Months to value. Those are bugs, not features.
          </p>
        </div>

        <div style={{
          overflow: 'auto',
          border: `1px solid ${C.border}`,
        }}>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontFamily: F.sans,
          }}>
            <thead>
              <tr style={{ background: 'rgba(0,0,0,0.2)' }}>
                <th style={{
                  padding: '16px',
                  textAlign: 'left',
                  fontSize: 11,
                  fontWeight: 600,
                  color: C.text3,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  borderBottom: `1px solid ${C.border}`,
                }}></th>
                <th style={{
                  padding: '16px',
                  textAlign: 'center',
                  fontSize: 11,
                  fontWeight: 600,
                  color: C.text,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  background: 'rgba(46,107,168,0.15)',
                  border: '1px solid rgba(46,107,168,0.4)',
                  borderBottom: '1px solid rgba(46,107,168,0.4)',
                }}>
                  <div style={{ marginBottom: 4, fontSize: 13 }}>Refyne</div>
                  <div style={{ fontSize: 10, color: C.indigoLt, fontWeight: 500 }}>Complete system</div>
                </th>
                <th style={{
                  padding: '16px',
                  textAlign: 'center',
                  fontSize: 11,
                  fontWeight: 600,
                  color: C.text3,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  borderBottom: `1px solid ${C.border}`,
                }}>
                  <div style={{ marginBottom: 4 }}>Insycle</div>
                  <div style={{ fontSize: 10, fontWeight: 500 }}>More setup</div>
                </th>
                <th style={{
                  padding: '16px',
                  textAlign: 'center',
                  fontSize: 11,
                  fontWeight: 600,
                  color: C.text3,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  borderBottom: `1px solid ${C.border}`,
                }}>
                  <div style={{ marginBottom: 4 }}>Openprise</div>
                  <div style={{ fontSize: 10, fontWeight: 500 }}>More cost</div>
                </th>
                <th style={{
                  padding: '16px',
                  textAlign: 'center',
                  fontSize: 11,
                  fontWeight: 600,
                  color: C.text3,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  borderBottom: `1px solid ${C.border}`,
                }}>
                  <div style={{ marginBottom: 4 }}>Manual cleanup</div>
                  <div style={{ fontSize: 10, fontWeight: 500 }}>More time</div>
                </th>
              </tr>
            </thead>
            <tbody>
              {[
                { label: 'Time to value', refyne: 'Same day', insycle: 'Weeks', openprise: 'Months', manual: 'Never done' },
                { label: 'Setup', refyne: '60 seconds', insycle: 'Hours', openprise: 'Months', manual: 'Ongoing' },
                { label: 'HubSpot-native', refyne: '✓', insycle: 'Partial', openprise: 'No', manual: 'No' },
                { label: 'Per-seat fees', refyne: 'Never', insycle: 'Yes', openprise: 'Yes', manual: 'N/A' },
                { label: 'Record limits', refyne: 'Never', insycle: 'Yes', openprise: 'Yes', manual: 'N/A' },
              ].map((row, i) => (
                <tr key={i} style={{ borderBottom: `1px solid ${C.border}` }}>
                  <td style={{
                    padding: '14px 16px',
                    fontSize: 13,
                    color: C.text2,
                    fontWeight: 500,
                  }}>
                    {row.label}
                  </td>
                  <td style={{
                    padding: '14px 16px',
                    textAlign: 'center',
                    fontSize: 13,
                    color: row.refyne === '✓' ? '#2E6BA8' : C.text,
                    background: 'rgba(46,107,168,0.08)',
                  }}>
                    {row.refyne}
                  </td>
                  <td style={{
                    padding: '14px 16px',
                    textAlign: 'center',
                    fontSize: 13,
                    color: C.text3,
                  }}>
                    {row.insycle}
                  </td>
                  <td style={{
                    padding: '14px 16px',
                    textAlign: 'center',
                    fontSize: 13,
                    color: C.text3,
                  }}>
                    {row.openprise}
                  </td>
                  <td style={{
                    padding: '14px 16px',
                    textAlign: 'center',
                    fontSize: 13,
                    color: C.text3,
                  }}>
                    {row.manual}
                  </td>
                </tr>
              ))}
              <tr>
                <td style={{
                  padding: '14px 16px',
                  fontSize: 13,
                  color: C.text2,
                  fontWeight: 500,
                }}>
                  Bottom line
                </td>
                <td style={{
                  padding: '14px 16px',
                  textAlign: 'center',
                  fontSize: 13,
                  fontWeight: 700,
                  color: C.text,
                  background: 'rgba(46,107,168,0.15)',
                  border: '1px solid rgba(46,107,168,0.4)',
                  borderTop: '1px solid rgba(46,107,168,0.4)',
                }}>
                  Clean data.<br />Automatically.
                </td>
                <td style={{
                  padding: '14px 16px',
                  textAlign: 'center',
                  fontSize: 13,
                  color: C.text3,
                }}>
                  More config.
                </td>
                <td style={{
                  padding: '14px 16px',
                  textAlign: 'center',
                  fontSize: 13,
                  color: C.text3,
                }}>
                  Enterprise<br />pricing.
                </td>
                <td style={{
                  padding: '14px 16px',
                  textAlign: 'center',
                  fontSize: 13,
                  color: C.text3,
                }}>
                  Manual<br />forever.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────── */}
      <section style={{
        maxWidth: 1100, margin: '0 auto',
        padding: '72px 24px',
        borderTop: `1px solid ${C.border}`,
      }}>
        <div style={{ textAlign: 'center', marginBottom: 52 }}>
          <div style={{
            fontSize: 11, color: C.indigoLt, fontWeight: 600,
            letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 14,
          }}>
            How it works
          </div>
          <h2 style={{
            fontSize: 'clamp(28px, 4vw, 38px)', fontWeight: 700, color: C.text,
            letterSpacing: '-0.03em', lineHeight: 1.15,
          }}>
            Up and running in minutes.
          </h2>
          <h2 style={{
            fontSize: 'clamp(28px, 4vw, 38px)', fontWeight: 700,
            color: 'rgba(249,248,245,0.4)',
            letterSpacing: '-0.03em', lineHeight: 1.15,
            marginTop: 4,
          }}>
            Improving forever.
          </h2>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(270px, 1fr))',
          gap: 16,
          marginBottom: 64,
        }}>
          <StepCard
            number="01"
            title="Connect HubSpot"
            description="OAuth connection in 60 seconds. No private app tokens, no manual configuration. Connect and Refyne reads your portal immediately."
          />
          <StepCard
            number="02"
            title="Set your data standards"
            description="Choose from pre-built rules for phone formats, company names, and industry values - or define your own. Preview every change before anything touches your CRM."
          />
          <StepCard
            number="03"
            title="Watch it run"
            description="Refyne scans nightly, surfaces issues, and writes clean values back to HubSpot. Your compliance score improves automatically."
          />
        </div>

        {/* Staccato copy */}
        <div style={{
          textAlign: 'center',
          maxWidth: 600,
          margin: '0 auto',
          fontFamily: 'Lora, serif',
          fontStyle: 'italic',
          fontSize: 24,
          lineHeight: 1.5,
          color: 'rgba(249,248,245,0.85)',
        }}>
          Your rules. Your formats.<br />
          Applied to every record.<br />
          Every night.<br />
          Without you lifting a finger.
        </div>
      </section>

      {/* ── Pricing CTA ──────────────────────────────────────────── */}
      <section style={{
        maxWidth: 1100, margin: '0 auto',
        padding: '72px 24px 96px',
      }}>
        <div style={{
          padding: '52px 48px',
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderRadius: 20,
          display: 'flex', alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap', gap: 24,
        }}>
          <div>
            <h2 style={{
              fontSize: 'clamp(22px, 3vw, 30px)', fontWeight: 700, color: C.text,
              letterSpacing: '-0.03em', marginBottom: 4,
            }}>
              One price. Unlimited seats. Unlimited records.
            </h2>
            <h2 style={{
              fontSize: 'clamp(22px, 3vw, 30px)', fontWeight: 700,
              color: 'rgba(249,248,245,0.4)',
              letterSpacing: '-0.03em', marginBottom: 10,
            }}>
              That's not a bug. That's the point.
            </h2>
            <p style={{ fontSize: 15, color: C.text2, lineHeight: 1.5 }}>
              Most data tools charge per user or per record. Refyne charges per HubSpot portal. Starting at $149/mo.
            </p>
          </div>
          <Link href="/pricing" style={{
            display: 'inline-flex', alignItems: 'center',
            padding: '12px 28px',
            background: `linear-gradient(to bottom, ${C.indigo}, ${C.indigoDk})`,
            color: '#fff', borderRadius: 9,
            fontSize: 14, fontWeight: 600,
            letterSpacing: '-0.01em',
            flexShrink: 0,
            boxShadow: '0 0 0 1px rgba(99,102,241,0.3), 0 1px 4px rgba(0,0,0,0.4)',
          }}>
            See pricing →
          </Link>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────── */}
      <footer style={{
        borderTop: `1px solid ${C.border}`,
        padding: '32px 24px',
      }}>
        <div style={{
          maxWidth: 1100, margin: '0 auto',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexWrap: 'wrap', gap: 16,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <RefyneMark size={20} />
            <span style={{ fontSize: 13, color: C.text3 }}>
              © 2026 RevOps Impact LLC
            </span>
          </div>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            {[
              { label: 'Pricing', href: '/pricing' },
              { label: 'Privacy', href: '/privacy' },
              { label: 'Terms', href: '/terms' },
              { label: 'Docs', href: '/docs' },
              { label: 'Support', href: 'mailto:jeff@revopsimpact.us' },
            ].map(link => (
              <Link key={link.href} href={link.href} style={{
                fontSize: 13, color: C.text3,
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
