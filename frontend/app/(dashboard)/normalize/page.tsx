'use client';

import { useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { C, F } from '@/lib/design-tokens';
import { Toggle, PrimaryBtn } from '@/components/refyne';

// TODO: wire to API - GET /api/harmonies or similar
const list = ['company-name','company-industry','phone-e164','linkedin-url','person-title','person-name'];

// TODO: wire to API - replace with normalization preview results
const preview = [
  { company: 'Specialized ABA',  field: 'industry', before: 'HOSPITAL_HEALTH_CARE', after: 'Healthcare' },
  { company: 'Specialized ABA',  field: 'phone',    before: '+1 (386) 795-5695',    after: '+13867955695' },
  { company: 'LEARN Behavioral', field: 'industry', before: 'MENTAL_HEALTH_CARE',   after: 'Mental Health Care' },
  { company: 'ZABA Therapy LLC', field: 'industry', before: 'PHARMACEUTICALS',      after: 'Pharmaceuticals' },
];

export default function NormalizePage() {
  const [active, setActive] = useState(['company-name','company-industry','phone-e164','linkedin-url']);
  const toggle = (id: string) => setActive(a => a.includes(id) ? a.filter(x => x !== id) : [...a, id]);

  return (
    <div style={{ display: 'flex', height: '100%', fontFamily: F.sans }}>
      {/* Harmonies sidebar */}
      <div style={{ width: 232, background: C.sidebar, borderRight: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div style={{ padding: '14px 16px', borderBottom: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 11, color: C.text3, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Harmonies</div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {list.map(id => (
            <div key={id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 16px', borderBottom: `1px solid ${C.border}` }}>
              <span style={{ fontSize: 11, fontFamily: F.mono, color: active.includes(id) ? C.text : C.text3 }}>{id}</span>
              <Toggle on={active.includes(id)} onToggle={() => toggle(id)} />
            </div>
          ))}
        </div>
        <div style={{ padding: 16, borderTop: `1px solid ${C.border}` }}>
          <PrimaryBtn>Load 23,100</PrimaryBtn>
        </div>
      </div>

      {/* Preview area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div style={{ padding: '12px 24px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: C.text2 }}>4 fields will change · 23,096 unchanged</span>
          <PrimaryBtn>Apply 4 changes</PrimaryBtn>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, fontFamily: F.sans }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                {['Record', 'Field', 'Before', 'After'].map(h => (
                  <th key={h} style={{ padding: '10px 24px', textAlign: 'left', color: C.text3, fontSize: 11, fontWeight: 500, letterSpacing: '0.03em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {preview.map((r, i) => (
                <tr key={i} style={{ borderBottom: `1px solid ${C.border}` }}>
                  <td style={{ padding: '12px 24px', color: C.text2, fontWeight: 500 }}>{r.company}</td>
                  <td style={{ padding: '12px 24px', fontFamily: F.mono, color: C.text3, fontSize: 11 }}>{r.field}</td>
                  <td style={{ padding: '12px 24px', fontFamily: F.mono, color: C.red, fontSize: 11 }}>{r.before}</td>
                  <td style={{ padding: '12px 24px', display: 'flex', alignItems: 'center', gap: 7 }}>
                    <span style={{ fontFamily: F.mono, color: C.green, fontSize: 11 }}>{r.after}</span>
                    <CheckCircle2 size={11} color={C.green} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
