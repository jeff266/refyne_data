'use client';

/**
 * ModeToggle - Phase 9
 *
 * Toggle between Implicit and Explicit normalization modes.
 * Persists to Supabase via the settings repository.
 */

import { Settings2, Zap, Eye } from 'lucide-react';
import { useNormalizationSettings } from '@/lib/settings';
import type { NormalizationMode } from '@/lib/db/types';

interface ModeOption {
  value: NormalizationMode;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

const MODE_OPTIONS: ModeOption[] = [
  {
    value: 'implicit',
    label: 'Implicit',
    description: 'Auto-applies normalization on every pull. No approval required.',
    icon: Zap,
  },
  {
    value: 'explicit',
    label: 'Explicit',
    description: 'Preview changes before applying. Review and approve each batch.',
    icon: Eye,
  },
];

export function ModeToggle() {
  const { mode, setMode, isLoading, isSupabaseEnabled } = useNormalizationSettings();

  const handleModeChange = async (newMode: NormalizationMode) => {
    await setMode(newMode);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-mplc-gray-100 flex items-center justify-center">
            <Settings2 className="w-5 h-5 text-mplc-gray-400" />
          </div>
          <div>
            <div className="h-5 w-24 bg-mplc-gray-200 rounded animate-pulse" />
            <div className="h-4 w-40 bg-mplc-gray-100 rounded animate-pulse mt-1" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-mplc-gray-100 flex items-center justify-center">
            <Settings2 className="w-5 h-5 text-mplc-gray-600" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-mplc-gray-900">Mode</h3>
            <p className="text-xs text-mplc-gray-500">
              How normalization is applied to your data
            </p>
          </div>
        </div>
        {!isSupabaseEnabled && (
          <span className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded">
            Local storage only
          </span>
        )}
      </div>

      {/* Mode Toggle */}
      <div className="flex gap-3">
        {MODE_OPTIONS.map((option) => {
          const Icon = option.icon;
          const isSelected = mode === option.value;

          return (
            <button
              key={option.value}
              onClick={() => handleModeChange(option.value)}
              className={`
                flex-1 flex items-start gap-3 p-4 rounded-xl border text-left transition-all
                ${isSelected
                  ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                  : 'border-mplc-gray-200 bg-white hover:border-mplc-gray-300 hover:bg-mplc-gray-50'
                }
              `}
            >
              <div className={`
                w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0
                ${isSelected ? 'bg-primary/10 text-primary' : 'bg-mplc-gray-100 text-mplc-gray-500'}
              `}>
                <Icon className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`
                    text-sm font-medium
                    ${isSelected ? 'text-mplc-gray-900' : 'text-mplc-gray-700'}
                  `}>
                    {option.label}
                  </span>
                  {isSelected && (
                    <span className="w-2 h-2 rounded-full bg-primary" />
                  )}
                </div>
                <span className="block text-xs text-mplc-gray-500 mt-0.5">
                  {option.description}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
