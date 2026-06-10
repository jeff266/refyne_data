'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { Plus, AlertTriangle, ChevronDown, Database, Zap, MoreVertical, Edit, Trash2 } from 'lucide-react';
import { C, F } from '@/lib/design-tokens';
import { Card, Toggle, Chip, PrimaryBtn, GhostBtn, Tooltip } from '@/components/refyne';
import { ReferenceDataTable } from '@/components/harmonies/ReferenceDataTable';
import { HarmonyWizard } from '@/components/harmonies/HarmonyWizard';
import { TaxonomyWizard } from '@/components/harmonies/TaxonomyWizard';
import { useObjectType } from '@/hooks/useObjectType';
import { countConditions, type ConditionGroups } from '@/lib/harmonies/condition-evaluator';

interface HarmonyItem {
  id: string;
  name: string;
  description?: string;
  category: string;
  fields: string[];
  version?: string;
  score?: number;
  warning?: string;
  isActive?: boolean;
  isPreset?: boolean;
  isArchived?: boolean;
  ruleCount?: number;
  recordsAffected?: number;
  examples?: Array<{ input: any; output: any }>;
  transformType?: 'lookup' | 'format';
  referenceTable?: string;
  unmatchedCount?: number;
  outputFormat?: string;
  outputFormatsAvailable?: Array<{ key: string; label: string; default?: boolean }>;
  conditionGroups?: ConditionGroups | null;
}

interface ComplianceInsight {
  id: string;
  harmony_id: string;
  message: string;
  record_count: number;
}

function OutputFormatSelector({
  harmonyId,
  currentFormat,
  availableFormats,
}: {
  harmonyId: string;
  currentFormat: string;
  availableFormats: Array<{ key: string; label: string; default?: boolean }>;
}) {
  const [selectedFormat, setSelectedFormat] = useState(currentFormat);
  const [saving, setSaving] = useState(false);

  const handleChange = async (formatKey: string) => {
    setSelectedFormat(formatKey);
    setSaving(true);

    try {
      const res = await fetch(`/api/harmonies/${harmonyId}/output-format`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outputFormat: formatKey }),
      });

      if (!res.ok) {
        console.error('Failed to save output format');
        setSelectedFormat(currentFormat); // Revert on error
      }
    } catch (err) {
      console.error('Failed to save output format:', err);
      setSelectedFormat(currentFormat); // Revert on error
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ fontSize: 11, color: C.text3 }}>
      <span style={{ marginRight: 8 }}>Output format:</span>
      {availableFormats.map((format) => (
        <label
          key={format.key}
          style={{
            marginRight: 16,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            opacity: saving ? 0.5 : 1,
          }}
        >
          <input
            type="radio"
            name={`format-${harmonyId}`}
            value={format.key}
            checked={selectedFormat === format.key}
            onChange={() => handleChange(format.key)}
            disabled={saving}
            style={{ cursor: 'pointer' }}
          />
          <span style={{ color: selectedFormat === format.key ? C.text : C.text3 }}>
            {format.label}
          </span>
        </label>
      ))}
    </div>
  );
}

