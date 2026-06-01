'use client';

import { C, F } from '@/lib/design-tokens';
import type { ReactNode, MouseEventHandler, CSSProperties } from 'react';

interface GhostBtnProps {
  children: ReactNode;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  disabled?: boolean;
  style?: CSSProperties;
  type?: 'button' | 'submit' | 'reset';
}

export function GhostBtn({ children, onClick, disabled, style, type = 'button' }: GhostBtnProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '5px 12px',
        border: `1px solid ${C.border2}`,
        color: disabled ? C.text3 : C.text2,
        borderRadius: 7,
        fontSize: 12,
        fontFamily: F.sans,
        background: 'transparent',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        ...style,
      }}
    >
      {children}
    </button>
  );
}
