/**
 * Cookie Consent Banner
 *
 * GDPR/CCPA compliant cookie consent banner.
 * Shows on first visit, persists choice for 1 year.
 */

'use client';

import { usePathname } from 'next/navigation';
import { useCookieConsent } from '@/hooks/useCookieConsent';

export function CookieBanner() {
  const pathname = usePathname();
  const { showBanner, acceptEssential, acceptAll } = useCookieConsent();

  // Don't show on internal tools
  if (pathname?.startsWith('/blog-admin')) {
    return null;
  }

  // Don't show if consent already given
  if (!showBanner) {
    return null;
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        background: '#0A1829',
        borderTop: '1px solid rgba(255, 255, 255, 0.1)',
        padding: '20px 40px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '24px',
        fontFamily: 'Jost, sans-serif',
        fontSize: '14px',
        color: '#F9F8F5',
      }}
    >
      {/* Left side: text + link */}
      <div style={{ flex: '1 1 auto', maxWidth: '600px' }}>
        <p style={{ margin: 0, marginBottom: '8px', lineHeight: '1.5' }}>
          We use cookies to keep Refyne working and to understand how it's being used.
        </p>
        <a
          href="/cookie-policy"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: '#2E6BA8',
            fontSize: '13px',
            textDecoration: 'none',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.textDecoration = 'underline';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.textDecoration = 'none';
          }}
        >
          Cookie policy ↗
        </a>
      </div>

      {/* Right side: buttons */}
      <div
        style={{
          display: 'flex',
          gap: '12px',
          flexShrink: 0,
        }}
      >
        <button
          onClick={acceptEssential}
          style={{
            background: 'transparent',
            border: '1px solid rgba(249, 248, 245, 0.3)',
            color: '#F9F8F5',
            padding: '8px 16px',
            fontSize: '14px',
            fontFamily: 'Jost, sans-serif',
            cursor: 'pointer',
            transition: 'border-color 0.2s',
            whiteSpace: 'nowrap',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'rgba(249, 248, 245, 0.6)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'rgba(249, 248, 245, 0.3)';
          }}
        >
          Accept strictly necessary
        </button>
        <button
          onClick={acceptAll}
          style={{
            background: '#2E6BA8',
            border: 'none',
            color: '#F9F8F5',
            padding: '8px 16px',
            fontSize: '14px',
            fontFamily: 'Jost, sans-serif',
            cursor: 'pointer',
            transition: 'filter 0.2s',
            whiteSpace: 'nowrap',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.filter = 'brightness(1.1)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.filter = 'brightness(1)';
          }}
        >
          Accept all
        </button>
      </div>

      {/* Mobile styles */}
      <style jsx>{`
        @media (max-width: 768px) {
          div {
            flex-direction: column !important;
            padding: 16px 20px !important;
            align-items: stretch !important;
          }
          div > div:first-child {
            max-width: none !important;
          }
          div > div:last-child {
            justify-content: stretch !important;
          }
          div > div:last-child button {
            flex: 1 !important;
          }
        }
      `}</style>
    </div>
  );
}
