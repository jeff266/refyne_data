'use client';

import { useState, useEffect } from 'react';
import { X, Plus } from 'lucide-react';
import { C, F } from '@/lib/design-tokens';
import { Card, Chip, PrimaryBtn, HowItWorksStrip } from '@/components/refyne';
import { LockedProviderChip } from '@/components/providers/LockedProviderChip';

// TODO: wire to API - replace with search results from enrichment providers
const rows = [
  { name: 'ABA Center of Georgia',  domain: 'abacenter.com',    size: 45,  score: 88, sel: true },
  { name: 'Behavior Care Inc',       domain: 'behaviorcare.com', size: 120, score: 84, sel: true },
  { name: 'Learning Tree ABA',       domain: '—',               size: 28,  score: 71, sel: false },
  { name: 'Spectrum Bridge LLC',     domain: 'spectrumbridge.io',size: 67,  score: 79, sel: false },
  { name: 'ABA Solutions Group',     domain: 'abasolutions.com', size: 89,  score: 65, sel: false },
  { name: 'Behavioral Health Co.',   domain: 'bh-co.com',        size: 34,  score: 58, sel: false },
];

// Full provider registry (all supported providers in the platform)
const PROVIDER_REGISTRY = [
  { key: 'apollo', label: 'Apollo' },
  { key: 'zoominfo', label: 'ZoomInfo' },
  { key: 'clearbit', label: 'Clearbit' },
  { key: 'hunter', label: 'Hunter' },
  { key: 'people-data-labs', label: 'People Data Labs' },
];

function MatchBar({ n }: { n: number }) {
  const col = n >= 80 ? C.green : n >= 65 ? C.amber : C.red;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ height: 3, width: 52, background: C.hover, borderRadius: 2 }}>
        <div style={{ height: '100%', width: `${n}%`, background: col, borderRadius: 2 }} />
      </div>
      <span style={{ fontSize: 10, fontFamily: F.mono, color: C.text3 }}>{n}</span>
    </div>
  );
}

