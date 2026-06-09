'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { C, F } from '@/lib/design-tokens';

type UseCase = 'clean' | 'enrich' | 'both';

export default function UseCasePage() {
  const router = useRouter();
  const [selectedUseCases, setSelectedUseCases] = useState<UseCase[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleUseCase = (useCase: UseCase) => {
    if (useCase === 'both') {
      // Selecting 'both' auto-selects clean and enrich
      if (selectedUseCases.includes('both')) {
        setSelectedUseCases([]);
      } else {
        setSelectedUseCases(['clean', 'enrich', 'both']);
      }
    } else {
      // Toggling clean or enrich
      if (selectedUseCases.includes(useCase)) {
        setSelectedUseCases(prev => prev.filter(uc => uc !== useCase && uc !== 'both'));
      } else {
        const newSelection = [...selectedUseCases.filter(uc => uc !== 'both'), useCase];
        // If both clean and enrich are selected, auto-select 'both'
        if (newSelection.includes('clean') && newSelection.includes('enrich')) {
          setSelectedUseCases(['clean', 'enrich', 'both']);
        } else {
          setSelectedUseCases(newSelection);
        }
      }
    }
  };

  const handleContinue = async () => {
    if (selectedUseCases.length === 0) {
      setError('Please select at least one option');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/onboarding/progress', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          use_cases: selectedUseCases,
          use_case_selected_at: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save progress');
      }

      router.push('/onboarding/connect');
    } catch (error) {
      console.error('Failed to save use case selection:', error);
      setError('Failed to save progress. Please try again.');
      setIsSubmitting(false);
    }
  };

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
          <span style={{ fontSize: 12, fontFamily: F.sans, color: C.text3, fontWeight: 500 }}>
            Step 2 of 6
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
          What are you looking to do?
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
          We'll tailor your setup based on your goals.
        </p>

        {/* Option cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 48 }}>
          {/* Card A: Clean */}
          <div
            onClick={() => toggleUseCase('clean')}
            style={{
              padding: 24,
              background: selectedUseCases.includes('clean') ? C.indigoDim : C.surface,
              border: selectedUseCases.includes('clean')
                ? `1px solid ${C.indigo}`
                : `1px solid ${C.border2}`,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              if (!selectedUseCases.includes('clean')) {
                e.currentTarget.style.borderColor = C.border2;
                e.currentTarget.style.background = C.hover;
              }
            }}
            onMouseLeave={(e) => {
              if (!selectedUseCases.includes('clean')) {
                e.currentTarget.style.borderColor = C.border2;
                e.currentTarget.style.background = C.surface;
              }
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
              {/* Custom Checkbox */}
              <div
                style={{
                  minWidth: 18,
                  height: 18,
                  border: selectedUseCases.includes('clean')
                    ? 'none'
                    : `1px solid ${C.border2}`,
                  background: selectedUseCases.includes('clean') ? C.indigo : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginTop: 2,
                }}
              >
                {selectedUseCases.includes('clean') && (
                  <span style={{ fontSize: 12, color: C.text, fontWeight: 700 }}>✓</span>
                )}
              </div>

              {/* Content */}
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontSize: 16,
                    fontFamily: F.sans,
                    fontWeight: 600,
                    color: C.text,
                    marginBottom: 6,
                  }}
                >
                  Clean up existing data
                </div>
                <div style={{ fontSize: 13, fontFamily: F.sans, color: C.text2, lineHeight: 1.6 }}>
                  Normalize formats, remove duplicates, and fix inconsistencies in your current HubSpot records.
                </div>
              </div>
            </div>
          </div>

          {/* Card B: Enrich */}
          <div
            onClick={() => toggleUseCase('enrich')}
            style={{
              padding: 24,
              background: selectedUseCases.includes('enrich') ? C.indigoDim : C.surface,
              border: selectedUseCases.includes('enrich')
                ? `1px solid ${C.indigo}`
                : `1px solid ${C.border2}`,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              if (!selectedUseCases.includes('enrich')) {
                e.currentTarget.style.borderColor = C.border2;
                e.currentTarget.style.background = C.hover;
              }
            }}
            onMouseLeave={(e) => {
              if (!selectedUseCases.includes('enrich')) {
                e.currentTarget.style.borderColor = C.border2;
                e.currentTarget.style.background = C.surface;
              }
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
              {/* Custom Checkbox */}
              <div
                style={{
                  minWidth: 18,
                  height: 18,
                  border: selectedUseCases.includes('enrich')
                    ? 'none'
                    : `1px solid ${C.border2}`,
                  background: selectedUseCases.includes('enrich') ? C.indigo : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginTop: 2,
                }}
              >
                {selectedUseCases.includes('enrich') && (
                  <span style={{ fontSize: 12, color: C.text, fontWeight: 700 }}>✓</span>
                )}
              </div>

              {/* Content */}
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontSize: 16,
                    fontFamily: F.sans,
                    fontWeight: 600,
                    color: C.text,
                    marginBottom: 6,
                  }}
                >
                  Enrich records with missing data
                </div>
                <div style={{ fontSize: 13, fontFamily: F.sans, color: C.text2, lineHeight: 1.6 }}>
                  Fill in missing company details like industry, employee count, and LinkedIn using data providers.
                </div>
              </div>
            </div>
          </div>

          {/* Card C: Both */}
          <div
            onClick={() => toggleUseCase('both')}
            style={{
              padding: 24,
              background: selectedUseCases.includes('both') ? C.indigoDim : C.surface,
              border: selectedUseCases.includes('both')
                ? `1px solid ${C.indigo}`
                : `1px solid ${C.border2}`,
              cursor: 'pointer',
              transition: 'all 0.2s',
              position: 'relative',
            }}
            onMouseEnter={(e) => {
              if (!selectedUseCases.includes('both')) {
                e.currentTarget.style.borderColor = C.border2;
                e.currentTarget.style.background = C.hover;
              }
            }}
            onMouseLeave={(e) => {
              if (!selectedUseCases.includes('both')) {
                e.currentTarget.style.borderColor = C.border2;
                e.currentTarget.style.background = C.surface;
              }
            }}
          >
            {/* Most popular badge */}
            <div
              style={{
                position: 'absolute',
                top: -10,
                right: 16,
                padding: '4px 12px',
                background: C.indigo,
                color: C.text,
                fontSize: 11,
                fontFamily: F.sans,
                fontWeight: 600,
              }}
            >
              Most popular
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
              {/* Custom Checkbox */}
              <div
                style={{
                  minWidth: 18,
                  height: 18,
                  border: selectedUseCases.includes('both')
                    ? 'none'
                    : `1px solid ${C.border2}`,
                  background: selectedUseCases.includes('both') ? C.indigo : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginTop: 2,
                }}
              >
                {selectedUseCases.includes('both') && (
                  <span style={{ fontSize: 12, color: C.text, fontWeight: 700 }}>✓</span>
                )}
              </div>

              {/* Content */}
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontSize: 16,
                    fontFamily: F.sans,
                    fontWeight: 600,
                    color: C.text,
                    marginBottom: 6,
                  }}
                >
                  Both - full data quality pipeline
                </div>
                <div style={{ fontSize: 13, fontFamily: F.sans, color: C.text2, lineHeight: 1.6 }}>
                  Start clean and keep it that way. The complete Refyne experience.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <p
            style={{
              marginBottom: 16,
              fontSize: 13,
              fontFamily: F.sans,
              color: C.amber,
              textAlign: 'center',
            }}
          >
            {error}
          </p>
        )}

        {/* Navigation buttons */}
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
          <button
            onClick={() => router.back()}
            style={{
              padding: '12px 24px',
              fontSize: 14,
              fontWeight: 500,
              fontFamily: F.sans,
              color: C.text,
              background: 'transparent',
              border: `1px solid ${C.border2}`,
              cursor: 'pointer',
            }}
          >
            ← Back
          </button>

          <button
            onClick={handleContinue}
            disabled={isSubmitting || selectedUseCases.length === 0}
            style={{
              padding: '12px 32px',
              fontSize: 14,
              fontWeight: 600,
              fontFamily: F.sans,
              color: C.text,
              background: C.indigo,
              border: 'none',
              cursor:
                isSubmitting || selectedUseCases.length === 0 ? 'not-allowed' : 'pointer',
              opacity: isSubmitting || selectedUseCases.length === 0 ? 0.4 : 1,
            }}
          >
            {isSubmitting ? 'Saving...' : 'Continue →'}
          </button>
        </div>
      </div>
    </div>
  );
}
