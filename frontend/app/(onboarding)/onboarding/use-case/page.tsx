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
          <span style={{ fontSize: 12, fontFamily: "'Jost', system-ui, sans-serif", color: 'rgba(249,248,245,0.5)', fontWeight: 500 }}>
            Step 2 of 7
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
          What are you looking to do?
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
          We'll tailor your setup based on your goals.
        </p>

        {/* Option cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 48 }}>
          {/* Card A: Clean */}
          <div
            onClick={() => toggleUseCase('clean')}
            style={{
              padding: 24,
              background: selectedUseCases.includes('clean')
                ? 'rgba(46,107,168,0.15)'
                : 'rgba(255,255,255,0.05)',
              border: selectedUseCases.includes('clean')
                ? '1px solid #2E6BA8'
                : '1px solid rgba(255,255,255,0.1)',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              if (!selectedUseCases.includes('clean')) {
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)';
              }
            }}
            onMouseLeave={(e) => {
              if (!selectedUseCases.includes('clean')) {
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
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
                    : '1px solid rgba(255,255,255,0.3)',
                  background: selectedUseCases.includes('clean') ? '#2E6BA8' : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginTop: 2,
                }}
              >
                {selectedUseCases.includes('clean') && (
                  <span style={{ fontSize: 12, color: '#F9F8F5', fontWeight: 700 }}>✓</span>
                )}
              </div>

              {/* Content */}
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontSize: 16,
                    fontFamily: "'Jost', system-ui, sans-serif",
                    fontWeight: 600,
                    color: '#F9F8F5',
                    marginBottom: 6,
                  }}
                >
                  Clean up existing data
                </div>
                <div style={{ fontSize: 13, fontFamily: "'Jost', system-ui, sans-serif", color: 'rgba(249,248,245,0.7)', lineHeight: 1.6 }}>
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
              background: selectedUseCases.includes('enrich')
                ? 'rgba(46,107,168,0.15)'
                : 'rgba(255,255,255,0.05)',
              border: selectedUseCases.includes('enrich')
                ? '1px solid #2E6BA8'
                : '1px solid rgba(255,255,255,0.1)',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              if (!selectedUseCases.includes('enrich')) {
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)';
              }
            }}
            onMouseLeave={(e) => {
              if (!selectedUseCases.includes('enrich')) {
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
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
                    : '1px solid rgba(255,255,255,0.3)',
                  background: selectedUseCases.includes('enrich') ? '#2E6BA8' : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginTop: 2,
                }}
              >
                {selectedUseCases.includes('enrich') && (
                  <span style={{ fontSize: 12, color: '#F9F8F5', fontWeight: 700 }}>✓</span>
                )}
              </div>

              {/* Content */}
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontSize: 16,
                    fontFamily: "'Jost', system-ui, sans-serif",
                    fontWeight: 600,
                    color: '#F9F8F5',
                    marginBottom: 6,
                  }}
                >
                  Enrich records with missing data
                </div>
                <div style={{ fontSize: 13, fontFamily: "'Jost', system-ui, sans-serif", color: 'rgba(249,248,245,0.7)', lineHeight: 1.6 }}>
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
              background: selectedUseCases.includes('both')
                ? 'rgba(46,107,168,0.15)'
                : 'rgba(255,255,255,0.05)',
              border: selectedUseCases.includes('both')
                ? '1px solid #2E6BA8'
                : '1px solid rgba(255,255,255,0.1)',
              cursor: 'pointer',
              transition: 'all 0.2s',
              position: 'relative',
            }}
            onMouseEnter={(e) => {
              if (!selectedUseCases.includes('both')) {
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)';
              }
            }}
            onMouseLeave={(e) => {
              if (!selectedUseCases.includes('both')) {
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
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
                background: '#2E6BA8',
                color: '#F9F8F5',
                fontSize: 11,
                fontFamily: "'Jost', system-ui, sans-serif",
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
                    : '1px solid rgba(255,255,255,0.3)',
                  background: selectedUseCases.includes('both') ? '#2E6BA8' : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginTop: 2,
                }}
              >
                {selectedUseCases.includes('both') && (
                  <span style={{ fontSize: 12, color: '#F9F8F5', fontWeight: 700 }}>✓</span>
                )}
              </div>

              {/* Content */}
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontSize: 16,
                    fontFamily: "'Jost', system-ui, sans-serif",
                    fontWeight: 600,
                    color: '#F9F8F5',
                    marginBottom: 6,
                  }}
                >
                  Both - full data quality pipeline
                </div>
                <div style={{ fontSize: 13, fontFamily: "'Jost', system-ui, sans-serif", color: 'rgba(249,248,245,0.7)', lineHeight: 1.6 }}>
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
              fontFamily: "'Jost', system-ui, sans-serif",
              color: '#F59E0B',
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
              fontFamily: "'Jost', system-ui, sans-serif",
              color: '#F9F8F5',
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.2)',
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
              fontFamily: "'Jost', system-ui, sans-serif",
              color: '#F9F8F5',
              background: '#2E6BA8',
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
