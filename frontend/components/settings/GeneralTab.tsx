'use client';

import { useState, useEffect } from 'react';
import { C, F } from '@/lib/design-tokens';
import { Card, Toggle, PrimaryBtn, GhostBtn } from '@/components/refyne';
import { useRole } from '@/hooks/useRole';
import { AdminOnlyNotice } from '@/components/auth/AdminOnlyNotice';

interface GeneralSettings {
  workspaceName: string | null;
  displayName: string | null;
  timezone: string;
  alwaysOn: {
    enabled: boolean;
    digestTime: string;
    scoreThreshold: number;
    sendOnNoChange: boolean;
    emailRecipients: string[];
  } | null;
}

const TIMEZONES = [
  { value: 'UTC', label: 'UTC' },
  { value: 'America/New_York', label: 'Eastern Time' },
  { value: 'America/Chicago', label: 'Central Time' },
  { value: 'America/Denver', label: 'Mountain Time' },
  { value: 'America/Los_Angeles', label: 'Pacific Time' },
  { value: 'Europe/London', label: 'London' },
  { value: 'Europe/Paris', label: 'Paris' },
  { value: 'Asia/Tokyo', label: 'Tokyo' },
  { value: 'Australia/Sydney', label: 'Sydney' },
];

export function GeneralTab() {
  const { isAdmin } = useRole();
  const [settings, setSettings] = useState<GeneralSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [workspaceName, setWorkspaceName] = useState('');
  const [timezone, setTimezone] = useState('UTC');
  const [digestEnabled, setDigestEnabled] = useState(false);
  const [digestTime, setDigestTime] = useState('23:00');
  const [scoreThreshold, setScoreThreshold] = useState(3);
  const [sendOnNoChange, setSendOnNoChange] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [confirmName, setConfirmName] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [syncFrequency, setSyncFrequency] = useState<'manual' | 'nightly' | 'every_6h' | 'hourly'>('nightly');
  const [connections, setConnections] = useState<any[]>([]);
  const [savingSyncFreq, setSavingSyncFreq] = useState(false);

  useEffect(() => {
    fetchSettings();
    fetchConnections();
  }, []);

  async function fetchSettings() {
    try {
      const res = await fetch('/api/org/settings/general');
      if (res.ok) {
        const data = await res.json();
        setSettings(data.settings);
        setWorkspaceName(data.settings.displayName || data.settings.workspaceName || '');
        setTimezone(data.settings.timezone || 'UTC');
        if (data.settings.alwaysOn) {
          setDigestEnabled(data.settings.alwaysOn.enabled);
          // Convert UTC time to local time for display
          const [hours] = data.settings.alwaysOn.digestTime.split(':');
          setDigestTime(`${hours}:00`);
          setScoreThreshold(data.settings.alwaysOn.scoreThreshold);
          setSendOnNoChange(data.settings.alwaysOn.sendOnNoChange);
        }
      }
    } catch (err) {
      console.error('Failed to fetch settings:', err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchConnections() {
    try {
      const res = await fetch('/api/hubspot/connections');
      if (res.ok) {
        const data = await res.json();
        setConnections(data.connections || []);
        // Set sync frequency from first connection
        if (data.connections?.length > 0 && data.connections[0].syncFrequency) {
          setSyncFrequency(data.connections[0].syncFrequency);
        }
      }
    } catch (err) {
      console.error('Failed to fetch connections:', err);
    }
  }

  async function handleSaveSyncFrequency() {
    if (connections.length === 0) {
      showToast('No HubSpot connection found', 'error');
      return;
    }

    setSavingSyncFreq(true);
    try {
      // Update all connections with the new frequency
      const promises = connections.map(conn =>
        fetch(`/api/hubspot/connections/${conn.id}/sync-frequency`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ frequency: syncFrequency }),
        })
      );

      const results = await Promise.all(promises);
      const allSuccessful = results.every(r => r.ok);

      if (allSuccessful) {
        showToast('Sync frequency updated', 'success');
        await fetchConnections();
      } else {
        showToast('Failed to update sync frequency', 'error');
      }
    } catch (err) {
      showToast('Failed to update sync frequency', 'error');
    } finally {
      setSavingSyncFreq(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch('/api/org/settings/general', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName: workspaceName,
          timezone,
          digestTime: `${digestTime.split(':')[0]}:00:00`,
          scoreThreshold,
          sendOnNoChange,
        }),
      });

      if (res.ok) {
        await fetchSettings();
        showToast('Settings saved successfully', 'success');
      } else {
        showToast('Failed to save settings', 'error');
      }
    } catch (err) {
      showToast('Failed to save settings', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteWorkspace() {
    setDeleting(true);
    try {
      const res = await fetch('/api/org/workspace', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmName }),
      });

      const data = await res.json();

      if (res.ok) {
        window.location.href = data.redirectTo || '/onboarding';
      } else {
        showToast(data.error || 'Failed to delete workspace', 'error');
      }
    } catch (err) {
      showToast('Failed to delete workspace', 'error');
    } finally {
      setDeleting(false);
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
    return <div style={{ padding: 20, color: C.text3 }}>Loading settings...</div>;
  }

  return (
    <div style={{ maxWidth: 720 }}>
      {/* Workspace Section */}
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, color: C.text3, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 16 }}>
          Workspace
        </h2>

        <Card style={{ marginBottom: 20 }}>
          <div style={{ padding: 20 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: C.text, marginBottom: 8 }}>
              Workspace name
            </label>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <input
                type="text"
                value={workspaceName}
                onChange={(e) => setWorkspaceName(e.target.value)}
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
                placeholder="Enter workspace name"
              />
            </div>
            <div style={{ fontSize: 11, color: C.text3, marginTop: 6 }}>
              Updates Clerk org name and workspace display name
            </div>
          </div>

          <div style={{ padding: 20, borderTop: `1px solid ${C.border}` }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: C.text, marginBottom: 8 }}>
              Timezone
            </label>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              style={{
                padding: '10px 12px',
                background: C.surface,
                border: `1px solid ${C.border2}`,
                borderRadius: 6,
                color: C.text,
                fontFamily: F.sans,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              {TIMEZONES.map((tz) => (
                <option key={tz.value} value={tz.value}>
                  {tz.label}
                </option>
              ))}
            </select>
            <div style={{ fontSize: 11, color: C.text3, marginTop: 6 }}>
              Used for Always On scan time display and digest email times
            </div>
          </div>
        </Card>
      </div>

      {/* Always On Section */}
      {isAdmin ? (
        <div style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, color: C.text3, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 16 }}>
            Always On
          </h2>

          <Card>
            <div style={{ padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: C.text, marginBottom: 4 }}>
                    Always On monitoring
                  </div>
                  <div style={{ fontSize: 11, color: C.text3 }}>
                    Enable daily compliance digest and monitoring
                  </div>
                </div>
                <Toggle on={digestEnabled} onToggle={() => setDigestEnabled(!digestEnabled)} />
              </div>

            <div style={{ marginBottom: 20, paddingBottom: 20, borderBottom: `1px solid ${C.border}` }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: C.text, marginBottom: 8 }}>
                Daily digest time
              </label>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <input
                  type="time"
                  value={digestTime}
                  onChange={(e) => setDigestTime(e.target.value)}
                  style={{
                    padding: '10px 12px',
                    background: C.surface,
                    border: `1px solid ${C.border2}`,
                    borderRadius: 6,
                    color: C.text,
                    fontFamily: F.mono,
                    fontSize: 13,
                  }}
                  disabled={!digestEnabled}
                />
                <span style={{ fontSize: 12, color: C.text3 }}>
                  {TIMEZONES.find(tz => tz.value === timezone)?.label || 'UTC'}
                </span>
              </div>
              <div style={{ fontSize: 11, color: C.text3, marginTop: 6 }}>
                Converts to UTC on save
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: C.text, marginBottom: 12 }}>
                Send digest when:
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                  <input
                    type="radio"
                    checked={!sendOnNoChange}
                    onChange={() => setSendOnNoChange(false)}
                    disabled={!digestEnabled}
                    style={{ cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: 13, color: C.text }}>
                    Only when score changes by{' '}
                    <input
                      type="number"
                      value={scoreThreshold}
                      onChange={(e) => setScoreThreshold(parseInt(e.target.value) || 3)}
                      style={{
                        width: 50,
                        padding: '4px 8px',
                        background: C.surface,
                        border: `1px solid ${C.border2}`,
                        borderRadius: 4,
                        color: C.text,
                        fontFamily: F.mono,
                        fontSize: 13,
                      }}
                      disabled={!digestEnabled || sendOnNoChange}
                    />{' '}
                    or more points
                  </span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                  <input
                    type="radio"
                    checked={sendOnNoChange}
                    onChange={() => setSendOnNoChange(true)}
                    disabled={!digestEnabled}
                    style={{ cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: 13, color: C.text }}>
                    Every day regardless of changes
                  </span>
                </label>
              </div>
            </div>

            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: C.text, marginBottom: 6 }}>
                Email recipients
              </div>
              <div style={{ fontSize: 12, color: C.text3, marginBottom: 8 }}>
                All members subscribed to Always On digest will receive it.
              </div>
              <a
                href="/settings?tab=notifications"
                style={{ fontSize: 12, color: C.indigo, textDecoration: 'none', cursor: 'pointer' }}
              >
                Manage notification preferences →
              </a>
            </div>
          </div>
        </Card>
        </div>
      ) : null}

      {/* Sync Configuration */}
      {connections.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, color: C.text3, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 16 }}>
            Sync Configuration
          </h2>

          <Card>
            <div style={{ padding: 20 }}>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: C.text, marginBottom: 4 }}>
                  Sync frequency
                </div>
                <div style={{ fontSize: 12, color: C.text3, marginBottom: 16 }}>
                  How often Refyne reads from HubSpot to update scores and detect new duplicates.
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                  <input
                    type="radio"
                    checked={syncFrequency === 'nightly'}
                    onChange={() => setSyncFrequency('nightly')}
                    style={{ cursor: 'pointer' }}
                  />
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: 13, color: C.text }}>Nightly (default)</span>
                    <span style={{ fontSize: 11, color: C.text3, marginLeft: 8 }}>All plans</span>
                  </div>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'not-allowed', opacity: 0.5 }}>
                  <input
                    type="radio"
                    checked={syncFrequency === 'every_6h'}
                    onChange={() => setSyncFrequency('every_6h')}
                    disabled
                    style={{ cursor: 'not-allowed' }}
                  />
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: 13, color: C.text }}>Every 6 hours</span>
                    <span style={{ fontSize: 11, color: C.amber, marginLeft: 8 }}>🔒 Growth</span>
                  </div>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'not-allowed', opacity: 0.5 }}>
                  <input
                    type="radio"
                    checked={syncFrequency === 'hourly'}
                    onChange={() => setSyncFrequency('hourly')}
                    disabled
                    style={{ cursor: 'not-allowed' }}
                  />
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: 13, color: C.text }}>Hourly</span>
                    <span style={{ fontSize: 11, color: C.indigo, marginLeft: 8 }}>🔒 Scale</span>
                  </div>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                  <input
                    type="radio"
                    checked={syncFrequency === 'manual'}
                    onChange={() => setSyncFrequency('manual')}
                    style={{ cursor: 'pointer' }}
                  />
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: 13, color: C.text }}>Manual</span>
                    <span style={{ fontSize: 11, color: C.text3, marginLeft: 8 }}>Sync only when you click Sync</span>
                  </div>
                </label>
              </div>

              <div style={{ fontSize: 11, color: C.text3, marginTop: 16 }}>
                Applies to: all connected HubSpot portals in this workspace
              </div>

              <div style={{ marginTop: 16 }}>
                <PrimaryBtn onClick={handleSaveSyncFrequency} disabled={savingSyncFreq}>
                  {savingSyncFreq ? 'Saving...' : 'Save sync frequency'}
                </PrimaryBtn>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Danger Zone */}
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, color: C.red, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 16 }}>
          Danger Zone
        </h2>

        <Card style={{ borderColor: C.redBrd }}>
          <div style={{ padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: C.text, marginBottom: 6 }}>
                  Delete workspace
                </div>
                <div style={{ fontSize: 12, color: C.text3, maxWidth: 500 }}>
                  Permanently delete this workspace and all its data. Your HubSpot data is not affected — only Refyne data is removed. This cannot be undone.
                </div>
              </div>
              <GhostBtn
                onClick={() => setShowDeleteConfirm(true)}
                style={{ borderColor: C.red, color: C.red }}
              >
                Delete workspace
              </GhostBtn>
            </div>
          </div>
        </Card>
      </div>

      {/* Save Button */}
      <div style={{ display: 'flex', gap: 12 }}>
        <PrimaryBtn onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save Changes'}
        </PrimaryBtn>
        <GhostBtn onClick={fetchSettings}>Cancel</GhostBtn>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setShowDeleteConfirm(false)}
        >
          <div onClick={(e: React.MouseEvent) => e.stopPropagation()}>
            <Card style={{ width: 480, maxWidth: '90vw' }}>
            <div style={{ padding: 20, borderBottom: `1px solid ${C.border}` }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, color: C.text }}>
                Delete workspace
              </h3>
            </div>
            <div style={{ padding: 20 }}>
              <p style={{ fontSize: 13, color: C.text, marginBottom: 16 }}>
                Type the workspace name to confirm deletion:
              </p>
              <p style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 12 }}>
                {workspaceName}
              </p>
              <input
                type="text"
                value={confirmName}
                onChange={(e) => setConfirmName(e.target.value)}
                placeholder="Type workspace name"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  background: C.surface,
                  border: `1px solid ${C.border2}`,
                  borderRadius: 6,
                  color: C.text,
                  fontFamily: F.sans,
                  fontSize: 13,
                  marginBottom: 16,
                }}
              />
              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                <GhostBtn onClick={() => setShowDeleteConfirm(false)}>
                  Cancel
                </GhostBtn>
                <PrimaryBtn
                  onClick={handleDeleteWorkspace}
                  disabled={confirmName !== workspaceName || deleting}
                >
                  {deleting ? 'Deleting...' : 'Delete workspace'}
                </PrimaryBtn>
              </div>
            </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
