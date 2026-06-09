'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { C, F } from '@/lib/design-tokens';

export default function FirstRunPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [preview, setPreview] = useState<any>(null);
  const [isApplying, setIsApplying] = useState(false);
  const [useCases, setUseCases] = useState<string[]>([]);

  useEffect(() => {
    loadPreview();
    fetchUseCases();
  }, []);

  const fetchUseCases = async () => {
    try {
      const response = await fetch('/api/onboarding/progress');
      if (response.ok) {
        const data = await response.json();
        setUseCases(data.use_cases || []);
      }
    } catch (error) {
      console.error('Failed to fetch use cases:', error);
    }
  };

  const loadPreview = async () => {
    try {
      setIsLoading(true);
      // Mock preview data - in real implementation would call normalize preview API
      await new Promise(resolve => setTimeout(resolve, 1500));

      setPreview({
        totalRecords: 1247,
        phoneChanges: 342,
        companyNameChanges: 189,
        linkedinChanges: 76,
      });
    } catch (error) {
      console.error('Failed to load preview:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApply = async () => {
    setIsApplying(true);

    try {
      // In real implementation: POST /api/normalize/apply
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Update onboarding progress
      await fetch('/api/onboarding/progress', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ran_normalize: true,
          first_normalize_at: new Date().toISOString(),
        }),
      });

      router.push('/onboarding/invite');
    } catch (error) {
      console.error('Failed to apply changes:', error);
      alert('Failed to apply changes. Please try again.');
      setIsApplying(false);
    }
  };

  const handleSkip = () => {
    router.push('/onboarding/invite');
  };

  const hasChanges = preview && (
    preview.phoneChanges > 0 ||
    preview.companyNameChanges > 0 ||
    preview.linkedinChanges > 0
  );

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
      <div style={{ width: '100%', maxWidth: 640 }}>
        {/* Progress indicator */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <span style={{ fontSize: 12, fontFamily: "'Jost', system-ui, sans-serif", color: 'rgba(249,248,245,0.5)', fontWeight: 500 }}>
            Step 4 of 5
          </span>
        </div>

        {/* Heading */}
        <h1
          style={{
            fontSize: 32,
            fontFamily: 'Lora, serif',
            fontWeight: 600,
            color: '#F9F8F5',
            marginBottom: 12,
            textAlign: 'center',
          }}
        >
          See Refyne in action
        </h1>
        <p
          style={{
            fontSize: 15,
            fontFamily: "'Jost', system-ui, sans-serif",
            color: 'rgba(249,248,245,0.7)',
            textAlign: 'center',
            marginBottom: 48,
            lineHeight: 1.6,
          }}
        >
          Here's a preview of what we'd change in your HubSpot right now.
        </p>

        {isLoading ? (
          <div
            style={{
              padding: 64,
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              textAlign: 'center',
              marginBottom: 48,
            }}
          >
            <div style={{ fontSize: 14, fontFamily: "'Jost', system-ui, sans-serif", color: 'rgba(249,248,245,0.7)', marginBottom: 16 }}>
              Scanning your records...
            </div>
            <div
              style={{
                width: '100%',
                maxWidth: 300,
                height: 6,
                background: 'rgba(255,255,255,0.1)',
                overflow: 'hidden',
                margin: '0 auto',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: '60%',
                  background: '#2E6BA8',
                  animation: 'progress 1.5s ease-in-out infinite',
                }}
              />
            </div>
          </div>
        ) : hasChanges ? (
          <>
            {/* Summary stats */}
            <div
              style={{
                padding: 24,
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                marginBottom: 24,
              }}
            >
              <div style={{ fontSize: 14, fontFamily: "'Jost', system-ui, sans-serif", fontWeight: 600, color: '#F9F8F5', marginBottom: 16 }}>
                Summary
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, fontFamily: "'Jost', system-ui, sans-serif", color: 'rgba(249,248,245,0.7)' }}>
                    {preview.totalRecords.toLocaleString()} records scanned
                  </span>
                </div>

                {preview.phoneChanges > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 13, fontFamily: "'Jost', system-ui, sans-serif", color: 'rgba(249,248,245,0.7)' }}>Phone numbers</span>
                    <span style={{ fontSize: 13, fontFamily: "'Jost', system-ui, sans-serif", fontWeight: 600, color: '#2E6BA8' }}>
                      {preview.phoneChanges} to reformat
                    </span>
                  </div>
                )}

                {preview.companyNameChanges > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 13, fontFamily: "'Jost', system-ui, sans-serif", color: 'rgba(249,248,245,0.7)' }}>Company names</span>
                    <span style={{ fontSize: 13, fontFamily: "'Jost', system-ui, sans-serif", fontWeight: 600, color: '#2E6BA8' }}>
                      {preview.companyNameChanges} to standardize
                    </span>
                  </div>
                )}

                {preview.linkedinChanges > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 13, fontFamily: "'Jost', system-ui, sans-serif", color: 'rgba(249,248,245,0.7)' }}>LinkedIn URLs</span>
                    <span style={{ fontSize: 13, fontFamily: "'Jost', system-ui, sans-serif", fontWeight: 600, color: '#2E6BA8' }}>
                      {preview.linkedinChanges} to canonicalize
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Enrich hint */}
            {useCases.includes('enrich') && (
              <div
                style={{
                  padding: 16,
                  background: 'rgba(46,107,168,0.15)',
                  border: '1px solid rgba(46,107,168,0.3)',
                  marginBottom: 32,
                }}
              >
                <div style={{ fontSize: 13, fontFamily: "'Jost', system-ui, sans-serif", fontWeight: 600, color: '#2E6BA8', marginBottom: 4 }}>
                  Ready to enrich your records?
                </div>
                <div style={{ fontSize: 12, fontFamily: "'Jost', system-ui, sans-serif", color: 'rgba(249,248,245,0.7)', lineHeight: 1.6 }}>
                  After setup, head to Enrich to fill in missing company data.
                </div>
              </div>
            )}

            {/* Navigation */}
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
              <button
                onClick={handleSkip}
                disabled={isApplying}
                style={{
                  padding: '12px 24px',
                  fontSize: 14,
                  fontWeight: 500,
                  fontFamily: "'Jost', system-ui, sans-serif",
                  color: '#F9F8F5',
                  background: 'transparent',
                  border: '1px solid rgba(255,255,255,0.2)',
                  cursor: isApplying ? 'not-allowed' : 'pointer',
                  opacity: isApplying ? 0.5 : 1,
                }}
              >
                Skip for now
              </button>

              <button
                onClick={handleApply}
                disabled={isApplying}
                style={{
                  padding: '12px 32px',
                  fontSize: 14,
                  fontWeight: 600,
                  fontFamily: "'Jost', system-ui, sans-serif",
                  color: '#F9F8F5',
                  background: '#2E6BA8',
                  border: 'none',
                  cursor: isApplying ? 'not-allowed' : 'pointer',
                  opacity: isApplying ? 0.4 : 1,
                }}
              >
                {isApplying ? 'Applying changes...' : 'Apply changes →'}
              </button>
            </div>
          </>
        ) : (
          <>
            {/* No changes needed */}
            <div
              style={{
                padding: 48,
                background: 'rgba(34,197,94,0.15)',
                border: '1px solid rgba(34,197,94,0.3)',
                textAlign: 'center',
                marginBottom: 48,
              }}
            >
              <div style={{ fontSize: 48, marginBottom: 16, color: '#22C55E' }}>✓</div>
              <div style={{ fontSize: 16, fontFamily: "'Jost', system-ui, sans-serif", fontWeight: 600, color: '#F9F8F5', marginBottom: 8 }}>
                Your data looks clean!
              </div>
              <div style={{ fontSize: 13, fontFamily: "'Jost', system-ui, sans-serif", color: 'rgba(249,248,245,0.7)' }}>
                No changes needed at this time.
              </div>
            </div>

            {/* Navigation */}
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <button
                onClick={() => router.push('/onboarding/invite')}
                style={{
                  padding: '12px 32px',
                  fontSize: 14,
                  fontWeight: 600,
                  fontFamily: "'Jost', system-ui, sans-serif",
                  color: '#F9F8F5',
                  background: '#2E6BA8',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                Continue →
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
