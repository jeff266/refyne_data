'use client';

import { useState, useEffect } from 'react';
import { useAuth, useUser } from '@clerk/nextjs';
import { C, F } from '@/lib/design-tokens';
import { Card, PrimaryBtn, GhostBtn } from '@/components/refyne';

interface Workspace {
  id: string;
  name: string;
  role: string;
  isActive: boolean;
}

interface NotificationPrefs {
  subscribed: boolean;
  mandatory: boolean;
}

const NOTIFICATION_TYPES = [
  {
    key: 'always_on_digest',
    label: 'Always On Digest',
    description: 'Daily compliance digest email',
    defaultSubscribed: false,
    mandatory: false,
  },
  {
    key: 'compliance_threshold_alert',
    label: 'Compliance Threshold Alert',
    description: 'Alert when compliance score drops below threshold',
    defaultSubscribed: true,
    mandatory: true,
  },
  {
    key: 'dedup_pairs_detected',
    label: 'Duplicate Pairs Detected',
    description: 'Notification when duplicate pairs are detected',
    defaultSubscribed: true,
    mandatory: false,
  },
  {
    key: 'quarantine_submitted',
    label: 'Quarantine Submitted',
    description: 'Alert when records are quarantined for review',
    defaultSubscribed: true,
    mandatory: true,
  },
  {
    key: 'credit_limit_warning',
    label: 'Credit Limit Warning',
    description: 'Warning when approaching credit limit',
    defaultSubscribed: true,
    mandatory: false,
  },
  {
    key: 'member_joined',
    label: 'Member Joined',
    description: 'Notification when new members join workspace',
    defaultSubscribed: false,
    mandatory: false,
  },
];

