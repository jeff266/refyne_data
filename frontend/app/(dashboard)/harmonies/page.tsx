'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, AlertTriangle, ChevronDown, Database } from 'lucide-react';
import { C, F } from '@/lib/design-tokens';
import { Card, Toggle, Chip, PrimaryBtn, GhostBtn, Tooltip } from '@/components/refyne';
import { ReferenceDataTable } from '@/components/harmonies/ReferenceDataTable';
import { HarmonyWizard } from '@/components/harmonies/HarmonyWizard';

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
  ruleCount?: number;
  recordsAffected?: number;
  examples?: Array<{ input: any; output: any }>;
  transformType?: 'lookup' | 'format';
  referenceTable?: string;
  unmatchedCount?: number;
  outputFormat?: string;
  outputFormatsAvailable?: Array<{ key: string; label: string; default?: boolean }>;
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
}) {
  const [testInput, setTestInput] = useState('');
  const [testOutput, setTestOutput] = useState<{
    matched: boolean;
    output: string | null;
    matchType?: 'exact' | 'fuzzy' | 'phonetic' | 'none';
    confidence?: number;
    explanation: string;
  } | null>(null);
  const [testing, setTesting] = useState(false);

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
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: enabled ? C.text : C.text3 }}>{h.name}</span>
                {h.isPreset && <Chip color="amber">Library</Chip>}
                {isRec && <Chip color="indigo">★ recommended</Chip>}
                {h.unmatchedCount && h.unmatchedCount > 0 && (
                  <Chip color="red">{h.unmatchedCount} unmatched</Chip>
                )}
              </div>
              <div style={{ fontSize: 11, color: C.text3, marginBottom: 4 }}>
                {h.description || h.name}
              </div>
              <div style={{ fontSize: 10, fontFamily: F.mono, color: C.text3, display: 'flex', alignItems: 'center', gap: 12 }}>
                <span>{h.fields[0]}</span>
                {h.ruleCount && <span>• {h.ruleCount} rules</span>}
                {h.recordsAffected !== undefined && <span>• {h.recordsAffected} records affected</span>}
              </div>
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
                    borderRadius: 4,
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
                  borderRadius: 4,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                Test
                <ChevronDown size={12} style={{ transform: testExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
              </button>
              <Toggle on={enabled} onToggle={onToggle} disabled={loading} />
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
            orgId="default"
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
  const orgId = 'default'; // TODO: get from auth context
  const [harmonies, setHarmonies] = useState<HarmonyItem[]>([]);
  const [enabledIds, setEnabledIds] = useState<Set<string>>(new Set());
  const [insights, setInsights] = useState<Map<string, ComplianceInsight>>(new Map());
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [expandedTestId, setExpandedTestId] = useState<string | null>(null);
  const [expandedHarmonyId, setExpandedHarmonyId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [wizardOpen, setWizardOpen] = useState(false);

  // Fetch harmonies and enabled state
  const fetchHarmonies = useCallback(async () => {
    try {
      const [harmoniesRes, insightsRes] = await Promise.all([
        fetch('/api/harmonies'),
        fetch(`/api/compliance/insights?orgId=${orgId}`)
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
    } catch (err) {
      console.error('Failed to fetch harmonies:', err);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    fetchHarmonies();
  }, [fetchHarmonies]);

  // Toggle harmony with optimistic update
  const toggle = async (id: string) => {
    const wasEnabled = enabledIds.has(id);

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
        headers: { 'x-org-id': orgId },
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

  // Filter harmonies based on search query
  const filteredHarmonies = searchQuery.trim()
    ? enrichedHarmonies.filter(h =>
        h.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        h.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        h.fields.some(f => f.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : enrichedHarmonies;

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
        <PrimaryBtn onClick={() => setWizardOpen(true)}>
          <Plus size={12} /> New harmony
        </PrimaryBtn>
        <GhostBtn onClick={() => alert('YAML import coming soon. You can currently manage reference data inline by clicking the "Data" button on lookup harmonies.')}>
          Import YAML
        </GhostBtn>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {enrichedCompany.length > 0 && (
          <Card>
            <div style={{ padding: '12px 20px', borderBottom: `1px solid ${C.border}` }}>
              <span style={{ fontSize: 11, color: C.text3, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Company</span>
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
              />
            ))}
          </Card>
        )}
        {enrichedPerson.length > 0 && (
          <Card>
            <div style={{ padding: '12px 20px', borderBottom: `1px solid ${C.border}` }}>
              <span style={{ fontSize: 11, color: C.text3, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Contact</span>
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
              />
            ))}
          </Card>
        )}
      </div>

      {/* Harmony Wizard */}
      <HarmonyWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onSuccess={() => {
          fetchHarmonies();
          setWizardOpen(false);
        }}
      />
    </div>
  );
}
