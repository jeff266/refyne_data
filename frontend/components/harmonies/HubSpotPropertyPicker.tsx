'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { ChevronDown, Search, ExternalLink } from 'lucide-react';
import { C, F } from '@/lib/design-tokens';

export interface HubSpotPropertyPickerProps {
  objectType: 'company' | 'contact';
  value: string | null;
  onChange: (propertyName: string, propertyLabel: string) => void;
  placeholder?: string;
}

interface HubSpotProperty {
  name: string;
  label: string;
  type: string;
  fieldType: string;
  groupName: string;
  description?: string;
  hubspotDefined: boolean;
}

export function HubSpotPropertyPicker({
  objectType,
  value,
  onChange,
  placeholder = 'Select a HubSpot property...',
}: HubSpotPropertyPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [notConnected, setNotConnected] = useState(false);
  const [standardProperties, setStandardProperties] = useState<HubSpotProperty[]>([]);
  const [customProperties, setCustomProperties] = useState<HubSpotProperty[]>([]);

  // Fetch properties on mount or when objectType changes
  useEffect(() => {
    async function fetchProperties() {
      setLoading(true);
      setNotConnected(false);

      try {
        const response = await fetch(`/api/hubspot/properties?objectType=${objectType}`);
        const data = await response.json();

        if (data.notConnected) {
          setNotConnected(true);
          return;
        }

        if (response.ok && data.properties) {
          setStandardProperties(data.properties.standard || []);
          setCustomProperties(data.properties.custom || []);
        }
      } catch (error) {
        console.error('Failed to fetch HubSpot properties:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchProperties();
  }, [objectType]);

  // Filter properties based on search
  const filteredStandard = useMemo(() => {
    if (!search) return standardProperties;
    const query = search.toLowerCase();
    return standardProperties.filter(
      p => p.label.toLowerCase().includes(query) || p.name.toLowerCase().includes(query)
    );
  }, [standardProperties, search]);

  const filteredCustom = useMemo(() => {
    if (!search) return customProperties;
    const query = search.toLowerCase();
    return customProperties.filter(
      p => p.label.toLowerCase().includes(query) || p.name.toLowerCase().includes(query)
    );
  }, [customProperties, search]);

  // Get selected property label
  const selectedProperty = useMemo(() => {
    if (!value) return null;
    return [...standardProperties, ...customProperties].find(p => p.name === value);
  }, [value, standardProperties, customProperties]);

  if (notConnected) {
    return (
      <div
        style={{
          padding: '12px 16px',
          background: C.surface,
          border: `1px solid ${C.border2}`,
          borderRadius: 8,
          fontSize: 12,
          color: C.text3,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span>Connect HubSpot to browse properties</span>
        <Link
          href="/connections"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            color: C.indigo,
            textDecoration: 'none',
            fontSize: 11,
          }}
        >
          Go to connections
          <ExternalLink size={11} />
        </Link>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative' }}>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{
          width: '100%',
          padding: '10px 14px',
          background: C.surface,
          border: `1px solid ${open ? C.indigo : C.border2}`,
          borderRadius: 8,
          fontSize: 12,
          color: value ? C.text : C.text3,
          textAlign: 'left',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          outline: 'none',
        }}
      >
        <span>{selectedProperty ? selectedProperty.label : placeholder}</span>
        <ChevronDown
          size={14}
          style={{
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s',
            color: C.text3,
          }}
        />
      </button>

      {/* Dropdown */}
      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            background: C.surface,
            border: `1px solid ${C.border2}`,
            borderRadius: 8,
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            zIndex: 100,
            maxHeight: 400,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Search input */}
          <div style={{ padding: 12, borderBottom: `1px solid ${C.border}` }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                background: C.bg,
                border: `1px solid ${C.border}`,
                borderRadius: 6,
                padding: '6px 10px',
              }}
            >
              <Search size={12} color={C.text3} />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search properties..."
                autoFocus
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  fontSize: 11,
                  color: C.text,
                }}
              />
            </div>
          </div>

          {/* Property list */}
          <div style={{ overflowY: 'auto', maxHeight: 320 }}>
            {loading ? (
              <div style={{ padding: 16, fontSize: 11, color: C.text3, textAlign: 'center' }}>
                Loading properties...
              </div>
            ) : (
              <>
                {/* Standard properties */}
                {filteredStandard.length > 0 && (
                  <>
                    <div
                      style={{
                        padding: '8px 14px',
                        fontSize: 10,
                        fontWeight: 600,
                        color: C.text3,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        background: C.bg,
                      }}
                    >
                      Standard Properties
                    </div>
                    {filteredStandard.map((prop) => (
                      <PropertyOption
                        key={prop.name}
                        property={prop}
                        selected={value === prop.name}
                        onClick={() => {
                          onChange(prop.name, prop.label);
                          setOpen(false);
                          setSearch('');
                        }}
                      />
                    ))}
                  </>
                )}

                {/* Custom properties */}
                {filteredCustom.length > 0 && (
                  <>
                    {filteredStandard.length > 0 && (
                      <div style={{ borderTop: `1px solid ${C.border}`, margin: '8px 0' }} />
                    )}
                    <div
                      style={{
                        padding: '8px 14px',
                        fontSize: 10,
                        fontWeight: 600,
                        color: C.text3,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        background: C.bg,
                      }}
                    >
                      Custom Properties
                    </div>
                    {filteredCustom.map((prop) => (
                      <PropertyOption
                        key={prop.name}
                        property={prop}
                        selected={value === prop.name}
                        onClick={() => {
                          onChange(prop.name, prop.label);
                          setOpen(false);
                          setSearch('');
                        }}
                      />
                    ))}
                  </>
                )}

                {/* No results */}
                {filteredStandard.length === 0 && filteredCustom.length === 0 && (
                  <div
                    style={{
                      padding: 16,
                      fontSize: 11,
                      color: C.text3,
                      textAlign: 'center',
                    }}
                  >
                    No properties found
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Click outside to close */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99,
          }}
        />
      )}
    </div>
  );
}

function PropertyOption({
  property,
  selected,
  onClick,
}: {
  property: HubSpotProperty;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: '100%',
        padding: '10px 14px',
        background: selected ? C.indigoDim : 'transparent',
        border: 'none',
        borderBottom: `1px solid ${C.border}`,
        cursor: 'pointer',
        textAlign: 'left',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
      }}
    >
      <span
        style={{
          fontSize: 12,
          color: selected ? C.indigo : C.text,
          fontWeight: selected ? 600 : 400,
          flex: 1,
          minWidth: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {property.label}
      </span>
      <span
        style={{
          fontSize: 10,
          fontFamily: F.mono,
          color: C.text3,
          flexShrink: 0,
        }}
      >
        {property.name}
      </span>
    </button>
  );
}
