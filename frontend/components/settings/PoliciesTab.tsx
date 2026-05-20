'use client';

import { useState, useEffect } from 'react';
import { C, F } from '@/lib/design-tokens';
import { Card, PrimaryBtn } from '@/components/refyne';

interface OrgPolicies {
  write_policy_default: 'fill_empty' | 'overwrite' | 'per_field';
  dedup_auto_merge_threshold: number | null;
  dedup_merge_survivor_rule: 'most_recent' | 'most_complete' | 'oldest';
  quarantine_threshold: number;
  nightly_scan_enabled: boolean;
  incremental_scan_enabled: boolean;
}

export function PoliciesTab() {
  const [policies, setPolicies] = useState<OrgPolicies>({
    write_policy_default: 'fill_empty',
    dedup_auto_merge_threshold: null,
    dedup_merge_survivor_rule: 'most_recent',
    quarantine_threshold: 40,
    nightly_scan_enabled: true,
    incremental_scan_enabled: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadPolicies();
  }, []);

  async function loadPolicies() {
    try {
      const res = await fetch('/api/org/policies');
      if (res.ok) {
        const data = await res.json();
        setPolicies(data.policies);
      }
    } catch (err) {
      console.error('Failed to load policies:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch('/api/org/policies', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(policies),
      });

      if (res.ok) {
        showToast('Policies saved', 'success');
        await loadPolicies();
      } else {
        showToast('Failed to save policies', 'error');
      }
    } catch (err) {
      showToast('Failed to save policies', 'error');
    } finally {
      setSaving(false);
    }
  }

  function showToast(message: string, type: 'success' | 'error') {
    const toast = document.createElement('div');
    toast.style.cssText = `
      position: fixed; bottom: 24px; right: 24px; padding: 12px 20px;
      background: ${type === 'success' ? C.greenDim : C.redDim};
      border: 1px solid ${type === 'success' ? C.greenBrd : C.redBrd};
      color: ${type === 'success' ? C.green : C.red};
      border-radius: 8px; font-size: 14px; z-index: 10000;
      font-family: ${F.sans};
    `;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  }

  if (loading) {
    return <div style={{ padding: 20, color: C.text3 }}>Loading policies...</div>;
  }

  return (
    <div style={{ maxWidth: 720 }}>
      {/* Enrichment Policy */}
      <Card style={{ marginBottom: 24 }}>
        <div style={{ padding: 20, borderBottom: `1px solid ${C.border}` }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 4 }}>
            Enrichment policy
          </h3>
          <p style={{ fontSize: 12, color: C.text3 }}>
            When enriching a record that already has a value:
          </p>
        </div>
        <div style={{ padding: 20 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              { value: 'fill_empty', label: 'Fill empty only', sub: 'never overwrite existing values' },
              { value: 'overwrite', label: 'Overwrite', sub: 'always use the provider value' },
              { value: 'per_field', label: 'Per field', sub: "respect each arrangement's field config" },
            ].map((opt) => (
              <label key={opt.value} style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
                <input
                  type="radio"
                  checked={policies.write_policy_default === opt.value}
                  onChange={() => setPolicies({ ...policies, write_policy_default: opt.value as any })}
                  style={{ cursor: 'pointer' }}
                />
                <div>
                  <div style={{ fontSize: 13, color: C.text }}>{opt.label}</div>
                  <div style={{ fontSize: 11, color: C.text3 }}>{opt.sub}</div>
                </div>
              </label>
            ))}
          </div>
        </div>
      </Card>

      {/* Dedup Policy */}
      <Card style={{ marginBottom: 24 }}>
        <div style={{ padding: 20, borderBottom: `1px solid ${C.border}` }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 4 }}>
            Dedup policy
          </h3>
        </div>
        <div style={{ padding: 20 }}>
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: C.text, marginBottom: 12 }}>
              Auto-merge threshold
            </div>
            {[
              { value: null, label: 'Never auto-merge', sub: 'always require manual review' },
              { value: 90, label: 'High confidence only', sub: '(90%+)' },
              { value: 75, label: 'Medium and above', sub: '(75%+)' },
            ].map((opt) => (
              <label key={String(opt.value)} style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', marginBottom: 8 }}>
                <input
                  type="radio"
                  checked={policies.dedup_auto_merge_threshold === opt.value}
                  onChange={() => setPolicies({ ...policies, dedup_auto_merge_threshold: opt.value })}
                  style={{ cursor: 'pointer' }}
                />
                <div>
                  <span style={{ fontSize: 13, color: C.text }}>{opt.label}</span>
                  <span style={{ fontSize: 11, color: C.text3, marginLeft: 8 }}>{opt.sub}</span>
                </div>
              </label>
            ))}
          </div>

          <div>
            <div style={{ fontSize: 13, fontWeight: 500, color: C.text, marginBottom: 12 }}>
              Merge survivor rule
            </div>
            {[
              { value: 'most_recent', label: 'Most recently updated' },
              { value: 'most_complete', label: 'Most complete', sub: '(fewest empty fields)' },
              { value: 'oldest', label: 'Oldest record', sub: '(original source of truth)' },
            ].map((opt) => (
              <label key={opt.value} style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', marginBottom: 8 }}>
                <input
                  type="radio"
                  checked={policies.dedup_merge_survivor_rule === opt.value}
                  onChange={() => setPolicies({ ...policies, dedup_merge_survivor_rule: opt.value as any })}
                  style={{ cursor: 'pointer' }}
                />
                <div>
                  <span style={{ fontSize: 13, color: C.text }}>{opt.label}</span>
                  {opt.sub && <span style={{ fontSize: 11, color: C.text3, marginLeft: 8 }}>{opt.sub}</span>}
                </div>
              </label>
            ))}
          </div>
        </div>
      </Card>

      {/* Quarantine Policy */}
      <Card style={{ marginBottom: 24 }}>
        <div style={{ padding: 20, borderBottom: `1px solid ${C.border}` }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 4 }}>
            Quarantine policy
          </h3>
        </div>
        <div style={{ padding: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: C.text, marginBottom: 8 }}>
            Auto-quarantine threshold
          </div>
          <div style={{ fontSize: 12, color: C.text3, marginBottom: 16 }}>
            Records with a compliance score below this level are automatically flagged for review.
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 12, color: C.text3 }}>Threshold</span>
            <input
              type="number"
              min="0"
              max="100"
              value={policies.quarantine_threshold}
              onChange={(e) => setPolicies({ ...policies, quarantine_threshold: parseInt(e.target.value) || 40 })}
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
            <span style={{ fontSize: 12, color: C.text3 }}>(0-100, default 40)</span>
          </div>
        </div>
      </Card>

      {/* Scan Policy */}
      <Card style={{ marginBottom: 24 }}>
        <div style={{ padding: 20, borderBottom: `1px solid ${C.border}` }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 4 }}>
            Scan policy
          </h3>
        </div>
        <div style={{ padding: 20 }}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: C.text, marginBottom: 8 }}>
              Nightly scan
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
                <input
                  type="radio"
                  checked={policies.nightly_scan_enabled}
                  onChange={() => setPolicies({ ...policies, nightly_scan_enabled: true })}
                  style={{ cursor: 'pointer' }}
                />
                <div>
                  <span style={{ fontSize: 13, color: C.text }}>Enabled</span>
                  <span style={{ fontSize: 11, color: C.text3, marginLeft: 8 }}>Runs daily at 06:00 UTC</span>
                </div>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
                <input
                  type="radio"
                  checked={!policies.nightly_scan_enabled}
                  onChange={() => setPolicies({ ...policies, nightly_scan_enabled: false })}
                  style={{ cursor: 'pointer' }}
                />
                <span style={{ fontSize: 13, color: C.text }}>Disabled</span>
              </label>
            </div>
          </div>

          <div>
            <div style={{ fontSize: 13, fontWeight: 500, color: C.text, marginBottom: 8 }}>
              Incremental scan
            </div>
            <div style={{ fontSize: 12, color: C.text3, marginBottom: 12 }}>
              Only scan records modified since the last scan. Disable to force a full scan on the next run.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
                <input
                  type="radio"
                  checked={policies.incremental_scan_enabled}
                  onChange={() => setPolicies({ ...policies, incremental_scan_enabled: true })}
                  style={{ cursor: 'pointer' }}
                />
                <span style={{ fontSize: 13, color: C.text }}>Enabled</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
                <input
                  type="radio"
                  checked={!policies.incremental_scan_enabled}
                  onChange={() => setPolicies({ ...policies, incremental_scan_enabled: false })}
                  style={{ cursor: 'pointer' }}
                />
                <span style={{ fontSize: 13, color: C.text }}>Disabled</span>
              </label>
            </div>
          </div>
        </div>
      </Card>

      {/* Save Button */}
      <PrimaryBtn onClick={handleSave} disabled={saving}>
        {saving ? 'Saving...' : 'Save policies'}
      </PrimaryBtn>
    </div>
  );
}
