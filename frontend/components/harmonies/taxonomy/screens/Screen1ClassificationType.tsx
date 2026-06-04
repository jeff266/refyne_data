/**
 * Screen 1: Classification Type Selection
 *
 * User selects what type of field they're classifying:
 * - Industry
 * - Sub-industry
 * - Market segment
 * - Custom field
 */

'use client';

import { C } from '@/lib/design-tokens';
import type { ClassificationType } from '../hooks/useTaxonomyWizard';

interface Screen1Props {
  classificationType: ClassificationType;
  onSelect: (type: ClassificationType) => void;
}

const options = [
  { value: 'industry' as const, label: 'Industry', desc: 'Normalize the main industry field' },
  { value: 'sub-industry' as const, label: 'Sub-industry', desc: 'Add a second tier of classification' },
  { value: 'market-segment' as const, label: 'Market segment', desc: 'Route accounts to the right segment' },
  { value: 'custom' as const, label: 'Custom field', desc: "I'll define my own" },
];

export function Screen1ClassificationType({ classificationType, onSelect }: Screen1Props) {
  return (
    <div>
      <h3 style={{ fontSize: 16, fontWeight: 600, color: C.text, marginBottom: 24 }}>
        What field are you classifying?
      </h3>

      {options.map((option) => (
        <div
          key={option.value}
          onClick={() => onSelect(option.value)}
          style={{
            padding: '16px 20px',
            marginBottom: 12,
            background: classificationType === option.value ? C.indigoDim : C.surface,
            border: `1px solid ${classificationType === option.value ? C.indigo : C.border}`,
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
            border: `2px solid ${classificationType === option.value ? C.indigo : C.border}`,
            background: classificationType === option.value ? C.indigo : 'transparent',
          }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 500, color: C.text, marginBottom: 4 }}>
              {option.label}
            </div>
            <div style={{ fontSize: 12, color: C.text3 }}>
              {option.desc}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
