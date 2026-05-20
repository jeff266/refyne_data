'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { C } from '@/lib/design-tokens';
import { PrimaryBtn, GhostBtn } from '@/components/refyne';
import { addToast } from '@/components/ui/toast';
import { Target, TrendingUp, Sparkles, X } from 'lucide-react';

interface OnboardingModalProps {
  onComplete: () => void;
  onSkip: () => void;
}

export function ArrangementsOnboardingModal({ onComplete, onSkip }: OnboardingModalProps) {
  const router = useRouter();
  const [currentScreen, setCurrentScreen] = useState<1 | 2 | 3>(1);
  const [numericPreferences, setNumericPreferences] = useState({
    q1: '', // trust higher vs lower vs average vs choose-per
    q2: '', // outlier handling
    q3: '', // revenue strategy
  });
  const [fieldsToCalibrate, setFieldsToCalibrate] = useState<string[]>([]);
  const [skipping, setSkipping] = useState(false);

  const handleSkip = async () => {
    setSkipping(true);
    try {
      // Mark onboarding as complete (skipped)
      const res = await fetch('/api/arrangements/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skipped: true }),
      });

      if (!res.ok) throw new Error('Failed to skip onboarding');

      addToast('success', 'Onboarding skipped - you can run calibration later from Settings');
      onSkip();
    } catch (error) {
      console.error('Failed to skip onboarding:', error);
      addToast('error', 'Failed to skip onboarding');
    } finally {
      setSkipping(false);
    }
  };

  const handleProceedWithoutCalibration = async () => {
    try {
      // Save numeric preferences and mark onboarding complete (without calibration)
      const strategy = deriveStrategy(numericPreferences);
      await fetch('/api/arrangements/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          skipped: false,
          numeric_default_strategy: strategy,
        }),
      });

      addToast('success', 'Preferences saved - you can run calibration later from Settings');
      onComplete();
    } catch (error) {
      console.error('Failed to complete onboarding:', error);
      addToast('error', 'Failed to complete onboarding');
    }
  };

  const handleRunCalibration = async () => {
    try {
      // Save preferences and start calibration
      const strategy = deriveStrategy(numericPreferences);
      await fetch('/api/arrangements/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          skipped: false,
          numeric_default_strategy: strategy,
        }),
      });

      // Redirect to calibration page (admin will run calibration there)
      router.push('/settings?tab=calibration');
      onComplete();
    } catch (error) {
      console.error('Failed to start calibration:', error);
      addToast('error', 'Failed to start calibration');
    }
  };

  const deriveStrategy = (prefs: typeof numericPreferences): string => {
    // Map questionnaire answers to aggregation strategy
    if (prefs.q2 === 'drop_outlier') return 'cluster_average';
    if (prefs.q1 === 'average' || prefs.q3 === 'average') return 'average';
    if (prefs.q1 === 'higher' || prefs.q3 === 'optimistic') return 'max';
    if (prefs.q1 === 'lower' || prefs.q3 === 'conservative') return 'min';
    return 'waterfall';
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: 32,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && currentScreen === 1) handleSkip();
      }}
    >
      <div
        style={{
          background: C.surface,
          borderRadius: 12,
          maxWidth: 640,
          width: '100%',
          maxHeight: '90vh',
          overflow: 'auto',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
        }}
      >
        {/* Screen 1: Welcome */}
        {currentScreen === 1 && (
          <div style={{ padding: 40 }}>
            <div style={{ textAlign: 'center', marginBottom: 32 }}>
              <div
                style={{
                  width: 64,
                  height: 64,
                  background: C.indigoDim,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 20px',
                }}
              >
                <Target size={32} color={C.indigo} />
              </div>
              <h2 style={{ fontSize: 20, fontWeight: 600, color: C.text, marginBottom: 12 }}>
                Before you build your first arrangement
              </h2>
              <p style={{ fontSize: 14, color: C.text2, lineHeight: 1.6, maxWidth: 480, margin: '0 auto' }}>
                Arrangements enrich your HubSpot records using a waterfall of providers you control.
                Before building one, spend 2 minutes calibrating how Refyne handles field conflicts — using
                your actual data.
              </p>
            </div>

            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <GhostBtn onClick={handleSkip} disabled={skipping}>
                {skipping ? 'Skipping...' : 'Skip for now — use defaults'}
              </GhostBtn>
              <PrimaryBtn onClick={() => setCurrentScreen(2)}>
                Start calibration setup →
              </PrimaryBtn>
            </div>
          </div>
        )}

        {/* Screen 2: Numeric field strategy */}
        {currentScreen === 2 && (
          <div style={{ padding: 40 }}>
            <h2 style={{ fontSize: 18, fontWeight: 600, color: C.text, marginBottom: 24 }}>
              How should we handle conflicting numbers?
            </h2>

            {/* Q1 */}
            <div style={{ marginBottom: 24 }}>
              <p style={{ fontSize: 14, color: C.text, marginBottom: 12, fontWeight: 500 }}>
                When two providers return different employee counts, which do you trust more?
              </p>
              <div style={{ display: 'grid', gap: 8 }}>
                {[
                  { value: 'higher', label: 'The higher number — companies often under-report headcount' },
                  { value: 'lower', label: 'The lower number — I\'d rather under-qualify than over-qualify' },
                  { value: 'average', label: 'The average — split the difference' },
                  { value: 'choose', label: 'Let me choose per arrangement' },
                ].map((option) => (
                  <label
                    key={option.value}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: 12,
                      background: numericPreferences.q1 === option.value ? C.indigoDim : C.bg,
                      border: `1px solid ${numericPreferences.q1 === option.value ? C.indigoBrd : C.border}`,
                      borderRadius: 6,
                      cursor: 'pointer',
                      fontSize: 13,
                      color: C.text,
                    }}
                  >
                    <input
                      type="radio"
                      name="q1"
                      value={option.value}
                      checked={numericPreferences.q1 === option.value}
                      onChange={(e) => setNumericPreferences({ ...numericPreferences, q1: e.target.value })}
                      style={{ cursor: 'pointer' }}
                    />
                    {option.label}
                  </label>
                ))}
              </div>
            </div>

            {/* Q2 */}
            <div style={{ marginBottom: 24 }}>
              <p style={{ fontSize: 14, color: C.text, marginBottom: 12, fontWeight: 500 }}>
                If Apollo says 50 employees and ZoomInfo says 4,800 for the same company, what should happen?
              </p>
              <div style={{ display: 'grid', gap: 8 }}>
                {[
                  { value: 'use_first', label: 'Use the first provider in my waterfall (ignore the outlier)' },
                  { value: 'average_anyway', label: 'Average them anyway' },
                  { value: 'drop_outlier', label: 'Drop the outlier and use the remaining value' },
                  { value: 'flag_review', label: 'Flag it for manual review' },
                ].map((option) => (
                  <label
                    key={option.value}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: 12,
                      background: numericPreferences.q2 === option.value ? C.indigoDim : C.bg,
                      border: `1px solid ${numericPreferences.q2 === option.value ? C.indigoBrd : C.border}`,
                      borderRadius: 6,
                      cursor: 'pointer',
                      fontSize: 13,
                      color: C.text,
                    }}
                  >
                    <input
                      type="radio"
                      name="q2"
                      value={option.value}
                      checked={numericPreferences.q2 === option.value}
                      onChange={(e) => setNumericPreferences({ ...numericPreferences, q2: e.target.value })}
                      style={{ cursor: 'pointer' }}
                    />
                    {option.label}
                  </label>
                ))}
              </div>
            </div>

            {/* Q3 */}
            <div style={{ marginBottom: 32 }}>
              <p style={{ fontSize: 14, color: C.text, marginBottom: 12, fontWeight: 500 }}>
                For annual revenue, I want to:
              </p>
              <div style={{ display: 'grid', gap: 8 }}>
                {[
                  { value: 'reliable', label: 'Fill from the most reliable provider and stop' },
                  { value: 'average', label: 'Average across all providers that return a value' },
                  { value: 'conservative', label: 'Take the most conservative (lowest) estimate' },
                  { value: 'optimistic', label: 'Take the most optimistic (highest) estimate' },
                ].map((option) => (
                  <label
                    key={option.value}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: 12,
                      background: numericPreferences.q3 === option.value ? C.indigoDim : C.bg,
                      border: `1px solid ${numericPreferences.q3 === option.value ? C.indigoBrd : C.border}`,
                      borderRadius: 6,
                      cursor: 'pointer',
                      fontSize: 13,
                      color: C.text,
                    }}
                  >
                    <input
                      type="radio"
                      name="q3"
                      value={option.value}
                      checked={numericPreferences.q3 === option.value}
                      onChange={(e) => setNumericPreferences({ ...numericPreferences, q3: e.target.value })}
                      style={{ cursor: 'pointer' }}
                    />
                    {option.label}
                  </label>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <GhostBtn onClick={() => setCurrentScreen(1)}>
                ← Back
              </GhostBtn>
              <PrimaryBtn
                onClick={() => setCurrentScreen(3)}
                disabled={!numericPreferences.q1 || !numericPreferences.q2 || !numericPreferences.q3}
              >
                Next →
              </PrimaryBtn>
            </div>
          </div>
        )}

        {/* Screen 3: Run calibration or proceed */}
        {currentScreen === 3 && (
          <div style={{ padding: 40 }}>
            <div style={{ textAlign: 'center', marginBottom: 32 }}>
              <div
                style={{
                  width: 64,
                  height: 64,
                  background: C.greenDim,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 20px',
                }}
              >
                <Sparkles size={32} color={C.green} />
              </div>
              <h2 style={{ fontSize: 20, fontWeight: 600, color: C.text, marginBottom: 12 }}>
                Calibrate your providers (recommended)
              </h2>
              <p style={{ fontSize: 14, color: C.text2, lineHeight: 1.6, maxWidth: 520, margin: '0 auto 24px' }}>
                Refyne will pull 10 sample companies from your HubSpot and query all your connected
                providers simultaneously. You'll review the results and vote on which answers look right.
                This trains Refyne to suggest the best waterfall order for each field.
              </p>
              <p style={{ fontSize: 13, color: C.text3 }}>
                Estimated cost: ~30-50 credits per field across your connected providers
              </p>
            </div>

            <div style={{ marginBottom: 24 }}>
              <p style={{ fontSize: 13, fontWeight: 500, color: C.text, marginBottom: 12 }}>
                Fields to calibrate now:
              </p>
              <div style={{ display: 'grid', gap: 8 }}>
                {[
                  { key: 'industry', label: 'Industry' },
                  { key: 'employee_count', label: 'Employee count' },
                  { key: 'revenue', label: 'Revenue' },
                  { key: 'linkedin_url', label: 'LinkedIn URL' },
                ].map((field) => (
                  <label
                    key={field.key}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: 12,
                      background: C.bg,
                      border: `1px solid ${C.border}`,
                      borderRadius: 6,
                      cursor: 'pointer',
                      fontSize: 13,
                      color: C.text,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={fieldsToCalibrate.includes(field.key)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFieldsToCalibrate([...fieldsToCalibrate, field.key]);
                        } else {
                          setFieldsToCalibrate(fieldsToCalibrate.filter((k) => k !== field.key));
                        }
                      }}
                      style={{ cursor: 'pointer' }}
                    />
                    {field.label}
                  </label>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, justifyContent: 'space-between' }}>
              <GhostBtn onClick={() => setCurrentScreen(2)}>
                ← Back
              </GhostBtn>
              <div style={{ display: 'flex', gap: 12 }}>
                <GhostBtn onClick={handleProceedWithoutCalibration}>
                  Proceed without calibration
                </GhostBtn>
                <PrimaryBtn onClick={handleRunCalibration}>
                  Run calibration now →
                </PrimaryBtn>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
