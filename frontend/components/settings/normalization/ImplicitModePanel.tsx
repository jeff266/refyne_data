'use client';

/**
 * ImplicitModePanel - Phase 9
 *
 * Simpler view for implicit mode:
 * - Pipeline selector (default pipeline)
 * - Last run stats (placeholder)
 * - Edit pipeline button
 */

import { useState, useEffect } from 'react';
import { Zap, Clock, Edit2 } from 'lucide-react';
import { PipelineSelector } from './PipelineSelector';
import { useNormalizationSettings } from '@/lib/settings';

export function ImplicitModePanel() {
  const { defaultPipeline, updateExistingPipeline } = useNormalizationSettings();

  const [selectedHarmonyIds, setSelectedHarmonyIds] = useState<string[]>(
    defaultPipeline?.harmony_ids || []
  );
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Sync with default pipeline when it loads
  useEffect(() => {
    if (defaultPipeline) {
      setSelectedHarmonyIds(defaultPipeline.harmony_ids);
    }
  }, [defaultPipeline]);

  const handleSave = async () => {
    if (!defaultPipeline) return;
    setIsSaving(true);
    try {
      await updateExistingPipeline(defaultPipeline.id, selectedHarmonyIds);
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (defaultPipeline) {
      setSelectedHarmonyIds(defaultPipeline.harmony_ids);
    }
    setIsEditing(false);
  };

  const hasChanges = defaultPipeline &&
    JSON.stringify(defaultPipeline.harmony_ids.sort()) !==
    JSON.stringify(selectedHarmonyIds.sort());

  return (
    <div className="space-y-6">
      {/* Info Banner */}
      <div className="flex items-start gap-4 p-4 bg-primary/5 border border-primary/20 rounded-xl">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Zap className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h4 className="text-sm font-medium text-mplc-gray-900">
            Auto-normalization enabled
          </h4>
          <p className="text-sm text-mplc-gray-600 mt-0.5">
            The default pipeline automatically normalizes data on every pull.
            No approval required.
          </p>
        </div>
      </div>

      {/* Default Pipeline Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-mplc-gray-900">Default Pipeline</h3>
          {!isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
            >
              <Edit2 className="w-3.5 h-3.5" />
              Edit Pipeline
            </button>
          )}
        </div>

        {isEditing ? (
          <>
            <PipelineSelector
              selectedHarmonyIds={selectedHarmonyIds}
              onSelectionChange={setSelectedHarmonyIds}
            />
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={handleCancel}
                disabled={isSaving}
                className="px-4 py-2 text-sm font-medium text-mplc-gray-700 bg-white border border-mplc-gray-300
                  rounded-lg hover:bg-mplc-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!hasChanges || isSaving}
                className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg
                  hover:bg-primary/90 disabled:opacity-50"
              >
                {isSaving ? 'Saving...' : 'Save Pipeline'}
              </button>
            </div>
          </>
        ) : (
          <div className="border border-mplc-gray-200 rounded-xl p-4 bg-white">
            {defaultPipeline ? (
              <>
                <div className="flex flex-wrap gap-2">
                  {defaultPipeline.harmony_ids.map(id => (
                    <span
                      key={id}
                      className="px-2.5 py-1 text-xs font-medium bg-mplc-gray-100 text-mplc-gray-700 rounded-md"
                    >
                      {id.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                    </span>
                  ))}
                </div>
                <div className="mt-4 pt-4 border-t border-mplc-gray-100">
                  <div className="flex items-center gap-2 text-xs text-mplc-gray-500">
                    <Clock className="w-3.5 h-3.5" />
                    <span>
                      {defaultPipeline.harmony_ids.length} Harmonies configured
                    </span>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-sm text-mplc-gray-500">No pipeline configured</p>
            )}
          </div>
        )}
      </div>

      {/* Last Run Stats (Placeholder) */}
      <div className="p-4 border border-mplc-gray-200 rounded-xl bg-mplc-gray-50">
        <div className="flex items-center gap-2 text-sm text-mplc-gray-600">
          <Clock className="w-4 h-4 text-mplc-gray-400" />
          <span>
            Last run statistics will appear here after enrichment pulls are processed.
          </span>
        </div>
      </div>
    </div>
  );
}
