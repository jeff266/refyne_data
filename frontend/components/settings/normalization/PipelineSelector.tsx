'use client';

/**
 * PipelineSelector - Phase 9
 *
 * Select and configure Harmonies for a pipeline.
 * Reads and writes the pipelines table.
 */

import { useState, useEffect } from 'react';
import { Music, Check, Plus, Trash2, Star } from 'lucide-react';
import { useNormalizationSettings } from '@/lib/settings';

/** Library Harmony info */
interface HarmonyInfo {
  id: string;
  name: string;
  category: string;
  fields: string[];
}

interface PipelineSelectorProps {
  /** Selected Harmony IDs */
  selectedHarmonyIds: string[];
  /** Callback when selection changes */
  onSelectionChange: (harmonyIds: string[]) => void;
  /** Whether the selector is disabled */
  disabled?: boolean;
}

export function PipelineSelector({
  selectedHarmonyIds,
  onSelectionChange,
  disabled = false,
}: PipelineSelectorProps) {
  const [harmonies, setHarmonies] = useState<HarmonyInfo[]>([]);
  const [loading, setLoading] = useState(true);

  // Load harmonies from API
  useEffect(() => {
    const loadHarmonies = async () => {
      try {
        const response = await fetch('/api/harmonies');
        if (!response.ok) throw new Error('Failed to fetch harmonies');
        const data = await response.json();
        setHarmonies(data.harmonies || []);
      } catch (err) {
        console.error('Failed to load harmonies:', err);
      } finally {
        setLoading(false);
      }
    };
    loadHarmonies();
  }, []);

  const selectedSet = new Set(selectedHarmonyIds);

  const toggleHarmony = (harmonyId: string) => {
    if (disabled) return;

    const newSelection = selectedSet.has(harmonyId)
      ? selectedHarmonyIds.filter(id => id !== harmonyId)
      : [...selectedHarmonyIds, harmonyId];

    onSelectionChange(newSelection);
  };

  const selectAll = () => {
    if (disabled) return;
    onSelectionChange(harmonies.map(h => h.id));
  };

  const clearAll = () => {
    if (disabled) return;
    onSelectionChange([]);
  };

  // Group harmonies by category
  const harmonyGroups = harmonies.reduce((acc, harmony) => {
    const category = harmony.category || 'Other';
    if (!acc[category]) acc[category] = [];
    acc[category].push(harmony);
    return acc;
  }, {} as Record<string, HarmonyInfo[]>);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-mplc-gray-100 flex items-center justify-center">
            <Music className="w-5 h-5 text-mplc-gray-400" />
          </div>
          <div>
            <div className="h-5 w-24 bg-mplc-gray-200 rounded animate-pulse" />
            <div className="h-4 w-32 bg-mplc-gray-100 rounded animate-pulse mt-1" />
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="h-10 bg-mplc-gray-100 rounded-lg animate-pulse" />
          ))}
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
            <Music className="w-5 h-5 text-mplc-gray-600" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-mplc-gray-900">Pipeline</h3>
            <p className="text-xs text-mplc-gray-500">
              {selectedHarmonyIds.length} of {harmonies.length} Harmonies selected
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={selectAll}
            disabled={disabled}
            className="text-xs text-primary hover:underline disabled:opacity-50"
          >
            Select All
          </button>
          <span className="text-mplc-gray-300">|</span>
          <button
            onClick={clearAll}
            disabled={disabled}
            className="text-xs text-mplc-gray-500 hover:underline disabled:opacity-50"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Harmony Checkboxes */}
      <div className="border border-mplc-gray-200 rounded-xl p-4 bg-white">
        <div className="space-y-4">
          {Object.entries(harmonyGroups).map(([category, categoryHarmonies]) => (
            <div key={category}>
              <div className="text-xs font-semibold text-mplc-gray-500 uppercase tracking-wider mb-2">
                {category}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {categoryHarmonies.map(harmony => {
                  const isSelected = selectedSet.has(harmony.id);
                  return (
                    <label
                      key={harmony.id}
                      className={`
                        flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-all
                        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
                        ${isSelected
                          ? 'border-primary bg-primary/5'
                          : 'border-mplc-gray-200 hover:border-mplc-gray-300 hover:bg-mplc-gray-50'
                        }
                      `}
                    >
                      <div className={`
                        w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0
                        ${isSelected
                          ? 'bg-primary border-primary'
                          : 'border-mplc-gray-300 bg-white'
                        }
                      `}>
                        {isSelected && <Check className="w-3 h-3 text-white" />}
                      </div>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleHarmony(harmony.id)}
                        disabled={disabled}
                        className="sr-only"
                      />
                      <span className="text-sm text-mplc-gray-700 truncate">
                        {harmony.name.replace(' Normalizer', '').replace(' Validator', '')}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Pipeline manager for selecting/managing pipelines.
 */
export function PipelineManager() {
  const {
    pipelines,
    defaultPipeline,
    createNewPipeline,
    updateExistingPipeline,
    setAsDefaultPipeline,
  } = useNormalizationSettings();

  const [selectedPipelineId, setSelectedPipelineId] = useState<string | null>(null);
  const [selectedHarmonyIds, setSelectedHarmonyIds] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Initialize with default pipeline
  useEffect(() => {
    if (defaultPipeline && !selectedPipelineId) {
      setSelectedPipelineId(defaultPipeline.id);
      setSelectedHarmonyIds(defaultPipeline.harmony_ids);
    }
  }, [defaultPipeline, selectedPipelineId]);

  const handleSave = async () => {
    if (!selectedPipelineId) return;
    setIsSaving(true);
    try {
      await updateExistingPipeline(selectedPipelineId, selectedHarmonyIds);
    } finally {
      setIsSaving(false);
    }
  };

  const selectedPipeline = pipelines.find(p => p.id === selectedPipelineId);
  const hasChanges = selectedPipeline &&
    JSON.stringify(selectedPipeline.harmony_ids.sort()) !==
    JSON.stringify(selectedHarmonyIds.sort());

  return (
    <div className="space-y-4">
      <PipelineSelector
        selectedHarmonyIds={selectedHarmonyIds}
        onSelectionChange={setSelectedHarmonyIds}
      />

      {hasChanges && (
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg
              hover:bg-primary/90 disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : 'Save Pipeline'}
          </button>
        </div>
      )}
    </div>
  );
}