export default function ProfilePage() {
  const { userId } = useAuth();
  const { user } = useUser();
  const [displayName, setDisplayName] = useState('');
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [notificationPrefs, setNotificationPrefs] = useState<Record<string, NotificationPrefs>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
      setDisplayName(fullName);
    }
    fetchProfileData();
  }, [user]);

  async function fetchProfileData() {
    try {
      const [workspacesRes, prefsRes] = await Promise.all([
        fetch('/api/profile/workspaces'),
        fetch('/api/profile/notifications'),
      ]);

      if (workspacesRes.ok) {
        const data = await workspacesRes.json();
        setWorkspaces(data.workspaces || []);
      }

      if (prefsRes.ok) {
        const data = await prefsRes.json();
        // Auto-seed defaults for missing prefs
        const prefs = NOTIFICATION_TYPES.reduce((acc, type) => {
          acc[type.key] = data.preferences?.[type.key] || {
            subscribed: type.defaultSubscribed,
            mandatory: type.mandatory,
          };
          return acc;
        }, {} as Record<string, NotificationPrefs>);
        setNotificationPrefs(prefs);
      }
    } catch (error) {
      console.error('Failed to fetch profile data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveDisplayName() {
    setSaving(true);
    try {
      const res = await fetch('/api/profile/display-name', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName }),
      });

      if (res.ok) {
        await user?.reload();
        showToast('Display name updated', 'success');
      } else {
        showToast('Failed to update display name', 'error');
      }
    } catch (error) {
      showToast('Failed to update display name', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleActivateWorkspace(orgId: string) {
    try {
      // Client-side activation using Clerk
      const res = await fetch('/api/profile/workspace/activate', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId }),
      });

      if (res.ok) {
        window.location.href = `/?__clerk_org=${orgId}`;
      }
    } catch (error) {
      console.error('Failed to activate workspace:', error);
    }
  }

  async function toggleNotification(type: string, currentValue: boolean, isMandatory: boolean) {
    if (isMandatory) return;

    // Optimistic update
    setNotificationPrefs((prev) => ({
      ...prev,
      [type]: { ...prev[type], subscribed: !currentValue },
    }));

    try {
      const res = await fetch(`/api/profile/notifications/${type}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscribed: !currentValue }),
      });

      if (!res.ok) {
        // Revert on error
        setNotificationPrefs((prev) => ({
          ...prev,
          [type]: { ...prev[type], subscribed: currentValue },
        }));
        showToast('Failed to update notification preference', 'error');
      }
    } catch (error) {
      // Revert on error
      setNotificationPrefs((prev) => ({
        ...prev,
        [type]: { ...prev[type], subscribed: currentValue },
      }));
      showToast('Failed to update notification preference', 'error');
    }
  }

  function showToast(message: string, type: 'success' | 'error') {
    const toast = document.createElement('div');
    toast.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      padding: 12px 20px;
      background: ${type === 'success' ? C.greenDim : C.redDim};
      border: 1px solid ${type === 'success' ? C.greenBrd : C.redBrd};
      color: ${type === 'success' ? C.green : C.red};
      border-radius: 8px;
      font-size: 14px;
      z-index: 10000;
      font-family: ${F.sans};
    `;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  }

  if (loading) {
    return (
      <div style={{ padding: '28px 32px', fontFamily: F.sans }}>
        <div style={{ color: C.text3, fontSize: 13 }}>Loading profile...</div>
      </div>
    );
  }

  return (
    <div style={{ padding: '28px 32px', fontFamily: F.sans, maxWidth: 920 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 18, fontWeight: 600, color: C.text, marginBottom: 4 }}>Profile</h1>
        <p style={{ fontSize: 13, color: C.text3 }}>Manage your personal account settings</p>
      </div>

      {/* Account Section */}
      <div style={{ marginBottom: 32 }}>
        <h2
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: C.text3,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            marginBottom: 16,
          }}
        >
          Account
        </h2>

        <Card style={{ marginBottom: 20 }}>
          <div style={{ padding: 20 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: C.text, marginBottom: 8 }}>
              Display name
            </label>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                style={{
                  flex: 1,
                  padding: '10px 12px',
                  background: C.surface,
                  border: `1px solid ${C.border2}`,
                  borderRadius: 6,
                  color: C.text,
                  fontFamily: F.sans,
                  fontSize: 13,
                }}
                placeholder="Enter your name"
              />
              <PrimaryBtn onClick={handleSaveDisplayName} disabled={saving}>
                {saving ? 'Saving...' : 'Save'}
              </PrimaryBtn>
            </div>
            <div style={{ fontSize: 11, color: C.text3, marginTop: 6 }}>
              This name appears in the UI and email notifications
            </div>
          </div>

          <div style={{ padding: 20, borderTop: `1px solid ${C.border}` }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: C.text, marginBottom: 8 }}>
              Email
            </label>
            <div style={{ fontSize: 13, color: C.text3 }}>{user?.primaryEmailAddress?.emailAddress}</div>
            <div style={{ fontSize: 11, color: C.text3, marginTop: 6 }}>
              Managed by your authentication provider
            </div>
          </div>
        </Card>
      </div>

      {/* Workspaces Section */}
      <div style={{ marginBottom: 32 }}>
        <h2
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: C.text3,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            marginBottom: 16,
          }}
        >
          Workspaces
        </h2>

        <Card>
          <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 13, color: C.text3 }}>
              You belong to {workspaces.length} workspace{workspaces.length !== 1 ? 's' : ''}
            </div>
          </div>
          {workspaces.map((workspace) => (
            <div
              key={workspace.id}
              style={{
                padding: '16px 20px',
                borderBottom: `1px solid ${C.border}`,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: C.text, marginBottom: 4 }}>
                  {workspace.name}
                </div>
                <div style={{ fontSize: 12, color: C.text3 }}>
                  {workspace.role.replace('org:', '').charAt(0).toUpperCase() + workspace.role.replace('org:', '').slice(1)}
                </div>
              </div>
              {workspace.isActive ? (
                <div
                  style={{
                    padding: '6px 12px',
                    background: C.greenDim,
                    border: `1px solid ${C.greenBrd}`,
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 500,
                    color: C.green,
                  }}
                >
                  Active
                </div>
              ) : (
                <GhostBtn onClick={() => handleActivateWorkspace(workspace.id)}>
                  Activate
                </GhostBtn>
              )}
            </div>
          ))}
        </Card>
      </div>

      {/* Notification Preferences Section */}
      <div style={{ marginBottom: 32 }}>
        <h2
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: C.text3,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            marginBottom: 16,
          }}
        >
          Notification Preferences
        </h2>

        <Card>
          <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 13, color: C.text3 }}>
              Choose which email notifications you want to receive
            </div>
          </div>
          {NOTIFICATION_TYPES.map((type) => {
            const pref = notificationPrefs[type.key];
            if (!pref) return null;

            return (
              <div
                key={type.key}
                style={{
                  padding: '16px 20px',
                  borderBottom: `1px solid ${C.border}`,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: C.text }}>
                      {type.label}
                    </div>
                    {pref.mandatory && (
                      <div
                        style={{
                          padding: '2px 6px',
                          background: C.indigoDim,
                          border: `1px solid ${C.indigoBrd}`,
                          borderRadius: 4,
                          fontSize: 10,
                          fontWeight: 600,
                          color: C.indigo,
                        }}
                        title="Required for admins"
                      >
                        REQUIRED
                      </div>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: C.text3 }}>{type.description}</div>
                </div>
                <button
                  onClick={() => toggleNotification(type.key, pref.subscribed, pref.mandatory)}
                  disabled={pref.mandatory}
                  style={{
                    width: 40,
                    height: 22,
                    borderRadius: 11,
                    border: 'none',
                    background: pref.subscribed ? C.indigo : C.border,
                    cursor: pref.mandatory ? 'not-allowed' : 'pointer',
                    position: 'relative',
                    transition: 'background 0.2s',
                    opacity: pref.mandatory ? 0.6 : 1,
                  }}
                >
                  <div
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: '50%',
                      background: 'white',
                      position: 'absolute',
                      top: 2,
                      left: pref.subscribed ? 20 : 2,
                      transition: 'left 0.2s',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
                    }}
                  />
                </button>
              </div>
            );
          })}
        </Card>
      </div>
    </div>
  );
}
