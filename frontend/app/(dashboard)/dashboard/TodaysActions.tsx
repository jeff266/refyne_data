'use client';

import { C, F } from '@/lib/design-tokens';
import { Card, PrimaryBtn } from '@/components/refyne';

interface Action {
  type: 'fix_harmony' | 'review_dedup' | 'quarantine' | 'enrich';
  label: string;
  description: string;
  estimatedMinutes: number;
  estimatedScoreImpact: number;
  route: string;
  primaryCta: string;
  count?: number;
}

interface TodaysActionsProps {
  actions: Action[];
}

export function TodaysActions({ actions }: TodaysActionsProps) {
  if (actions.length === 0) {
    return null;
  }

  return (
    <Card>
      <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.border}` }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: C.text, letterSpacing: '-0.01em' }}>
          Today's actions
        </span>
      </div>
      <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {actions.map((action, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                style={{ flexShrink: 0, marginTop: 2 }}
              >
                <path
                  d="M8 1L9.545 5.13L14 5.635L10.636 8.455L11.708 13L8 10.635L4.292 13L5.364 8.455L2 5.635L6.455 5.13L8 1Z"
                  fill={C.amber}
                  stroke={C.amber}
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 4 }}>
                  {action.label}
                </div>
                <div style={{ fontSize: 11, color: C.text3, lineHeight: 1.5 }}>
                  {action.description} · ~{action.estimatedMinutes} min · +{action.estimatedScoreImpact}pts
                </div>
              </div>
            </div>
            <PrimaryBtn
              onClick={() => window.location.href = action.route}
              style={{ width: '100%', fontSize: 12 }}
            >
              {action.primaryCta} →
            </PrimaryBtn>
          </div>
        ))}
        {actions.length === 3 && (
          <a
            href="/actions"
            style={{
              fontSize: 11,
              color: C.indigo,
              textDecoration: 'none',
              textAlign: 'center',
            }}
          >
            See all actions →
          </a>
        )}
      </div>
    </Card>
  );
}
