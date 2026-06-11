'use client';

import { useEffect, useState } from 'react';
import { C, F } from '@/lib/design-tokens';
import { Card } from '@/components/refyne';
import { AlertCircle, AlertTriangle, Info } from 'lucide-react';
import Link from 'next/link';

interface AttentionItem {
  type: string;
  title: string;
  description: string;
  count: number;
  severity: 'high' | 'medium' | 'low';
  href: string;
}

const SEVERITY_ICONS = {
  high: AlertCircle,
  medium: AlertTriangle,
  low: Info,
};

const SEVERITY_COLORS = {
  high: C.red,
  medium: C.amber,
  low: C.text3,
};

export function NeedsAttentionSection() {
  const [items, setItems] = useState<AttentionItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/dashboard/summary')
      .then((res) => {
        if (res.ok) return res.json();
        throw new Error('Failed to fetch summary');
      })
      .then((data) => {
        setItems(data.pendingAttention || []);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to fetch dashboard summary:', err);
        setLoading(false);
      });
  }, []);

  // Don't render if no items
  if (!loading && items.length === 0) {
    return null;
  }

  if (loading) {
    return (
      <Card style={{ padding: '20px 24px', marginBottom: 24 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: C.text,
            marginBottom: 16,
            letterSpacing: '-0.01em',
          }}
        >
          Needs Your Attention
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[1, 2, 3].map((i) => (
            <div key={i} style={{ display: 'flex', gap: 12 }}>
              <div
                style={{
                  width: 20,
                  height: 20,
                  background: C.hover,
                  borderRadius: '50%',
                }}
              />
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    height: 14,
                    background: C.hover,
                    marginBottom: 6,
                    borderRadius: 4,
                    width: '60%',
                  }}
                />
                <div
                  style={{
                    height: 12,
                    background: C.hover,
                    borderRadius: 4,
                    width: '80%',
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </Card>
    );
  }

  return (
    <Card style={{ padding: '20px 24px', marginBottom: 24 }}>
      <div
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: C.text,
          marginBottom: 16,
          letterSpacing: '-0.01em',
        }}
      >
        Needs Your Attention
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {items.slice(0, 5).map((item, idx) => {
          const Icon = SEVERITY_ICONS[item.severity];
          const color = SEVERITY_COLORS[item.severity];

          return (
            <div
              key={idx}
              style={{
                display: 'flex',
                gap: 12,
                alignItems: 'flex-start',
              }}
            >
              <div style={{ paddingTop: 2 }}>
                <Icon size={16} color={color} />
              </div>
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 500,
                    color: C.text,
                    marginBottom: 4,
                  }}
                >
                  {item.title}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: C.text3,
                    marginBottom: 6,
                    lineHeight: 1.4,
                  }}
                >
                  {item.description}
                </div>
                <Link
                  href={item.href}
                  style={{
                    fontSize: 12,
                    color: C.indigo,
                    textDecoration: 'none',
                    fontWeight: 500,
                  }}
                >
                  Review →
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
