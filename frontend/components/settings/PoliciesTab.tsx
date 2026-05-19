'use client';

import { useEffect, useState } from 'react';
import { C, F } from '@/lib/design-tokens';
import { Card, Toggle, PrimaryBtn, GhostBtn } from '@/components/refyne';

interface OrgSettings {
  allow_operator_push: boolean;
  duplicate_push_policy: 'block' | 'quarantine' | 'allow';
  external_agencies_enabled: boolean;
}

interface Limit {
  id: string;
  applies_to: string;
  credits_per_period: number;
  period: 'day' | 'week' | 'month';
}

export function PoliciesTab() {
  const [settings, setSettings] = useState<OrgSettings | null>(null);
  const [limits, setLimits] = useState<Limit[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAddLimit, setShowAddLimit] = useState(false);

  useEffect(() => {
    loadSettings();
    loadLimits();
  }, []);

  async function loadSettings() {
    try {
      const res = await fetch('/api/org/settings');
      if (!res.ok) throw new Error('Failed to load settings');
      const data = await res.json();
      setSettings(data.settings);
    } catch (err) {
      console.error('Failed to load settings:', err);
    } finally {
      setLoading(false);
    }
  }

  async function loadLimits() {
    try {
      const res = await fetch('/api/limits');
      if (!res.ok) throw new Error('Failed to load limits');
      const data = await res.json();
      setLimits(data.limits || []);
    } catch (err) {
      console.error('Failed to load limits:', err);
    }
  }

  async function handleSave() {
    if (!settings) return;

    setSaving(true);
    try {
      const res = await fetch('/api/org/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      if (!res.ok) throw new Error('Failed to save settings');

      alert('Settings saved successfully');
    } catch (err) {
      console.error('Failed to save:', err);
      alert('Failed to save settings');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteLimit(id: string) {
    if (!confirm('Delete this limit?')) return;

    try {
      const res = await fetch(`/api/limits/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete limit');
      await loadLimits();
    } catch (err) {
      console.error('Failed to delete limit:', err);
      alert('Failed to delete limit');
    }
  }

  if (loading || !settings) {
    return <div style={{ color: C.text3, fontSize: 13 }}>Loading policies...</div>;
  }

  return (
    <div style={{ maxWidth: 720 }}>
      <h2 style={{ fontSize: 15, fontWeight: 600, color: C.text, marginBottom: 16 }}>Push Policies</h2>

      {/* Push Permissions */}
      <Card style={{ marginBottom: 16 }}>
        <div style={{ padding: '14px 20px', borderBottom: `1px solid ${C.border}` }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>Push Permissions</span>
        </div>
        <div style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 13, color: C.text, marginBottom: 4 }}>Allow operators to push records</div>
              <div style={{ fontSize: 11, color: C.text3 }}>
                When disabled, only admins can push enriched records to HubSpot
              </div>
            </div>
            <Toggle
              on={settings.allow_operator_push}
              onToggle={() =>
                setSettings({ ...settings, allow_operator_push: !settings.allow_operator_push })
              }
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 13, color: C.text, marginBottom: 4 }}>Enable external agencies</div>
              <div style={{ fontSize: 11, color: C.text3 }}>Allow external agency members to access workspace</div>
            </div>
            <Toggle
              on={settings.external_agencies_enabled}
              onToggle={() =>
                setSettings({ ...settings, external_agencies_enabled: !settings.external_agencies_enabled })
              }
            />
          </div>
        </div>
      </Card>

      {/* Duplicate Detection Policy */}
      <Card style={{ marginBottom: 16 }}>
        <div style={{ padding: '14px 20px', borderBottom: `1px solid ${C.border}` }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>Duplicate Detection</span>
        </div>
        <div style={{ padding: '16px 20px' }}>
          <div style={{ fontSize: 13, color: C.text, marginBottom: 12 }}>When duplicate detected:</div>

          <label style={{ display: 'flex', alignItems: 'center', marginBottom: 10, cursor: 'pointer' }}>
            <input
              type="radio"
              checked={settings.duplicate_push_policy === 'block'}
              onChange={() => setSettings({ ...settings, duplicate_push_policy: 'block' })}
              style={{ marginRight: 10 }}
            />
            <div>
              <div style={{ fontSize: 13, color: C.text }}>Block push</div>
              <div style={{ fontSize: 11, color: C.text3 }}>Return error and show existing record</div>
            </div>
          </label>

          <label style={{ display: 'flex', alignItems: 'center', marginBottom: 10, cursor: 'pointer' }}>
            <input
              type="radio"
              checked={settings.duplicate_push_policy === 'quarantine'}
              onChange={() => setSettings({ ...settings, duplicate_push_policy: 'quarantine' })}
              style={{ marginRight: 10 }}
            />
            <div>
              <div style={{ fontSize: 13, color: C.text }}>Quarantine for review</div>
              <div style={{ fontSize: 11, color: C.text3 }}>Queue for admin approval</div>
            </div>
          </label>

          <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
            <input
              type="radio"
              checked={settings.duplicate_push_policy === 'allow'}
              onChange={() => setSettings({ ...settings, duplicate_push_policy: 'allow' })}
              style={{ marginRight: 10 }}
            />
            <div>
              <div style={{ fontSize: 13, color: C.text }}>Allow push with warning</div>
              <div style={{ fontSize: 11, color: C.text3 }}>Push anyway but show warning message</div>
            </div>
          </label>
        </div>
      </Card>

      {/* Data Write Behavior */}
      <Card style={{ marginBottom: 16 }}>
        <div style={{ padding: '14px 20px', borderBottom: `1px solid ${C.border}` }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>Data Write Behavior</span>
        </div>
        <div style={{ padding: '16px 20px' }}>
          <div style={{ fontSize: 13, color: C.text, marginBottom: 12 }}>When pushing enriched data to HubSpot:</div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ width: 180, fontSize: 12, fontWeight: 500, color: C.text3, paddingTop: 2 }}>
                Always overwrite
              </div>
              <div style={{ flex: 1, fontSize: 12, color: C.text3 }}>
                Fields like <code style={{ fontFamily: F.mono, background: C.surface, padding: '2px 6px', borderRadius: 3 }}>apollo_industry</code> always replace HubSpot values
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ width: 180, fontSize: 12, fontWeight: 500, color: C.text3, paddingTop: 2 }}>
                Overwrite if blank/ours
              </div>
              <div style={{ flex: 1, fontSize: 12, color: C.text3 }}>
                Fields like <code style={{ fontFamily: F.mono, background: C.surface, padding: '2px 6px', borderRadius: 3 }}>numberofemployees</code> update only if HubSpot has no value or last source was Refyne
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ width: 180, fontSize: 12, fontWeight: 500, color: C.text3, paddingTop: 2 }}>
                Never overwrite
              </div>
              <div style={{ flex: 1, fontSize: 12, color: C.text3 }}>
                Fields like <code style={{ fontFamily: F.mono, background: C.surface, padding: '2px 6px', borderRadius: 3 }}>domain</code> never overwrite existing values
              </div>
            </div>
          </div>

          <div style={{ marginTop: 16, padding: 12, background: C.indigoDim, borderRadius: 6, border: `1px solid ${C.indigoBrd}` }}>
            <div style={{ fontSize: 12, color: C.text, marginBottom: 4, fontWeight: 500 }}>
              Custom field policies
            </div>
            <div style={{ fontSize: 11, color: C.text3, lineHeight: 1.5 }}>
              Configure write policies per-field in <a href="/field-mappings" style={{ color: C.indigo, textDecoration: 'none' }}>Field Mappings →</a>
            </div>
          </div>
        </div>
      </Card>

      {/* Prospecting Limits */}
      <Card style={{ marginBottom: 24 }}>
        <div style={{ padding: '14px 20px', borderBottom: `1px solid ${C.border}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>Prospecting Limits</span>
            <button
              onClick={() => setShowAddLimit(!showAddLimit)}
              style={{
                background: 'none',
                border: 'none',
                fontSize: 12,
                color: C.indigo,
                cursor: 'pointer',
              }}
            >
              + Add Limit
            </button>
          </div>
        </div>
        <div style={{ padding: '16px 20px' }}>
          {limits.length === 0 ? (
            <div style={{ fontSize: 13, color: C.text3, textAlign: 'center', padding: 20 }}>
              No limits configured. All users have unlimited prospecting.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {limits.map((limit) => (
                <div
                  key={limit.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: 12,
                    background: C.surface,
                    borderRadius: 6,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 13, color: C.text, fontWeight: 500 }}>
                      {limit.applies_to.startsWith('role:')
                        ? limit.applies_to.replace('role:', '').replace('org:', '')
                        : limit.applies_to.replace('user:', 'User: ')}
                    </div>
                    <div style={{ fontSize: 12, color: C.text3 }}>
                      {limit.credits_per_period} records per {limit.period}
                    </div>
                  </div>
                  <GhostBtn onClick={() => handleDeleteLimit(limit.id)}>Remove</GhostBtn>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      <div style={{ display: 'flex', gap: 10 }}>
        <PrimaryBtn onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save Changes'}
        </PrimaryBtn>
        <GhostBtn onClick={loadSettings}>Cancel</GhostBtn>
      </div>
    </div>
  );
}
