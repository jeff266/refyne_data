'use client';

import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { C, F } from '@/lib/design-tokens';
import { PLAN_PRICING } from '@/lib/billing/plan-features';

export default function UpgradePage() {
  const searchParams = useSearchParams();
  const feature = searchParams?.get('feature');
  const plan = searchParams?.get('plan') as keyof typeof PLAN_PRICING | null;

  const featureDescriptions: Record<string, { title: string; description: string }> = {
    normalize: {
      title: 'Normalize',
      description:
        'Automatically clean and standardize company names, industries, phone numbers, and addresses across your CRM. Define canonical normalization rules once and apply them everywhere.',
    },
    dedup: {
      title: 'Dedup',
      description:
        'Detect and merge duplicate companies with a 7-signal confidence cascade. Grade A matches get bulk-approved in seconds, saving hours of manual deduplication work.',
    },
    compliance: {
      title: 'Compliance Dashboard',
      description:
        'Real-time CRM health score with harmony-level breakdown and trend tracking. Know exactly where your data quality breaks down and track improvements over time.',
    },
    prospect: {
      title: 'Prospect Toolkit',
      description:
        'Full prospecting suite with enrichment, company search, and account intelligence. Build targeted lists and enrich records with company data on demand.',
    },
    always_on: {
      title: 'Always On Monitoring',
      description:
        'Get nightly digest emails with compliance score changes, new duplicate pairs detected, and automatic merging of Grade A duplicates. Refyne watches your CRM while you sleep.',
    },
  };

  const featureInfo = feature && featureDescriptions[feature] ? featureDescriptions[feature] : null;
  const pricing = plan && PLAN_PRICING[plan] ? PLAN_PRICING[plan] : null;

  if (!featureInfo || !pricing) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: C.bg,
          fontFamily: F.sans,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ fontSize: 24, fontWeight: 600, color: C.text, marginBottom: 16 }}>
            Upgrade Your Plan
          </h1>
          <p style={{ fontSize: 14, color: C.text2, marginBottom: 24 }}>
            Unlock more features by upgrading your Refyne plan.
          </p>
          <Link
            href="/pricing"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '12px 24px',
              background: `linear-gradient(to bottom, ${C.indigo}, ${C.indigoDk})`,
              color: '#fff',
              borderRadius: 9,
              fontSize: 14,
              fontWeight: 600,
              textDecoration: 'none',
              boxShadow: '0 0 0 1px rgba(99,102,241,0.3), 0 1px 4px rgba(0,0,0,0.4)',
            }}
          >
            See all plans
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: C.bg,
        fontFamily: F.sans,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        style={{
          maxWidth: 560,
          width: '100%',
          background: C.surface,
          border: `2px solid ${C.indigoBrd}`,
          borderRadius: 16,
          padding: 48,
          textAlign: 'center',
        }}
      >
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: 16,
            background: C.indigoDim,
            border: `1px solid ${C.indigoBrd}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 36,
            margin: '0 auto 28px',
          }}
        >
          🔓
        </div>

        <h1
          style={{
            fontSize: 32,
            fontWeight: 700,
            color: C.text,
            marginBottom: 12,
            letterSpacing: '-0.03em',
          }}
        >
          Unlock {featureInfo.title}
        </h1>

        <p
          style={{
            fontSize: 16,
            color: C.text2,
            lineHeight: 1.6,
            marginBottom: 32,
          }}
        >
          {featureInfo.description}
        </p>

        <div
          style={{
            background: C.indigoDim,
            border: `1px solid ${C.indigoBrd}`,
            borderRadius: 12,
            padding: 20,
            marginBottom: 32,
          }}
        >
          <div style={{ fontSize: 13, color: C.text3, marginBottom: 8 }}>
            Required plan
          </div>
          <div style={{ fontSize: 24, fontWeight: 600, color: C.text, marginBottom: 4 }}>
            {pricing.name}
          </div>
          {pricing.monthlyPrice && (
            <div style={{ fontSize: 32, fontWeight: 700, color: C.indigoLt }}>
              ${pricing.monthlyPrice}
              <span style={{ fontSize: 16, fontWeight: 400, color: C.text2 }}>/mo</span>
            </div>
          )}
          {pricing.annualPrice && (
            <div style={{ fontSize: 13, color: C.text3, marginTop: 4 }}>
              or ${pricing.annualPrice}/mo billed annually (save 20%)
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Link
            href={`/sign-up?plan=${plan}`}
            style={{
              display: 'block',
              padding: '14px 32px',
              background: `linear-gradient(to bottom, ${C.indigo}, ${C.indigoDk})`,
              color: '#fff',
              borderRadius: 9,
              fontSize: 15,
              fontWeight: 600,
              letterSpacing: '-0.01em',
              textDecoration: 'none',
              boxShadow: '0 0 0 1px rgba(99,102,241,0.3), 0 2px 6px rgba(0,0,0,0.4)',
            }}
          >
            Upgrade to {pricing.name}
          </Link>

          <Link
            href="/pricing"
            style={{
              display: 'block',
              padding: '14px 32px',
              border: `1px solid ${C.border}`,
              color: C.text2,
              borderRadius: 9,
              fontSize: 15,
              fontWeight: 500,
              letterSpacing: '-0.01em',
              textDecoration: 'none',
            }}
          >
            See all plans
          </Link>

          <Link
            href="/dashboard"
            style={{
              display: 'block',
              padding: '14px 32px',
              color: C.text3,
              fontSize: 14,
              fontWeight: 500,
              textDecoration: 'none',
            }}
          >
            ← Go back
          </Link>
        </div>
      </div>
    </div>
  );
}
