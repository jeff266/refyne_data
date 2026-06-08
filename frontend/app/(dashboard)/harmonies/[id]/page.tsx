'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, Trash2, XCircle, CheckCircle } from 'lucide-react';
import { C, F } from '@/lib/design-tokens';
import { Card, StatCard, Toggle, PrimaryBtn, GhostBtn, Chip } from '@/components/refyne';
import { ReferenceDataTable } from '@/components/harmonies/ReferenceDataTable';
import { SuggestionQueue } from '@/components/harmonies/SuggestionQueue';
import { ConditionBuilder } from '@/components/harmonies/ConditionBuilder';
import {
  evaluateConditionGroups,
  getConditionFields,
  countConditions,
  type ConditionGroups,
} from '@/lib/harmonies/condition-evaluator';
import type { HubSpotProperty } from '@/lib/harmonies/enum-validator';

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
  conditionGroups?: ConditionGroups | null;
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
  status?: 'written' | 'failed' | 'skipped';
  errorMessage?: string | null;
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
  const [targetFieldProperty, setTargetFieldProperty] = useState<HubSpotProperty | null>(null);
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

  // Conditions state
  const [editingConditions, setEditingConditions] = useState(false);
  const [editedConditionGroups, setEditedConditionGroups] = useState<ConditionGroups | null>(null);

  // Test state
  const [testInput, setTestInput] = useState('');
  const [conditionFieldValues, setConditionFieldValues] = useState<Record<string, string>>({});
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

  // Fetch target field property for enum validation
  useEffect(() => {
    if (config) {
      fetchTargetFieldProperty();
    }
  }, [config]);

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

  async function fetchTargetFieldProperty() {
    if (!config) return;

    const targetField = config.fieldAssignments[0]?.hubspotProperty;
    if (!targetField) return;

    try {
      const res = await fetch(`/api/hubspot/properties?objectType=${config.objectType}`);
      if (res.ok) {
        const data = await res.json();
        // Find the target field in the properties list
        const allProperties = [...(data.properties?.standard || []), ...(data.properties?.custom || [])];
        const property = allProperties.find((p: HubSpotProperty) => p.name === targetField);
        if (property) {
          setTargetFieldProperty(property);
        }
      }
    } catch (err) {
      console.error('Failed to fetch target field property:', err);
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

  async function handleSaveConditions() {
    if (!config) return;

    try {
      setSaving(true);
      const res = await fetch(`/api/harmonies/${config.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conditionGroups: editedConditionGroups,
        }),
      });

      if (res.ok) {
        setConfig({
          ...config,
          conditionGroups: editedConditionGroups,
        });
        setEditingConditions(false);
      } else {
        console.error('Failed to save conditions');
        alert('Failed to save conditions');
      }
    } catch (err) {
      console.error('Failed to save conditions:', err);
      alert('Failed to save conditions');
    } finally {
      setSaving(false);
    }
  }

  async function handleClearConditions() {
    if (!config) return;
    if (!confirm('Remove all conditions? This harmony will run on all records.')) return;

    try {
      setSaving(true);
      const res = await fetch(`/api/harmonies/${config.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conditionGroups: null,
        }),
      });

      if (res.ok) {
        setConfig({
          ...config,
          conditionGroups: null,
        });
        setEditingConditions(false);
        setEditedConditionGroups(null);
      } else {
        console.error('Failed to clear conditions');
        alert('Failed to clear conditions');
      }
    } catch (err) {
      console.error('Failed to clear conditions:', err);
      alert('Failed to clear conditions');
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

  // Helper function to format operator display name
  function formatOperator(op: string): string {
    const operatorMap: Record<string, string> = {
      equals: '=',
      not_equals: '≠',
      contains: 'contains',
      not_contains: 'does not contain',
      starts_with: 'starts with',
      ends_with: 'ends with',
      is_empty: 'is empty',
      is_not_empty: 'is not empty',
      greater_than: '>',
      less_than: '<',
      greater_than_or_equal: '≥',
      less_than_or_equal: '≤',
      between: 'between',
      is_any_of: 'is any of',
      is_none_of: 'is none of',
      is_true: 'is true',
      is_false: 'is false',
      before: 'before',
      after: 'after',
      in_last_n_days: 'in last N days',
      not_in_last_n_days: 'not in last N days',
    };
    return operatorMap[op] || op;
  }

  // Helper function to format condition value for display
  function formatConditionValue(value: any, operator: string): string {
    // Operators with no value input
    if (['is_empty', 'is_not_empty', 'is_true', 'is_false'].includes(operator)) {
      return '';
    }

    // Handle null/undefined
    if (value === null || value === undefined) {
      return '';
    }

    // Handle between operator (object with from/to)
    if (operator === 'between' && typeof value === 'object' && 'from' in value && 'to' in value) {
      return `${value.from} to ${value.to}`;
    }

    // Handle is_any_of/is_none_of (arrays)
    if (Array.isArray(value)) {
      return value.join(', ');
    }

    // Handle in_last_n_days (number)
    if (operator === 'in_last_n_days' || operator === 'not_in_last_n_days') {
      return `${value} days`;
    }

    // Handle dates (convert ISO strings to readable format)
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
      try {
        const date = new Date(value);
        return date.toLocaleDateString();
      } catch {
        return value;
      }
    }

    // Default: return as string
    return String(value);
  }

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

      {/* CONDITIONS */}
      <div id="conditions">
        <Card style={{ marginBottom: 24 }}>
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 style={{ fontSize: 14, fontWeight: 600, color: C.text, margin: 0 }}>
              Conditions
            </h2>
            {config?.conditionGroups && !editingConditions && (
              <div style={{ display: 'flex', gap: 8 }}>
                <GhostBtn
                  onClick={() => {
                    setEditedConditionGroups(config.conditionGroups ?? null);
                    setEditingConditions(true);
                  }}
                  disabled={saving}
                >
                  Edit
                </GhostBtn>
                <GhostBtn onClick={handleClearConditions} disabled={saving}>
                  Clear
                </GhostBtn>
              </div>
            )}
          </div>
        </div>
        <div style={{ padding: '16px 20px' }}>
          {!config?.conditionGroups ? (
            <div>
              <div style={{ fontSize: 13, color: C.text3, marginBottom: 12 }}>
                Runs on all {config?.objectType || 'company'} records.
              </div>
              <GhostBtn
                onClick={() => {
                  setEditedConditionGroups({
                    match: 'all',
                    groups: [{
                      match: 'all',
                      conditions: [{
                        field: '',
                        fieldLabel: '',
                        fieldType: 'string',
                        operator: 'equals',
                        value: null,
                      }],
                    }],
                  });
                  setEditingConditions(true);
                }}
                disabled={saving}
              >
                + Add conditions
              </GhostBtn>
            </div>
          ) : editingConditions ? (
            <div>
              <ConditionBuilder
                value={editedConditionGroups}
                onChange={setEditedConditionGroups}
                objectType={config.objectType}
              />
              <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                <PrimaryBtn onClick={handleSaveConditions} disabled={saving}>
                  {saving ? <><Loader2 size={14} /> Saving...</> : 'Save'}
                </PrimaryBtn>
                <GhostBtn
                  onClick={() => {
                    setEditingConditions(false);
                    setEditedConditionGroups(config.conditionGroups ?? null);
                  }}
                  disabled={saving}
                >
                  Cancel
                </GhostBtn>
              </div>
            </div>
          ) : (
            <div style={{ fontSize: 13 }}>
              <div style={{ marginBottom: 12, color: C.text3 }}>
                Match <strong style={{ color: C.text, fontFamily: F.mono }}>
                  {config.conditionGroups.match.toUpperCase()}
                </strong> of:
              </div>
              {config.conditionGroups.groups.map((group, idx) => (
                <div
                  key={idx}
                  style={{
                    marginBottom: 12,
                    padding: 12,
                    background: C.surface,
                    border: `1px solid ${C.border}`,
                    borderRadius: 6,
                  }}
                >
                  <div style={{ fontSize: 11, color: C.text3, marginBottom: 8 }}>
                    Group {idx + 1} - Match <strong style={{ fontFamily: F.mono }}>
                      {group.match.toUpperCase()}
                    </strong>:
                  </div>
                  {group.conditions.map((cond, condIdx) => (
                    <div
                      key={condIdx}
                      style={{
                        marginBottom: 4,
                        fontSize: 12,
                        color: C.text2,
                        fontFamily: F.mono,
                      }}
                    >
                      {cond.fieldLabel || cond.field}{' '}
                      <span style={{ color: C.text3 }}>{formatOperator(cond.operator)}</span>{' '}
                      {formatConditionValue(cond.value, cond.operator)}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>
      </div>

      {/* Live Tester */}
      <Card style={{ marginBottom: 24 }}>
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.border}` }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, color: C.text, margin: 0 }}>
            Live Tester
          </h2>
        </div>
        <div style={{ padding: '16px 20px' }}>
          {/* Condition Fields (if harmony has conditions) */}
          {config?.conditionGroups && (() => {
            const conditionFields = Array.from(getConditionFields(config.conditionGroups));
            if (conditionFields.length > 0) {
              return (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 11, color: C.text3, marginBottom: 8 }}>
                    Condition fields (set values to test condition matching):
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                    {conditionFields.map((field) => (
                      <div key={field}>
                        <label style={{ fontSize: 10, color: C.text3, marginBottom: 4, display: 'block' }}>
                          {field}
                        </label>
                        <input
                          type="text"
                          value={conditionFieldValues[field] || ''}
                          onChange={(e) => setConditionFieldValues({ ...conditionFieldValues, [field]: e.target.value })}
                          placeholder={`Enter ${field}...`}
                          style={{
                            width: '100%',
                            padding: '6px 10px',
                            fontSize: 12,
                            fontFamily: F.mono,
                            background: C.surface,
                            border: `1px solid ${C.border}`,
                            color: C.text,
                          }}
                        />
                      </div>
                    ))}
                  </div>
                  {/* Condition Evaluation Result */}
                  {conditionFields.some(f => conditionFieldValues[f]) && (() => {
                    const conditionMet = evaluateConditionGroups(conditionFieldValues, config.conditionGroups!);
                    return (
                      <div style={{
                        marginTop: 12,
                        padding: '8px 12px',
                        background: conditionMet ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                        border: `1px solid ${conditionMet ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                        borderRadius: 6,
                        fontSize: 12,
                        color: conditionMet ? C.green : C.red,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                      }}>
                        {conditionMet ? '✓' : '✗'} Condition {conditionMet ? 'matched' : 'not matched'}
                      </div>
                    );
                  })()}
                </div>
              );
            }
            return null;
          })()}

          {/* Test Input */}
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
              ) : (() => {
                // Check if conditions are met (if harmony has conditions)
                const hasConditions = config?.conditionGroups;
                const conditionMet = hasConditions
                  ? evaluateConditionGroups(conditionFieldValues, config.conditionGroups!)
                  : true;

                // If conditions exist but not met, show skipped message
                if (hasConditions && !conditionMet && testInput) {
                  return (
                    <div>
                      <span style={{ color: C.text3, opacity: 0.6 }}>(skipped - condition not met)</span>
                    </div>
                  );
                }

                // Check if output equals input (already normalized)
                if (testOutput && testOutput.output && testOutput.output === testInput.trim()) {
                  return (
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ color: C.green }}>{testOutput.output} ✓</span>
                        <span style={{ fontSize: 10, color: C.green }}>already normalized</span>
                      </div>
                      <div style={{ fontSize: 10, color: C.text3, marginTop: 2 }}>
                        Input is already in the correct format
                      </div>
                    </div>
                  );
                }

                // Otherwise show normal test output
                return testOutput ? (
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
                );
              })()}
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
                  <th style={{ padding: '10px 20px', textAlign: 'center', fontSize: 11, fontWeight: 600, color: C.text3, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Status
                  </th>
                  <th style={{ padding: '10px 20px', textAlign: 'right', fontSize: 11, fontWeight: 600, color: C.text3, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    When
                  </th>
                </tr>
              </thead>
              <tbody>
                {changes.map((change, i) => {
                  const hasFailed = change.status === 'failed' && change.errorMessage;

                  return (
                    <React.Fragment key={i}>
                      <tr style={{ borderBottom: hasFailed ? 'none' : `1px solid ${C.border}` }}>
                        <td style={{ padding: '10px 20px', fontSize: 13, color: C.text }}>
                          {change.recordName}
                        </td>
                        <td style={{ padding: '10px 20px', fontSize: 13, fontFamily: F.mono, color: C.text3 }}>
                          {change.previousValue || '(empty)'}
                        </td>
                        <td style={{ padding: '10px 20px', fontSize: 13, fontFamily: F.mono, color: hasFailed ? C.text3 : C.green }}>
                          {hasFailed ? '—' : change.newValue}
                        </td>
                        <td style={{ padding: '10px 20px', textAlign: 'center' }}>
                          {change.status === 'failed' ? (
                            <span title="Write failed">
                              <XCircle size={16} color={C.red} />
                            </span>
                          ) : (
                            <span title="Written successfully">
                              <CheckCircle size={16} color={C.green} />
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '10px 20px', fontSize: 12, color: C.text3, textAlign: 'right' }}>
                          {formatRelativeTime(change.writtenAt)}
                        </td>
                      </tr>
                      {hasFailed && (
                        <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                          <td colSpan={5} style={{ padding: '8px 20px 12px', fontSize: 12, color: C.text3, background: C.redDim }}>
                            <div style={{ display: 'flex', alignItems: 'start', gap: 8 }}>
                              <span style={{ color: C.red, fontWeight: 600 }}>Error:</span>
                              <span>{change.errorMessage}</span>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
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
          <ReferenceDataTable
            harmonyId={harmonyId}
            tableName={config.referenceTable}
            targetFieldProperty={targetFieldProperty}
          />
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
