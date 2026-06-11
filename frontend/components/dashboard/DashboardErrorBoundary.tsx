'use client';

import React from 'react';
import { C, F } from '@/lib/design-tokens';
import { Card } from '@/components/refyne';
import { AlertCircle } from 'lucide-react';

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class DashboardErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Dashboard Error Boundary caught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <Card
          style={{
            padding: '32px 24px',
            margin: '24px 0',
            textAlign: 'center',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
            <AlertCircle size={32} color={C.amber} />
            <div>
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 600,
                  color: C.text,
                  marginBottom: 8,
                }}
              >
                Something went wrong
              </div>
              <div style={{ fontSize: 13, color: C.text3, marginBottom: 16 }}>
                {this.state.error?.message || 'An error occurred while loading this section'}
              </div>
              <button
                onClick={() => window.location.reload()}
                style={{
                  padding: '8px 16px',
                  background: C.indigoDim,
                  border: `1px solid ${C.indigoBrd}`,
                  color: C.indigo,
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: 'pointer',
                  borderRadius: 4,
                }}
              >
                Reload page
              </button>
            </div>
          </div>
        </Card>
      );
    }

    return this.props.children;
  }
}
