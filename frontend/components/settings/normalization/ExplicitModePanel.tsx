'use client';

/**
 * ExplicitModePanel - Phase 9
 *
 * Complete explicit mode workflow:
 * 1. Select Harmonies (pipeline)
 * 2. Load records
 * 3. Run preview
 * 4. Review diff table
 * 5. Apply or cancel
 */

import { useState, useCallback } from 'react';
import { Play, Loader2, Upload, Database } from 'lucide-react';
import { PipelineSelector } from './PipelineSelector';
import { CSVRecordSource, type RecordSourceResult } from './RecordSource';
import { HubSpotRecordSource } from '../hubspot/HubSpotRecordSource';
import { DiffTable } from './DiffTable';
import { useNormalizationSettings } from '@/lib/settings';

type RecordSourceType = 'csv' | 'hubspot';

// Types imported directly to avoid server-side code
interface RawRecord {
  _id: string;
  _label?: string;
  [key: string]: unknown;
}

interface FieldPreviewResult {
  field: string;
  current: unknown;
  projected: unknown;
  status: 'changed' | 'unchanged' | 'error';
  error?: string;
  harmonyId?: string;
}

interface RecordPreviewResult {
  record_id: string;
  record_label: string;
  fields: FieldPreviewResult[];
  status: 'changed' | 'unchanged' | 'error';
}

interface PreviewSummary {
  changed: number;
  unchanged: number;
  errors: number;
  total: number;
}

interface HarmoniesPreviewOutput {
  summary: PreviewSummary;
  results: RecordPreviewResult[];
}

interface ApplyError {
  record_id: string;
  error: string;
  field?: string;
}

interface HarmoniesApplyOutput {
  applied: number;
  errors: ApplyError[];
  records: RawRecord[];
}

interface McpResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

/**
 * Call harmonies_preview via API route.
 */
