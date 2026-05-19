'use client';

import { useState, useEffect } from 'react';
import { C, F } from '@/lib/design-tokens';

interface QuarantineAlertProps {
  count: number;
  oldestDays: number;
}

export function QuarantineAlert({ count, oldestDays }: QuarantineAlertProps) {
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    // Check if dismissed today
    const dismissed = localStorage.getItem('quarantine_alert_dismissed');
    if (dismissed) {
      const dismissedDate = new Date(dismissed);
      const today = new Date();
      if (
        dismissedDate.getDate() === today.getDate() &&
        dismissedDate.getMonth() === today.getMonth() &&
        dismissedDate.getFullYear() === today.getFullYear()
      ) {
        setIsDismissed(true);
      }
    }
  }, []);

  const handleDismiss = () => {
    localStorage.setItem('quarantine_alert_dismissed', new Date().toISOString());
    setIsDismissed(true);
  };

  if (count === 0 || isDismissed) {
    return null;
  }

  return (
    <div
      style={{
        background: C.amberDim,
        border: `1px solid ${C.amberBrd}`,
        borderRadius: 8,
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 24,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path
            d="M10 6V10M10 14H10.01M8.27 3.11L2.5 12C2.28 12.35 2.17 12.76 2.17 13.17C2.17 13.58 2.28 13.99 2.5 14.34C2.72 14.69 3.03 14.97 3.39 15.15C3.75 15.33 4.16 15.42 4.57 15.42H15.43C15.84 15.42 16.25 15.33 16.61 15.15C16.97 14.97 17.28 14.69 17.5 14.34C17.72 13.99 17.83 13.58 17.83 13.17C17.83 12.76 17.72 12.35 17.5 12L11.73 3.11C11.51 2.76 11.2 2.48 10.84 2.3C10.48 2.12 10.07 2.03 9.66 2.03C9.25 2.03 8.84 2.12 8.48 2.3C8.12 2.48 7.81 2.76 7.59 3.11H8.27Z"
            stroke={C.amber}
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <div>
          <div style={{ fontSize: 13, fontWeight: 500, color: C.text }}>
            {count} records pending quarantine review
          </div>
          <div style={{ fontSize: 11, color: C.text3 }}>
            Oldest: {oldestDays} days ago
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button
          onClick={() => window.location.href = '/quarantine'}
          style={{
            padding: '6px 12px',
            background: C.amber,
            border: 'none',
            borderRadius: 6,
            color: '#000',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Review now →
        </button>
        <button
          onClick={handleDismiss}
          style={{
            padding: '6px',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: C.text3,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path
              d="M10.5 3.5L3.5 10.5M3.5 3.5L10.5 10.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
