'use client';

import { useState } from 'react';
import { C, F } from '@/lib/design-tokens';
import { Card } from './Card';
import Link from 'next/link';

interface OnboardingStep {
  key: string;
  label: string;
  description: string;
  link?: string;
}

const STEPS: OnboardingStep[] = [
  {
    key: 'connected_hubspot',
    label: 'Connect HubSpot',
    description: 'Link your HubSpot portal to get started',
    link: '/connections',
  },
  {
    key: 'viewed_dashboard',
    label: 'View your compliance score',
    description: 'Check your data quality baseline',
    link: '/dashboard',
  },
  {
    key: 'viewed_dedup',
    label: 'Review dedup pairs',
    description: 'Discover and merge duplicate records',
    link: '/dedup',
  },
  {
    key: 'applied_harmony',
    label: 'Apply your first Harmony',
    description: 'Create a data normalization rule',
    link: '/harmonies',
  },
  {
    key: 'ran_normalize',
    label: 'Run your first normalize',
    description: 'Apply Harmonies to your data',
    link: '/normalize',
  },
];

interface OnboardingChecklistProps {
  progress: {
    connected_hubspot: boolean;
    viewed_dashboard: boolean;
    viewed_dedup: boolean;
    applied_harmony: boolean;
    ran_normalize: boolean;
    completed_at: string | null;
    dismissed_at: string | null;
  };
  onDismiss: () => void;
}

export function OnboardingChecklist({ progress, onDismiss }: OnboardingChecklistProps) {
  const [isDismissing, setIsDismissing] = useState(false);

  // Count completed steps
  const completedCount = STEPS.filter((step) => progress[step.key as keyof typeof progress]).length;
  const totalSteps = STEPS.length;
  const allComplete = completedCount === totalSteps;

  // Check if we should show completion state (within 24h of completion)
  const showCompletionState = progress.completed_at && !progress.dismissed_at
    ? Date.now() - new Date(progress.completed_at).getTime() < 24 * 60 * 60 * 1000
    : false;

  const handleDismiss = async () => {
    setIsDismissing(true);
    await onDismiss();
  };

  return (
    <Card style={{ marginBottom: 28 }}>
      {/* Header */}
      <div
        style={{
          padding: '16px 20px',
          borderBottom: `1px solid ${C.border}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.text, letterSpacing: '-0.01em' }}>
            {showCompletionState ? 'Setup complete' : 'Get started with Refyne'}
          </div>
          {!showCompletionState && (
            <div style={{ fontSize: 11, color: C.text3, marginTop: 2 }}>
              Complete these steps to activate your workspace
            </div>
          )}
        </div>
        <button
          onClick={handleDismiss}
          disabled={isDismissing}
          style={{
            fontSize: 11,
            color: C.text3,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '4px 8px',
          }}
        >
          {isDismissing ? 'Dismissing...' : 'Dismiss'}
        </button>
      </div>

      {/* Progress Bar */}
      {!showCompletionState && (
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.border}` }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 8,
            }}
          >
            <span style={{ fontSize: 11, fontFamily: F.mono, color: C.text3 }}>
              {completedCount} of {totalSteps} complete
            </span>
            <span style={{ fontSize: 11, fontFamily: F.mono, color: C.text3 }}>
              {Math.round((completedCount / totalSteps) * 100)}%
            </span>
          </div>
          <div
            style={{
              height: 6,
              background: C.hover,
              borderRadius: 3,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${(completedCount / totalSteps) * 100}%`,
                background: allComplete ? C.green : C.indigo,
                transition: 'width 0.3s ease',
              }}
            />
          </div>
        </div>
      )}

      {/* Steps List or Completion Message */}
      {showCompletionState ? (
        <div
          style={{
            padding: '24px 20px',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              fontSize: 48,
              marginBottom: 12,
            }}
          >
            ✅
          </div>
          <div style={{ fontSize: 13, color: C.text, marginBottom: 4 }}>
            Your workspace is ready to go
          </div>
          <div style={{ fontSize: 11, color: C.text3 }}>
            All setup steps completed. This message will auto-hide in 24 hours.
          </div>
        </div>
      ) : (
        <div style={{ padding: '12px 20px' }}>
          {STEPS.map((step, index) => {
            const isComplete = progress[step.key as keyof typeof progress];
            return (
              <div
                key={step.key}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 12,
                  padding: '12px 0',
                  borderBottom: index < STEPS.length - 1 ? `1px solid ${C.border}` : 'none',
                }}
              >
                {/* Step Indicator */}
                <div
                  style={{
                    minWidth: 20,
                    height: 20,
                    borderRadius: '50%',
                    background: isComplete ? C.green : C.hover,
                    border: isComplete ? 'none' : `2px solid ${C.border2}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginTop: 2,
                  }}
                >
                  {isComplete && (
                    <span style={{ fontSize: 12, color: C.bg }}>✓</span>
                  )}
                </div>

                {/* Step Content */}
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 500,
                      color: isComplete ? C.text2 : C.text,
                      marginBottom: 2,
                      textDecoration: isComplete ? 'line-through' : 'none',
                    }}
                  >
                    {step.label}
                  </div>
                  <div style={{ fontSize: 11, color: C.text3, marginBottom: 6 }}>
                    {step.description}
                  </div>
                  {!isComplete && step.link && (
                    <Link
                      href={step.link}
                      style={{
                        fontSize: 11,
                        color: C.indigo,
                        textDecoration: 'none',
                      }}
                    >
                      Go to {step.label.toLowerCase()} →
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
