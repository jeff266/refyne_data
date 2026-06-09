'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { C, F } from '@/lib/design-tokens';

export default function CompletePage() {
  const router = useRouter();
  const [useCases, setUseCases] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    completeOnboarding();
  }, []);

  const completeOnboarding = async () => {
    try {
      // Fetch use cases
      const progressResponse = await fetch('/api/onboarding/progress');
      if (progressResponse.ok) {
        const data = await progressResponse.json();
        setUseCases(data.use_cases || []);
      }

      // Mark onboarding as complete
      await fetch('/api/onboarding/progress', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          onboarding_flow_completed_at: new Date().toISOString(),
        }),
      });

      // Set cookie to prevent middleware redirects
      document.cookie = 'refyne_onboarding_complete=true; path=/; max-age=31536000'; // 1 year
    } catch (error) {
      console.error('Failed to complete onboarding:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getSubtext = () => {
    if (useCases.includes('both') || useCases.includes('clean')) {
      return 'Your normalization rules are configured and your first run is complete. Refyne will keep your data consistent from here.';
    }
    if (useCases.includes('enrich')) {
      return 'Your workspace is ready. Head to Enrich to start filling in missing company data.';
    }
    return 'Your workspace is ready. Explore the dashboard to see your data quality insights.';
  };

  if (isLoading) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 'calc(100vh - 64px)',
          fontFamily: "'Jost', system-ui, sans-serif",
          color: 'rgba(249,248,245,0.7)',
        }}
      >
        Finalizing setup...
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 'calc(100vh - 64px)',
        padding: 32,
      }}
    >
      <div style={{ width: '100%', maxWidth: 640, textAlign: 'center' }}>
        {/* Animated checkmark */}
        <div
          style={{
            width: 120,
            height: 120,
            margin: '0 auto 32px',
            border: `4px solid #2E6BA8`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 64,
            color: '#2E6BA8',
          }}
        >
          ✓
        </div>

        {/* Heading */}
        <h1
          style={{
            fontSize: 36,
            fontFamily: 'Lora, serif',
            fontWeight: 600,
            color: '#F9F8F5',
            marginBottom: 16,
          }}
        >
          You're all set.
        </h1>
        <p
          style={{
            fontSize: 15,
            fontFamily: "'Jost', system-ui, sans-serif",
            color: 'rgba(249,248,245,0.7)',
            marginBottom: 64,
            lineHeight: 1.6,
            maxWidth: 480,
            margin: '0 auto 64px',
          }}
        >
          {getSubtext()}
        </p>

        {/* Quick action cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 48 }}>
          {/* Card: Dedup (if clean selected) */}
          {(useCases.includes('clean') || useCases.includes('both')) && (
            <div
              onClick={() => router.push('/dedup')}
              style={{
                padding: 20,
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
              }}
            >
              <div style={{ fontSize: 14, fontFamily: "'Jost', system-ui, sans-serif", fontWeight: 600, color: '#F9F8F5', marginBottom: 4 }}>
                Review dedup clusters
              </div>
              <div style={{ fontSize: 12, fontFamily: "'Jost', system-ui, sans-serif", color: 'rgba(249,248,245,0.7)', marginBottom: 12 }}>
                You have potential duplicates to review.
              </div>
              <div style={{ fontSize: 12, fontFamily: "'Jost', system-ui, sans-serif", fontWeight: 600, color: '#2E6BA8' }}>
                Go to Dedup →
              </div>
            </div>
          )}

          {/* Card: Enrich (if enrich selected) */}
          {(useCases.includes('enrich') || useCases.includes('both')) && (
            <div
              onClick={() => router.push('/enrich')}
              style={{
                padding: 20,
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
              }}
            >
              <div style={{ fontSize: 14, fontFamily: "'Jost', system-ui, sans-serif", fontWeight: 600, color: '#F9F8F5', marginBottom: 4 }}>
                Start enriching
              </div>
              <div style={{ fontSize: 12, fontFamily: "'Jost', system-ui, sans-serif", color: 'rgba(249,248,245,0.7)', marginBottom: 12 }}>
                Add missing data to your HubSpot records.
              </div>
              <div style={{ fontSize: 12, fontFamily: "'Jost', system-ui, sans-serif", fontWeight: 600, color: '#2E6BA8' }}>
                Go to Enrich →
              </div>
            </div>
          )}

          {/* Card: Dashboard (always shown) */}
          <div
            onClick={() => router.push('/dashboard')}
            style={{
              padding: 20,
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
            }}
          >
            <div style={{ fontSize: 14, fontFamily: "'Jost', system-ui, sans-serif", fontWeight: 600, color: '#F9F8F5', marginBottom: 4 }}>
              Explore your dashboard
            </div>
            <div style={{ fontSize: 12, fontFamily: "'Jost', system-ui, sans-serif", color: 'rgba(249,248,245,0.7)', marginBottom: 12 }}>
              See your data quality score and recent activity.
            </div>
            <div style={{ fontSize: 12, fontFamily: "'Jost', system-ui, sans-serif", fontWeight: 600, color: '#2E6BA8' }}>
              Go to Dashboard →
            </div>
          </div>
        </div>

        {/* Primary CTA */}
        <button
          onClick={() => router.push('/dashboard')}
          style={{
            padding: '14px 32px',
            fontSize: 14,
            fontWeight: 600,
            fontFamily: "'Jost', system-ui, sans-serif",
            color: '#F9F8F5',
            background: '#2E6BA8',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          Go to Dashboard →
        </button>
      </div>
    </div>
  );
}
