'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { C, F } from '@/lib/design-tokens';
import { PrimaryBtn } from '@/components/refyne';

export default function OnboardingScorePage() {
  const router = useRouter();
  const [displayScore, setDisplayScore] = useState(0);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [showCTA, setShowCTA] = useState(false);
  const [finalScore] = useState(67); // TODO: Get from API
  const [role] = useState('revops'); // TODO: Get from onboarding_progress
  const [companyName] = useState('Your Company'); // TODO: Get from onboarding_progress
  const animationRef = useRef<number>();

  useEffect(() => {
    // Phase 1: Count-up animation (1.5 seconds)
    const startTime = Date.now();
    const duration = 1500;

    function animate() {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Easing function for smooth count-up
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      const current = Math.floor(easeOutQuart * finalScore);

      setDisplayScore(current);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        setDisplayScore(finalScore);
        // Phase 2: Breakdown appears (500ms pause)
        setTimeout(() => {
          setShowBreakdown(true);
          // Phase 3: CTA appears (1s pause)
          setTimeout(() => {
            setShowCTA(true);
            // Mark score revealed
            markScoreRevealed();
          }, 1000);
        }, 500);
      }
    }

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  async function markScoreRevealed() {
    try {
      await fetch('/api/onboarding/complete', {
        method: 'POST',
      });
    } catch (error) {
      console.error('Failed to mark score revealed:', error);
    }
  }

  function getPrimaryCTA() {
    switch (role) {
      case 'revops':
        return {
          text: 'Review 12 high-confidence duplicates →',
          path: '/dedup?grade=A',
        };
      case 'sales':
        return {
          text: 'Fix phone numbers for cleaner call data →',
          path: '/normalize?harmony=phone_e164',
        };
      case 'marketing':
        return {
          text: 'Fix industry data for better segmentation →',
          path: '/normalize?harmony=industry',
        };
      case 'agency':
        return {
          text: 'View full dashboard →',
          path: '/dashboard',
        };
      default:
        return {
          text: 'Review duplicates →',
          path: '/dedup',
        };
    }
  }

  const scoreColor = finalScore >= 80 ? C.green : finalScore >= 60 ? C.amber : C.red;
  const primaryCTA = getPrimaryCTA();

  return (
    <div style={{
      minHeight: '100vh',
      background: C.bg,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: F.sans,
      color: C.text,
      padding: 24,
    }}>
      {/* Logo */}
      <div style={{
        position: 'absolute',
        top: 32,
        left: 32,
        fontSize: 20,
        fontWeight: 600,
        color: C.indigo,
      }}>
        Refyne
      </div>

      {/* Content */}
      <div style={{
        maxWidth: 600,
        width: '100%',
        textAlign: 'center',
      }}>
        {/* Phase 1: Score */}
        <div style={{ marginBottom: 48 }}>
          <div style={{ fontSize: 16, color: C.text3, marginBottom: 24 }}>
            Your HubSpot health score
          </div>
          <div style={{
            fontSize: 120,
            fontWeight: 700,
            color: scoreColor,
            lineHeight: 1,
            fontFamily: F.mono,
          }}>
            {displayScore}
          </div>
          <div style={{ fontSize: 32, color: C.text3, marginTop: 8 }}>
            / 100
          </div>
        </div>

        {/* Phase 2: Breakdown */}
        {showBreakdown && (
          <div style={{
            background: C.sidebar,
            border: `1px solid ${C.border}`,
            borderRadius: 12,
            padding: 32,
            marginBottom: 32,
            textAlign: 'left',
            animation: 'fadeIn 0.5s ease-out',
          }}>
            <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 24 }}>
              Here's what we found in {companyName}:
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              {/* Duplicates */}
              <div>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 8 }}>
                  <span style={{ fontSize: 24 }}>⚡</span>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 500 }}>34 duplicate pairs</div>
                    <div style={{ fontSize: 14, color: C.text3, marginTop: 4 }}>
                      12 Grade A — high confidence matches
                    </div>
                  </div>
                </div>
              </div>

              {/* Phone Numbers */}
              <div>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 8 }}>
                  <span style={{ fontSize: 24 }}>📞</span>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 500 }}>847 phone numbers</div>
                    <div style={{ fontSize: 14, color: C.text3, marginTop: 4 }}>
                      Need E.164 formatting
                    </div>
                  </div>
                </div>
              </div>

              {/* Industry */}
              <div>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <span style={{ fontSize: 24 }}>🏭</span>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 500 }}>284 companies</div>
                    <div style={{ fontSize: 14, color: C.text3, marginTop: 4 }}>
                      Missing industry classification
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Phase 3: CTA */}
        {showCTA && (
          <div style={{ animation: 'fadeIn 0.5s ease-out' }}>
            <div style={{ marginBottom: 16 }}>
              <PrimaryBtn onClick={() => router.push(primaryCTA.path)}>
                {primaryCTA.text}
              </PrimaryBtn>
            </div>

            <button
              onClick={() => router.push('/dashboard')}
              style={{
                background: 'none',
                border: 'none',
                color: C.text3,
                fontSize: 14,
                cursor: 'pointer',
                textDecoration: 'underline',
                fontFamily: F.sans,
              }}
            >
              Explore your full score
            </button>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
