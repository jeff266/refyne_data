'use client';

import { useAuth } from '@clerk/nextjs';
import Link from 'next/link';
import { MarketingLayout } from '@/components/marketing/MarketingLayout';
import { C, F } from '@/lib/design-tokens';

export default function UnsubscribedPage() {
  const { isSignedIn } = useAuth();

  return (
    <MarketingLayout>
      <div style={{ maxWidth: 600, margin: '0 auto', padding: '120px 32px', textAlign: 'center' }}>
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            background: C.surface,
            border: `1px solid ${C.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 24px',
          }}
        >
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
            <path
              d="M20 4L12 13L4 4"
              stroke={C.text2}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M4 20L12 11L20 20"
              stroke={C.text2}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        <h1 style={{ fontSize: 28, fontWeight: 600, color: C.text, marginBottom: 12 }}>
          You've been unsubscribed
        </h1>
        <p style={{ fontSize: 16, color: C.text2, lineHeight: 1.6, marginBottom: 32 }}>
          You won't receive Refyne digest emails anymore.
        </p>

        {isSignedIn && (
          <div style={{ marginBottom: 24 }}>
            <Link
              href="/settings"
              style={{
                display: 'inline-block',
                padding: '12px 24px',
                fontSize: 14,
                fontWeight: 600,
                background: C.indigo,
                color: 'white',
                border: 'none',
                borderRadius: 8,
                textDecoration: 'none',
                transition: 'all 0.2s',
              }}
            >
              Manage notification preferences
            </Link>
          </div>
        )}

        <p style={{ fontSize: 13, color: C.text3 }}>
          To re-enable digest emails, update your notification preferences in{' '}
          {isSignedIn ? (
            <Link href="/settings" style={{ color: C.indigo, textDecoration: 'none' }}>
              Settings
            </Link>
          ) : (
            'Settings'
          )}.
        </p>
      </div>
    </MarketingLayout>
  );
}
