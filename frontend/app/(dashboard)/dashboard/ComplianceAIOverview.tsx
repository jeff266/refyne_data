'use client';

import { useEffect, useState } from 'react';
import { C } from '@/lib/design-tokens';
import { Card } from '@/components/refyne';
import { ChevronUp, ChevronDown } from 'lucide-react';
import * as Sentry from '@sentry/nextjs';

interface Action {
  label: string;
  description: string;
  route: string;
  urgency: 'high' | 'medium' | 'low';
  estimatedImpact: string;
}

interface ComplianceOverview {
  overview: string;
  trend: 'improving' | 'declining' | 'stable';
  actions: Action[];
  generatedAt: string;
  cached: boolean;
}

const URGENCY_COLORS = {
  high: C.red,
  medium: C.amber,
  low: C.text3,
} as const;

const URGENCY_LABELS = {
  high: 'HIGH',
  medium: 'MED',
  low: 'LOW',
} as const;

export function ComplianceAIOverview() {
  const [overview, setOverview] = useState<ComplianceOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('refyne:ai-overview-collapsed') === 'true';
  });

  useEffect(() => {
    let mounted = true;
    const timeout = setTimeout(() => {
      if (mounted && loading) {
        setLoading(false);
        setError(true);
      }
    }, 3000);

    fetch('/api/ai/compliance-overview')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch AI overview');
        return res.json();
      })
      .then((data) => {
        if (mounted) {
          setOverview(data);
          setLoading(false);
          clearTimeout(timeout);
        }
      })
      .catch((err) => {
        if (mounted) {
          console.error('AI overview error:', err);
          Sentry.captureException(err, { level: 'warning' });
          setError(true);
          setLoading(false);
          clearTimeout(timeout);
        }
      });

    return () => {
      mounted = false;
      clearTimeout(timeout);
    };
  }, []);

  const toggleCollapse = () => {
    const newState = !collapsed;
    setCollapsed(newState);
    localStorage.setItem('refyne:ai-overview-collapsed', String(newState));
  };

  if (error || (!loading && !overview)) {
    return null; // Hide entirely on error
  }

  if (loading) {
    return (
      <Card style={{ marginBottom: 24, padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>AI Overview</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ height: 16, background: C.surface, borderRadius: 4, width: '100%' }} />
          <div style={{ height: 16, background: C.surface, borderRadius: 4, width: '85%' }} />
          <div style={{ height: 16, background: C.surface, borderRadius: 4, width: '60%' }} />
        </div>
      </Card>
    );
  }

  if (collapsed) {
    return (
      <Card style={{ marginBottom: 24, padding: '12px 20px' }}>
        <div
          onClick={toggleCollapse}
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
        >
          <div style={{ fontSize: 13, color: C.text3 }}>AI overview available</div>
          <ChevronDown size={16} color={C.text3} />
        </div>
      </Card>
    );
  }

  return (
    <Card style={{ marginBottom: 24, padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>AI Overview</div>
        <button
          onClick={toggleCollapse}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 4,
            display: 'flex',
            color: C.text3,
          }}
        >
          <ChevronUp size={16} />
        </button>
      </div>

      <div style={{ fontSize: 13, color: C.text, lineHeight: 1.6, marginBottom: 20 }}>
        {overview.overview}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {overview.actions.slice(0, 3).map((action, idx) => (
          <div
            key={idx}
            style={{
              display: 'flex',
              gap: 12,
              alignItems: 'flex-start',
            }}
          >
            <div
              style={{
                fontSize: 10,
                fontWeight: 600,
                color: URGENCY_COLORS[action.urgency],
                letterSpacing: '0.5px',
                flexShrink: 0,
                marginTop: 2,
              }}
            >
              ● {URGENCY_LABELS[action.urgency]}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: C.text, marginBottom: 4 }}>
                {action.label}
              </div>
              <div style={{ fontSize: 12, color: C.text3, marginBottom: 6 }}>
                {action.description}
              </div>
              <a
                href={action.route}
                style={{
                  fontSize: 12,
                  color: C.indigo,
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                {action.route.includes('normalize') && 'Run normalize →'}
                {action.route.includes('dedup') && 'Review pairs →'}
                {action.route.includes('quarantine') && 'Review queue →'}
                {action.route.includes('harmonies') && 'View harmonies →'}
                {!action.route.includes('normalize') && 
                 !action.route.includes('dedup') && 
                 !action.route.includes('quarantine') && 
                 !action.route.includes('harmonies') && 'View →'}
              </a>
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 16, fontSize: 11, color: C.text3 }}>
        Generated {formatTimeAgo(overview.generatedAt)}
      </div>
    </Card>
  );
}

function formatTimeAgo(isoDate: string): string {
  const now = new Date();
  const then = new Date(isoDate);
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'just now';
  if (diffMins === 1) return '1 minute ago';
  if (diffMins < 60) return `${diffMins} minutes ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours === 1) return '1 hour ago';
  if (diffHours < 24) return `${diffHours} hours ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return '1 day ago';
  return `${diffDays} days ago`;
}
