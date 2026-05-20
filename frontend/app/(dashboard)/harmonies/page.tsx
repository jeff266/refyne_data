'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, AlertTriangle } from 'lucide-react';
import { C, F } from '@/lib/design-tokens';
import { Card, Toggle, Chip, PrimaryBtn, GhostBtn } from '@/components/refyne';

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
}

interface ComplianceInsight {
  id: string;
  harmony_id: string;
  message: string;
  record_count: number;
}

function HarmonyRow({
  h,
  isRec,
  enabled,
  onToggle,
  loading
}: {
  h: HarmonyItem;
  isRec?: boolean;
  enabled: boolean;
  onToggle: () => void;
  loading?: boolean;
}) {
  return (
    <div style={{ padding: '14px 20px', borderBottom: `1px solid ${C.border}` }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: enabled ? C.text : C.text3 }}>{h.name}</span>
            {h.isPreset && <Chip color="amber">Library</Chip>}
            {isRec && <Chip color="indigo">★ recommended</Chip>}
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
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          {h.score !== undefined && <span style={{ fontSize: 11, fontFamily: F.mono, color: h.score >= 90 ? C.green : C.amber }}>{h.score}%</span>}
          <Toggle on={enabled} onToggle={onToggle} disabled={loading} />
        </div>
      </div>
    </div>
  );
}

export default function HarmoniesPage() {
  const orgId = 'default'; // TODO: get from auth context
  const [harmonies, setHarmonies] = useState<HarmonyItem[]>([]);
  const [enabledIds, setEnabledIds] = useState<Set<string>>(new Set());
  const [insights, setInsights] = useState<Map<string, ComplianceInsight>>(new Map());
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);

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
      score: undefined, // TODO: fetch compliance scores from API
    };
  });

  const enrichedCompany = enrichedHarmonies.filter(h => h.category === 'company');
  const enrichedPerson = enrichedHarmonies.filter(h => h.category === 'person' || h.category === 'contact');

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
        <div style={{ flex: 1, background: C.surface, border: `1px solid ${C.border2}`, borderRadius: 8, padding: '8px 14px', fontSize: 12, color: C.text3 }}>Search harmonies...</div>
        <PrimaryBtn><Plus size={12} /> New harmony</PrimaryBtn>
        <GhostBtn>Import YAML</GhostBtn>
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
              />
            ))}
          </Card>
        )}
      </div>
    </div>
  );
}
