'use client';

import { C } from '@/lib/design-tokens';
import type { ChipColor } from '@/lib/design-tokens';
import type { ReactNode } from 'react';

interface ChipProps {
  children: ReactNode;
  color?: ChipColor;
}

export function Chip({ children, color = 'indigo' }: ChipProps) {
  const bg =
    color === 'green'
      ? C.greenDim
      : color === 'red'
        ? C.redDim
        : color === 'amber'
          ? C.amberDim
          : C.indigoDim;
  const tc =
    color === 'green'
      ? C.green
      : color === 'red'
        ? C.red
        : color === 'amber'
          ? C.amber
          : C.indigoLt;
  const br =
    color === 'green'
      ? C.greenBrd
      : color === 'red'
        ? 'rgba(239,68,68,0.2)'
        : color === 'amber'
          ? 'rgba(245,158,11,0.2)'
          : C.indigoBrd;

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 3,
        padding: '2px 7px',
        background: bg,
        color: tc,
        borderRadius: 5,
        fontSize: 11,
        fontWeight: 500,
        border: `1px solid ${br}`,
      }}
    >
      {children}
    </span>
  );
}
