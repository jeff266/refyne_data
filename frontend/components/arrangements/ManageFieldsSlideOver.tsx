'use client';

import { useState, useEffect } from 'react';
import { C } from '@/lib/design-tokens';
import { PrimaryBtn, GhostBtn } from '@/components/refyne';
import { addToast } from '@/components/ui/toast';
import { X, RefreshCw, AlertCircle } from 'lucide-react';
import { FieldConfig } from './ArrangementWaterfallBuilder';

interface HubSpotProperty {
  name: string;
  label: string;
  type: string;
  fieldType: 'categorical' | 'numeric' | 'url' | 'text' | 'boolean';
  objectType: 'company' | 'contact';
  calculated: boolean;
}

interface ManageFieldsSlideOverProps {
  open: boolean;
  onClose: () => void;
  currentFields: FieldConfig[];
  onSave: (fields: FieldConfig[]) => void;
}

const STANDARD_COMPANY_FIELDS: Array<{ key: string; label: string; type: FieldConfig['field_type'] }> = [
  { key: 'domain', label: 'Domain', type: 'url' },
  { key: 'industry', label: 'Industry', type: 'categorical' },
  { key: 'employee_count', label: 'Employee Count', type: 'numeric' },
  { key: 'annual_revenue', label: 'Annual Revenue', type: 'numeric' },
  { key: 'phone', label: 'Phone', type: 'text' },
  { key: 'city', label: 'City', type: 'text' },
  { key: 'state', label: 'State', type: 'text' },
  { key: 'country', label: 'Country', type: 'text' },
  { key: 'postal_code', label: 'Postal Code', type: 'text' },
  { key: 'linkedin_url', label: 'LinkedIn URL', type: 'url' },
  { key: 'facebook_url', label: 'Facebook URL', type: 'url' },
  { key: 'twitter_handle', label: 'Twitter Handle', type: 'text' },
  { key: 'founded_year', label: 'Founded Year', type: 'numeric' },
  { key: 'description', label: 'Description', type: 'text' },
  { key: 'timezone', label: 'Timezone', type: 'text' },
  { key: 'total_funding', label: 'Total Funding', type: 'numeric' },
];

const STANDARD_CONTACT_FIELDS: Array<{ key: string; label: string; type: FieldConfig['field_type'] }> = [
  { key: 'email', label: 'Email', type: 'text' },
  { key: 'firstname', label: 'First Name', type: 'text' },
  { key: 'lastname', label: 'Last Name', type: 'text' },
  { key: 'jobtitle', label: 'Job Title', type: 'text' },
  { key: 'phone', label: 'Phone', type: 'text' },
  { key: 'mobilephone', label: 'Mobile Phone', type: 'text' },
  { key: 'linkedin_url', label: 'LinkedIn URL', type: 'url' },
  { key: 'twitter_handle', label: 'Twitter Handle', type: 'text' },
];

