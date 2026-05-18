// Always On Settings Component
// TODO: This file is a placeholder and should be fully implemented based on SPEC 3.
// Requires integration with the Always On API endpoints.

'use client';

import { useState, useEffect } from 'react';
import { C, F } from '@/lib/design-tokens';
import { Card, Toggle, PrimaryBtn, GhostBtn, Chip } from '@/components/refyne';
import type { AlwaysOnConfig, AlwaysOnStatus, DigestRun } from '@/lib/always-on/types';

export function AlwaysOnSettings() {
  const [status, setStatus] = useState<AlwaysOnStatus | null>(null);
  const [config, setConfig] = useState<AlwaysOnConfig | null>(null);
  const [runs, setRuns] = useState<DigestRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [formValues, setFormValues] = useState<Partial<AlwaysOnConfig>>({});

  // Fetch status and config on mount
  useEffect(() => {
    fetchStatus();
    fetchRuns();
  }, []);

  async function fetchStatus() {
    try {
      const res = await fetch('/api/always-on/status');
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
        if (data.config) {
          setConfig(data.config);
          setFormValues(data.config);
        }
      }
    } catch (err) {
      console.error('Failed to fetch Always On status:', err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchRuns() {
    try {
      const res = await fetch('/api/always-on/runs?perPage=10');
      if (res.ok) {
        const data = await res.json();
        setRuns(data.runs || []);
      }
    } catch (err) {
      console.error('Failed to fetch runs:', err);
    }
  }

  async function toggleEnabled() {
    try {
      const res = await fetch('/api/always-on/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !status?.enabled }),
      });

      if (res.ok) {
        await fetchStatus();
      }
    } catch (err) {
      console.error('Failed to toggle Always On:', err);
    }
  }

  async function saveConfig() {
    setSaving(true);
    try {
      const res = await fetch('/api/always-on/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formValues),
      });

      if (res.ok) {
        const data = await res.json();
        setConfig(data.config);
        setFormValues(data.config);
      }
    } catch (err) {
      console.error('Failed to save config:', err);
    } finally {
      setSaving(false);
    }
  }

  async function sendTestEmail() {
    try {
      const res = await fetch('/api/always-on/test-email', {
        method: 'POST',
      });

      if (res.ok) {
        alert('Test email sent!');
      } else {
        alert('Failed to send test email');
      }
    } catch (err) {
      console.error('Failed to send test email:', err);
    }
  }

  async function sendTestSlack() {
    try {
      const res = await fetch('/api/always-on/test-slack', {
        method: 'POST',
      });

      if (res.ok) {
        alert('Test message sent to Slack!');
      } else {
        alert('Failed to send test message');
      }
    } catch (err) {
      console.error('Failed to send test Slack message:', err);
    }
  }

  async function triggerNow() {
    try {
      const res = await fetch('/api/always-on/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      if (res.ok) {
        alert('Digest job triggered! Check back in a few minutes.');
        setTimeout(fetchRuns, 3000);
      }
    } catch (err) {
      console.error('Failed to trigger digest:', err);
    }
  }

  function updateField<K extends keyof AlwaysOnConfig>(field: K, value: AlwaysOnConfig[K]) {
    setFormValues({ ...formValues, [field]: value });
  }

  const isDirty = JSON.stringify(formValues) !== JSON.stringify(config);

  if (loading) {
    return (
      <div style={{ fontSize: 13, color: C.text3 }}>Loading Always On settings...</div>
    );
  }

  return (
    <div>
      {/* Always On Toggle */}
      <Card style={{ marginBottom: 16 }}>
        <div style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 13, color: C.text, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
                Always On monitoring
                {!status?.enabled && (
                  <Chip color="indigo">Add-on</Chip>
                )}
              </div>
              <div style={{ fontSize: 11, color: C.text3 }}>
                Nightly scan, digest email, and Slack alerts
              </div>
            </div>
            <Toggle
              on={status?.enabled || false}
              onToggle={toggleEnabled}
            />
          </div>
        </div>
      </Card>

      {/* Config Panel (visible when enabled) */}
      {status?.enabled && (
        <>
          <Card style={{ marginBottom: 16 }}>
            <div style={{ padding: '14px 20px', borderBottom: `1px solid ${C.border}` }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>Schedule & Delivery</span>
            </div>
            <div style={{ padding: '16px 20px' }}>
              {/* Scan Schedule */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 13, color: C.text, marginBottom: 8 }}>Scan time (UTC)</div>
                <input
                  type="time"
                  value={formValues.scanTimeUtc || '06:00:00'}
                  onChange={(e) => updateField('scanTimeUtc', e.target.value)}
                  style={{
                    padding: '8px 12px',
                    background: C.surface,
                    border: `1px solid ${C.border2}`,
                    borderRadius: 6,
                    color: C.text,
                    fontFamily: F.mono,
                    fontSize: 13,
                  }}
                />
                <div style={{ fontSize: 11, color: C.text3, marginTop: 4 }}>
                  Runs nightly across all connected portals
                </div>
              </div>

              {/* Email Digest */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div style={{ fontSize: 13, color: C.text }}>Email digest</div>
                  <Toggle
                    on={formValues.digestEnabled ?? true}
                    onToggle={() => updateField('digestEnabled', !formValues.digestEnabled)}
                  />
                </div>
                {formValues.digestEnabled && (
                  <>
                    <input
                      type="text"
                      placeholder="email@example.com, email2@example.com (max 10)"
                      value={(formValues.emailRecipients || []).join(', ')}
                      onChange={(e) =>
                        updateField(
                          'emailRecipients',
                          e.target.value.split(',').map((s) => s.trim()).filter(Boolean)
                        )
                      }
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        background: C.surface,
                        border: `1px solid ${C.border2}`,
                        borderRadius: 6,
                        color: C.text,
                        fontSize: 13,
                        marginBottom: 8,
                      }}
                    />
                    <GhostBtn onClick={sendTestEmail}>Send test email</GhostBtn>
                  </>
                )}
              </div>

              {/* Slack */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div style={{ fontSize: 13, color: C.text }}>Slack alerts</div>
                  <Toggle
                    on={formValues.slackEnabled ?? false}
                    onToggle={() => updateField('slackEnabled', !formValues.slackEnabled)}
                  />
                </div>
                {formValues.slackEnabled && (
                  <>
                    <input
                      type="text"
                      placeholder="https://hooks.slack.com/services/..."
                      value={formValues.slackWebhookUrl || ''}
                      onChange={(e) => updateField('slackWebhookUrl', e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        background: C.surface,
                        border: `1px solid ${C.border2}`,
                        borderRadius: 6,
                        color: C.text,
                        fontFamily: F.mono,
                        fontSize: 12,
                        marginBottom: 8,
                      }}
                    />
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <GhostBtn onClick={sendTestSlack}>Send test message</GhostBtn>
                      <a
                        href="https://api.slack.com/messaging/webhooks"
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ fontSize: 12, color: C.indigo, textDecoration: 'none' }}
                      >
                        How to create a Slack webhook →
                      </a>
                    </div>
                  </>
                )}
              </div>
            </div>
          </Card>

          {/* Advanced Settings */}
          <Card style={{ marginBottom: 16 }}>
            <div
              style={{ padding: '14px 20px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              onClick={() => setShowAdvanced(!showAdvanced)}
            >
              <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>Advanced</span>
              <span style={{ fontSize: 11, color: C.text3 }}>{showAdvanced ? '▼' : '▶'}</span>
            </div>
            {showAdvanced && (
              <div style={{ padding: '16px 20px', borderTop: `1px solid ${C.border}` }}>
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 13, color: C.text, marginBottom: 8 }}>
                    Only send when score changes by ≥ N pts
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={formValues.scoreDeltaThreshold ?? 3}
                      onChange={(e) => updateField('scoreDeltaThreshold', parseInt(e.target.value) || 0)}
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
                    <span style={{ fontSize: 12, color: C.text3 }}>0 = always send</span>
                  </div>
                </div>

                <div style={{ marginBottom: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 13, color: C.text, marginBottom: 4 }}>
                        Auto-approve Grade A dedup pairs
                      </div>
                      <div style={{ fontSize: 11, color: C.amber }}>
                        ⚠️ Merges execute automatically
                      </div>
                    </div>
                    <Toggle
                      on={formValues.autoMergeGradeA ?? false}
                      onToggle={() => updateField('autoMergeGradeA', !formValues.autoMergeGradeA)}
                    />
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 13, color: C.text, marginBottom: 4 }}>
                        Send digest even when nothing changed
                      </div>
                    </div>
                    <Toggle
                      on={formValues.sendOnNoChange ?? false}
                      onToggle={() => updateField('sendOnNoChange', !formValues.sendOnNoChange)}
                    />
                  </div>
                </div>
              </div>
            )}
          </Card>

          {/* Run History */}
          <Card>
            <div style={{ padding: '14px 20px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>Run History</span>
              <GhostBtn onClick={triggerNow}>Trigger now</GhostBtn>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                  {['Date', 'Portal', 'Score', 'Delta', 'Pairs', 'Status'].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: '10px 20px',
                        textAlign: 'left',
                        color: C.text3,
                        fontSize: 11,
                        fontWeight: 500,
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {runs.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: '24px', textAlign: 'center', color: C.text3, fontSize: 12 }}>
                      No runs yet. Click "Trigger now" to start.
                    </td>
                  </tr>
                ) : (
                  runs.map((run) => (
                    <tr key={run.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                      <td style={{ padding: '12px 20px', fontFamily: F.mono, color: C.text2, fontSize: 11 }}>
                        {new Date(run.runAt).toLocaleString()}
                      </td>
                      <td style={{ padding: '12px 20px', color: C.text }}>{run.portalName || '—'}</td>
                      <td style={{ padding: '12px 20px', fontFamily: F.mono }}>
                        {run.scoreAfter !== null ? `${run.scoreAfter}%` : '—'}
                      </td>
                      <td style={{ padding: '12px 20px', fontFamily: F.mono, color: run.scoreDelta && run.scoreDelta > 0 ? C.green : run.scoreDelta && run.scoreDelta < 0 ? C.red : C.text3 }}>
                        {run.scoreDelta !== null ? `${run.scoreDelta > 0 ? '+' : ''}${run.scoreDelta}` : '—'}
                      </td>
                      <td style={{ padding: '12px 20px', fontFamily: F.mono }}>{run.newPairsDetected}</td>
                      <td style={{ padding: '12px 20px' }}>
                        <Chip
                          color={
                            run.status === 'completed'
                              ? 'green'
                              : run.status === 'failed'
                              ? 'indigo'
                              : 'indigo'
                          }
                        >
                          {run.status}
                        </Chip>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </Card>
        </>
      )}

      {/* Sticky Save Bar */}
      {isDirty && (
        <div
          style={{
            position: 'fixed',
            bottom: 0,
            left: 200,
            right: 0,
            padding: '12px 24px',
            background: C.surface,
            borderTop: `1px solid ${C.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 12,
            zIndex: 100,
          }}
        >
          <span style={{ fontSize: 13, color: C.text2 }}>You have unsaved changes</span>
          <GhostBtn onClick={() => setFormValues(config!)}>Discard</GhostBtn>
          <PrimaryBtn onClick={saveConfig} disabled={saving}>
            {saving ? 'Saving...' : 'Save changes'}
          </PrimaryBtn>
        </div>
      )}
    </div>
  );
}
