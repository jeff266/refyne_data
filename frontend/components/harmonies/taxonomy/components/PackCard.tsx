/**
 * PackCard Component
 *
 * Displays a single taxonomy pack option with selection state.
 */

'use client';

import { C, F } from '@/lib/design-tokens';
import type { Pack } from '../hooks/useTaxonomyWizard';

interface PackCardProps {
  pack: Pack;
  isSelected: boolean;
  onSelect: (pack: Pack) => void;
}

export function PackCard({ pack, isSelected, onSelect }: PackCardProps) {
  return (
    <div
      onClick={() => onSelect(pack)}
      style={{
        padding: 20,
        background: C.indigoDim,
        border: `1px solid ${isSelected ? C.indigo : C.border}`,
        cursor: 'pointer',
      }}
    >
      <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 8 }}>
        {pack.name}
      </div>
      <div style={{ fontSize: 12, color: C.text3, marginBottom: 12 }}>
        {pack.entryCount} mappings pre-loaded
      </div>
      {isSelected && (
        <div style={{
          padding: '6px 12px',
          background: C.indigo,
          color: '#fff',
          fontSize: 12,
          fontWeight: 500,
          textAlign: 'center',
        }}>
          Selected
        </div>
      )}
      {!isSelected && (
        <button
          style={{
            width: '100%',
            padding: '6px 12px',
            background: 'transparent',
            border: `1px solid ${C.border}`,
            color: C.text,
            fontSize: 12,
            cursor: 'pointer',
            fontFamily: F.sans,
          }}
        >
          Select
        </button>
      )}
    </div>
  );
}
