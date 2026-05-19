'use client';

import { useState, useEffect } from 'react';
import { Plus, Loader2 } from 'lucide-react';
import { C, F } from '@/lib/design-tokens';
import { Card, PrimaryBtn, GhostBtn } from '@/components/refyne';

interface FieldMapping {
  id: string;
  canonical_field: string;
  hubspot_property: string;
  write_policy: 'always_overwrite' | 'overwrite_if_blank_or_ours' | 'never_overwrite';
  is_active: boolean;
}

function policyColor(p: string) {
  return p === 'always_overwrite' ? C.amber : p === 'never_overwrite' ? C.text3 : C.green;
}

export default function MappingsPage() {
  const [mappings, setMappings] = useState<FieldMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchMappings();
  }, []);

  async function fetchMappings() {
    try {
      setLoading(true);
      const res = await fetch('/api/field-mappings');
      if (!res.ok) {
        throw new Error('Failed to fetch field mappings');
      }
      const data = await res.json();
      setMappings(data.mappings || []);
    } catch (err) {
      console.error('Error fetching field mappings:', err);
      setError(err instanceof Error ? err.message : 'Failed to load field mappings');
    } finally {
      setLoading(false);
    }
  }

  async function updateMapping(id: string, updates: Partial<FieldMapping>) {
    try {
      const res = await fetch(`/api/field-mappings/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!res.ok) {
        throw new Error('Failed to update field mapping');
      }
      const data = await res.json();
      // Update local state
      setMappings(mappings.map(m => m.id === id ? data.mapping : m));
    } catch (err) {
      console.error('Error updating field mapping:', err);
      alert(err instanceof Error ? err.message : 'Failed to update field mapping');
    }
  }

  if (loading) {
    return (
      <div style={{ padding: '28px 32px', fontFamily: F.sans, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <Loader2 size={24} color={C.text3} style={{ animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '28px 32px', fontFamily: F.sans }}>
        <Card style={{ padding: 20, textAlign: 'center', color: C.red }}>
          {error}
        </Card>
      </div>
    );
  }

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
            {mappings.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ padding: '40px 20px', textAlign: 'center', color: C.text3 }}>
                  No field mappings configured
                </td>
              </tr>
            ) : (
              mappings.map((r) => (
                <tr key={r.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                  <td style={{ padding: '12px 20px', fontFamily: F.mono, color: C.text, fontSize: 11, fontWeight: 500 }}>{r.canonical_field}</td>
                  <td style={{ padding: '12px 20px', fontFamily: F.mono, color: C.text2, fontSize: 11 }}>{r.hubspot_property}</td>
                  <td style={{ padding: '12px 20px' }}>
                    <span style={{ fontSize: 10, fontFamily: F.mono, color: policyColor(r.write_policy), background: C.hover, padding: '3px 8px', borderRadius: 4 }}>{r.write_policy}</span>
                  </td>
                  <td style={{ padding: '12px 20px' }}><GhostBtn onClick={() => {}}>Edit</GhostBtn></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
