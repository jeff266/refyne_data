'use client';

import { C, F } from '@/lib/design-tokens';
import { Card } from './Card';

interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
  accent?: string;
}

export function StatCard({ label, value, sub, accent }: StatCardProps) {
  return (
    <Card style={{ padding: '18px 20px' }}>
      <div
        style={{
          fontSize: 11,
          color: C.text3,
          fontFamily: F.sans,
          marginBottom: 10,
          fontWeight: 500,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 30,
          fontWeight: 600,
          fontFamily: F.mono,
          color: accent || C.text,
          lineHeight: 1,
          letterSpacing: '-0.02em',
        }}
      >
        {value}
      </div>
      {sub && (
        <div
          style={{
            fontSize: 11,
            color: C.text3,
            marginTop: 8,
            fontWeight: 400,
          }}
        >
          {sub}
        </div>
      )}
    </Card>
  );
}
