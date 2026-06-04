/**
 * Screen 2.5: Transform Type Selection
 *
 * User chooses between format function or lookup table transformation.
 */

'use client';

import { C } from '@/lib/design-tokens';
import type { TransformType } from '../hooks/useTaxonomyWizard';

interface Screen2p5Props {
  transformType: TransformType;
  onSelect: (type: TransformType) => void;
}

const options = [
  {
    value: 'format' as const,
    label: 'Format function',
    desc: 'Apply a built-in transformation rule',
    bestFor: 'Best for: phone numbers, emails, URLs, names',
  },
  {
    value: 'lookup' as const,
    label: 'Lookup table',
    desc: 'Map input values to canonical values',
    bestFor: 'Best for: industry, country, sub-industry',
  },
];

export function Screen2p5TransformType({ transformType, onSelect }: Screen2p5Props) {
  return (
    <div>
      <h3 style={{ fontSize: 16, fontWeight: 600, color: C.text, marginBottom: 24 }}>
        How should this harmony transform values?
      </h3>

      {options.map((option) => (
        <div
          key={option.value}
          onClick={() => onSelect(option.value)}
          style={{
            padding: '16px 20px',
            marginBottom: 12,
            background: transformType === option.value ? C.indigoDim : C.surface,
            border: `1px solid ${transformType === option.value ? C.indigo : C.border}`,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <div style={{
            width: 16,
            height: 16,
            borderRadius: '50%',
            border: `2px solid ${transformType === option.value ? C.indigo : C.border}`,
            background: transformType === option.value ? C.indigo : 'transparent',
          }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 500, color: C.text, marginBottom: 4 }}>
              {option.label}
            </div>
            <div style={{ fontSize: 12, color: C.text3, marginBottom: 4 }}>
              {option.desc}
            </div>
            <div style={{ fontSize: 11, color: C.text3, fontStyle: 'italic' }}>
              {option.bestFor}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
