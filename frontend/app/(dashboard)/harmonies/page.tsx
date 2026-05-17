'use client';

import { useState } from 'react';
import { Plus, AlertTriangle } from 'lucide-react';
import { C, F } from '@/lib/design-tokens';
import { Card, Toggle, Chip, PrimaryBtn, GhostBtn } from '@/components/refyne';

// TODO: wire to API - GET /api/harmonies/library or similar
const rec = [
  { id: 'company-name',     v: 'v1.2.0', desc: 'Option C suffix normalization',   score: 99 },
  { id: 'company-industry', v: 'v2.1.0', desc: 'Canonical industry taxonomy',     score: 82, warn: '82 records — no rule covers "(Fintech)"' },
  { id: 'phone-e164',       v: 'v1.0.0', desc: 'E.164 international format',      score: 95 },
  { id: 'linkedin-url',     v: 'v1.0.0', desc: 'LinkedIn URL canonicalization',   score: 77 },
];

const other = [
  { id: 'person-title',  v: 'v1.1.0', desc: '6 canonical role categories' },
  { id: 'person-name',   v: 'v1.0.0', desc: 'Name prefix / suffix normalization' },
  { id: 'company-domain',v: 'v1.0.0', desc: 'Domain canonicalization' },
];

interface HarmonyItem {
  id: string;
  v: string;
  desc: string;
  score?: number;
  warn?: string;
}

function HarmonyRow({ h, isRec, enabled, onToggle }: { h: HarmonyItem; isRec?: boolean; enabled: boolean; onToggle: () => void }) {
  return (
    <div style={{ padding: '14px 20px', borderBottom: `1px solid ${C.border}` }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, fontFamily: F.mono, color: enabled ? C.text : C.text3, fontWeight: 500 }}>{h.id}</span>
            <span style={{ fontSize: 10, fontFamily: F.mono, color: C.text3 }}>{h.v}</span>
            {isRec && <Chip color="indigo">★ recommended</Chip>}
          </div>
          <div style={{ fontSize: 11, color: C.text3, marginBottom: h.warn ? 8 : 0 }}>{h.desc}</div>
          {h.warn && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 10px', background: C.amberDim, borderRadius: 6, border: `1px solid rgba(245,158,11,0.2)` }}>
              <AlertTriangle size={11} color={C.amber} />
              <span style={{ fontSize: 11, color: C.amber }}>{h.warn}</span>
              <span style={{ fontSize: 10, color: C.amber, textDecoration: 'underline', marginLeft: 2, cursor: 'pointer' }}>Edit rule</span>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          {h.score && <span style={{ fontSize: 11, fontFamily: F.mono, color: h.score >= 90 ? C.green : C.amber }}>{h.score}%</span>}
          <Toggle on={enabled} onToggle={onToggle} />
        </div>
      </div>
    </div>
  );
}

export default function HarmoniesPage() {
  const [enabled, setEnabled] = useState(['company-name','company-industry','phone-e164','linkedin-url']);
  const toggle = (id: string) => setEnabled(e => e.includes(id) ? e.filter(x => x !== id) : [...e, id]);

  return (
    <div style={{ padding: '28px 32px', fontFamily: F.sans }}>
      <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
        <div style={{ flex: 1, background: C.surface, border: `1px solid ${C.border2}`, borderRadius: 8, padding: '8px 14px', fontSize: 12, color: C.text3 }}>Search harmonies...</div>
        <PrimaryBtn><Plus size={12} /> New harmony</PrimaryBtn>
        <GhostBtn>Import YAML</GhostBtn>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Card>
          <div style={{ padding: '12px 20px', borderBottom: `1px solid ${C.border}` }}>
            <span style={{ fontSize: 11, color: C.text3, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Recommended</span>
          </div>
          {rec.map(h => <HarmonyRow key={h.id} h={h} isRec enabled={enabled.includes(h.id)} onToggle={() => toggle(h.id)} />)}
        </Card>
        <Card>
          <div style={{ padding: '12px 20px', borderBottom: `1px solid ${C.border}` }}>
            <span style={{ fontSize: 11, color: C.text3, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Contact</span>
          </div>
          {other.map(h => <HarmonyRow key={h.id} h={h} enabled={enabled.includes(h.id)} onToggle={() => toggle(h.id)} />)}
        </Card>
      </div>
    </div>
  );
}
