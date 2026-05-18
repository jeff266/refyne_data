'use client';

import { useState } from 'react';
import { C, F } from '@/lib/design-tokens';
import { Card, Toggle, PrimaryBtn, GhostBtn } from '@/components/refyne';
import { AlwaysOnSettings } from '@/components/always-on/AlwaysOnSettings';
import { MembersTab } from '@/components/settings/MembersTab';
import { PoliciesTab } from '@/components/settings/PoliciesTab';
import { NotificationsTab } from '@/components/settings/NotificationsTab';

type TabType = 'general' | 'members' | 'policies' | 'notifications';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabType>('general');

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
      </div>

      {/* Tab Content */}
      {activeTab === 'general' && <GeneralTab />}
      {activeTab === 'members' && <MembersTab />}
      {activeTab === 'policies' && <PoliciesTab />}
      {activeTab === 'notifications' && <NotificationsTab />}
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

function GeneralTab() {
  return (
    <div style={{ maxWidth: 720 }}>
      {/* Always On */}
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, color: C.text, marginBottom: 16 }}>Always On</h2>
        <AlwaysOnSettings />
      </div>

      {/* General Settings */}
      <Card style={{ marginBottom: 16 }}>
        <div style={{ padding: '14px 20px', borderBottom: `1px solid ${C.border}` }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>General</span>
        </div>
        <div style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 13, color: C.text, marginBottom: 4 }}>Auto-scan on sync</div>
              <div style={{ fontSize: 11, color: C.text3 }}>Automatically run compliance scan after HubSpot sync</div>
            </div>
            <Toggle on={true} onToggle={() => {}} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 13, color: C.text, marginBottom: 4 }}>Implicit normalization</div>
              <div style={{ fontSize: 11, color: C.text3 }}>Auto-apply normalized values without review</div>
            </div>
            <Toggle on={false} onToggle={() => {}} />
          </div>
        </div>
      </Card>

      {/* Notifications */}
      <Card style={{ marginBottom: 16 }}>
        <div style={{ padding: '14px 20px', borderBottom: `1px solid ${C.border}` }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>Notifications</span>
        </div>
        <div style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 13, color: C.text, marginBottom: 4 }}>Email alerts</div>
              <div style={{ fontSize: 11, color: C.text3 }}>Receive email when compliance drops below threshold</div>
            </div>
            <Toggle on={true} onToggle={() => {}} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 13, color: C.text, marginBottom: 4 }}>Slack notifications</div>
              <div style={{ fontSize: 11, color: C.text3 }}>Post alerts to a Slack channel</div>
            </div>
            <Toggle on={false} onToggle={() => {}} />
          </div>
          <div>
            <div style={{ fontSize: 13, color: C.text, marginBottom: 8 }}>Score threshold</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <input
                type="number"
                defaultValue={75}
                style={{
                  width: 80,
                  padding: '8px 12px',
                  background: C.surface,
                  border: `1px solid ${C.border2}`,
                  borderRadius: 6,
                  color: C.text,
                  fontFamily: F.mono,
                  fontSize: 13,
                }}
              />
              <span style={{ fontSize: 12, color: C.text3 }}>Alert when compliance score drops below this value</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Danger Zone */}
      <Card>
        <div style={{ padding: '14px 20px', borderBottom: `1px solid ${C.border}` }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: C.red }}>Danger Zone</span>
        </div>
        <div style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 13, color: C.text, marginBottom: 4 }}>Reset compliance data</div>
              <div style={{ fontSize: 11, color: C.text3 }}>Clear all normalized records and score history</div>
            </div>
            <GhostBtn>Reset Data</GhostBtn>
          </div>
        </div>
      </Card>

      <div style={{ marginTop: 24, display: 'flex', gap: 10 }}>
        <PrimaryBtn>Save Changes</PrimaryBtn>
        <GhostBtn>Cancel</GhostBtn>
      </div>
    </div>
  );
}