export function ManageFieldsSlideOver({ open, onClose, currentFields, onSave }: ManageFieldsSlideOverProps) {
  const [selectedFields, setSelectedFields] = useState<Set<string>>(new Set());
  const [customProperties, setCustomProperties] = useState<HubSpotProperty[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [cacheEmpty, setCacheEmpty] = useState(false);

  useEffect(() => {
    if (open) {
      // Initialize with current fields
      const currentKeys = new Set(currentFields.map((f) => f.field_key));
      setSelectedFields(currentKeys);

      // Load custom properties from cache
      loadCustomProperties();
    }
  }, [open, currentFields]);

  const loadCustomProperties = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/hubspot/properties-cache');
      if (res.ok) {
        const { properties } = await res.json();

        if (!properties || properties.length === 0) {
          setCacheEmpty(true);
          setCustomProperties([]);
        } else {
          setCacheEmpty(false);
          // Filter out calculated fields
          const writable = properties.filter((p: any) => !p.calculated && !p.readOnlyValue);
          setCustomProperties(
            writable.map((p: any) => ({
              name: p.name,
              label: p.label,
              type: p.type,
              fieldType: mapHubSpotTypeToFieldType(p.type),
              objectType: p.objectType || 'company',
              calculated: p.calculated,
            }))
          );
        }
      } else {
        setCacheEmpty(true);
      }
    } catch (error) {
      console.error('Failed to load custom properties:', error);
      setCacheEmpty(true);
    } finally {
      setLoading(false);
    }
  };

  const handleSyncProperties = async () => {
    setSyncing(true);
    try {
      const res = await fetch('/api/hubspot/sync-properties', { method: 'POST' });
      if (res.ok) {
        addToast('success', 'Properties synced from HubSpot');
        await loadCustomProperties();
      } else {
        throw new Error('Sync failed');
      }
    } catch (error) {
      console.error('Failed to sync properties:', error);
      addToast('error', 'Failed to sync properties from HubSpot');
    } finally {
      setSyncing(false);
    }
  };

  const handleToggleField = (fieldKey: string) => {
    const newSet = new Set(selectedFields);
    if (newSet.has(fieldKey)) {
      newSet.delete(fieldKey);
    } else {
      newSet.add(fieldKey);
    }
    setSelectedFields(newSet);
  };

  const handleSave = () => {
    // Create FieldConfig objects for new fields
    const allAvailableFields = [
      ...STANDARD_COMPANY_FIELDS,
      ...STANDARD_CONTACT_FIELDS,
      ...customProperties.map((p) => ({ key: p.name, label: p.label, type: p.fieldType })),
    ];

    const newConfigs: FieldConfig[] = Array.from(selectedFields).map((fieldKey) => {
      // Check if already in current fields
      const existing = currentFields.find((f) => f.field_key === fieldKey);
      if (existing) return existing;

      // Create new config
      const fieldDef = allAvailableFields.find((f) => f.key === fieldKey);
      return {
        field_key: fieldKey,
        field_type: fieldDef?.type || 'text',
        aggregation_strategy: 'waterfall',
        apply_harmony: false,
        harmony_id: null,
        steps: [],
      };
    });

    onSave(newConfigs);
    onClose();
  };

  const mapHubSpotTypeToFieldType = (hsType: string): FieldConfig['field_type'] => {
    if (hsType === 'number') return 'numeric';
    if (hsType === 'bool' || hsType === 'boolean') return 'boolean';
    if (hsType === 'enumeration') return 'categorical';
    return 'text';
  };

  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        width: 600,
        background: C.surface,
        boxShadow: '-4px 0 24px rgba(0, 0, 0, 0.2)',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '20px 24px',
          borderBottom: `1px solid ${C.border}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <h2 style={{ fontSize: 18, fontWeight: 600, color: C.text }}>Manage Fields</h2>
        <button
          onClick={onClose}
          style={{
            background: 'transparent',
            border: 'none',
            color: C.text3,
            cursor: 'pointer',
            padding: 4,
          }}
        >
          <X size={20} />
        </button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
        {/* Standard Company Fields */}
        <div style={{ marginBottom: 32 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 12 }}>
            Standard Company Fields
          </h3>
          <div style={{ display: 'grid', gap: 8 }}>
            {STANDARD_COMPANY_FIELDS.map((field) => (
              <label
                key={field.key}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: 12,
                  background: selectedFields.has(field.key) ? C.indigoDim : C.bg,
                  border: `1px solid ${selectedFields.has(field.key) ? C.indigoBrd : C.border}`,
                  borderRadius: 6,
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={selectedFields.has(field.key)}
                  onChange={() => handleToggleField(field.key)}
                  style={{ cursor: 'pointer' }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: C.text, fontWeight: 500 }}>{field.label}</div>
                  <div style={{ fontSize: 11, color: C.text3 }}>{field.type}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Standard Contact Fields */}
        <div style={{ marginBottom: 32 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 12 }}>
            Standard Contact Fields
          </h3>
          <div style={{ display: 'grid', gap: 8 }}>
            {STANDARD_CONTACT_FIELDS.map((field) => (
              <label
                key={field.key}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: 12,
                  background: selectedFields.has(field.key) ? C.indigoDim : C.bg,
                  border: `1px solid ${selectedFields.has(field.key) ? C.indigoBrd : C.border}`,
                  borderRadius: 6,
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={selectedFields.has(field.key)}
                  onChange={() => handleToggleField(field.key)}
                  style={{ cursor: 'pointer' }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: C.text, fontWeight: 500 }}>{field.label}</div>
                  <div style={{ fontSize: 11, color: C.text3 }}>{field.type}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Custom Fields */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: C.text }}>Custom HubSpot Fields</h3>
            <GhostBtn onClick={handleSyncProperties} disabled={syncing}>
              <RefreshCw size={14} />
              {syncing ? 'Syncing...' : 'Sync from HubSpot'}
            </GhostBtn>
          </div>

          {cacheEmpty && (
            <div
              style={{
                padding: 16,
                background: C.amberDim,
                border: `1px solid ${C.amberBrd}`,
                borderRadius: 8,
                display: 'flex',
                alignItems: 'start',
                gap: 12,
              }}
            >
              <AlertCircle size={16} color={C.amber} style={{ marginTop: 2 }} />
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 13, color: C.text, marginBottom: 6 }}>
                  No custom fields found
                </p>
                <p style={{ fontSize: 12, color: C.text2 }}>
                  Connect HubSpot and sync properties to see custom fields from your portal.
                </p>
              </div>
            </div>
          )}

          {!cacheEmpty && customProperties.length > 0 && (
            <div style={{ display: 'grid', gap: 8 }}>
              {customProperties.map((prop) => (
                <label
                  key={prop.name}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: 12,
                    background: selectedFields.has(prop.name) ? C.indigoDim : C.bg,
                    border: `1px solid ${selectedFields.has(prop.name) ? C.indigoBrd : C.border}`,
                    borderRadius: 6,
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selectedFields.has(prop.name)}
                    onChange={() => handleToggleField(prop.name)}
                    style={{ cursor: 'pointer' }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, color: C.text, fontWeight: 500 }}>{prop.label}</div>
                    <div style={{ fontSize: 11, color: C.text3 }}>
                      {prop.name} • {prop.fieldType} • {prop.objectType}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div
        style={{
          padding: '16px 24px',
          borderTop: `1px solid ${C.border}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div style={{ fontSize: 13, color: C.text3 }}>
          {selectedFields.size} field{selectedFields.size !== 1 ? 's' : ''} selected
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <GhostBtn onClick={onClose}>Cancel</GhostBtn>
          <PrimaryBtn onClick={handleSave}>Save</PrimaryBtn>
        </div>
      </div>
    </div>
  );
}
