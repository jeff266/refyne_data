'use client';

import { useEffect, useState } from 'react';
import { C, F } from '@/lib/design-tokens';
import { Card } from '@/components/refyne';

interface LastNightStats {
  recordsNormalized: number;
  dupesFound: number;
  fieldsFilled: number;
  importsProcessed: number;
}

export function SinceYesterdaySection() {
  const [stats, setStats] = useState<LastNightStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/dashboard/summary')
      .then((res) => {
        if (res.ok) return res.json();
        throw new Error('Failed to fetch summary');
      })
      .then((data) => {
        setStats(data.lastNight);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to fetch dashboard summary:', err);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div style={{ marginBottom: 28 }}>
        <div
          style={{
            fontSize: 11,
            fontFamily: F.sans,
            color: C.text3,
            marginBottom: 12,
            fontWeight: 500,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
          }}
        >
          Since Yesterday
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          {[1, 2, 3, 4].map((i) => (
            <Card
              key={i}
              style={{
                padding: '18px 20px',
                background: '#1C3654',
                border: `1px solid rgba(255,255,255,0.08)`,
                borderRadius: 0,
              }}
            >
              <div style={{ height: 60 }} />
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const hasData = stats && (
    stats.recordsNormalized > 0 ||
    stats.dupesFound > 0 ||
    stats.fieldsFilled > 0 ||
    stats.importsProcessed > 0
  );

  return (
    <div style={{ marginBottom: 28 }}>
      <div
        style={{
          fontSize: 11,
          fontFamily: F.sans,
          color: C.text3,
          marginBottom: 12,
          fontWeight: 500,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
        }}
      >
        Since Yesterday
      </div>

      {!hasData ? (
        <Card
          style={{
            padding: '32px 24px',
            background: '#1C3654',
            border: `1px solid rgba(255,255,255,0.08)`,
            borderRadius: 0,
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 13, color: C.text3, fontStyle: 'italic' }}>
            Refyne ran overnight but found nothing new to fix.
          </div>
        </Card>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          <Card
            style={{
              padding: '18px 20px',
              background: '#1C3654',
              border: `1px solid rgba(255,255,255,0.08)`,
              borderRadius: 0,
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontFamily: F.sans,
                color: C.text3,
                marginBottom: 10,
                fontWeight: 400,
                textTransform: 'uppercase',
                letterSpacing: '0.03em',
              }}
            >
              Records normalized
            </div>
            <div
              style={{
                fontSize: 32,
                fontWeight: 600,
                fontFamily: F.serif,
                color: C.text,
                lineHeight: 1,
              }}
            >
              {stats?.recordsNormalized.toLocaleString() || '0'}
            </div>
          </Card>

          <Card
            style={{
              padding: '18px 20px',
              background: '#1C3654',
              border: `1px solid rgba(255,255,255,0.08)`,
              borderRadius: 0,
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontFamily: F.sans,
                color: C.text3,
                marginBottom: 10,
                fontWeight: 400,
                textTransform: 'uppercase',
                letterSpacing: '0.03em',
              }}
            >
              Dupes identified
            </div>
            <div
              style={{
                fontSize: 32,
                fontWeight: 600,
                fontFamily: F.serif,
                color: C.text,
                lineHeight: 1,
              }}
            >
              {stats?.dupesFound.toLocaleString() || '0'}
            </div>
          </Card>

          <Card
            style={{
              padding: '18px 20px',
              background: '#1C3654',
              border: `1px solid rgba(255,255,255,0.08)`,
              borderRadius: 0,
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontFamily: F.sans,
                color: C.text3,
                marginBottom: 10,
                fontWeight: 400,
                textTransform: 'uppercase',
                letterSpacing: '0.03em',
              }}
            >
              Fields filled
            </div>
            <div
              style={{
                fontSize: 32,
                fontWeight: 600,
                fontFamily: F.serif,
                color: C.text,
                lineHeight: 1,
              }}
            >
              {stats?.fieldsFilled.toLocaleString() || '0'}
            </div>
          </Card>

          <Card
            style={{
              padding: '18px 20px',
              background: '#1C3654',
              border: `1px solid rgba(255,255,255,0.08)`,
              borderRadius: 0,
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontFamily: F.sans,
                color: C.text3,
                marginBottom: 10,
                fontWeight: 400,
                textTransform: 'uppercase',
                letterSpacing: '0.03em',
              }}
            >
              Imports processed
            </div>
            <div
              style={{
                fontSize: 32,
                fontWeight: 600,
                fontFamily: F.serif,
                color: C.text,
                lineHeight: 1,
              }}
            >
              {stats?.importsProcessed.toLocaleString() || '0'}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
