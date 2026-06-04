'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, Trash2 } from 'lucide-react';
import { C, F } from '@/lib/design-tokens';
import { Card, StatCard, Toggle, PrimaryBtn, GhostBtn, Chip } from '@/components/refyne';
import { ReferenceDataTable } from '@/components/harmonies/ReferenceDataTable';
import { SuggestionQueue } from '@/components/harmonies/SuggestionQueue';

interface HarmonyConfig {
  id: string;
  name: string;
  description: string | null;
  transformType: 'lookup' | 'format';
  transformFunction: string | null;
  referenceTable: string | null;
  objectType: 'company' | 'contact';
  isActive: boolean;
  isPreset: boolean;
  isArchived: boolean;
  writePolicy: 'always_overwrite' | 'fill_empty' | 'never_overwrite';
  fieldAssignments: Array<{
    canonicalField: string;
    hubspotProperty: string;
  }>;
}

interface HarmonyStats {
  recordsProcessed: number;
  changesApplied: number;
  skipped: number;
  changeRate: number;
  lastRunAt: string | null;
}

interface HarmonyChange {
  recordId: string;
  recordName: string;
  field: string;
  previousValue: string;
  newValue: string;
  writtenAt: string;
}

interface HarmonyReference {
  data: Array<{
    id: string;
    inputValue: string;
    canonicalValue: string;
    source: string;
    isActive: boolean;
  }>;
  total: number;
  page: number;
  hasMore: boolean;
}

