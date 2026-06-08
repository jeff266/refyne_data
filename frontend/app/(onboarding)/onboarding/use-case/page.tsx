'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { C, F } from '@/lib/design-tokens';

type UseCase = 'clean' | 'enrich' | 'both';

export default function UseCasePage() {
  const router = useRouter();
  const [selectedUseCases, setSelectedUseCases] = useState<UseCase[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      alert('Please select at least one option');
      return;
    }

    setIsSubmitting(true);

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
      alert('Failed to save progress. Please try again.');
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
          <span style={{ fontSize: 12, color: '#64748B', fontWeight: 500 }}>
            Step 2 of 7
          </span>
        </div>

        {/* Heading */}
        <h1
          style={{
            fontSize: 32,
            fontFamily: 'Lora, serif',
            fontWeight: 600,
            color: '#1E293B',
            marginBottom: 12,
            textAlign: 'center',
          }}
        >
          What are you looking to do?
        </h1>
        <p
          style={{
            fontSize: 15,
            color: '#64748B',
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
              background: '#fff',
              border: selectedUseCases.includes('clean')
                ? `2px solid ${C.indigo}`
                : '1px solid #E2E8F0',
              borderRadius: 8,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              if (!selectedUseCases.includes('clean')) {
                e.currentTarget.style.borderColor = '#CBD5E1';
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.05)';
              }
            }}
            onMouseLeave={(e) => {
              if (!selectedUseCases.includes('clean')) {
                e.currentTarget.style.borderColor = '#E2E8F0';
                e.currentTarget.style.boxShadow = 'none';
              }
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
              {/* Checkbox */}
              <div
                style={{
                  minWidth: 20,
                  height: 20,
                  borderRadius: 4,
                  border: selectedUseCases.includes('clean')
                    ? `2px solid ${C.indigo}`
                    : '2px solid #CBD5E1',
                  background: selectedUseCases.includes('clean') ? C.indigo : '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginTop: 2,
                }}
              >
                {selectedUseCases.includes('clean') && (
                  <span style={{ fontSize: 12, color: '#fff', fontWeight: 700 }}>✓</span>
                )}
              </div>

              {/* Content */}
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontSize: 16,
                    fontWeight: 600,
                    color: '#1E293B',
                    marginBottom: 6,
                  }}
                >
                  Clean up existing data
                </div>
                <div style={{ fontSize: 13, color: '#64748B', lineHeight: 1.6 }}>
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
              background: '#fff',
              border: selectedUseCases.includes('enrich')
                ? `2px solid ${C.indigo}`
                : '1px solid #E2E8F0',
              borderRadius: 8,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              if (!selectedUseCases.includes('enrich')) {
                e.currentTarget.style.borderColor = '#CBD5E1';
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.05)';
              }
            }}
            onMouseLeave={(e) => {
              if (!selectedUseCases.includes('enrich')) {
                e.currentTarget.style.borderColor = '#E2E8F0';
                e.currentTarget.style.boxShadow = 'none';
              }
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
              {/* Checkbox */}
              <div
                style={{
                  minWidth: 20,
                  height: 20,
                  borderRadius: 4,
                  border: selectedUseCases.includes('enrich')
                    ? `2px solid ${C.indigo}`
                    : '2px solid #CBD5E1',
                  background: selectedUseCases.includes('enrich') ? C.indigo : '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginTop: 2,
                }}
              >
                {selectedUseCases.includes('enrich') && (
                  <span style={{ fontSize: 12, color: '#fff', fontWeight: 700 }}>✓</span>
                )}
              </div>

              {/* Content */}
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontSize: 16,
                    fontWeight: 600,
                    color: '#1E293B',
                    marginBottom: 6,
                  }}
                >
                  Enrich records with missing data
                </div>
                <div style={{ fontSize: 13, color: '#64748B', lineHeight: 1.6 }}>
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
              background: '#fff',
              border: selectedUseCases.includes('both')
                ? `2px solid ${C.indigo}`
                : '1px solid #E2E8F0',
              borderRadius: 8,
              cursor: 'pointer',
              transition: 'all 0.2s',
              position: 'relative',
            }}
            onMouseEnter={(e) => {
              if (!selectedUseCases.includes('both')) {
                e.currentTarget.style.borderColor = '#CBD5E1';
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.05)';
              }
            }}
            onMouseLeave={(e) => {
              if (!selectedUseCases.includes('both')) {
                e.currentTarget.style.borderColor = '#E2E8F0';
                e.currentTarget.style.boxShadow = 'none';
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
                color: '#fff',
                fontSize: 11,
                fontWeight: 600,
                borderRadius: 4,
              }}
            >
              Most popular
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
              {/* Checkbox */}
              <div
                style={{
                  minWidth: 20,
                  height: 20,
                  borderRadius: 4,
                  border: selectedUseCases.includes('both')
                    ? `2px solid ${C.indigo}`
                    : '2px solid #CBD5E1',
                  background: selectedUseCases.includes('both') ? C.indigo : '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginTop: 2,
                }}
              >
                {selectedUseCases.includes('both') && (
                  <span style={{ fontSize: 12, color: '#fff', fontWeight: 700 }}>✓</span>
                )}
              </div>

              {/* Content */}
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontSize: 16,
                    fontWeight: 600,
                    color: '#1E293B',
                    marginBottom: 6,
                  }}
                >
                  Both - full data quality pipeline
                </div>
                <div style={{ fontSize: 13, color: '#64748B', lineHeight: 1.6 }}>
                  Start clean and keep it that way. The complete Refyne experience.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation buttons */}
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
          <button
            onClick={() => router.back()}
            style={{
              padding: '12px 24px',
              fontSize: 14,
              fontWeight: 500,
              fontFamily: F.sans,
              color: '#64748B',
              background: '#fff',
              border: '1px solid #CBD5E1',
              borderRadius: 6,
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
              color: '#fff',
              background: C.steel,
              border: 'none',
              borderRadius: 6,
              cursor:
                isSubmitting || selectedUseCases.length === 0 ? 'not-allowed' : 'pointer',
              opacity: isSubmitting || selectedUseCases.length === 0 ? 0.5 : 1,
            }}
          >
            {isSubmitting ? 'Saving...' : 'Continue →'}
          </button>
        </div>
      </div>
    </div>
  );
}
