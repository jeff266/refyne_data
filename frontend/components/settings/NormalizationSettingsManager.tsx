'use client';

/**
 * NormalizationSettingsManager - Phase 9
 *
 * Main container for normalization settings.
 * Supports two modes:
 * - Implicit: Auto-normalize on every pull (default pipeline config)
 * - Explicit: Preview-then-approve workflow (Insycle-style)
 */

import { useNormalizationSettings } from '@/lib/settings';
import { ModeToggle, ImplicitModePanel, ExplicitModePanel } from './normalization';

export function NormalizationSettingsManager() {
  const { mode, isLoading } = useNormalizationSettings();

  if (isLoading) {
    return (
      <div className="space-y-8">
        {/* Mode Toggle Skeleton */}
        <div className="space-y-4">
          <div className="h-6 w-48 bg-mplc-gray-200 rounded animate-pulse" />
          <div className="grid grid-cols-2 gap-4">
            <div className="h-24 bg-mplc-gray-100 rounded-xl animate-pulse" />
            <div className="h-24 bg-mplc-gray-100 rounded-xl animate-pulse" />
          </div>
        </div>
        {/* Panel Skeleton */}
        <div className="h-64 bg-mplc-gray-100 rounded-xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Mode Selection */}
      <ModeToggle />

      {/* Mode-specific Panel */}
      <div className="pt-6 border-t border-mplc-gray-200">
        {mode === 'implicit' ? (
          <ImplicitModePanel />
        ) : (
          <ExplicitModePanel />
        )}
      </div>
    </div>
  );
}
