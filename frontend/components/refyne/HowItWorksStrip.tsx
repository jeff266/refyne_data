'use client';

import { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { C, F } from '@/lib/design-tokens';

interface HowItWorksStripProps {
  steps: {
    title: string;
    description: string;
  }[];
  storageKey: string; // Unique key for localStorage (e.g., 'how-it-works-dedup')
}

export function HowItWorksStrip({ steps, storageKey }: HowItWorksStripProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Load collapsed state from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(storageKey);
    if (stored === 'collapsed') {
      setIsCollapsed(true);
    }
  }, [storageKey]);

  // Save collapsed state to localStorage when it changes
  const toggleCollapse = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    localStorage.setItem(storageKey, newState ? 'collapsed' : 'expanded');
  };

  if (isCollapsed) {
    return (
      <div
        style={{
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderRadius: 8,
          padding: '12px 20px',
          marginBottom: 20,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 600, color: C.text, fontFamily: F.sans }}>
          How it works
        </span>
        <button
          onClick={toggleCollapse}
          style={{
            background: 'none',
            border: 'none',
            color: C.indigo,
            fontSize: 12,
            fontWeight: 500,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            fontFamily: F.sans,
          }}
        >
          Show <ChevronDown size={14} />
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: 8,
        padding: '20px',
        marginBottom: 20,
        fontFamily: F.sans,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>
          How it works
        </span>
        <button
          onClick={toggleCollapse}
          style={{
            background: 'none',
            border: 'none',
            color: C.indigo,
            fontSize: 12,
            fontWeight: 500,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          Hide <ChevronUp size={14} />
        </button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        {steps.map((step, i) => (
          <div key={i}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 20,
                height: 20,
                borderRadius: '50%',
                background: C.indigo,
                color: '#fff',
                fontSize: 11,
                fontWeight: 600,
                marginBottom: 8,
              }}
            >
              {i + 1}
            </div>
            <div style={{ fontSize: 12, fontWeight: 600, color: C.text, marginBottom: 4 }}>
              {step.title}
            </div>
            <div style={{ fontSize: 11, color: C.text2, lineHeight: 1.5 }}>
              {step.description}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
