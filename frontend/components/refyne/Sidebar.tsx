'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
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
} from 'lucide-react';
import { C, F, NAV } from '@/lib/design-tokens';
import { RefyneLogo } from './RefyneLogo';

const ICONS: Record<string, React.ElementType> = {
  LayoutDashboard,
  Search,
  ArrowUpDown,
  GitMerge,
  Sparkles,
  ArrowRightLeft,
  Plug2,
};

export function Sidebar() {
  const pathname = usePathname();
  const currentPage = pathname.split('/')[1] || 'dashboard';

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
        {NAV.map((item, i) => {
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
                  padding: '8px 8px 4px',
                  fontSize: 10,
                  color: C.text3,
                  fontWeight: 600,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  fontFamily: F.sans,
                }}
              >
                {item.group}
              </div>
            );
          }

          if (!('id' in item) || !item.id) return null;

          const active = currentPage === item.id;
          const Icon = ICONS[item.icon];
          const href = `/${item.id}`;

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
        <Link
          href="/settings"
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 8px',
            borderRadius: 7,
            color: currentPage === 'settings' ? C.indigoLt : C.text3,
            fontSize: 13,
            marginBottom: 1,
            background: currentPage === 'settings' ? 'rgba(99,102,241,0.12)' : 'transparent',
            border: `1px solid ${currentPage === 'settings' ? C.indigoBrd : 'transparent'}`,
            textDecoration: 'none',
          }}
        >
          <Settings size={14} />
          Settings
        </Link>
        <button
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
          }}
        >
          <HelpCircle size={14} />
          Help & docs
        </button>
      </div>
    </div>
  );
}
