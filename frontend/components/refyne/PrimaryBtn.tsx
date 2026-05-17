'use client';

import { C, F } from '@/lib/design-tokens';
import type { ReactNode, MouseEventHandler } from 'react';

interface PrimaryBtnProps {
  children: ReactNode;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  small?: boolean;
  disabled?: boolean;
}

export function PrimaryBtn({ children, onClick, small, disabled }: PrimaryBtnProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: small ? '4px 10px' : '6px 14px',
        background: disabled
          ? C.text3
          : `linear-gradient(to bottom, ${C.indigo}, ${C.indigoDk})`,
        color: '#fff',
        borderRadius: 7,
        fontSize: small ? 11 : 12,
        fontWeight: 500,
        fontFamily: F.sans,
        boxShadow: disabled
          ? 'none'
          : '0 0 0 1px rgba(99,102,241,0.3), 0 1px 3px rgba(0,0,0,0.4)',
        letterSpacing: '-0.01em',
        border: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
      }}
    >
      {children}
    </button>
  );
}