function HarmonyRow({
  h,
  isRec,
  enabled,
  onToggle,
  loading,
  testExpanded,
  onToggleTest,
  expanded,
  onToggleExpand,
  issueCount,
  isAdmin,
  onDelete,
  conflicts,
  isCalibrated,
}: {
  h: HarmonyItem;
  isRec?: boolean;
  enabled: boolean;
  onToggle: () => void;
  loading?: boolean;
  testExpanded: boolean;
  onToggleTest: () => void;
  expanded: boolean;
  onToggleExpand: () => void;
  issueCount?: number;
  isAdmin: boolean;
  onDelete: (harmonyId: string) => void;
  conflicts?: Array<{ harmonyId: string; harmonyName: string; canonicalField: string }>;
  isCalibrated?: boolean;
}) {
  const router = useRouter();
  const [testInput, setTestInput] = useState('');
  const [testOutput, setTestOutput] = useState<{
    matched: boolean;
    output: string | null;
    matchType?: 'exact' | 'fuzzy' | 'phonetic' | 'none';
    confidence?: number;
    explanation: string;
  } | null>(null);
  const [testing, setTesting] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  // Debounced test API call
  useEffect(() => {
    if (!testExpanded || !testInput) {
      setTestOutput(null);
      return;
    }

    setTesting(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/harmonies/${h.id}/test`, {
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
  }, [testInput, testExpanded, h.id]);

  // Generate tooltip content with examples
  const tooltipContent = h.examples && h.examples.length > 0 ? (
    <div>
      <div style={{ fontWeight: 600, marginBottom: 8, color: C.text }}>Examples</div>
      {h.examples.slice(0, 4).map((ex, i) => (
        <div key={i} style={{ marginBottom: 6, fontSize: 11, fontFamily: F.mono }}>
          <span style={{ color: C.text3 }}>{JSON.stringify(ex.input)}</span>
          <span style={{ color: C.text3, margin: '0 6px' }}>→</span>
          <span style={{ color: C.green }}>{JSON.stringify(ex.output)}</span>
        </div>
      ))}
      {h.examples.length > 4 && (
        <div style={{ fontSize: 10, color: C.text3, marginTop: 8 }}>+ {h.examples.length - 4} more examples</div>
      )}
    </div>
  ) : null;

  return (
    <div style={{ borderBottom: `1px solid ${C.border}` }}>
      <Tooltip content={tooltipContent} disabled={!tooltipContent}>
        <div style={{ padding: '14px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <Link href={`/harmonies/${h.id}`} style={{ textDecoration: 'none', display: 'block' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: enabled ? C.text : C.text3 }}>{h.name}</span>
                  {h.isPreset && <Chip color="amber">Library</Chip>}
                  {!h.isPreset && !h.isArchived && (
                    <span style={{
                      fontSize: 10,
                      fontWeight: 600,
                      color: '#71717A',
                      background: 'rgba(113,113,122,0.1)',
                      padding: '2px 8px',
                      borderRadius: 4,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em'
                    }}>Custom</span>
                  )}
                  {h.isArchived && (
                    <span style={{
                      fontSize: 10,
                      fontWeight: 600,
                      color: C.text3,
                      background: 'rgba(82,82,91,0.1)',
                      padding: '2px 8px',
                      borderRadius: 4,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em'
                    }}>Archived</span>
                  )}
                  {isCalibrated && (
                    <span style={{
                      fontSize: 10,
                      fontWeight: 600,
                      color: C.indigo,
                      background: 'rgba(99,102,241,0.1)',
                      padding: '2px 8px',
                      borderRadius: 4,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em'
                    }}>Configured in setup</span>
                  )}
                  {isRec && <Chip color="indigo">★ recommended</Chip>}
                  {h.unmatchedCount && h.unmatchedCount > 0 && (
                    <Chip color="red">{h.unmatchedCount} unmatched</Chip>
                  )}
                  {h.conditionGroups && (
                    <a
                      href={`/harmonies/${h.id}#conditions`}
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        fontSize: 10,
                        fontWeight: 600,
                        color: C.indigo,
                        background: 'rgba(99,102,241,0.1)',
                        padding: '2px 8px',
                        borderRadius: 4,
                        textDecoration: 'none',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em'
                      }}
                    >
                      <Zap size={10} />
                      {countConditions(h.conditionGroups)} {countConditions(h.conditionGroups) === 1 ? 'condition' : 'conditions'}
                    </a>
                  )}
                </div>
                <div style={{ fontSize: 11, color: C.text3, marginBottom: 4 }}>
                  {h.description || h.name}
                </div>
                {h.examples && h.examples.length > 0 && (
                  <div style={{ fontSize: 11, color: C.text3, marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: '8px 16px' }}>
                    {h.examples.slice(0, 3).map((ex, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: F.mono, fontSize: 10 }}>
                        <span style={{ color: C.text3 }}>{JSON.stringify(ex.input)}</span>
                        <span style={{ color: C.text3 }}>→</span>
                        <span style={{ color: C.green, fontWeight: 500 }}>{JSON.stringify(ex.output)}</span>
                      </div>
                    ))}
                    {h.examples.length > 3 && (
                      <span style={{ fontSize: 10, color: C.text3 }}>+{h.examples.length - 3} more</span>
                    )}
                  </div>
                )}
              </Link>
              <div style={{ fontSize: 10, fontFamily: F.mono, color: C.text3, display: 'flex', alignItems: 'center', gap: 12 }}>
                <span>{h.fields[0]}</span>
                {issueCount !== undefined && issueCount > 0 && (
                  <Chip color="amber">{issueCount} {issueCount === 1 ? 'issue' : 'issues'}</Chip>
                )}
                {issueCount === 0 && (
                  <span style={{ color: C.green }}>✓ 0 issues</span>
                )}
                {h.recordsAffected !== undefined && <span>• {h.recordsAffected} records affected</span>}
              </div>
              {conflicts && conflicts.length > 0 && (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 8px', background: C.amberDim, borderRadius: 0, border: `1px solid ${C.amberBrd}`, marginTop: 6 }}>
                  <AlertTriangle size={10} color={C.amber} />
                  <span style={{ fontSize: 10, color: C.amber }}>
                    Conflict: shares {conflicts[0].canonicalField} with {conflicts[0].harmonyName}
                    {conflicts.length > 1 && ` +${conflicts.length - 1} more`}
                  </span>
                </div>
              )}
              {h.warning && (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 10px', background: C.amberDim, borderRadius: 6, border: `1px solid rgba(245,158,11,0.2)`, marginTop: 8 }}>
                  <AlertTriangle size={11} color={C.amber} />
                  <span style={{ fontSize: 11, color: C.amber }}>{h.warning}</span>
                </div>
              )}
              {h.outputFormatsAvailable && h.outputFormatsAvailable.length > 1 && (
                <div style={{ marginTop: 10 }}>
                  <OutputFormatSelector
                    harmonyId={h.id}
                    currentFormat={h.outputFormat || 'default'}
                    availableFormats={h.outputFormatsAvailable}
                  />
                </div>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              {h.score !== undefined && <span style={{ fontSize: 11, fontFamily: F.mono, color: h.score >= 90 ? C.green : C.amber }}>{h.score}%</span>}
              {h.transformType === 'lookup' && h.referenceTable && (
                <button
                  onClick={onToggleExpand}
                  style={{
                    padding: '4px 8px',
                    fontSize: 11,
                    color: expanded ? C.indigo : C.text3,
                    background: expanded ? C.indigoDim : 'transparent',
                    border: `1px solid ${expanded ? C.indigoBrd : C.border}`,
                    borderRadius: 0,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <Database size={12} />
                  Data
                  <ChevronDown size={12} style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
                </button>
              )}
              <button
                onClick={onToggleTest}
                style={{
                  padding: '4px 8px',
                  fontSize: 11,
                  color: testExpanded ? C.indigo : C.text3,
                  background: testExpanded ? C.indigoDim : 'transparent',
                  border: `1px solid ${testExpanded ? C.indigoBrd : C.border}`,
                  borderRadius: 0,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                Test
                <ChevronDown size={12} style={{ transform: testExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
              </button>
              {isAdmin ? (
                <Toggle on={enabled} onToggle={onToggle} disabled={loading} />
              ) : (
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '4px 10px',
                  fontSize: 11,
                  color: enabled ? C.green : C.text3,
                  background: enabled ? C.greenDim : C.surface,
                  border: `1px solid ${enabled ? C.greenBrd : C.border}`,
                  borderRadius: 4,
                }}>
                  {enabled ? 'Enabled' : 'Disabled'}
                </div>
              )}

              {/* Show "..." menu only for custom harmonies and only for admins */}
              {!h.isPreset && isAdmin && (
                <div style={{ position: 'relative' }}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpen(!menuOpen);
                    }}
                    style={{
                      padding: '4px 8px',
                      fontSize: 11,
                      color: menuOpen ? C.indigo : C.text3,
                      background: menuOpen ? C.indigoDim : 'transparent',
                      border: `1px solid ${menuOpen ? C.indigoBrd : C.border}`,
                      borderRadius: 0,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <MoreVertical size={14} />
                  </button>

                  {menuOpen && (
                    <>
                      {/* Backdrop */}
                      <div
                        onClick={() => setMenuOpen(false)}
                        style={{
                          position: 'fixed',
                          top: 0,
                          left: 0,
                          right: 0,
                          bottom: 0,
                          zIndex: 998,
                        }}
                      />

                      {/* Menu */}
                      <div
                        style={{
                          position: 'absolute',
                          top: '100%',
                          right: 0,
                          marginTop: 4,
                          background: C.bg,
                          border: `1px solid ${C.border}`,
                          borderRadius: 0,
                          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                          zIndex: 999,
                          minWidth: 140,
                        }}
                      >
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setMenuOpen(false);
                            router.push(`/harmonies/${h.id}`);
                          }}
                          style={{
                            width: '100%',
                            padding: '8px 12px',
                            fontSize: 12,
                            color: C.text,
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            textAlign: 'left',
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = C.surface)}
                          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                        >
                          <Edit size={12} />
                          Edit
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setMenuOpen(false);
                            onDelete(h.id);
                          }}
                          style={{
                            width: '100%',
                            padding: '8px 12px',
                            fontSize: 12,
                            color: C.red,
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            textAlign: 'left',
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = C.surface)}
                          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                        >
                          <Trash2 size={12} />
                          Delete
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </Tooltip>

      {/* Inline tester */}
      {testExpanded && (
        <div style={{ padding: '12px 20px', background: C.surface, borderTop: `1px solid ${C.border}` }}>
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
                background: C.bg,
                border: `1px solid ${C.border}`,
                borderRadius: 6,
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
      )}

      {/* Reference data table for lookup harmonies */}
      {expanded && h.transformType === 'lookup' && h.referenceTable && (
        <div style={{ borderTop: `1px solid ${C.border}`, padding: '16px 20px' }}>
          <ReferenceDataTable
            harmonyId={h.id}
            tableName={h.referenceTable}
          />
        </div>
      )}

      {/* Algorithm description for format harmonies */}
      {expanded && h.transformType === 'format' && (
        <div style={{ padding: '16px 20px', background: C.surface, borderTop: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: C.text, marginBottom: 8 }}>Algorithm</div>
          <div style={{ fontSize: 11, color: C.text3, lineHeight: 1.6 }}>
            {getAlgorithmDescription(h.id)}
          </div>
        </div>
      )}
    </div>
  );
}

// Algorithm descriptions for format harmonies
function getAlgorithmDescription(harmonyId: string): string {
  const descriptions: Record<string, string> = {
    'phone-e164': 'Normalizes phone numbers to E.164 format. Strips all non-digits, adds +1 for US numbers (10 digits), or preserves country code for 11-digit numbers starting with 1.',
    'email-lowercase': 'Converts email addresses to lowercase and trims whitespace. This ensures consistent email formatting across your CRM.',
    'linkedin-url': 'Normalizes LinkedIn URLs to canonical format (https://linkedin.com/in/slug or https://linkedin.com/company/slug). Extracts slug from various LinkedIn URL formats.',
    'company-name': 'Applies smart title case to company names. Capitalizes first letter of each word, but keeps common legal suffixes uppercase (LLC, INC, CORP, LTD, PLC, LP, LLP).',
  };
  return descriptions[harmonyId] || 'This harmony applies an algorithmic transformation to normalize field values.';
}

export default function HarmoniesPage() {
  const { orgRole } = useAuth();
  const isAdmin = orgRole === 'org:admin';
  const [objectType] = useObjectType();
  const [harmonies, setHarmonies] = useState<HarmonyItem[]>([]);
  const [enabledIds, setEnabledIds] = useState<Set<string>>(new Set());
  const [insights, setInsights] = useState<Map<string, ComplianceInsight>>(new Map());
  const [issueCounts, setIssueCounts] = useState<Record<string, number>>({});
  const [countsLoading, setCountsLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [expandedTestId, setExpandedTestId] = useState<string | null>(null);
  const [expandedHarmonyId, setExpandedHarmonyId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [wizardOpen, setWizardOpen] = useState(false);
  const [taxonomyWizardOpen, setTaxonomyWizardOpen] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ harmonyId: string; harmonyName: string; fieldAssignment?: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [conflictModal, setConflictModal] = useState<{
    harmonyId: string;
    harmonyName: string;
    conflicts: Array<{ harmonyId: string; harmonyName: string; canonicalField: string }>;
  } | null>(null);
  const [conflictResolution, setConflictResolution] = useState<'cancel' | 'disable-others' | 'both'>('cancel');
  const [resolvingConflict, setResolvingConflict] = useState(false);
  const [fieldConflicts, setFieldConflicts] = useState<Map<string, Array<{ harmonyId: string; harmonyName: string; canonicalField: string }>>>(new Map());
  const [calibrationHarmonies, setCalibrationHarmonies] = useState<Set<string>>(new Set());

  // Fetch harmonies and enabled state
  const fetchHarmonies = useCallback(async () => {
    try {
      const [harmoniesRes, insightsRes, onboardingRes] = await Promise.all([
        fetch(`/api/harmonies?objectType=${objectType}`),
        fetch('/api/compliance/insights'),
        fetch('/api/onboarding/progress')
      ]);

      if (harmoniesRes.ok) {
        const data = await harmoniesRes.json();
        const harmoniesList = data.harmonies || [];
        setHarmonies(harmoniesList);

        // Set enabled IDs based on isActive field from database
        const activeIds = harmoniesList
          .filter((h: HarmonyItem) => h.isActive)
          .map((h: HarmonyItem) => h.id);
        setEnabledIds(new Set(activeIds));
      }

      if (insightsRes.ok) {
        const { insights: insightsList } = await insightsRes.json();
        const insightsMap = new Map<string, ComplianceInsight>();
        (insightsList || []).forEach((insight: ComplianceInsight) => {
          if (insight.harmony_id) {
            insightsMap.set(insight.harmony_id, insight);
          }
        });
        setInsights(insightsMap);
      }

      if (onboardingRes.ok) {
        const onboardingData = await onboardingRes.json();
        const calibratedIds = onboardingData.calibration_harmonies || [];
        setCalibrationHarmonies(new Set(calibratedIds));
      }

      // Fetch field conflicts for visual indicators
      await fetchFieldConflicts();
    } catch (err) {
      console.error('Failed to fetch harmonies:', err);
    } finally {
      setLoading(false);
    }
  }, [objectType]);

  // Fetch field conflicts for all active harmonies
  const fetchFieldConflicts = async () => {
    try {
      const res = await fetch('/api/harmonies/conflicts');
      if (res.ok) {
        const data = await res.json();
        const conflictsMap = new Map<string, Array<{ harmonyId: string; harmonyName: string; canonicalField: string }>>(
          Object.entries(data.conflicts || {})
        );
        setFieldConflicts(conflictsMap);
      }
    } catch (err) {
      console.error('Failed to fetch field conflicts:', err);
    }
  };

  useEffect(() => {
    fetchHarmonies();
  }, [fetchHarmonies]);

  // Fetch issue counts on mount
  useEffect(() => {
    const loadIssueCounts = async () => {
      try {
        const response = await fetch('/api/normalize/issue-counts?nocache=1');
        if (response.ok) {
          const data = await response.json();
          setIssueCounts(data.counts || {});
        }
      } catch (err) {
        console.error('Failed to fetch issue counts:', err);
      } finally {
        setCountsLoading(false);
      }
    };
    loadIssueCounts();
  }, []);

  // Toggle harmony with optimistic update
  const toggle = async (id: string) => {
    const wasEnabled = enabledIds.has(id);

    // If turning ON, check for conflicts first
    if (!wasEnabled) {
      try {
        const conflictRes = await fetch(`/api/harmonies/${id}/check-conflicts`);
        if (conflictRes.ok) {
          const conflictData = await conflictRes.json();
          if (conflictData.conflicts && conflictData.conflicts.length > 0) {
            // Show conflict modal
            const harmony = harmonies.find(h => h.id === id);
            setConflictModal({
              harmonyId: id,
              harmonyName: harmony?.name || id,
              conflicts: conflictData.conflicts,
            });
            setConflictResolution('cancel');
            return; // Don't proceed with toggle - wait for user decision
          }
        }
      } catch (err) {
        console.error('Failed to check conflicts:', err);
        // Continue with toggle even if conflict check fails
      }
    }

    // Optimistic update
    setTogglingId(id);
    setEnabledIds(prev => {
      const next = new Set(prev);
      if (wasEnabled) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });

    try {
      const res = await fetch(`/api/harmonies/${id}/toggle`, {
        method: 'POST',
      });

      if (!res.ok) {
        // Revert on error
        setEnabledIds(prev => {
          const next = new Set(prev);
          if (wasEnabled) {
            next.add(id);
          } else {
            next.delete(id);
          }
          return next;
        });
        console.error('Failed to toggle harmony');
      } else {
        const data = await res.json();
        // Confirm with server state
        setEnabledIds(new Set(data.harmonies || []));
        // Refresh conflicts
        await fetchFieldConflicts();
      }
    } catch (err) {
      // Revert on error
      setEnabledIds(prev => {
        const next = new Set(prev);
        if (wasEnabled) {
          next.add(id);
        } else {
          next.delete(id);
        }
        return next;
      });
      console.error('Failed to toggle harmony:', err);
    } finally {
      setTogglingId(null);
    }
  };

  // Handle conflict resolution
  const handleConflictResolve = async () => {
    if (!conflictModal) return;

    setResolvingConflict(true);

    try {
      if (conflictResolution === 'cancel') {
        // Just close modal, don't activate
        setConflictModal(null);
        return;
      }

      if (conflictResolution === 'disable-others') {
        // Disable all conflicting harmonies first
        for (const conflict of conflictModal.conflicts) {
          const conflictEnabled = enabledIds.has(conflict.harmonyId);
          if (conflictEnabled) {
            await fetch(`/api/harmonies/${conflict.harmonyId}/toggle`, {
              method: 'POST',
            });
          }
        }
      }

      // Now activate this harmony (for both 'disable-others' and 'both')
      const res = await fetch(`/api/harmonies/${conflictModal.harmonyId}/toggle`, {
        method: 'POST',
      });

      if (res.ok) {
        const data = await res.json();
        setEnabledIds(new Set(data.harmonies || []));
        await fetchFieldConflicts();
      }

      setConflictModal(null);
    } catch (err) {
      console.error('Failed to resolve conflict:', err);
    } finally {
      setResolvingConflict(false);
    }
  };

  // Handle delete with confirmation and field assignment warning
  const handleDeleteClick = async (harmonyId: string) => {
    const harmony = harmonies.find(h => h.id === harmonyId);
    if (!harmony) return;

    // Check if harmony has field assignment
    try {
      const res = await fetch(`/api/harmonies/field-assignments?harmonyId=${harmonyId}`);
      if (res.ok) {
        const data = await res.json();
        const assignment = data.assignments?.[0];

        setDeleteConfirm({
          harmonyId,
          harmonyName: harmony.name,
          fieldAssignment: assignment?.hubspot_property,
        });
      }
    } catch (err) {
      console.error('Failed to check field assignment:', err);
      setDeleteConfirm({
        harmonyId,
        harmonyName: harmony.name,
      });
    }
  };

  // Execute delete
  const executeDelete = async () => {
    if (!deleteConfirm) return;

    setDeleting(true);

    try {
      // Archive first
      const archiveRes = await fetch(`/api/harmonies/${deleteConfirm.harmonyId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isArchived: true }),
      });

      if (!archiveRes.ok) {
        throw new Error('Failed to archive harmony');
      }

      // Delete after 0ms delay (matches pattern from detail page)
      await new Promise(resolve => setTimeout(resolve, 0));

      const deleteRes = await fetch(`/api/harmonies/${deleteConfirm.harmonyId}`, {
        method: 'DELETE',
      });

      if (!deleteRes.ok) {
        const errorData = await deleteRes.json();
        throw new Error(errorData.error || 'Failed to delete harmony');
      }

      // Refresh harmonies list
      await fetchHarmonies();
      setDeleteConfirm(null);
    } catch (err) {
      console.error('Failed to delete harmony:', err);
      alert(err instanceof Error ? err.message : 'Failed to delete harmony');
    } finally {
      setDeleting(false);
    }
  };

  // Group harmonies by category
  const companyHarmonies = harmonies.filter(h => h.category === 'company');
  const personHarmonies = harmonies.filter(h => h.category === 'person' || h.category === 'contact');

  // Recommended harmonies (hardcoded for now - could come from API)
  const recommendedIds = new Set(['company-name', 'company-industry', 'phone', 'linkedin-url']);

  // Enrich harmonies with insights
  const enrichedHarmonies = harmonies.map(h => {
    const insight = insights.get(h.id);
    return {
      ...h,
      warning: insight ? `${insight.record_count} records — ${insight.message}` : undefined,
      unmatchedCount: insight?.record_count || 0,
      score: undefined, // TODO: fetch compliance scores from API
    };
  });

  // Filter out archived harmonies unless showArchived is true
  const visibleHarmonies = showArchived
    ? enrichedHarmonies
    : enrichedHarmonies.filter(h => !h.isArchived);

  // Filter harmonies based on search query
  const filteredHarmonies = searchQuery.trim()
    ? visibleHarmonies.filter(h =>
        h.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        h.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        h.fields.some(f => f.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : visibleHarmonies;

  const enrichedCompany = filteredHarmonies.filter(h => h.category === 'company');
  const enrichedPerson = filteredHarmonies.filter(h => h.category === 'person' || h.category === 'contact');

  if (loading) {
    return (
      <div style={{ padding: '28px 32px', fontFamily: F.sans }}>
        <div style={{ fontSize: 13, color: C.text3 }}>Loading harmonies...</div>
      </div>
    );
  }

  return (
    <div style={{ padding: '28px 32px', fontFamily: F.sans }}>
      <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search harmonies..."
          style={{
            flex: 1,
            background: C.surface,
            border: `1px solid ${C.border2}`,
            borderRadius: 8,
            padding: '8px 14px',
            fontSize: 12,
            color: C.text,
            outline: 'none',
          }}
        />
        {isAdmin && (
          <>
            <PrimaryBtn onClick={() => setWizardOpen(true)}>
              <Plus size={12} /> New harmony
            </PrimaryBtn>
            <PrimaryBtn onClick={() => setTaxonomyWizardOpen(true)}>
              <Plus size={12} /> Add Taxonomy
            </PrimaryBtn>
          </>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {enrichedCompany.length > 0 && (
          <Card>
            <div style={{ padding: '12px 20px', borderBottom: `1px solid ${C.border}` }}>
              <h2 className="section-heading" style={{ margin: 0, border: 'none', paddingBottom: 0 }}>Company</h2>
            </div>
            {enrichedCompany.map(h => (
              <HarmonyRow
                key={h.id}
                h={h}
                isRec={recommendedIds.has(h.id)}
                enabled={enabledIds.has(h.id)}
                onToggle={() => toggle(h.id)}
                loading={togglingId === h.id}
                testExpanded={expandedTestId === h.id}
                onToggleTest={() => setExpandedTestId(expandedTestId === h.id ? null : h.id)}
                expanded={expandedHarmonyId === h.id}
                onToggleExpand={() => setExpandedHarmonyId(expandedHarmonyId === h.id ? null : h.id)}
                issueCount={issueCounts[h.id]}
                isAdmin={isAdmin}
                onDelete={handleDeleteClick}
                conflicts={fieldConflicts.get(h.id)}
                isCalibrated={calibrationHarmonies.has(h.id)}
              />
            ))}
          </Card>
        )}
        {enrichedPerson.length > 0 && (
          <Card>
            <div style={{ padding: '12px 20px', borderBottom: `1px solid ${C.border}` }}>
              <h2 className="section-heading" style={{ margin: 0, border: 'none', paddingBottom: 0 }}>Contact</h2>
            </div>
            {enrichedPerson.map(h => (
              <HarmonyRow
                key={h.id}
                h={h}
                enabled={enabledIds.has(h.id)}
                onToggle={() => toggle(h.id)}
                loading={togglingId === h.id}
                testExpanded={expandedTestId === h.id}
                onToggleTest={() => setExpandedTestId(expandedTestId === h.id ? null : h.id)}
                expanded={expandedHarmonyId === h.id}
                onToggleExpand={() => setExpandedHarmonyId(expandedHarmonyId === h.id ? null : h.id)}
                issueCount={issueCounts[h.id]}
                isAdmin={isAdmin}
                onDelete={handleDeleteClick}
                conflicts={fieldConflicts.get(h.id)}
                isCalibrated={calibrationHarmonies.has(h.id)}
              />
            ))}
          </Card>
        )}
      </div>

      {/* Show Archived Toggle */}
      {harmonies.some(h => h.isArchived) && (
        <div style={{ marginTop: 24, textAlign: 'center' }}>
          <button
            onClick={() => setShowArchived(!showArchived)}
            style={{
              padding: '8px 16px',
              fontSize: 12,
              color: C.text2,
              background: 'transparent',
              border: `1px solid ${C.border}`,
              borderRadius: 6,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            {showArchived ? 'Hide archived' : 'Show archived'}
            {!showArchived && harmonies.filter(h => h.isArchived).length > 0 && (
              <span style={{
                background: C.text3,
                color: C.bg,
                fontSize: 10,
                fontWeight: 600,
                padding: '2px 6px',
                borderRadius: 4,
              }}>
                {harmonies.filter(h => h.isArchived).length}
              </span>
            )}
          </button>
        </div>
      )}

      {/* Harmony Wizard */}
      <HarmonyWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onSuccess={() => {
          fetchHarmonies();
          setWizardOpen(false);
        }}
      />

      {/* Taxonomy Wizard */}
      {taxonomyWizardOpen && (
        <TaxonomyWizard
          onClose={() => {
            setTaxonomyWizardOpen(false);
            fetchHarmonies(); // Refresh the harmonies list
          }}
        />
      )}

      {/* Conflict Resolution Modal */}
      {conflictModal && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => !resolvingConflict && setConflictModal(null)}
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
          >
            {/* Dialog */}
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                background: C.bg,
                border: `1px solid ${C.border}`,
                borderRadius: 0,
                padding: 24,
                maxWidth: 520,
                width: '100%',
                margin: '0 20px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
                <AlertTriangle size={24} color={C.amber} style={{ flexShrink: 0, marginTop: 2 }} />
                <div style={{ flex: 1 }}>
                  <h2 style={{ fontSize: 16, fontWeight: 600, color: C.text, marginBottom: 8 }}>
                    Field conflict detected
                  </h2>
                  <p style={{ fontSize: 13, color: C.text2, lineHeight: 1.5, marginBottom: 16 }}>
                    <strong>{conflictModal.conflicts[0].harmonyName}</strong> already writes to{' '}
                    <span style={{ fontFamily: F.mono, fontSize: 12 }}>{conflictModal.conflicts[0].canonicalField}</span>.
                    Enabling <strong>{conflictModal.harmonyName}</strong> for the same field may cause conflicts.
                  </p>

                  <p style={{ fontSize: 13, color: C.text, marginBottom: 12, fontWeight: 500 }}>
                    Which harmony should take priority?
                  </p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                    <label
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 10,
                        padding: 10,
                        border: `2px solid ${conflictResolution === 'cancel' ? C.indigo : C.border}`,
                        borderRadius: 0,
                        background: conflictResolution === 'cancel' ? C.indigoDim : 'transparent',
                        cursor: 'pointer',
                      }}
                    >
                      <input
                        type="radio"
                        name="conflictResolution"
                        value="cancel"
                        checked={conflictResolution === 'cancel'}
                        onChange={(e) => setConflictResolution(e.target.value as any)}
                        style={{ marginTop: 2, cursor: 'pointer' }}
                      />
                      <div style={{ fontSize: 12, color: C.text }}>
                        Keep <strong>{conflictModal.conflicts[0].harmonyName}</strong> active, cancel this activation
                      </div>
                    </label>

                    <label
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 10,
                        padding: 10,
                        border: `2px solid ${conflictResolution === 'disable-others' ? C.indigo : C.border}`,
                        borderRadius: 0,
                        background: conflictResolution === 'disable-others' ? C.indigoDim : 'transparent',
                        cursor: 'pointer',
                      }}
                    >
                      <input
                        type="radio"
                        name="conflictResolution"
                        value="disable-others"
                        checked={conflictResolution === 'disable-others'}
                        onChange={(e) => setConflictResolution(e.target.value as any)}
                        style={{ marginTop: 2, cursor: 'pointer' }}
                      />
                      <div style={{ fontSize: 12, color: C.text }}>
                        Enable this one, disable <strong>{conflictModal.conflicts[0].harmonyName}</strong>
                      </div>
                    </label>

                    <label
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 10,
                        padding: 10,
                        border: `2px solid ${conflictResolution === 'both' ? C.indigo : C.border}`,
                        borderRadius: 0,
                        background: conflictResolution === 'both' ? C.indigoDim : 'transparent',
                        cursor: 'pointer',
                      }}
                    >
                      <input
                        type="radio"
                        name="conflictResolution"
                        value="both"
                        checked={conflictResolution === 'both'}
                        onChange={(e) => setConflictResolution(e.target.value as any)}
                        style={{ marginTop: 2, cursor: 'pointer' }}
                      />
                      <div style={{ fontSize: 12, color: C.text }}>
                        Enable both (last harmony applied wins)
                      </div>
                    </label>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setConflictModal(null)}
                  disabled={resolvingConflict}
                  style={{
                    padding: '8px 16px',
                    fontSize: 12,
                    color: C.text,
                    background: 'transparent',
                    border: `1px solid ${C.border}`,
                    borderRadius: 0,
                    cursor: resolvingConflict ? 'not-allowed' : 'pointer',
                    opacity: resolvingConflict ? 0.5 : 1,
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleConflictResolve}
                  disabled={resolvingConflict}
                  style={{
                    padding: '8px 16px',
                    fontSize: 12,
                    color: C.bg,
                    background: C.indigo,
                    border: 'none',
                    borderRadius: 0,
                    cursor: resolvingConflict ? 'not-allowed' : 'pointer',
                    opacity: resolvingConflict ? 0.5 : 1,
                  }}
                >
                  {resolvingConflict ? 'Applying...' : 'Confirm'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Delete Confirmation Dialog */}
      {deleteConfirm && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => !deleting && setDeleteConfirm(null)}
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
          >
            {/* Dialog */}
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                background: C.bg,
                border: `1px solid ${C.border}`,
                borderRadius: 0,
                padding: 24,
                maxWidth: 480,
                width: '100%',
                margin: '0 20px',
              }}
            >
              <h2 style={{ fontSize: 16, fontWeight: 600, color: C.text, marginBottom: 12 }}>
                Delete this harmony?
              </h2>
              <p style={{ fontSize: 13, color: C.text2, marginBottom: 16, lineHeight: 1.5 }}>
                {deleteConfirm.fieldAssignment ? (
                  <>
                    This harmony is assigned to <strong>{deleteConfirm.fieldAssignment}</strong>. Deleting it will remove the assignment. This cannot be undone.
                  </>
                ) : (
                  'This cannot be undone.'
                )}
              </p>

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setDeleteConfirm(null)}
                  disabled={deleting}
                  style={{
                    padding: '8px 16px',
                    fontSize: 12,
                    color: C.text,
                    background: 'transparent',
                    border: `1px solid ${C.border}`,
                    borderRadius: 0,
                    cursor: deleting ? 'not-allowed' : 'pointer',
                    opacity: deleting ? 0.5 : 1,
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={executeDelete}
                  disabled={deleting}
                  style={{
                    padding: '8px 16px',
                    fontSize: 12,
                    color: C.bg,
                    background: C.red,
                    border: 'none',
                    borderRadius: 0,
                    cursor: deleting ? 'not-allowed' : 'pointer',
                    opacity: deleting ? 0.5 : 1,
                  }}
                >
                  {deleting ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
