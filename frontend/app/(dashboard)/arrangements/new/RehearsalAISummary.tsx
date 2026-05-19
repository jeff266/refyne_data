'use client';

import { useState, useEffect } from 'react';
import { C } from '@/lib/design-tokens';
import { AlertTriangle, CheckCircle, Loader2 } from 'lucide-react';
import * as Sentry from '@sentry/nextjs';

interface RehearsalAISummaryProps {
  runId: string;
  onReadyStateChange?: (ready: boolean) => void;
}

interface AISummary {
  overview: string;
  fillRate: number;
  recommendations: string[];
  costContext: string;
  readyToRun: boolean;
}

export function RehearsalAISummary({ runId, onReadyStateChange }: RehearsalAISummaryProps) {
  const [summary, setSummary] = useState<AISummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    loadSummary();
  }, [runId]);

  useEffect(() => {
    if (summary && onReadyStateChange) {
      onReadyStateChange(summary.readyToRun);
    }
  }, [summary?.readyToRun, onReadyStateChange]);

  async function loadSummary() {
    try {
      const res = await fetch('/api/ai/rehearsal-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ runId }),
      });

      if (!res.ok) throw new Error('Failed to fetch AI summary');
      const data = await res.json();
      setSummary(data);
      setLoading(false);
    } catch (err) {
      console.error('AI summary error:', err);
      Sentry.captureException(err, { level: 'warning' });
      setError(true);
      setLoading(false);
    }
  }

  if (error) {
    return null; // Hide on error
  }

  if (loading) {
    return (
      <div
        style={{
          marginTop: 24,
          padding: 20,
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderRadius: 8,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <Loader2 size={20} color={C.text3} className="spin" />
          <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>
            Analyzing rehearsal results...
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ height: 12, background: C.border, borderRadius: 4, width: '100%' }} />
          <div style={{ height: 12, background: C.border, borderRadius: 4, width: '85%' }} />
          <div style={{ height: 12, background: C.border, borderRadius: 4, width: '60%' }} />
        </div>
      </div>
    );
  }

  if (!summary) return null;

  return (
    <div
      style={{
        marginTop: 24,
        padding: 20,
        background: summary.readyToRun ? C.greenDim : C.amberDim,
        border: `1px solid ${summary.readyToRun ? C.greenBrd : C.amberBrd}`,
        borderRadius: 8,
      }}
    >
      {/* Header with Ready Status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        {summary.readyToRun ? (
          <CheckCircle size={20} color={C.green} />
        ) : (
          <AlertTriangle size={20} color={C.amber} />
        )}
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 2 }}>
            {summary.readyToRun ? 'Ready to Run' : 'Review Recommendations'}
          </div>
          <div style={{ fontSize: 12, color: C.text3 }}>
            AI Analysis of Rehearsal Results
          </div>
        </div>
      </div>

      {/* Overview */}
      <div
        style={{
          fontSize: 13,
          color: C.text,
          lineHeight: 1.6,
          marginBottom: 16,
          paddingBottom: 16,
          borderBottom: `1px solid ${summary.readyToRun ? C.greenBrd : C.amberBrd}`,
        }}
      >
        {summary.overview}
      </div>

      {/* Fill Rate */}
      <div style={{ marginBottom: 16 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 6,
          }}
        >
          <span style={{ fontSize: 12, color: C.text3 }}>Data Fill Rate</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>
            {Math.round(summary.fillRate)}%
          </span>
        </div>
        <div
          style={{
            height: 8,
            background: C.surface,
            borderRadius: 4,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${summary.fillRate}%`,
              background: summary.readyToRun ? C.green : C.amber,
              transition: 'width 0.3s ease',
            }}
          />
        </div>
      </div>

      {/* Recommendations */}
      {summary.recommendations.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: C.text,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              marginBottom: 10,
            }}
          >
            Recommendations
          </div>
          <ul
            style={{
              margin: 0,
              paddingLeft: 20,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            {summary.recommendations.map((rec, idx) => (
              <li
                key={idx}
                style={{
                  fontSize: 13,
                  color: C.text,
                  lineHeight: 1.5,
                }}
              >
                {rec}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Cost Context */}
      {summary.costContext && (
        <div
          style={{
            fontSize: 12,
            color: C.text3,
            fontStyle: 'italic',
            paddingTop: 12,
            borderTop: `1px solid ${summary.readyToRun ? C.greenBrd : C.amberBrd}`,
          }}
        >
          {summary.costContext}
        </div>
      )}
    </div>
  );
}
