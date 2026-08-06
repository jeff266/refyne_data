'use client';

import Link from 'next/link';
import { Zap, ArrowRight } from 'lucide-react';
import { C } from '@/lib/design-tokens';

interface LimitReachedBannerProps {
  limitType?: 'merge' | 'normalize' | 'enrich' | 'generic';
  customTitle?: string;
  customMessage?: string;
}

/**
 * Limit Reached Banner
 *
 * Inline banner shown when users hit trial limits for specific actions.
 * Much better UX than showing "billing_limit_exceeded" error text.
 */
export function LimitReachedBanner({
  limitType = 'generic',
  customTitle,
  customMessage,
}: LimitReachedBannerProps) {
  const config = {
    merge: {
      title: "You've reached your trial merge limit",
      message:
        "You've used all 10 merges in your free trial. Upgrade to Growth or Scale for unlimited deduplication.",
      icon: '🔗',
    },
    normalize: {
      title: "You've reached your trial normalization limit",
      message:
        "You've used all 100 normalization writes in your free trial. Upgrade to Growth or Scale for unlimited normalization.",
      icon: '✨',
    },
    enrich: {
      title: "You've reached your trial enrichment limit",
      message:
        "You've used all 50 enrichment credits in your free trial. Upgrade to Growth or Scale for more credits.",
      icon: '🎯',
    },
    generic: {
      title: "You've reached your trial limit",
      message: 'Upgrade to Growth or Scale to continue using Refyne.',
      icon: '⚡',
    },
  };

  const { title, message, icon } = config[limitType];

  return (
    <div
      style={{
        background: `linear-gradient(135deg, ${C.indigo}08 0%, ${C.indigo}15 100%)`,
        border: `1.5px solid ${C.indigoBrd}`,
        borderRadius: 8,
        padding: '24px 28px',
        marginBottom: 24,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
        {/* Icon */}
        <div
          style={{
            fontSize: 32,
            lineHeight: 1,
            marginTop: -2,
          }}
        >
          {icon}
        </div>

        {/* Content */}
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontSize: 17,
              fontWeight: 600,
              color: C.text,
              marginBottom: 6,
              lineHeight: 1.3,
            }}
          >
            {customTitle || title}
          </div>
          <div
            style={{
              fontSize: 14,
              color: C.text2,
              lineHeight: 1.6,
            }}
          >
            {customMessage || message}
          </div>
        </div>
      </div>

      {/* CTA Buttons */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <Link
          href="/settings/billing"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '11px 22px',
            background: C.indigo,
            color: '#fff',
            borderRadius: 6,
            fontSize: 14,
            fontWeight: 600,
            textDecoration: 'none',
            transition: 'all 0.2s',
            border: 'none',
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.background = C.indigoLt;
            e.currentTarget.style.transform = 'translateY(-1px)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(99,102,241,0.3)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.background = C.indigo;
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          View pricing & upgrade
          <ArrowRight size={16} />
        </Link>

        <Link
          href="/pricing"
          style={{
            fontSize: 14,
            color: C.text2,
            textDecoration: 'none',
            padding: '11px 16px',
            borderRadius: 6,
            transition: 'all 0.2s',
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.color = C.text;
            e.currentTarget.style.background = C.hover;
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.color = C.text2;
            e.currentTarget.style.background = 'transparent';
          }}
        >
          Compare plans →
        </Link>
      </div>
    </div>
  );
}
