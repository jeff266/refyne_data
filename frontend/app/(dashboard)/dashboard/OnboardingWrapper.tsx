'use client';

import { useEffect, useState, useRef } from 'react';
import { OnboardingChecklist } from '@/components/refyne';

export function OnboardingWrapper() {
  const [progress, setProgress] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const hasTrackedVisit = useRef(false);

  useEffect(() => {
    // Fetch onboarding status
    async function fetchStatus() {
      try {
        const res = await fetch('/api/onboarding/status');
        if (res.ok) {
          const data = await res.json();
          setProgress(data);
        }
      } catch (error) {
        console.error('Failed to fetch onboarding status:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchStatus();
  }, []);

  useEffect(() => {
    // Track dashboard visit (only once per page load)
    if (!hasTrackedVisit.current && progress && !progress.viewed_dashboard) {
      hasTrackedVisit.current = true;

      fetch('/api/onboarding/step/viewed_dashboard', {
        method: 'POST',
      }).then(() => {
        // Refresh progress
        setProgress((prev: any) => ({
          ...prev,
          viewed_dashboard: true,
        }));
      }).catch((error) => {
        console.error('Failed to track dashboard visit:', error);
      });
    }
  }, [progress]);

  const handleDismiss = async () => {
    try {
      await fetch('/api/onboarding/dismiss', {
        method: 'POST',
      });
      // Hide the checklist immediately
      setProgress(null);
    } catch (error) {
      console.error('Failed to dismiss onboarding:', error);
    }
  };

  // Don't show if loading, no progress data, or already dismissed
  if (isLoading || !progress || progress.dismissed_at) {
    return null;
  }

  // Don't show if completed more than 24h ago
  if (progress.completed_at) {
    const completedTime = new Date(progress.completed_at).getTime();
    const hoursSinceCompletion = (Date.now() - completedTime) / (1000 * 60 * 60);
    if (hoursSinceCompletion > 24) {
      return null;
    }
  }

  return <OnboardingChecklist progress={progress} onDismiss={handleDismiss} />;
}
