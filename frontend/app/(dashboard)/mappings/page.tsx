'use client';

import { useState, useEffect } from 'react';
import { Plus, Loader2, Lock, ArrowRight } from 'lucide-react';
import { C, F } from '@/lib/design-tokens';
import { Card, PrimaryBtn, GhostBtn } from '@/components/refyne';

interface FieldMapping {
  id: string;
  canonical_field: string;
  hubspot_property: string;
  write_policy: 'fill_gaps' | 'always_overwrite' | 'never_overwrite';
  is_active: boolean;
  is_system: boolean;
  portal_id: string | null;
  object_type: string;
}

interface UnmappedProperty {
  property_name: string;
  property_label: string;
  property_type: string;
  portal_id: string;
  is_custom: boolean;
}

interface Portal {
  id: string;
  portal_id: string;
  portal_name: string;
}

function policyColor(p: string) {
  return p === 'always_overwrite' ? C.amber : p === 'never_overwrite' ? C.text3 : C.green;
}

export default function MappingsPage() {
  const [mappings, setMappings] = useState<FieldMapping[]>([]);
  const [unmappedProps, setUnmappedProps] = useState<UnmappedProperty[]>([]);
  const [portals, setPortals] = useState<Portal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [objectFilter, setObjectFilter] = useState<string>('company');
  const [portalFilter, setPortalFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  useEffect(() => {
    fetchData();
  }, [objectFilter, portalFilter]);

  async function fetchData() {
    try {
      setLoading(true);

      // Fetch portals for filter
      const portalsRes = await fetch('/api/hubspot/connections');
      if (portalsRes.ok) {
        const portalsData = await portalsRes.json();
        setPortals(portalsData.connections || []);
      }

      // Fetch field mappings
      const mappingsRes = await fetch(
        `/api/field-mappings?object_type=${objectFilter}${portalFilter !== 'all' ? `&portal_id=${portalFilter}` : ''}`
      );
      if (!mappingsRes.ok) {
        throw new Error('Failed to fetch field mappings');
      }
      const mappingsData = await mappingsRes.json();
      setMappings(mappingsData.mappings || []);

      // Fetch unmapped properties
      if (portalFilter !== 'all') {
        const unmappedRes = await fetch(
          `/api/field-mappings/unmapped?object_type=${objectFilter}&portal_id=${portalFilter}`
        );
        if (unmappedRes.ok) {
          const unmappedData = await unmappedRes.json();
          setUnmappedProps(unmappedData.properties || []);
        }
      } else {
        setUnmappedProps([]);
      }
    } catch (err) {
      console.error('Error fetching data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }

  // Filter mappings by type
  const systemMappings = mappings.filter((m) => m.is_system);
  const customMappings = mappings.filter((m) => !m.is_system);

  // Apply type filter
  const filteredMappings =
    typeFilter === 'all'
      ? mappings
      : typeFilter === 'system'
      ? systemMappings
      : typeFilter === 'custom'
      ? customMappings
      : [];

  const showUnmapped = typeFilter === 'all' || typeFilter === 'unmapped';

  if (loading) {
    return (
      <div
        style={{
          padding: '28px 32px',
          fontFamily: F.sans,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: 400,
        }}
      >
        <Loader2
          size={24}
          color={C.text3}
          className="animate-spin"
        />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '28px 32px', fontFamily: F.sans }}>
        <Card style={{ padding: 20, textAlign: 'center', color: C.red }}>{error}</Card>
      </div>
    );
  }

  return (
    <div style={{ padding: '28px 32px', fontFamily: F.sans }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: C.text, marginBottom: 8 }}>
          Field Mappings
        </h1>
        <p style={{ fontSize: 13, color: C.text3 }}>
          Configure how Refyne canonical fields map to HubSpot properties
        </p>
      </div>

      {/* Filters */}
      <Card style={{ padding: 16, marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          {/* Object filter */}
          <div style={{ flex: '0 0 200px' }}>
            <label
              style={{
                display: 'block',
                fontSize: 11,
                fontWeight: 500,
                color: C.text3,
                marginBottom: 6,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              Object
            </label>
            <select
              value={objectFilter}
              onChange={(e) => setObjectFilter(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                fontSize: 12,
                color: C.text,
                background: C.surface,
                border: `1px solid ${C.border}`,
                borderRadius: 6,
                cursor: 'pointer',
                fontFamily: F.sans,
              }}
            >
              <option value="company">Companies</option>
              <option value="contact">Contacts</option>
              <option value="deal" disabled>
                Deals (coming soon)
              </option>
            </select>
          </div>

          {/* Portal filter */}
          <div style={{ flex: '0 0 200px' }}>
            <label
              style={{
                display: 'block',
                fontSize: 11,
                fontWeight: 500,
                color: C.text3,
                marginBottom: 6,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              Portal
            </label>
            <select
              value={portalFilter}
              onChange={(e) => setPortalFilter(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                fontSize: 12,
                color: C.text,
                background: C.surface,
                border: `1px solid ${C.border}`,
                borderRadius: 6,
                cursor: 'pointer',
                fontFamily: F.sans,
              }}
            >
              <option value="all">All portals</option>
              {portals.map((p) => (
                <option key={p.id} value={p.portal_id}>
                  {p.portal_name || `Portal ${p.portal_id}`}
                </option>
              ))}
            </select>
          </div>

          {/* Type filter */}
          <div style={{ flex: '0 0 200px' }}>
            <label
              style={{
                display: 'block',
                fontSize: 11,
                fontWeight: 500,
                color: C.text3,
                marginBottom: 6,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              Type
            </label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                fontSize: 12,
                color: C.text,
                background: C.surface,
                border: `1px solid ${C.border}`,
                borderRadius: 6,
                cursor: 'pointer',
                fontFamily: F.sans,
              }}
            >
              <option value="all">All</option>
              <option value="system">System</option>
              <option value="custom">Custom</option>
              <option value="unmapped">Unmapped</option>
            </select>
          </div>
        </div>
      </Card>

      {/* System Mappings */}
      {(typeFilter === 'all' || typeFilter === 'system') && systemMappings.length > 0 && (
        <Card style={{ marginBottom: 16 }}>
          <div
            style={{
              padding: '14px 20px',
              borderBottom: `1px solid ${C.border}`,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: C.text,
                  letterSpacing: '-0.01em',
                }}
              >
                System Mappings
              </span>
              <span
                style={{
                  fontSize: 11,
                  color: C.text3,
                  marginLeft: 8,
                }}
              >
                Auto-configured by Refyne
              </span>
            </div>
          </div>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: 12,
              fontFamily: F.sans,
            }}
          >
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                {['Canonical field', 'HubSpot property', 'Write policy', 'Type'].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: '10px 20px',
                      textAlign: 'left',
                      color: C.text3,
                      fontSize: 11,
                      fontWeight: 500,
                      letterSpacing: '0.03em',
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {systemMappings.map((r) => (
                <tr key={r.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                  <td
                    style={{
                      padding: '12px 20px',
                      fontFamily: F.mono,
                      color: C.text,
                      fontSize: 11,
                      fontWeight: 500,
                    }}
                  >
                    {r.canonical_field}
                  </td>
                  <td
                    style={{
                      padding: '12px 20px',
                      fontFamily: F.mono,
                      color: C.text2,
                      fontSize: 11,
                    }}
                  >
                    {r.hubspot_property}
                  </td>
                  <td style={{ padding: '12px 20px' }}>
                    <span
                      style={{
                        fontSize: 10,
                        fontFamily: F.mono,
                        color: policyColor(r.write_policy),
                        background: C.hover,
                        padding: '3px 8px',
                        borderRadius: 4,
                      }}
                    >
                      {r.write_policy}
                    </span>
                  </td>
                  <td style={{ padding: '12px 20px' }}>
                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        fontSize: 10,
                        color: C.text3,
                      }}
                    >
                      <Lock size={12} />
                      <span>System</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {/* Custom Mappings */}
      {(typeFilter === 'all' || typeFilter === 'custom') && (
        <Card style={{ marginBottom: 16 }}>
          <div
            style={{
              padding: '14px 20px',
              borderBottom: `1px solid ${C.border}`,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: C.text,
                letterSpacing: '-0.01em',
              }}
            >
              Custom Mappings
            </span>
            <PrimaryBtn>
              <Plus size={12} /> Add mapping
            </PrimaryBtn>
          </div>
          {customMappings.length === 0 ? (
            <div
              style={{
                padding: '40px 20px',
                textAlign: 'center',
                color: C.text3,
                fontSize: 12,
              }}
            >
              No custom mappings yet. Add one above.
            </div>
          ) : (
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: 12,
                fontFamily: F.sans,
              }}
            >
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                  {['Canonical field', 'HubSpot property', 'Write policy', ''].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: '10px 20px',
                        textAlign: 'left',
                        color: C.text3,
                        fontSize: 11,
                        fontWeight: 500,
                        letterSpacing: '0.03em',
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {customMappings.map((r) => (
                  <tr key={r.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                    <td
                      style={{
                        padding: '12px 20px',
                        fontFamily: F.mono,
                        color: C.text,
                        fontSize: 11,
                        fontWeight: 500,
                      }}
                    >
                      {r.canonical_field}
                    </td>
                    <td
                      style={{
                        padding: '12px 20px',
                        fontFamily: F.mono,
                        color: C.text2,
                        fontSize: 11,
                      }}
                    >
                      {r.hubspot_property}
                    </td>
                    <td style={{ padding: '12px 20px' }}>
                      <span
                        style={{
                          fontSize: 10,
                          fontFamily: F.mono,
                          color: policyColor(r.write_policy),
                          background: C.hover,
                          padding: '3px 8px',
                          borderRadius: 4,
                        }}
                      >
                        {r.write_policy}
                      </span>
                    </td>
                    <td style={{ padding: '12px 20px' }}>
                      <GhostBtn onClick={() => {}}>Edit</GhostBtn>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}

      {/* Unmapped Properties */}
      {showUnmapped && portalFilter !== 'all' && (
        <Card>
          <div
            style={{
              padding: '14px 20px',
              borderBottom: `1px solid ${C.border}`,
            }}
          >
            <span
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: C.text,
                letterSpacing: '-0.01em',
              }}
            >
              Unmapped Properties
            </span>
            <span
              style={{
                fontSize: 11,
                color: C.text3,
                marginLeft: 8,
              }}
            >
              Custom HubSpot properties not yet mapped
            </span>
          </div>
          {unmappedProps.length === 0 ? (
            <div
              style={{
                padding: '40px 20px',
                textAlign: 'center',
                color: C.text3,
                fontSize: 12,
              }}
            >
              {portalFilter === 'all'
                ? 'Select a specific portal to see unmapped properties'
                : 'All custom properties are mapped'}
            </div>
          ) : (
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: 12,
                fontFamily: F.sans,
              }}
            >
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                  {['HubSpot property', 'Label', 'Type', 'Action'].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: '10px 20px',
                        textAlign: 'left',
                        color: C.text3,
                        fontSize: 11,
                        fontWeight: 500,
                        letterSpacing: '0.03em',
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {unmappedProps.map((prop) => (
                  <tr key={prop.property_name} style={{ borderBottom: `1px solid ${C.border}` }}>
                    <td
                      style={{
                        padding: '12px 20px',
                        fontFamily: F.mono,
                        color: C.text,
                        fontSize: 11,
                        fontWeight: 500,
                      }}
                    >
                      {prop.property_name}
                    </td>
                    <td
                      style={{
                        padding: '12px 20px',
                        color: C.text2,
                        fontSize: 11,
                      }}
                    >
                      {prop.property_label}
                    </td>
                    <td style={{ padding: '12px 20px' }}>
                      <span
                        style={{
                          fontSize: 10,
                          fontFamily: F.mono,
                          color: prop.is_custom ? C.indigo : C.text3,
                          background: C.hover,
                          padding: '3px 8px',
                          borderRadius: 4,
                        }}
                      >
                        {prop.is_custom ? 'Custom' : 'Standard'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 20px' }}>
                      <GhostBtn onClick={() => {}}>
                        Map <ArrowRight size={12} style={{ marginLeft: 4 }} />
                      </GhostBtn>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}
    </div>
  );
}
