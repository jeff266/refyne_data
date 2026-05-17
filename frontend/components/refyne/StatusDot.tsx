'use client';

import { C } from '@/lib/design-tokens';

interface StatusDotProps {
  color?: string;
}

export function StatusDot({ color = C.green }: StatusDotProps) {
  return (
    <span
      style={{
        display: 'inline-block',
        width: 6,
        height: 6,
        borderRadius: '50%',
        background: color,
        flexShrink: 0,
      }}
    />
  );
}
