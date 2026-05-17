'use client';

import { Plus } from 'lucide-react';
import { C, F } from '@/lib/design-tokens';
import { Card, PrimaryBtn, GhostBtn } from '@/components/refyne';

// TODO: wire to API - GET /api/field-mappings or similar
const rows = [
  { canon: 'industry',      hubspot: 'industry',          policy: 'overwrite_if_blank_or_ours' },
  { canon: 'phone',         hubspot: 'phone',             policy: 'always_overwrite' },
  { canon: 'linkedin_url',  hubspot: 'hs_linkedin_url',   policy: 'overwrite_if_blank_or_ours' },
  { canon: 'employee_count',hubspot: 'numberofemployees', policy: 'never_overwrite' },
  { canon: 'description',   hubspot: 'description',       policy: 'never_overwrite' },
  { canon: 'domain',        hubspot: 'domain',            policy: 'always_overwrite' },
];

function policyColor(p: string) {
  return p === 'always_overwrite' ? C.amber : p === 'never_overwrite' ? C.text3 : C.green;
}

export default function MappingsPage() {
  return (
    <div style={{ padding: '28px 32px', fontFamily: F.sans }}>
      <Card>
        <div style={{ padding: '14px 20px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: C.text, letterSpacing: '-0.01em' }}>HubSpot field mappings</span>
          <PrimaryBtn><Plus size={12} /> Add mapping</PrimaryBtn>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, fontFamily: F.sans }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${C.border}` }}>
              {['Canonical field', 'HubSpot property', 'Write policy', ''].map(h => (
                <th key={h} style={{ padding: '10px 20px', textAlign: 'left', color: C.text3, fontSize: 11, fontWeight: 500, letterSpacing: '0.03em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} style={{ borderBottom: `1px solid ${C.border}` }}>
                <td style={{ padding: '12px 20px', fontFamily: F.mono, color: C.text, fontSize: 11, fontWeight: 500 }}>{r.canon}</td>
                <td style={{ padding: '12px 20px', fontFamily: F.mono, color: C.text2, fontSize: 11 }}>{r.hubspot}</td>
                <td style={{ padding: '12px 20px' }}>
                  <span style={{ fontSize: 10, fontFamily: F.mono, color: policyColor(r.policy), background: C.hover, padding: '3px 8px', borderRadius: 4 }}>{r.policy}</span>
                </td>
                <td style={{ padding: '12px 20px' }}><GhostBtn>Edit</GhostBtn></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
