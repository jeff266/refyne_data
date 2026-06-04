/**
 * Screen 3b: Reading Values from HubSpot
 *
 * Loading state shown while reading field values from HubSpot.
 */

'use client';

import { C } from '@/lib/design-tokens';

interface Props {
  objectType: string;
  fieldLabel: string;
}

export function Screen3bReadingValues({ objectType, fieldLabel }: Props) {
  return (
    <div>
      <h3 style={{ fontSize: 16, fontWeight: 600, color: C.text, marginBottom: 24 }}>
        Reading from HubSpot
      </h3>

      <div style={{ marginBottom: 16, fontSize: 13, color: C.text2 }}>
        Reading distinct values from{' '}
        <span style={{ fontWeight: 500, color: C.text }}>{fieldLabel}</span>
        {' '}across {objectType}s...
      </div>

      {/* Animated progress bar */}
      <div style={{
        width: '100%',
        height: 4,
        background: C.border,
        borderRadius: 0,
        overflow: 'hidden',
        marginBottom: 24,
      }}>
        <div style={{
          width: '70%',
          height: '100%',
          background: C.indigo,
          animation: 'pulse 1.5s ease-in-out infinite',
        }} />
      </div>

      <div style={{ fontSize: 12, color: C.text3 }}>
        This takes a few seconds for large portals...
      </div>

      <style jsx>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}
