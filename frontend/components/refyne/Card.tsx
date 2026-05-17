'use client';

import { C } from '@/lib/design-tokens';
import type { CSSProperties, ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  style?: CSSProperties;
}

export function Card({ children, style = {} }: CardProps) {
  return (
    <div style={{
      background: C.surface,
      border: `1px solid ${C.border}`,
      borderRadius: 12,
      ...style,
    }}>
      {children}
    </div>
  );
}
