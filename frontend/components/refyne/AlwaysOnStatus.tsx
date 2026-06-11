'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { C, F } from '@/lib/design-tokens';
import { StatusDot } from './StatusDot';

export function AlwaysOnStatus() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch Always On status from API
    fetch('/api/settings/always-on-status')
      .then((res) => {
        if (res.ok) return res.json();
        throw new Error('Failed to fetch status');
      })
      .then((data) => {
        setEnabled(data.enabled || false);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to fetch Always On status:', err);
        setEnabled(false);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div
        style={{
          padding: '8px 8px',
          marginBottom: 8,
          opacity: 0.5,
        }}
      >
        <div
          style={{
            height: 12,
            background: C.hover,
            borderRadius: 4,
            width: '70%',
          }}
        />
      </div>
    );
  }

  return (
    <Link
      href="/settings/notifications"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 8px',
        marginBottom: 8,
        textDecoration: 'none',
        borderRadius: 6,
        transition: 'background 0.15s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = C.hover;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent';
      }}
    >
      <StatusDot color={enabled ? C.green : C.text3} />
      <span
        style={{
          fontSize: 12,
          color: enabled ? C.text2 : C.text3,
          fontFamily: F.sans,
          fontWeight: enabled ? 500 : 400,
        }}
      >
        Always On
      </span>
    </Link>
  );
}
