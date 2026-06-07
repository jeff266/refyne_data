import { useEffect, useState } from 'react';
import { useOrganization } from '@clerk/nextjs';
import { FeatureFlag } from '@/lib/features/flags';

interface FeatureFlagsState {
  flags: Record<string, boolean>;
  isLoading: boolean;
}

// Client-side hook for feature flag checks
// Fetches from /api/features/flags endpoint
// Use this in React components
export function useFeatureFlags(flagsToCheck: FeatureFlag[]) {
  const { organization } = useOrganization();
  const [state, setState] = useState<FeatureFlagsState>({
    flags: {},
    isLoading: true
  });

  useEffect(() => {
    if (!organization) return;

    fetch(`/api/features/flags?flags=${flagsToCheck.join(',')}`)
      .then(r => r.json())
      .then(data => setState({ flags: data.flags, isLoading: false }))
      .catch(() => setState({ flags: {}, isLoading: false }));
  }, [organization?.id]);

  return {
    isEnabled: (flag: FeatureFlag) => state.flags[flag] ?? false,
    isLoading: state.isLoading,
    flags: state.flags
  };
}

// Single flag convenience hook
export function useFlag(flag: FeatureFlag): boolean {
  const { isEnabled } = useFeatureFlags([flag]);
  return isEnabled(flag);
}
