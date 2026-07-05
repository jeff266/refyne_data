'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { UserButton } from '@clerk/nextjs';
import {
  LayoutDashboard,
  Search,
  ArrowUpDown,
  GitMerge,
  Sparkles,
  ArrowRightLeft,
  Plug2,
  Settings,
  HelpCircle,
  User,
  ChevronDown,
  Loader2,
  Clock,
  Users,
  Shield,
  Workflow,
  Upload,
} from 'lucide-react';
import { C, F, NAV } from '@/lib/design-tokens';
import { RefyneLogo } from './RefyneLogo';
import { useEnrichRun } from '@/context/EnrichRunContext';
import { CreditsWidget } from './CreditsWidget';
import { AlwaysOnStatus } from './AlwaysOnStatus';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';
import { useCookieConsent } from '@/hooks/useCookieConsent';
import { FEATURE_FLAGS } from '@/lib/features/flags';

const ICONS: Record<string, React.ElementType> = {
  LayoutDashboard,
  Search,
  Clock,
  ArrowUpDown,
  GitMerge,
  Upload,
  Sparkles,
  ArrowRightLeft,
  Plug2,
  Users,
  Shield,
  Workflow,
  Settings,
  User,
};

export function Sidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentPage = pathname.split('/')[1] || 'dashboard';
  const [showHelpMenu, setShowHelpMenu] = useState(false);
  const enrichRunContext = useEnrichRun();
  const { resetConsent } = useCookieConsent();
  const [billingStatus, setBillingStatus] = useState<{
    subscription_tier: string;
    trial_days_remaining: number | null;
  } | null>(null);

  // Fetch billing status for trial badge
  useEffect(() => {
    fetch('/api/billing/status')
      .then(res => res.json())
      .then(data => setBillingStatus(data))
      .catch(err => console.error('Failed to fetch billing status:', err));
  }, []);

  // Fetch feature flags for beta-gated nav items
  const { isEnabled } = useFeatureFlags([FEATURE_FLAGS.EVENT_LIST_IMPORT]);

  // Preserve ?object= param across navigation
  const objectType = searchParams.get('object');
  const queryString = objectType ? `?object=${objectType}` : '';

  // Filter nav items based on beta gates
  const visibleNavItems = NAV.filter(item => {
    if (!('betaGated' in item) || !item.betaGated) return true;

    // Map nav item ID to feature flag
    if (item.id === 'import') {
      return isEnabled(FEATURE_FLAGS.EVENT_LIST_IMPORT);
    }

    return false;
  });

  return (
    <div
      style={{
        width: 224,
        background: C.sidebar,
        borderRight: `1px solid ${C.border}`,
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
      }}
    >
      <div
        style={{
          padding: '18px 16px',
          borderBottom: `1px solid ${C.border}`,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <RefyneLogo />
        <div>
          <div
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: C.text,
              fontFamily: F.sans,
              letterSpacing: '-0.02em',
              lineHeight: 1.2,
            }}
          >
            Refyne
          </div>
          <div
            style={{
              fontSize: 10,
              color: C.text3,
              fontFamily: F.mono,
              marginTop: 1,
            }}
          >
            data layer
          </div>
        </div>
      </div>

      <nav style={{ flex: 1, padding: '8px 8px', overflowY: 'auto' }}>
        {visibleNavItems.map((item, i) => {
          if ('divider' in item && item.divider) {
            return (
              <div
                key={i}
                style={{ height: 1, background: C.border, margin: '6px 0' }}
              />
            );
          }
          if ('group' in item && item.group) {
            return (
              <div
                key={i}
                style={{
                  padding: '12px 16px 4px 16px',
                  fontSize: 10,
                  color: C.text3,
                  fontWeight: 600,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  fontFamily: F.mono,
                }}
              >
                {item.group}
              </div>
            );
          }

          if (!('id' in item) || !item.id) return null;

          const active = currentPage === item.id;
          const Icon = ICONS[item.icon];
          const href = `/${item.id}${queryString}`;

          return (
            <Link
              key={item.id}
              href={href}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 8px',
                borderRadius: 7,
                background: active ? 'rgba(99,102,241,0.12)' : 'transparent',
                color: active ? C.indigoLt : C.text2,
                fontSize: 13,
                fontWeight: active ? 500 : 400,
                textAlign: 'left',
                marginBottom: 1,
                border: `1px solid ${active ? C.indigoBrd : 'transparent'}`,
                transition: 'all 0.1s',
                letterSpacing: '-0.01em',
                textDecoration: 'none',
              }}
            >
              {Icon && <Icon size={14} color={active ? C.indigoLt : C.text3} />}
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div style={{ borderTop: `1px solid ${C.border}`, padding: '8px 8px' }}>
        {/* Always On Status Indicator */}
        <AlwaysOnStatus />

        {/* Trial Badge - only show for trial tier */}
        {billingStatus && billingStatus.subscription_tier === 'trial' && (
          <div style={{ marginBottom: 12 }}>
            <div
              style={{
                borderTop: `1px solid ${C.border}`,
                paddingTop: 12,
                marginTop: 8,
              }}
            >
              {billingStatus.trial_days_remaining !== null && billingStatus.trial_days_remaining > 0 ? (
                <>
                  <div
                    style={{
                      padding: '8px 12px',
                      background: '#f59e0b',
                      color: '#000',
                      borderRadius: 4,
                      fontSize: 11,
                      fontWeight: 600,
                      marginBottom: 8,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <span>⚠</span>
                    <span>{billingStatus.trial_days_remaining} days left</span>
                  </div>
                  <Link
                    href="/settings/billing"
                    style={{
                      display: 'block',
                      padding: '8px 12px',
                      background: C.surface3,
                      color: C.text,
                      borderRadius: 4,
                      fontSize: 12,
                      fontWeight: 600,
                      textAlign: 'center',
                      textDecoration: 'none',
                    }}
                  >
                    Upgrade
                  </Link>
                </>
              ) : (
                <>
                  <div
                    style={{
                      padding: '8px 12px',
                      background: '#ef4444',
                      color: '#fff',
                      borderRadius: 4,
                      fontSize: 11,
                      fontWeight: 600,
                      marginBottom: 8,
                    }}
                  >
                    Trial ended
                  </div>
                  <Link
                    href="/settings/billing"
                    style={{
                      display: 'block',
                      padding: '8px 12px',
                      background: '#ef4444',
                      color: '#fff',
                      borderRadius: 4,
                      fontSize: 12,
                      fontWeight: 600,
                      textAlign: 'center',
                      textDecoration: 'none',
                    }}
                  >
                    Upgrade to continue
                  </Link>
                </>
              )}
            </div>
          </div>
        )}

        <CreditsWidget />
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 8px',
            marginBottom: 8,
          }}
        >
          <UserButton
            appearance={{
              elements: {
                userButtonAvatarBox: {
                  width: '24px',
                  height: '24px',
                },
                userButtonPopoverCard: {
                  background: C.sidebar,
                  border: `1px solid ${C.border}`,
                },
              },
            }}
          />
        </div>
        <div>
          <button
            onClick={() => setShowHelpMenu(!showHelpMenu)}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 8px',
              borderRadius: 7,
              color: C.text3,
              fontSize: 13,
              marginBottom: 1,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <HelpCircle size={14} />
              Help & docs
            </div>
            <ChevronDown
              size={14}
              style={{
                transform: showHelpMenu ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s'
              }}
            />
          </button>
          {showHelpMenu && (
            <div style={{ paddingLeft: 30, marginTop: 4, marginBottom: 4 }}>
              <Link
                href={`/privacy${queryString}`}
                style={{
                  display: 'block',
                  padding: '4px 8px',
                  fontSize: 12,
                  color: C.text3,
                  textDecoration: 'none',
                  borderRadius: 4,
                }}
              >
                Privacy Policy
              </Link>
              <Link
                href={`/security${queryString}`}
                style={{
                  display: 'block',
                  padding: '4px 8px',
                  fontSize: 12,
                  color: C.text3,
                  textDecoration: 'none',
                  borderRadius: 4,
                }}
              >
                Security
              </Link>
              <Link
                href={`/terms${queryString}`}
                style={{
                  display: 'block',
                  padding: '4px 8px',
                  fontSize: 12,
                  color: C.text3,
                  textDecoration: 'none',
                  borderRadius: 4,
                }}
              >
                Terms of Service
              </Link>
              <Link
                href={`/cookie-policy${queryString}`}
                style={{
                  display: 'block',
                  padding: '4px 8px',
                  fontSize: 12,
                  color: C.text3,
                  textDecoration: 'none',
                  borderRadius: 4,
                }}
              >
                Cookie Policy
              </Link>
              <button
                onClick={() => {
                  resetConsent();
                  setShowHelpMenu(false);
                }}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '4px 8px',
                  fontSize: 12,
                  color: C.text3,
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  borderRadius: 4,
                }}
              >
                Cookie preferences
              </button>
            </div>
          )}
        </div>
      </div>

      <style jsx global>{`
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}
