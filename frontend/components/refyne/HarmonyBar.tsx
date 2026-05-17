'use client';

import { C, F } from '@/lib/design-tokens';
import { Chip } from './Chip';

interface HarmonyBarProps {
  name: string;
  score: number;
  note?: string;
}

export function HarmonyBar({ name, score, note }: HarmonyBarProps) {
  const col = score >= 90 ? C.green : score >= 75 ? C.amber : C.red;

  return (
    <div style={{ marginBottom: 16 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 6,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, fontFamily: F.mono, color: C.text2 }}>
            {name}
          </span>
          {note && <Chip color="amber">{note}</Chip>}
        </div>
        <span
          style={{
            fontSize: 12,
            fontFamily: F.mono,
            color: col,
            fontWeight: 500,
          }}
        >
          {score}%
        </span>
      </div>
      <div style={{ height: 3, background: C.hover, borderRadius: 2 }}>
        <div
          style={{
            height: '100%',
            width: `${score}%`,
            background: col,
            borderRadius: 2,
            transition: 'width 0.4s ease',
          }}
        />
      </div>
    </div>
  );
}
