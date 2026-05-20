'use client';

import { useState } from 'react';
import { ChevronUp } from 'lucide-react';
import { C, F } from '@/lib/design-tokens';

export function HowItWorksStrip() {
  const [isVisible, setIsVisible] = useState(true);

  if (!isVisible) {
    return (
      <button
        onClick={() => setIsVisible(true)}
        style={{
          width: '100%',
          padding: 12,
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderRadius: 8,
          color: C.text2,
          fontSize: 13,
          textAlign: 'center',
          cursor: 'pointer',
          marginBottom: 24,
        }}
      >
        Show how Arrangements work ↓
      </button>
    );
  }

  return (
    <div
      style={{
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: 8,
        padding: 24,
        marginBottom: 24,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 20,
        }}
      >
        <h3
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: C.text,
            letterSpacing: '-0.01em',
          }}
        >
          How Arrangements work
        </h3>
        <button
          onClick={() => setIsVisible(false)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '4px 8px',
            background: 'transparent',
            border: 'none',
            color: C.text3,
            fontSize: 12,
            cursor: 'pointer',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = C.text;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = C.text3;
          }}
        >
          Hide <ChevronUp size={14} />
        </button>
      </div>

      {/* Three steps */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 20,
        }}
      >
        {/* Step 1 */}
        <div>
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: C.text,
              marginBottom: 8,
            }}
          >
            ① Build a waterfall
          </div>
          <p
            style={{
              fontSize: 12,
              lineHeight: '1.5',
              color: C.text2,
              margin: 0,
            }}
          >
            Stack providers in order. Apollo tries first. If it misses, Clearbit tries. Then
            Serper. First hit wins. Gaps get filled from multiple sources automatically.
          </p>
        </div>

        {/* Step 2 */}
        <div>
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: C.text,
              marginBottom: 8,
            }}
          >
            ② Rehearse free
          </div>
          <p
            style={{
              fontSize: 12,
              lineHeight: '1.5',
              color: C.text2,
              margin: 0,
            }}
          >
            See exactly what will change before spending a single credit. No HubSpot writes. Full
            fill-rate preview across all providers.
          </p>
        </div>

        {/* Step 3 */}
        <div>
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: C.text,
              marginBottom: 8,
            }}
          >
            ③ Run
          </div>
          <p
            style={{
              fontSize: 12,
              lineHeight: '1.5',
              color: C.text2,
              margin: 0,
            }}
          >
            Executes with checkpoints — pauses on errors, resumes where it stopped. No duplicate
            credits, no incomplete data.
          </p>
        </div>
      </div>
    </div>
  );
}
