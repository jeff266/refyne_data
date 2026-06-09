'use client';

import React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error Boundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 32,
            background: '#162944',
            color: '#fff',
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          <h1 style={{ fontSize: 24, marginBottom: 16 }}>Something went wrong</h1>
          <div
            style={{
              maxWidth: 600,
              padding: 24,
              background: 'rgba(255,255,255,0.1)',
              borderRadius: 8,
              marginBottom: 24,
            }}
          >
            <div style={{ fontSize: 14, fontFamily: 'monospace', color: '#ff6b6b', marginBottom: 8 }}>
              {this.state.error?.name}: {this.state.error?.message}
            </div>
            <pre
              style={{
                fontSize: 12,
                color: 'rgba(255,255,255,0.7)',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {this.state.error?.stack}
            </pre>
          </div>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '12px 24px',
              fontSize: 14,
              fontWeight: 600,
              color: '#fff',
              background: '#2E6BA8',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
            }}
          >
            Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