async function executeHarmoniesPreview(input: {
  harmony_ids: string[];
  records: RawRecord[];
}): Promise<McpResponse<HarmoniesPreviewOutput>> {
  const response = await fetch('/api/harmonies/preview', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return response.json();
}

/**
 * Call harmonies_apply via API route.
 */
async function executeHarmoniesApply(input: {
  harmony_ids: string[];
  records: RawRecord[];
}): Promise<McpResponse<HarmoniesApplyOutput>> {
  const response = await fetch('/api/harmonies/apply', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return response.json();
}

type WorkflowState = 'idle' | 'records_loaded' | 'previewing' | 'previewed' | 'applying' | 'applied';

export function ExplicitModePanel() {
  const { defaultPipeline } = useNormalizationSettings();

  // Pipeline selection
  const [selectedHarmonyIds, setSelectedHarmonyIds] = useState<string[]>(
    defaultPipeline?.harmony_ids || []
  );

  // Record source type selection
  const [sourceType, setSourceType] = useState<RecordSourceType>('csv');

  // Record source state
  const [loadedRecords, setLoadedRecords] = useState<RawRecord[] | null>(null);
  const [sourceName, setSourceName] = useState<string | null>(null);

  // Preview state
  const [previewData, setPreviewData] = useState<HarmoniesPreviewOutput | null>(null);
  const [workflowState, setWorkflowState] = useState<WorkflowState>('idle');
  const [error, setError] = useState<string | null>(null);

  // Apply result state
  const [applyResult, setApplyResult] = useState<HarmoniesApplyOutput | null>(null);

  // Handle records loaded
  const handleRecordsLoaded = useCallback((result: RecordSourceResult) => {
    setLoadedRecords(result.records);
    setSourceName(result.sourceName);
    setPreviewData(null);
    setApplyResult(null);
    setWorkflowState('records_loaded');
    setError(null);
  }, []);

  // Handle records cleared
  const handleClearRecords = useCallback(() => {
    setLoadedRecords(null);
    setSourceName(null);
    setPreviewData(null);
    setApplyResult(null);
    setWorkflowState('idle');
    setError(null);
  }, []);

  // Run preview
  const handleRunPreview = useCallback(async () => {
    if (!loadedRecords || selectedHarmonyIds.length === 0) return;

    setWorkflowState('previewing');
    setError(null);

    try {
      const result = await executeHarmoniesPreview({
        harmony_ids: selectedHarmonyIds,
        records: loadedRecords,
      });

      if (result.success && result.data) {
        setPreviewData(result.data);
        setWorkflowState('previewed');
      } else {
        setError(result.error?.message || 'Preview failed');
        setWorkflowState('records_loaded');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Preview failed');
      setWorkflowState('records_loaded');
    }
  }, [loadedRecords, selectedHarmonyIds]);

  // Apply changes
  const handleApply = useCallback(async () => {
    if (!loadedRecords || selectedHarmonyIds.length === 0) return;

    setWorkflowState('applying');
    setError(null);

    try {
      const result = await executeHarmoniesApply({
        harmony_ids: selectedHarmonyIds,
        records: loadedRecords,
      });

      if (result.success && result.data) {
        setApplyResult(result.data);
        setWorkflowState('applied');
      } else {
        setError(result.error?.message || 'Apply failed');
        setWorkflowState('previewed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Apply failed');
      setWorkflowState('previewed');
    }
  }, [loadedRecords, selectedHarmonyIds]);

  // Cancel - go back to idle
  const handleCancel = useCallback(() => {
    handleClearRecords();
  }, [handleClearRecords]);

  // Reset after apply
  const handleReset = useCallback(() => {
    handleClearRecords();
  }, [handleClearRecords]);

  // Calculate changed count for button
  const changedCount = previewData?.summary.changed || 0;

  // Determine if preview button should be enabled
  const canRunPreview = loadedRecords &&
    loadedRecords.length > 0 &&
    selectedHarmonyIds.length > 0 &&
    workflowState !== 'previewing';

  // Determine if apply button should be enabled
  const canApply = previewData &&
    changedCount > 0 &&
    workflowState === 'previewed';

  const isPreviewing = workflowState === 'previewing';
  const isApplying = workflowState === 'applying';
  const isApplied = workflowState === 'applied';

  return (
    <div className="space-y-6">
      {/* Pipeline Selector */}
      <PipelineSelector
        selectedHarmonyIds={selectedHarmonyIds}
        onSelectionChange={setSelectedHarmonyIds}
        disabled={isPreviewing || isApplying}
      />

      {/* Record Source Type Selector */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-mplc-gray-700">Load records from:</span>
          <div className="flex gap-2">
            <button
              onClick={() => {
                if (!loadedRecords) setSourceType('csv');
              }}
              disabled={!!loadedRecords}
              className={`inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg
                border transition-colors disabled:opacity-75
                ${sourceType === 'csv'
                  ? 'border-primary bg-primary/5 text-primary'
                  : 'border-mplc-gray-300 text-mplc-gray-600 hover:bg-mplc-gray-50'
                }`}
            >
              <Upload className="w-4 h-4" />
              CSV/JSON
            </button>
            <button
              onClick={() => {
                if (!loadedRecords) setSourceType('hubspot');
              }}
              disabled={!!loadedRecords}
              className={`inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg
                border transition-colors disabled:opacity-75
                ${sourceType === 'hubspot'
                  ? 'border-orange-500 bg-orange-50 text-orange-600'
                  : 'border-mplc-gray-300 text-mplc-gray-600 hover:bg-mplc-gray-50'
                }`}
            >
              <Database className="w-4 h-4" />
              HubSpot
            </button>
          </div>
        </div>

        {/* Record Source Component */}
        {sourceType === 'csv' ? (
          <CSVRecordSource
            onRecordsLoaded={handleRecordsLoaded}
            onClear={handleClearRecords}
            loadedRecords={loadedRecords}
            sourceName={sourceName}
            disabled={isPreviewing || isApplying}
          />
        ) : (
          <HubSpotRecordSource
            onRecordsLoaded={handleRecordsLoaded}
            onClear={handleClearRecords}
            loadedRecords={loadedRecords}
            sourceName={sourceName}
            disabled={isPreviewing || isApplying}
          />
        )}
      </div>

      {/* Run Preview Button */}
      {loadedRecords && !isApplied && (
        <div className="flex justify-end">
          <button
            onClick={handleRunPreview}
            disabled={!canRunPreview}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-medium
              rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPreviewing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Running Preview...
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                Run Preview
              </>
            )}
          </button>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Diff Table */}
      <DiffTable
        previewData={previewData}
        isLoading={isPreviewing}
      />

      {/* Commit Gate */}
      {previewData && !isApplied && (
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-mplc-gray-200">
          <button
            onClick={handleCancel}
            disabled={isApplying}
            className="px-4 py-2 text-sm font-medium text-mplc-gray-700 bg-white border border-mplc-gray-300
              rounded-lg hover:bg-mplc-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            disabled={!canApply || isApplying}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white
              bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isApplying ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Applying...
              </>
            ) : (
              `Apply ${changedCount} Change${changedCount !== 1 ? 's' : ''}`
            )}
          </button>
        </div>
      )}

      {/* Applied Success */}
      {isApplied && applyResult && (
        <div className="space-y-4">
          <div className="p-4 bg-green-50 border border-green-200 rounded-xl">
            <h4 className="text-sm font-medium text-green-800 mb-1">
              Changes Applied Successfully
            </h4>
            <p className="text-sm text-green-700">
              {applyResult.applied} record{applyResult.applied !== 1 ? 's' : ''} normalized.
              {applyResult.errors.length > 0 && (
                <span className="text-amber-700">
                  {' '}{applyResult.errors.length} error{applyResult.errors.length !== 1 ? 's' : ''}.
                </span>
              )}
            </p>
          </div>
          <div className="flex justify-end">
            <button
              onClick={handleReset}
              className="px-4 py-2 text-sm font-medium text-primary border border-primary
                rounded-lg hover:bg-primary/5"
            >
              Start New Batch
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
