/**
 * Screen 2: Field Mapping
 *
 * User selects source and target fields, and write policy.
 */

'use client';

import { C, F } from '@/lib/design-tokens';
import { HubSpotPropertyPicker } from '../../HubSpotPropertyPicker';

interface Screen2Props {
  sourceField: string;
  sourceFieldLabel: string;
  targetField: string;
  targetFieldLabel: string;
  createNewField: boolean;
  writePolicy: 'fill_empty' | 'always_overwrite';
  onSourceChange: (name: string, label: string) => void;
  onTargetChange: (name: string, label: string) => void;
  onCreateNewFieldChange: (value: boolean) => void;
  onTargetFieldChange: (value: string) => void;
  onWritePolicyChange: (policy: 'fill_empty' | 'always_overwrite') => void;
}

export function Screen2FieldMapping({
  sourceField,
  targetField,
  createNewField,
  writePolicy,
  onSourceChange,
  onTargetChange,
  onCreateNewFieldChange,
  onTargetFieldChange,
  onWritePolicyChange,
}: Screen2Props) {
  return (
    <div>
      <h3 style={{ fontSize: 16, fontWeight: 600, color: C.text, marginBottom: 24 }}>
        Where should classified values be written?
      </h3>

      <div style={{ marginBottom: 24 }}>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: C.text2, marginBottom: 8 }}>
          SOURCE FIELD (read from)
        </label>
        <HubSpotPropertyPicker
          objectType="company"
          value={sourceField}
          onChange={onSourceChange}
          placeholder="Select source field..."
        />
      </div>

      <div style={{ marginBottom: 24 }}>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: C.text2, marginBottom: 8 }}>
          TARGET FIELD (write to)
        </label>

        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, cursor: 'pointer' }}>
            <input
              type="radio"
              checked={!createNewField}
              onChange={() => onCreateNewFieldChange(false)}
              style={{ cursor: 'pointer' }}
            />
            <span style={{ fontSize: 13, color: C.text }}>Use an existing field</span>
          </label>
          {!createNewField && (
            <HubSpotPropertyPicker
              objectType="company"
              value={targetField}
              onChange={onTargetChange}
              placeholder="Select target field..."
            />
          )}
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <input
            type="radio"
            checked={createNewField}
            onChange={() => onCreateNewFieldChange(true)}
            style={{ cursor: 'pointer' }}
          />
          <span style={{ fontSize: 13, color: C.text }}>Let Refyne create a new field</span>
        </label>
        {createNewField && (
          <div style={{ marginTop: 12, padding: 12, background: C.surface, border: `1px solid ${C.border}` }}>
            <input
              type="text"
              value={targetField}
              onChange={(e) => onTargetFieldChange(e.target.value)}
              placeholder="refyne_sub_industry"
              style={{
                width: '100%',
                padding: '8px 12px',
                background: C.bg,
                border: `1px solid ${C.border}`,
                color: C.text,
                fontSize: 13,
                fontFamily: F.mono,
                outline: 'none',
              }}
            />
            <div style={{ fontSize: 11, color: C.text3, marginTop: 8 }}>
              Will be created in your HubSpot on first normalize run
            </div>
          </div>
        )}
      </div>

      <div>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: C.text2, marginBottom: 8 }}>
          WRITE POLICY
        </label>
        <div style={{ display: 'flex', gap: 12 }}>
          {[
            { value: 'fill_empty' as const, label: 'Fill empty only' },
            { value: 'always_overwrite' as const, label: 'Always overwrite' },
          ].map((policy) => (
            <label key={policy.value} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input
                type="radio"
                checked={writePolicy === policy.value}
                onChange={() => onWritePolicyChange(policy.value)}
                style={{ cursor: 'pointer' }}
              />
              <span style={{ fontSize: 13, color: C.text }}>{policy.label}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
