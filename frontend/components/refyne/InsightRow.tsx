'use client';

import { C, F } from '@/lib/design-tokens';

interface InsightRowProps {
  type: 'ok' | 'warn' | 'error';
  harmony: string;
  text: string;
  action: string;
  onAction?: () => void;
}

export function InsightRow({ type, harmony, text, action, onAction }: InsightRowProps) {
  const col = type === 'ok' ? C.green : type === 'warn' ? C.amber : C.red;

  return (
    <div
      style={{
        display: 'flex',
        gap: 12,
        padding: '12px 16px',
        borderBottom: `1px solid ${C.border}`,
      }}
    >
      <div
        style={{
          width: 3,
          borderRadius: 2,
          background: col,
          flexShrink: 0,
          alignSelf: 'stretch',
        }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 11,
            fontFamily: F.mono,
            color: col,
            marginBottom: 3,
          }}
        >
          {harmony}
        </div>
        <div
          style={{
            fontSize: 12,
            color: C.text2,
            lineHeight: 1.5,
            marginBottom: 5,
          }}
        >
          {text}
        </div>
        <button
          onClick={onAction}
          style={{
            fontSize: 11,
            color: C.text3,
            textDecoration: 'underline',
            padding: 0,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          {action}
        </button>
      </div>
    </div>
  );
}
