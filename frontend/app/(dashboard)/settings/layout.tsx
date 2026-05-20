'use client';

import { usePathname } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { C, F } from '@/lib/design-tokens';
import Link from 'next/link';

interface Tab {
  key: string;
  label: string;
  path: string;
  roles: ('admin' | 'operator' | 'viewer')[];
}

const TABS: Tab[] = [
  { key: 'general', label: 'General', path: '/settings/general', roles: ['admin', 'operator'] },
  { key: 'policies', label: 'Policies', path: '/settings/policies', roles: ['admin', 'operator'] },
  { key: 'notifications', label: 'Notifications', path: '/settings/notifications', roles: ['admin', 'operator', 'viewer'] },
  { key: 'billing', label: 'Billing', path: '/settings/billing', roles: ['admin'] },
  { key: 'team', label: 'Team', path: '/settings/team', roles: ['admin', 'operator'] },
];

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { orgRole } = useAuth();

  // Map Clerk org role to simplified role
  const userRole: 'admin' | 'operator' | 'viewer' =
    orgRole === 'org:admin' ? 'admin' :
    orgRole === 'org:operator' ? 'operator' :
    'viewer';

  // Filter tabs based on role
  const visibleTabs = TABS.filter((tab) => tab.roles.includes(userRole));

  return (
    <div style={{ padding: '28px 32px', fontFamily: F.sans }}>
      {/* Page title */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 600, color: C.text, marginBottom: 4 }}>
          Settings
        </h1>
        <p style={{ fontSize: 13, color: C.text3 }}>
          Manage your workspace configuration and preferences
        </p>
      </div>

      {/* Tab navigation */}
      <div
        style={{
          display: 'flex',
          gap: 32,
          borderBottom: `1px solid ${C.border}`,
          marginBottom: 32,
        }}
      >
        {visibleTabs.map((tab) => {
          const isActive = pathname === tab.path || pathname.startsWith(`${tab.path}/`);
          return (
            <Link
              key={tab.key}
              href={tab.path}
              style={{
                padding: '12px 0',
                fontSize: 13,
                fontWeight: isActive ? 600 : 400,
                color: isActive ? C.text : C.text3,
                textDecoration: 'none',
                borderBottom: isActive ? `2px solid ${C.indigo}` : 'none',
                marginBottom: isActive ? -1 : 0,
                transition: 'color 0.15s',
              }}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      {/* Tab content */}
      {children}
    </div>
  );
}
