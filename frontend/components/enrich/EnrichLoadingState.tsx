'use client';

import { useState, useEffect, useRef } from 'react';
import { C, F } from '@/lib/design-tokens';

interface CompanyPreview {
  name: string;
  initials: string;
  gap_count: number;
}

interface FieldGap {
  field: string;
  missing: number;
  coverage: number;
}

interface EnrichLoadingStateProps {
  onComplete: () => void;
  finalCount: number;
  finalFieldGaps: FieldGap[];
}

const PHASE_LABELS = [
  'Reading company properties',
  'Counting missing fields',
  'Calculating coverage rates',
  'Analyzing data quality',
  'Building gap analysis',
  'Almost ready...',
];

const FIELD_LABELS: Record<string, string> = {
  industry: 'Industry',
  numberofemployees: 'Employee count',
  linkedin_company_page: 'LinkedIn URL',
  phone: 'Phone',
  domain: 'Domain',
  annualrevenue: 'Revenue',
};

export function EnrichLoadingState({
  onComplete,
  finalCount,
  finalFieldGaps,
}: EnrichLoadingStateProps) {
  const [count, setCount] = useState(0);
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [companies, setCompanies] = useState<CompanyPreview[]>([]);
  const [visibleCompanies, setVisibleCompanies] = useState<CompanyPreview[]>([]);
  const [showBars, setShowBars] = useState(false);
  const [barPercentages, setBarPercentages] = useState<Record<string, number>>({});
  const [scanComplete, setScanComplete] = useState(false);
  const [showShimmer, setShowShimmer] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const phaseIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const companyRotationRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch company preview on mount
  useEffect(() => {
    async function fetchPreview() {
      try {
        const res = await fetch('/api/enrich/company-preview');
        if (res.ok) {
          const data = await res.json();
          setCompanies(data.companies || []);
          setVisibleCompanies((data.companies || []).slice(0, 5));
        }
      } catch (error) {
        console.error('Failed to fetch company preview:', error);
      }
    }
    fetchPreview();
  }, []);

  // Rotate visible companies
  useEffect(() => {
    if (companies.length <= 5) return;

    let currentIndex = 5;
    companyRotationRef.current = setInterval(() => {
      const next = companies.slice(currentIndex, currentIndex + 1);
      if (next.length > 0) {
        setVisibleCompanies((prev) => [...prev.slice(1), next[0]]);
        currentIndex++;
        if (currentIndex >= companies.length) {
          currentIndex = 0;
        }
      }
    }, 600);

    return () => {
      if (companyRotationRef.current) {
        clearInterval(companyRotationRef.current);
      }
    };
  }, [companies]);

  // Animate counter
  useEffect(() => {
    let current = 0;
    const increment = Math.floor(finalCount / 30); // ~30 ticks to reach final

    intervalRef.current = setInterval(() => {
      const randomDelta = Math.floor(Math.random() * 120) + 60; // 60-180
      current += randomDelta;

      if (current >= finalCount) {
        setCount(finalCount);
        clearInterval(intervalRef.current!);
        // Trigger scan complete sequence
        setScanComplete(true);
      } else {
        setCount(current);

        // Show bars at ~30% progress
        const progress = current / finalCount;
        if (progress >= 0.3 && !showBars) {
          setShowBars(true);
          // Initialize bars with placeholder percentages
          const placeholders: Record<string, number> = {};
          finalFieldGaps.forEach((gap) => {
            placeholders[gap.field] = Math.floor(Math.random() * 40) + 30; // 30-70%
          });
          setBarPercentages(placeholders);
        }
      }
    }, 180);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [finalCount, finalFieldGaps, showBars]);

  // Cycle phase labels
  useEffect(() => {
    phaseIntervalRef.current = setInterval(() => {
      setPhaseIndex((prev) => (prev + 1) % PHASE_LABELS.length);
    }, 1800);

    return () => {
      if (phaseIntervalRef.current) {
        clearInterval(phaseIntervalRef.current);
      }
    };
  }, []);

  // When scan completes
  useEffect(() => {
    if (!scanComplete) return;

    // Update bars to real percentages
    const realPercentages: Record<string, number> = {};
    finalFieldGaps.forEach((gap) => {
      realPercentages[gap.field] = gap.coverage;
    });
    setBarPercentages(realPercentages);

    // Show shimmer after 200ms
    setTimeout(() => {
      setShowShimmer(true);
    }, 200);

    // Transition to full layout after 600ms
    setTimeout(() => {
      onComplete();
    }, 600);
  }, [scanComplete, finalFieldGaps, onComplete]);

  const getGapColor = (gapCount: number) => {
    if (gapCount >= 4) return '#ef4444'; // red
    if (gapCount >= 2) return '#f59e0b'; // amber
    return '#10b981'; // green
  };

  return (
    <div
      style={{
        fontFamily: F.sans,
        background: C.bg,
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div style={{ maxWidth: 600, width: '100%' }}>
        {/* Counter */}
        <div
          style={{
            fontSize: 64,
            fontWeight: 600,
            color: C.text,
            textAlign: 'center',
            marginBottom: 8,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {count.toLocaleString()}
        </div>
        <div
          style={{
            fontSize: 14,
            color: C.text2,
            textAlign: 'center',
            marginBottom: 40,
          }}
        >
          {scanComplete ? 'Scan complete. Building your gap analysis...' : 'companies scanned'}
        </div>

        {/* Field bars */}
        {showBars && (
          <div
            style={{
              marginBottom: 40,
              opacity: showBars ? 1 : 0,
              transition: 'opacity 0.4s',
            }}
          >
            {finalFieldGaps.map((gap) => {
              const percentage = barPercentages[gap.field] || 0;
              return (
                <div
                  key={gap.field}
                  style={{
                    marginBottom: 12,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: 12,
                      color: C.text3,
                      marginBottom: 4,
                    }}
                  >
                    <span>{FIELD_LABELS[gap.field] || gap.field}</span>
                    <span>{percentage}%</span>
                  </div>
                  <div
                    style={{
                      height: 6,
                      background: C.surface,
                      borderRadius: 0,
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        height: '100%',
                        width: `${percentage}%`,
                        background: percentage < 30 ? '#ef4444' : percentage < 60 ? '#f59e0b' : '#10b981',
                        transition: 'width 0.8s ease-out, background-color 0.3s',
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Company feed or shimmer */}
        {!showShimmer ? (
          <div
            style={{
              marginBottom: 24,
              opacity: visibleCompanies.length > 0 ? 1 : 0,
              transition: 'opacity 0.4s',
            }}
          >
            {visibleCompanies.slice(0, 5).map((company, i) => (
              <div
                key={`${company.name}-${i}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '8px 12px',
                  borderBottom: `0.5px solid ${C.border}`,
                  animation: 'fadeIn 0.3s ease-in',
                }}
              >
                {/* Avatar */}
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 0,
                    background: C.surface,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 11,
                    fontWeight: 600,
                    color: C.text3,
                    flexShrink: 0,
                  }}
                >
                  {company.initials}
                </div>

                {/* Name */}
                <div
                  style={{
                    flex: 1,
                    fontSize: 13,
                    color: C.text,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {company.name}
                </div>

                {/* Gap dots */}
                <div style={{ display: 'flex', gap: 3 }}>
                  {Array.from({ length: Math.min(company.gap_count, 6) }).map((_, idx) => (
                    <div
                      key={idx}
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        background: getGapColor(company.gap_count),
                      }}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ marginBottom: 24 }}>
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                style={{
                  height: 80,
                  background: C.surface,
                  marginBottom: 12,
                  borderRadius: 0,
                  animation: 'shimmer 1.5s infinite',
                  backgroundImage: `linear-gradient(90deg, ${C.surface} 0%, ${C.hover} 50%, ${C.surface} 100%)`,
                  backgroundSize: '200% 100%',
                }}
              />
            ))}
          </div>
        )}

        {/* Phase label */}
        <div
          style={{
            fontSize: 12,
            color: C.text3,
            textAlign: 'center',
            fontStyle: 'italic',
          }}
        >
          {PHASE_LABELS[phaseIndex]}
        </div>

        <style jsx>{`
          @keyframes fadeIn {
            from {
              opacity: 0;
              transform: translateY(-4px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }

          @keyframes shimmer {
            0% {
              background-position: -200% 0;
            }
            100% {
              background-position: 200% 0;
            }
          }
        `}</style>
      </div>
    </div>
  );
}