export default function HarmonyDetailPage() {
  const params = useParams();
  const router = useRouter();
  const harmonyId = params.id as string;

  // State
  const [config, setConfig] = useState<HarmonyConfig | null>(null);
  const [stats, setStats] = useState<HarmonyStats | null>(null);
  const [changes, setChanges] = useState<HarmonyChange[]>([]);
  const [reference, setReference] = useState<HarmonyReference | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState('');
  const [showArchiveModal, setShowArchiveModal] = useState(false);

  // Form state
  const [editedName, setEditedName] = useState('');
  const [editedDescription, setEditedDescription] = useState('');
  const [editedWritePolicy, setEditedWritePolicy] = useState<'always_overwrite' | 'fill_empty' | 'never_overwrite'>('fill_empty');

  // Test state
  const [testInput, setTestInput] = useState('');
  const [testOutput, setTestOutput] = useState<{
    matched: boolean;
    output: string | null;
    matchType?: 'exact' | 'fuzzy' | 'phonetic' | 'none';
    confidence?: number;
    explanation: string;
  } | null>(null);
  const [testing, setTesting] = useState(false);

  // Load data on mount
  useEffect(() => {
    fetchConfig();
    fetchStats();
    fetchChanges();
  }, [harmonyId]);

  // Update reference data when config loads
  useEffect(() => {
    if (config?.transformType === 'lookup' && config?.referenceTable) {
      fetchReference();
    }
  }, [config?.transformType, config?.referenceTable]);

  // Debounced test
  useEffect(() => {
    if (!testInput) {
      setTestOutput(null);
      return;
    }

    setTesting(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/harmonies/${harmonyId}/test`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ input: testInput }),
        });

        if (res.ok) {
          const data = await res.json();
          setTestOutput(data);
        }
      } catch (err) {
        console.error('Test failed:', err);
      } finally {
        setTesting(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [testInput, harmonyId]);

  async function fetchConfig() {
    try {
      setLoading(true);
      const res = await fetch(`/api/harmonies/${harmonyId}`);
      if (res.ok) {
        const data = await res.json();
        setConfig(data);
        setEditedName(data.name);
        setEditedDescription(data.description || '');
        setEditedWritePolicy(data.writePolicy || 'fill_empty');
      } else {
        console.error('Failed to fetch config');
      }
    } catch (err) {
      console.error('Failed to fetch config:', err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchStats() {
    try {
      const res = await fetch(`/api/harmonies/${harmonyId}/stats`);
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  }

  async function fetchChanges() {
    try {
      const res = await fetch(`/api/harmonies/${harmonyId}/changes`);
      if (res.ok) {
        const data = await res.json();
        setChanges(data.changes || []);
      }
    } catch (err) {
      console.error('Failed to fetch changes:', err);
    }
  }

  async function fetchReference(page = 1, search = '') {
    try {
      const res = await fetch(`/api/harmonies/${harmonyId}/reference?page=${page}&search=${search}`);
      if (res.ok) {
        const data = await res.json();
        setReference(data);
      }
    } catch (err) {
      console.error('Failed to fetch reference:', err);
    }
  }

  async function handleToggleActive() {
    if (!config) return;

    const wasActive = config.isActive;

    // Show confirmation if deactivating
    if (wasActive) {
      if (!confirm('Deactivate this harmony? It will stop applying transformations.')) {
        return;
      }
    }

    // Optimistic update
    setToggling(true);
    setConfig({ ...config, isActive: !wasActive });

    try {
      const res = await fetch(`/api/harmonies/${harmonyId}/toggle`, {
        method: 'POST',
      });

      if (!res.ok) {
        // Revert on error
        setConfig({ ...config, isActive: wasActive });
        console.error('Failed to toggle active');
      }
    } catch (err) {
      // Revert on error
      setConfig({ ...config, isActive: wasActive });
      console.error('Failed to toggle active:', err);
    } finally {
      setToggling(false);
    }
  }

  async function handleSaveSettings() {
    if (!config) return;

    setSaving(true);

    try {
      const res = await fetch(`/api/harmonies/${harmonyId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editedName,
          description: editedDescription,
          writePolicy: editedWritePolicy,
        }),
      });

      if (res.ok) {
        // Update local state
        setConfig({
          ...config,
          name: editedName,
          description: editedDescription,
          writePolicy: editedWritePolicy,
        });
      } else {
        console.error('Failed to save settings');
        alert('Failed to save settings');
      }
    } catch (err) {
      console.error('Failed to save settings:', err);
      alert('Failed to save settings');
    } finally {
      setSaving(false);
    }
  }

  function handleArchive() {
    setShowArchiveModal(true);
  }

  async function confirmArchive() {
    if (!config) return;

    setShowArchiveModal(false);
    setArchiving(true);

    try {
      const res = await fetch(`/api/harmonies/${harmonyId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isArchived: true,
          isActive: false, // Also deactivate when archiving
        }),
      });

      if (res.ok) {
        // Redirect back to harmonies list
        router.push('/harmonies');
      } else {
        console.error('Failed to archive harmony');
        alert('Failed to archive harmony');
      }
    } catch (err) {
      console.error('Failed to archive harmony:', err);
      alert('Failed to archive harmony');
    } finally {
      setArchiving(false);
    }
  }

  async function handleDelete() {
    if (!config) return;

    setDeleting(true);

    try {
      const res = await fetch(`/api/harmonies/${harmonyId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        // Redirect back to harmonies list
        router.push('/harmonies');
      } else {
        const error = await res.json();
        console.error('Failed to delete harmony:', error);
        alert(error.error || 'Failed to delete harmony');
      }
    } catch (err) {
      console.error('Failed to delete harmony:', err);
      alert('Failed to delete harmony');
    } finally {
      setDeleting(false);
      setDeleteConfirmName('');
    }
  }

  function formatRelativeTime(timestamp: string | null): string {
    if (!timestamp) return 'Never';

    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 30) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  }

  if (loading) {
    return (
      <div style={{ padding: '28px 32px', fontFamily: F.sans }}>
        <div style={{ fontSize: 13, color: C.text3 }}>Loading...</div>
      </div>
    );
  }

  if (!config) {
    return (
      <div style={{ padding: '28px 32px', fontFamily: F.sans }}>
        <div style={{ fontSize: 13, color: C.text3 }}>Harmony not found</div>
      </div>
    );
  }

  const hitRate = stats ? Math.round(stats.changeRate * 100) : 0;

  return (
    <div style={{ padding: '28px 32px', fontFamily: F.sans }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <button
          onClick={() => router.push('/harmonies')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 12,
            color: C.text2,
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            marginBottom: 12,
          }}
        >
          <ArrowLeft size={14} />
          Back to Harmonies
        </button>

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
              <h1 style={{ fontSize: 24, fontWeight: 600, color: C.text, margin: 0 }}>
                {config.name}
              </h1>
              <Chip color={config.isActive ? 'green' : 'amber'}>
                {config.isActive ? 'Active' : 'Inactive'}
              </Chip>
            </div>
            {config.description && (
              <p style={{ fontSize: 13, color: C.text3, margin: 0 }}>
                {config.description}
              </p>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 12, color: C.text3 }}>
              {config.isActive ? 'Active' : 'Inactive'}
            </span>
            <Toggle on={config.isActive} onToggle={handleToggleActive} disabled={toggling} />
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
        <StatCard
          label="Records Processed"
          value={stats?.recordsProcessed.toLocaleString() || '0'}
          sub="Last 30 days"
        />
        <StatCard
          label="Changes Applied"
          value={stats?.changesApplied.toLocaleString() || '0'}
          sub={`${stats?.skipped || 0} skipped`}
        />
        <StatCard
          label="Hit Rate"
          value={`${hitRate}%`}
          accent={hitRate >= 90 ? C.green : hitRate >= 70 ? C.amber : C.red}
          sub="Changes / Processed"
        />
        <StatCard
          label="Last Run"
          value={formatRelativeTime(stats?.lastRunAt || null)}
          sub={stats?.lastRunAt ? new Date(stats.lastRunAt).toLocaleString() : ''}
        />
      </div>

      {/* How it works */}
      <Card style={{ marginBottom: 24 }}>
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.border}` }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, color: C.text, margin: 0 }}>
            How it works
          </h2>
        </div>
        <div style={{ padding: '16px 20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20 }}>
            <div>
              <div style={{ fontSize: 11, color: C.text3, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Transform Type
              </div>
              <div style={{ fontSize: 13, color: C.text, fontFamily: F.mono }}>
                {config.transformType === 'lookup' ? 'Lookup Table' : 'Format Function'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: C.text3, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Target Field
              </div>
              <div style={{ fontSize: 13, color: C.text, fontFamily: F.mono }}>
                {config.fieldAssignments[0]?.hubspotProperty || 'None'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: C.text3, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Object Type
              </div>
              <div style={{ fontSize: 13, color: C.text, textTransform: 'capitalize' }}>
                {config.objectType}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: C.text3, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Write Policy
              </div>
              <div style={{ fontSize: 13, color: C.text }}>
                {config.writePolicy === 'always_overwrite' ? 'Always Overwrite' :
                 config.writePolicy === 'fill_empty' ? 'Fill Empty' :
                 'Never Overwrite'}
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Live Tester */}
      <Card style={{ marginBottom: 24 }}>
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.border}` }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, color: C.text, margin: 0 }}>
            Live Tester
          </h2>
        </div>
        <div style={{ padding: '16px 20px' }}>
          <div style={{ fontSize: 11, color: C.text3, marginBottom: 8 }}>Try a value:</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <input
              type="text"
              value={testInput}
              onChange={(e) => setTestInput(e.target.value)}
              placeholder="Type to test transformation..."
              style={{
                flex: 1,
                padding: '8px 12px',
                fontSize: 13,
                fontFamily: F.mono,
                background: C.surface,
                border: `1px solid ${C.border}`,
                color: C.text,
              }}
            />
            <span style={{ fontSize: 13, color: C.text3 }}>→</span>
            <div style={{ flex: 1, padding: '8px 12px', fontSize: 13, fontFamily: F.mono, minHeight: 36 }}>
              {testing ? (
                <span style={{ color: C.text3 }}>...</span>
              ) : testOutput ? (
                testOutput.matched ? (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ color: C.green }}>{testOutput.output} ✓</span>
                      {testOutput.matchType === 'exact' && (
                        <span style={{ fontSize: 10, color: C.green }}>exact</span>
                      )}
                      {testOutput.matchType === 'fuzzy' && (
                        <span style={{ fontSize: 10, color: C.amber }}>fuzzy {testOutput.confidence}%</span>
                      )}
                      {testOutput.matchType === 'phonetic' && (
                        <span style={{ fontSize: 10, color: '#f97316' }}>phonetic {testOutput.confidence}%</span>
                      )}
                    </div>
                    <div style={{ fontSize: 10, color: C.text3, marginTop: 2 }}>
                      {testOutput.explanation}
                    </div>
                  </div>
                ) : (
                  <div>
                    <span style={{ color: C.amber }}>No match ⚠</span>
                    <div style={{ fontSize: 10, color: C.text3, marginTop: 4 }}>
                      {testOutput.explanation || 'Would appear as unmatched in compliance score'}
                    </div>
                  </div>
                )
              ) : (
                <span style={{ color: C.text3 }}>Type to see output</span>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Recent Changes */}
      {changes.length > 0 && (
        <Card style={{ marginBottom: 24 }}>
          <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.border}` }}>
            <h2 style={{ fontSize: 14, fontWeight: 600, color: C.text, margin: 0 }}>
              Recent Changes
            </h2>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                  <th style={{ padding: '10px 20px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: C.text3, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Record
                  </th>
                  <th style={{ padding: '10px 20px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: C.text3, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Previous Value
                  </th>
                  <th style={{ padding: '10px 20px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: C.text3, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    New Value
                  </th>
                  <th style={{ padding: '10px 20px', textAlign: 'right', fontSize: 11, fontWeight: 600, color: C.text3, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    When
                  </th>
                </tr>
              </thead>
              <tbody>
                {changes.map((change, i) => (
                  <tr key={i} style={{ borderBottom: `1px solid ${C.border}` }}>
                    <td style={{ padding: '10px 20px', fontSize: 13, color: C.text }}>
                      {change.recordName}
                    </td>
                    <td style={{ padding: '10px 20px', fontSize: 13, fontFamily: F.mono, color: C.text3 }}>
                      {change.previousValue || '(empty)'}
                    </td>
                    <td style={{ padding: '10px 20px', fontSize: 13, fontFamily: F.mono, color: C.green }}>
                      {change.newValue}
                    </td>
                    <td style={{ padding: '10px 20px', fontSize: 12, color: C.text3, textAlign: 'right' }}>
                      {formatRelativeTime(change.writtenAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* AI Suggestions (lookup only) */}
      {config.transformType === 'lookup' && (
        <Card style={{ marginBottom: 24 }}>
          <SuggestionQueue harmonyId={harmonyId} />
        </Card>
      )}

      {/* Reference Data (lookup only) */}
      {config.transformType === 'lookup' && config.referenceTable && (
        <Card style={{ marginBottom: 24 }}>
          <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.border}` }}>
            <h2 style={{ fontSize: 14, fontWeight: 600, color: C.text, margin: 0 }}>
              Reference Data
            </h2>
          </div>
          <ReferenceDataTable harmonyId={harmonyId} tableName={config.referenceTable} />
        </Card>
      )}

      {/* Settings */}
      <Card>
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.border}` }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, color: C.text, margin: 0 }}>
            Settings
          </h2>
        </div>
        <div style={{ padding: '20px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 600 }}>
            {/* Name */}
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: C.text, marginBottom: 6 }}>
                Name
              </label>
              <input
                type="text"
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  fontSize: 13,
                  background: C.surface,
                  border: `1px solid ${C.border}`,
                  color: C.text,
                }}
              />
            </div>

            {/* Description */}
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: C.text, marginBottom: 6 }}>
                Description
              </label>
              <textarea
                value={editedDescription}
                onChange={(e) => setEditedDescription(e.target.value)}
                rows={3}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  fontSize: 13,
                  background: C.surface,
                  border: `1px solid ${C.border}`,
                  color: C.text,
                  resize: 'vertical',
                }}
              />
            </div>

            {/* Write Policy */}
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: C.text, marginBottom: 6 }}>
                Write Policy
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  { value: 'fill_empty', label: 'Fill Empty', desc: 'Only write if the field is empty' },
                  { value: 'always_overwrite', label: 'Always Overwrite', desc: 'Always write, even if the field has a value' },
                  { value: 'never_overwrite', label: 'Never Overwrite', desc: 'Never write if the field has any value' },
                ].map((policy) => (
                  <label
                    key={policy.value}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 10,
                      padding: '12px 14px',
                      background: editedWritePolicy === policy.value ? C.indigoDim : C.surface,
                      border: `1px solid ${editedWritePolicy === policy.value ? C.indigoBrd : C.border}`,
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="radio"
                      value={policy.value}
                      checked={editedWritePolicy === policy.value}
                      onChange={(e) => setEditedWritePolicy(e.target.value as any)}
                      style={{ marginTop: 2, cursor: 'pointer' }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: editedWritePolicy === policy.value ? C.indigo : C.text, marginBottom: 2 }}>
                        {policy.label}
                      </div>
                      <div style={{ fontSize: 11, color: C.text3 }}>
                        {policy.desc}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 10, paddingTop: 10 }}>
              <PrimaryBtn onClick={handleSaveSettings} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 size={14} className="preview-spinner" />
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </PrimaryBtn>
              <GhostBtn onClick={fetchConfig}>
                Cancel
              </GhostBtn>
            </div>

            {/* Archive/Delete Actions (Custom Harmonies Only) */}
            {!config.isPreset && (
              <>
                <div style={{
                  marginTop: 32,
                  paddingTop: 32,
                  borderTop: `1px solid ${C.border}`,
                }}>
                  <h4 style={{ fontSize: 13, fontWeight: 600, color: C.red, marginBottom: 12 }}>
                    Danger Zone
                  </h4>

                  {!config.isArchived ? (
                    <div>
                      <div style={{ fontSize: 12, color: C.text3, marginBottom: 12 }}>
                        Archive this harmony to hide it from the harmonies list. You can unarchive it later.
                      </div>
                      <button
                        onClick={handleArchive}
                        disabled={archiving}
                        style={{
                          padding: '8px 16px',
                          fontSize: 13,
                          fontWeight: 500,
                          color: C.red,
                          background: 'transparent',
                          border: `1px solid ${C.redBrd}`,
                          cursor: archiving ? 'not-allowed' : 'pointer',
                          opacity: archiving ? 0.5 : 1,
                        }}
                      >
                        {archiving ? 'Archiving...' : 'Archive Harmony'}
                      </button>
                    </div>
                  ) : (
                    <div>
                      <div style={{ fontSize: 12, color: C.text3, marginBottom: 12 }}>
                        Permanently delete this harmony and all its reference data. This cannot be undone.
                      </div>
                      <div style={{ fontSize: 11, color: C.text3, marginBottom: 8 }}>
                        Type <strong>{config.name}</strong> to confirm:
                      </div>
                      <input
                        type="text"
                        value={deleteConfirmName}
                        onChange={(e) => setDeleteConfirmName(e.target.value)}
                        placeholder={config.name}
                        style={{
                          width: '100%',
                          maxWidth: 400,
                          padding: '8px 12px',
                          fontSize: 13,
                          background: C.surface,
                          border: `1px solid ${C.border}`,
                          color: C.text,
                          marginBottom: 12,
                        }}
                      />
                      <button
                        onClick={handleDelete}
                        disabled={deleting || deleteConfirmName !== config.name}
                        style={{
                          padding: '8px 16px',
                          fontSize: 13,
                          fontWeight: 500,
                          color: '#fff',
                          background: deleteConfirmName === config.name ? C.red : C.hover,
                          border: 'none',
                          cursor: deleting || deleteConfirmName !== config.name ? 'not-allowed' : 'pointer',
                          opacity: deleting || deleteConfirmName !== config.name ? 0.5 : 1,
                        }}
                      >
                        {deleting ? (
                          <>
                            <Loader2 size={14} className="preview-spinner" style={{ marginRight: 8 }} />
                            Deleting...
                          </>
                        ) : (
                          <>
                            <Trash2 size={14} style={{ marginRight: 8, display: 'inline-block', verticalAlign: 'middle' }} />
                            Delete Permanently
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </Card>

      {/* Archive Confirmation Modal */}
      {showArchiveModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setShowArchiveModal(false)}
        >
          <div
            style={{
              background: C.surface,
              border: `1px solid ${C.border}`,
              borderRadius: 8,
              padding: 24,
              maxWidth: 480,
              width: '90%',
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{
              fontSize: 16,
              fontWeight: 600,
              color: C.text,
              marginBottom: 12,
              fontFamily: F.sans,
            }}>
              Archive this harmony?
            </h3>
            <p style={{
              fontSize: 14,
              color: C.text2,
              marginBottom: 24,
              lineHeight: 1.5,
              fontFamily: F.sans,
            }}>
              It will be hidden from the harmonies list but can be recovered.
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowArchiveModal(false)}
                style={{
                  padding: '8px 16px',
                  fontSize: 14,
                  fontWeight: 500,
                  background: C.surface,
                  border: `1px solid ${C.border}`,
                  borderRadius: 6,
                  color: C.text,
                  cursor: 'pointer',
                  fontFamily: F.sans,
                }}
              >
                Cancel
              </button>
              <button
                onClick={confirmArchive}
                disabled={archiving}
                style={{
                  padding: '8px 16px',
                  fontSize: 14,
                  fontWeight: 500,
                  background: C.indigo,
                  border: 'none',
                  borderRadius: 6,
                  color: '#fff',
                  cursor: archiving ? 'not-allowed' : 'pointer',
                  opacity: archiving ? 0.5 : 1,
                  fontFamily: F.sans,
                }}
              >
                {archiving ? 'Archiving...' : 'OK'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