export default function EnrichPage() {
  const [view, setView] = useState<'table' | 'grid'>('table');
  const [connectedProviders, setConnectedProviders] = useState<string[]>([]);
  const [selectedProviders, setSelectedProviders] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch connected providers on mount
  useEffect(() => {
    async function fetchConnections() {
      try {
        const res = await fetch('/api/providers/connections');
        if (res.ok) {
          const data = await res.json();
          const providerKeys = data.connections.map((c: any) => c.provider);
          setConnectedProviders(providerKeys);
        }
      } catch (error) {
        console.error('Failed to fetch provider connections:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchConnections();
  }, []);

  const prospectingSteps = [
    {
      title: 'Set your ICP filters',
      description: 'Industry, size, location, keywords — search across connected providers.',
    },
    {
      title: 'Enrich and review',
      description: 'Refyne enriches each result with canonical data before it touches your CRM.',
    },
    {
      title: 'Push with confidence',
      description: 'Duplicate check runs automatically — records are blocked, quarantined, or pushed based on your org policy.',
    },
  ];

  return (
    <div style={{ display: 'flex', height: '100%', fontFamily: F.sans }}>
      {/* Filters sidebar */}
      <div style={{ width: 248, background: C.sidebar, borderRight: `1px solid ${C.border}`, padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 0, overflowY: 'auto', flexShrink: 0 }}>
        {/* Industry filter */}
        <div style={{ marginBottom: 22 }}>
          <div style={{ fontSize: 11, color: C.text3, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 9 }}>Industry</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {['Healthcare', 'Behavioral'].map(c => (
              <span key={c} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', background: C.indigoDim, color: C.indigoLt, borderRadius: 5, fontSize: 11, border: `1px solid ${C.indigoBrd}` }}>
                {c} <X size={9} />
              </span>
            ))}
            <span style={{ padding: '3px 7px', color: C.text3, fontSize: 11 }}>+ Add</span>
          </div>
        </div>

        {/* Company size filter */}
        <div style={{ marginBottom: 22 }}>
          <div style={{ fontSize: 11, color: C.text3, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 9 }}>Company size</div>
          <div style={{ height: 3, background: C.hover, borderRadius: 2, position: 'relative', margin: '10px 0' }}>
            <div style={{ position: 'absolute', left: '10%', right: '50%', height: '100%', background: C.indigo, borderRadius: 2 }} />
          </div>
        </div>

        {/* Location filter */}
        <div style={{ marginBottom: 22 }}>
          <div style={{ fontSize: 11, color: C.text3, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 9 }}>Location</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', background: C.indigoDim, color: C.indigoLt, borderRadius: 5, fontSize: 11, border: `1px solid ${C.indigoBrd}` }}>
              United States <X size={9} />
            </span>
            <span style={{ padding: '3px 7px', color: C.text3, fontSize: 11 }}>+ Add</span>
          </div>
        </div>

        {/* Provider filter - dynamic */}
        <div style={{ marginBottom: 22 }}>
          <div style={{ fontSize: 11, color: C.text3, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 9 }}>Provider</div>
          {loading ? (
            <div style={{ fontSize: 11, color: C.text3 }}>Loading...</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {/* Connected providers - selectable */}
              {PROVIDER_REGISTRY.filter(p => connectedProviders.includes(p.key)).map(provider => {
                const isSelected = selectedProviders.includes(provider.key);
                return (
                  <button
                    key={provider.key}
                    onClick={() => {
                      if (isSelected) {
                        setSelectedProviders(prev => prev.filter(k => k !== provider.key));
                      } else {
                        setSelectedProviders(prev => [...prev, provider.key]);
                      }
                    }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '3px 8px',
                      background: isSelected ? C.indigoDim : C.surface,
                      color: isSelected ? C.indigoLt : C.text2,
                      borderRadius: 5,
                      fontSize: 11,
                      border: `1px solid ${isSelected ? C.indigoBrd : C.border2}`,
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    {provider.label}
                    {isSelected && <X size={9} />}
                  </button>
                );
              })}

              {/* Locked providers */}
              {PROVIDER_REGISTRY.filter(p => !connectedProviders.includes(p.key)).map(provider => (
                <LockedProviderChip
                  key={provider.key}
                  provider={provider.key}
                  providerLabel={provider.label}
                  currentPath="/enrich"
                />
              ))}
            </div>
          )}
        </div>
        <div style={{ marginBottom: 22 }}>
          <div style={{ fontSize: 11, color: C.text3, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 9 }}>Keywords</div>
          <div style={{ background: C.surface, border: `1px solid ${C.border2}`, borderRadius: 7, padding: '7px 10px', fontSize: 12, color: C.text3 }}>ABA therapy...</div>
        </div>
        <PrimaryBtn>Search</PrimaryBtn>
        <button style={{ marginTop: 8, fontSize: 12, color: C.text3, padding: '6px 0', background: 'none', border: 'none', cursor: 'pointer' }}>Clear filters</button>
      </div>

      {/* Results area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div style={{ padding: '12px 20px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 12, color: C.text2 }}>312 results</span>
            <span style={{ fontSize: 11, color: C.text3 }}>·</span>
            <Chip color="indigo">2 selected</Chip>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ display: 'flex', border: `1px solid ${C.border2}`, borderRadius: 6, overflow: 'hidden' }}>
              {(['table', 'grid'] as const).map(v => (
                <button key={v} onClick={() => setView(v)} style={{ padding: '4px 10px', fontSize: 11, background: view === v ? C.hover : 'transparent', color: view === v ? C.text : C.text3, borderRight: v === 'table' ? `1px solid ${C.border2}` : 'none', border: 'none', cursor: 'pointer' }}>{v}</button>
              ))}
            </div>
            <PrimaryBtn><Plus size={11} /> Enrich selected</PrimaryBtn>
          </div>
        </div>
        <div style={{ padding: '20px 20px 0 20px' }}>
          <HowItWorksStrip steps={prospectingSteps} storageKey="how-it-works-prospecting" />
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {view === 'table' ? (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, fontFamily: F.sans }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                  {['', 'Company', 'Domain', 'Size', 'Match'].map(h => (
                    <th key={h} style={{ padding: '10px 20px', textAlign: 'left', color: C.text3, fontSize: 11, fontWeight: 500, letterSpacing: '0.03em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} style={{ borderBottom: `1px solid ${C.border}`, background: r.sel ? C.indigoDim : 'transparent' }}>
                    <td style={{ padding: '11px 20px' }}>
                      <div style={{ width: 14, height: 14, borderRadius: 4, background: r.sel ? C.indigo : 'transparent', border: `1px solid ${r.sel ? C.indigo : C.border2}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {r.sel && <span style={{ color: '#fff', fontSize: 9 }}>✓</span>}
                      </div>
                    </td>
                    <td style={{ padding: '11px 20px', color: C.text, fontWeight: 500 }}>{r.name}</td>
                    <td style={{ padding: '11px 20px', fontFamily: F.mono, color: C.text2, fontSize: 11 }}>{r.domain}</td>
                    <td style={{ padding: '11px 20px', fontFamily: F.mono, color: C.text2 }}>{r.size}</td>
                    <td style={{ padding: '11px 20px' }}><MatchBar n={r.score} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={{ padding: 20, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              {rows.map((r, i) => (
                <Card key={i} style={{ padding: '14px 16px', border: `1px solid ${r.sel ? C.indigoBrd : C.border}`, background: r.sel ? C.indigoDim : C.surface }}>
                  <div style={{ fontSize: 13, color: C.text, fontWeight: 600, marginBottom: 4, letterSpacing: '-0.01em' }}>{r.name}</div>
                  <div style={{ fontSize: 11, fontFamily: F.mono, color: C.text3, marginBottom: 2 }}>{r.domain}</div>
                  <div style={{ fontSize: 11, color: C.text3, marginBottom: 10 }}>{r.size} employees</div>
                  <MatchBar n={r.score} />
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
