'use client';

import { C, F } from '@/lib/design-tokens';
import { Card, PrimaryBtn } from '@/components/refyne';

interface Action {
  type: string;
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  href: string;
  count?: number;
}

interface TodaysActionsProps {
  actions: Action[];
}

export function TodaysActions({ actions }: TodaysActionsProps) {
  const getPriorityColor = (priority: 'high' | 'medium' | 'low') => {
    switch (priority) {
      case 'high': return C.red;
      case 'medium': return C.amber;
      case 'low': return C.indigo;
      default: return C.text3;
    }
  };

  if (actions.length === 0) {
    return (
      <Card>
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.border}` }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: C.text, letterSpacing: '-0.01em' }}>
            TODAY'S ACTIONS
          </span>
        </div>
        <div style={{ padding: '28px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: 13, color: C.green, marginBottom: 6 }}>
            ✓ Everything looks good.
          </div>
          <div style={{ fontSize: 12, color: C.text3 }}>
            No actions needed today.
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.border}` }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: C.text, letterSpacing: '-0.01em' }}>
          TODAY'S ACTIONS
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {actions.map((action, i) => (
          <a
            key={i}
            href={action.href}
            style={{
              padding: '16px 20px',
              borderBottom: i < actions.length - 1 ? `1px solid ${C.border}` : 'none',
              display: 'block',
              textDecoration: 'none',
              cursor: 'pointer',
              transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = C.hover}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: getPriorityColor(action.priority),
                  flexShrink: 0,
                  marginTop: 6,
                }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 4 }}>
                  {action.count ? `${action.count} ` : ''}{action.title}
                </div>
                <div style={{ fontSize: 11, color: C.text3, lineHeight: 1.5, marginBottom: 8 }}>
                  {action.description}
                </div>
                <div style={{ fontSize: 11, color: C.indigo, fontWeight: 500 }}>
                  Review now →
                </div>
              </div>
            </div>
          </a>
        ))}
      </div>
    </Card>
  );
}
