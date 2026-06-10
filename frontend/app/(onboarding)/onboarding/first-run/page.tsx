'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { C, F } from '@/lib/design-tokens';

interface NormalizePreview {
  changes: Array<{
    company_id: string;
    changes: Array<{ field: string; old_value: any; new_value: any }>;
  }>;
  summary: {
    total_records: number;
    records_with_changes: number;
    total_changes: number;
  };
}

export default function FirstRunPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [preview, setPreview] = useState<NormalizePreview | null>(null);
  const [previewError, setPreviewError] = useState(false);
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
      setPreviewError(false);

      const response = await fetch('/api/normalize/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        throw new Error('Preview failed');
      }

      const data: NormalizePreview = await response.json();
      setPreview(data);
    } catch (error) {
      console.error('Failed to load preview:', error);
      setPreviewError(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApply = async () => {
    setIsApplying(true);

    try {
      // Apply the normalization changes
      const applyResponse = await fetch('/api/normalize/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dryRun: false }),
      });

      if (!applyResponse.ok) {
        throw new Error('Failed to apply changes');
      }

      const applyResult = await applyResponse.json();

      if (!applyResult.success) {
        throw new Error('Apply operation failed');
      }

      // Update onboarding progress
      await fetch('/api/onboarding/progress', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ran_normalize: true,
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

  const hasChanges = preview && preview.summary.records_with_changes > 0;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 'calc(100vh - 64px)',
        padding: 32,
        background: C.bg,
      }}
    >
      <div style={{ width: '100%', maxWidth: 640 }}>
        {/* Progress indicator */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <span style={{ fontSize: 12, fontFamily: F.sans, color: C.text3, fontWeight: 500 }}>
            Step 5 of 6
          </span>
        </div>

        {/* Heading */}
        <h1
          style={{
            fontSize: 32,
            fontFamily: 'Lora, serif',
            fontWeight: 600,
            color: C.text,
            marginBottom: 12,
            textAlign: 'center',
          }}
        >
          See Refyne in action
        </h1>
        <p
          style={{
            fontSize: 15,
            fontFamily: F.sans,
            color: C.text2,
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
              background: C.surface,
              border: `1px solid ${C.border2}`,
              textAlign: 'center',
              marginBottom: 48,
            }}
          >
            <div style={{ fontSize: 14, fontFamily: F.sans, color: C.text2, marginBottom: 16 }}>
              Scanning your records...
            </div>
            <div
              style={{
                width: '100%',
                maxWidth: 300,
                height: 6,
                background: C.border2,
                overflow: 'hidden',
                margin: '0 auto',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: '60%',
                  background: C.indigo,
                  animation: 'progress 1.5s ease-in-out infinite',
                }}
              />
            </div>
          </div>
        ) : previewError ? (
          <>
            {/* Error state - unable to scan */}
            <div
              style={{
                padding: 48,
                background: C.surface,
                border: `1px solid ${C.border2}`,
                textAlign: 'center',
                marginBottom: 48,
              }}
            >
              <div style={{ fontSize: 16, fontFamily: F.sans, fontWeight: 600, color: C.text, marginBottom: 8 }}>
                We'll scan your records after setup
              </div>
              <div style={{ fontSize: 13, fontFamily: F.sans, color: C.text2 }}>
                Unable to preview changes right now. You can run normalization from the dashboard after completing setup.
              </div>
            </div>

            {/* Navigation - Skip only */}
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <button
                onClick={handleSkip}
                style={{
                  padding: '12px 32px',
                  fontSize: 14,
                  fontWeight: 600,
                  fontFamily: F.sans,
                  color: C.text,
                  background: C.indigo,
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                Continue →
              </button>
            </div>
          </>
        ) : hasChanges ? (
          <>
            {/* Summary stats */}
            <div
              style={{
                padding: 24,
                background: C.surface,
                border: `1px solid ${C.border2}`,
                marginBottom: 24,
              }}
            >
              <div style={{ fontSize: 14, fontFamily: F.sans, fontWeight: 600, color: C.text, marginBottom: 16 }}>
                Summary
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, fontFamily: F.sans, color: C.text2 }}>
                    {preview.summary.total_records.toLocaleString()} records scanned
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, fontFamily: F.sans, color: C.text2 }}>Records with changes</span>
                  <span style={{ fontSize: 13, fontFamily: F.sans, fontWeight: 600, color: C.indigo }}>
                    {preview.summary.records_with_changes.toLocaleString()}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, fontFamily: F.sans, color: C.text2 }}>Total field changes</span>
                  <span style={{ fontSize: 13, fontFamily: F.sans, fontWeight: 600, color: C.indigo }}>
                    {preview.summary.total_changes.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            {/* Enrich hint */}
            {useCases.includes('enrich') && (
              <div
                style={{
                  padding: 16,
                  background: C.indigoDim,
                  border: `1px solid ${C.indigoBrd}`,
                  marginBottom: 32,
                }}
              >
                <div style={{ fontSize: 13, fontFamily: F.sans, fontWeight: 600, color: C.indigo, marginBottom: 4 }}>
                  Ready to enrich your records?
                </div>
                <div style={{ fontSize: 12, fontFamily: F.sans, color: C.text2, lineHeight: 1.6 }}>
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
                  fontFamily: F.sans,
                  color: C.text,
                  background: 'transparent',
                  border: `1px solid ${C.border2}`,
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
                  fontFamily: F.sans,
                  color: C.text,
                  background: C.indigo,
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
                background: C.greenDim,
                border: `1px solid ${C.greenBrd}`,
                textAlign: 'center',
                marginBottom: 48,
              }}
            >
              <div style={{ fontSize: 48, marginBottom: 16, color: C.green }}>✓</div>
              <div style={{ fontSize: 16, fontFamily: F.sans, fontWeight: 600, color: C.text, marginBottom: 8 }}>
                Your data looks clean!
              </div>
              <div style={{ fontSize: 13, fontFamily: F.sans, color: C.text2 }}>
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
                  fontFamily: F.sans,
                  color: C.text,
                  background: C.indigo,
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
