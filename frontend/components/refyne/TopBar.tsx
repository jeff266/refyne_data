'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { OrganizationSwitcher, useOrganization } from '@clerk/nextjs';
import { ChevronRight, Command, RefreshCw, Plus } from 'lucide-react';
import { C, F, PAGE_META } from '@/lib/design-tokens';
import { PrimaryBtn } from './PrimaryBtn';
import { ObjectSwitcher } from './ObjectSwitcher';

export function TopBar() {
  const pathname = usePathname();
  const currentPage = pathname.split('/')[1] || 'dashboard';
  const meta = PAGE_META[currentPage] || { label: 'Dashboard', action: null };

  // Force full page reload when organization changes to clear all cached state
  const { organization } = useOrganization();
  const orgIdRef = useRef<string | undefined>();

  useEffect(() => {
    // Skip on initial mount
    if (orgIdRef.current === undefined) {
      orgIdRef.current = organization?.id;
      return;
    }

    // If org changed, force full page reload to clear cached data
    if (organization?.id !== orgIdRef.current) {
      console.log('[TopBar] Organization changed, forcing page reload to clear cache');
      window.location.href = pathname;
    }
  }, [organization?.id, pathname]);

  return (
    <div
      style={{
        height: 50,
        background: C.sidebar,
        borderBottom: `1px solid ${C.border}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        flexShrink: 0,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontFamily: F.sans,
        }}
      >
        <OrganizationSwitcher
          afterSelectOrganizationUrl={pathname}
          afterSelectPersonalUrl={pathname}
          hidePersonal={true}
          skipInvitationScreen={true}
          appearance={{
            elements: {
              rootBox: {
                display: 'flex',
                alignItems: 'center',
              },
              organizationSwitcherTrigger: {
                padding: '4px 8px',
                border: 'none',
                background: 'none',
                color: C.text3,
                fontSize: '11px',
                fontFamily: F.mono,
                '&:hover': {
                  color: C.text2,
                },
              },
            },
          }}
        />
        <ChevronRight size={12} color={C.text3} />
        <ObjectSwitcher />
        <ChevronRight size={12} color={C.text3} />
        <span
          style={{
            fontSize: 13,
            color: C.text,
            fontWeight: 600,
            letterSpacing: '-0.01em',
          }}
        >
          {meta.label}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            padding: '4px 10px',
            border: `1px solid ${C.border2}`,
            borderRadius: 6,
            color: C.text3,
            fontSize: 11,
            fontFamily: F.mono,
          }}
        >
          <Command size={10} /> K
        </div>
        <button
          style={{
            padding: '5px 10px',
            border: `1px solid ${C.border2}`,
            borderRadius: 6,
            color: C.text2,
            fontSize: 11,
            fontFamily: F.sans,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            background: 'none',
            cursor: 'pointer',
          }}
        >
          <RefreshCw size={10} /> Sync
        </button>
        {meta.action && (
          <PrimaryBtn>
            <Plus size={12} /> {meta.action}
          </PrimaryBtn>
        )}
      </div>
    </div>
  );
}
