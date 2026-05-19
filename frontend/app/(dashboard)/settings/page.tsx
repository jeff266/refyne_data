'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useSearchParams } from 'next/navigation';
import { C, F } from '@/lib/design-tokens';
import { Card, PrimaryBtn } from '@/components/refyne';
import { GeneralTab } from '@/components/settings/GeneralTab';
import { MembersTab } from '@/components/settings/MembersTab';
import { PoliciesTab } from '@/components/settings/PoliciesTab';
import { NotificationsTab } from '@/components/settings/NotificationsTab';
import { BillingTab } from '@/components/settings/BillingTab';

type TabType = 'general' | 'members' | 'policies' | 'notifications' | 'billing';

export default function SettingsPage() {
  const { orgRole } = useAuth();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab') as TabType | null;
  const [activeTab, setActiveTab] = useState<TabType>(tabParam || 'general');

  useEffect(() => {
    if (tabParam && ['general', 'members', 'policies', 'notifications', 'billing'].includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  // Role gating: only admins can access settings
  if (orgRole === 'org:viewer' || orgRole === 'org:operator') {
    return (
      <div style={{ padding: '28px 32px', fontFamily: F.sans, maxWidth: 920 }}>
        <Card style={{ padding: 40, textAlign: 'center' }}>
          <h1 style={{ fontSize: 18, fontWeight: 600, color: C.text, marginBottom: 12 }}>
            Settings are managed by your workspace admin
          </h1>
          <p style={{ fontSize: 14, color: C.text3, marginBottom: 24 }}>
            Manage your personal preferences in your Profile.
          </p>
          <PrimaryBtn onClick={() => window.location.href = '/profile'}>
            Go to Profile →
          </PrimaryBtn>
        </Card>
      </div>
    );
  }

  return (
    <div style={{ padding: '28px 32px', fontFamily: F.sans, maxWidth: 920 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 18, fontWeight: 600, color: C.text, marginBottom: 4 }}>Settings</h1>
        <p style={{ fontSize: 13, color: C.text3 }}>Configure your Refyne workspace</p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 24, borderBottom: `1px solid ${C.border}`, marginBottom: 24 }}>
        <Tab active={activeTab === 'general'} onClick={() => setActiveTab('general')}>
          General
        </Tab>
        <Tab active={activeTab === 'members'} onClick={() => setActiveTab('members')}>
          Members
        </Tab>
        <Tab active={activeTab === 'policies'} onClick={() => setActiveTab('policies')}>
          Policies
        </Tab>
        <Tab active={activeTab === 'notifications'} onClick={() => setActiveTab('notifications')}>
          Notifications
        </Tab>
        <Tab active={activeTab === 'billing'} onClick={() => setActiveTab('billing')}>
          Billing
        </Tab>
      </div>

      {/* Tab Content */}
      {activeTab === 'general' && <GeneralTab />}
      {activeTab === 'members' && <MembersTab />}
      {activeTab === 'policies' && <PoliciesTab />}
      {activeTab === 'notifications' && <NotificationsTab />}
      {activeTab === 'billing' && <BillingTab />}
    </div>
  );
}

function Tab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: 'none',
        border: 'none',
        padding: '0 0 12px 0',
        fontSize: 13,
        fontWeight: active ? 600 : 400,
        color: active ? C.text : C.text3,
        borderBottom: active ? `2px solid ${C.indigo}` : '2px solid transparent',
        cursor: 'pointer',
        transition: 'all 0.2s',
      }}
    >
      {children}
    </button>
  );
}

