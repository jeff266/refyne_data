'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Clock,
  Play,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Settings,
  Zap,
  Timer,
} from 'lucide-react';
import type {
  ClayCalibrationResult,
  ClayCalibrationSummary,
  ClayStepConfig,
  TimeoutMode,
  OnTimeoutAction,
} from '@/types/clay';
import { DEFAULT_CLAY_CONFIG, calculateRecommendedTimeout } from '@/types/clay';

interface ClayCalibrationProps {
  webhookUrl: string;
  config?: Partial<ClayStepConfig>;
  onConfigChange: (config: Partial<ClayStepConfig>) => void;
  sampleRecords: Record<string, any>[];
}

export default function ClayCalibration({
  webhookUrl,
  config,
  onConfigChange,
  sampleRecords,
}: ClayCalibrationProps) {
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [sampleSize, setSampleSize] = useState(3);
  const [results, setResults] = useState<ClayCalibrationResult[]>([]);
  const [summary, setSummary] = useState<ClayCalibrationSummary | null>(
    config?.calibration || null
  );
  const [error, setError] = useState<string | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // Get callback URL for this instance
  const callbackUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/api/webhooks/clay`
      : '/api/webhooks/clay';

  // Timeout settings
  const timeoutMode = config?.timeoutMode || DEFAULT_CLAY_CONFIG.timeoutMode!;
  const customTimeoutMs = config?.customTimeoutMs || 30000;
  const bufferPercent = config?.bufferPercent || DEFAULT_CLAY_CONFIG.bufferPercent!;
  const onTimeout = config?.onTimeout || DEFAULT_CLAY_CONFIG.onTimeout!;

  const recommendedTimeout = summary
    ? calculateRecommendedTimeout(summary)
    : null;

  const effectiveTimeout =
    timeoutMode === 'recommended'
      ? recommendedTimeout || 30000
      : timeoutMode === 'custom'
      ? customTimeoutMs
      : null;

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, []);

  const runCalibration = async () => {
    if (!webhookUrl) {
      setError('Please configure Clay webhook URL first');
      return;
    }

    if (sampleRecords.length === 0) {
      setError('No sample records available. Run a test search first.');
      return;
    }

    setIsCalibrating(true);
    setError(null);
    setResults([]);

    const samplesToTest = sampleRecords.slice(0, sampleSize);
    const calibrationResults: ClayCalibrationResult[] = [];

    try {
      // Send each record and track timing
      for (let i = 0; i < samplesToTest.length; i++) {
        const record = samplesToTest[i];
        const requestId = `cal_${Date.now()}_${i}`;
        const sentAt = new Date();

        // Update UI with pending state
        calibrationResults.push({
          recordId: requestId,
          sentAt,
          success: false,
        });
        setResults([...calibrationResults]);

        try {
          // Send to Clay
          const response = await fetch('/api/clay/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              requestId,
              records: [record],
              webhookUrl,
              callbackUrl,
            }),
          });

          if (!response.ok) {
            throw new Error('Failed to send to Clay');
          }

          // Poll for response (max 60 seconds for calibration)
          const result = await pollForResponse(requestId, 60000);

          calibrationResults[i] = {
            ...calibrationResults[i],
            receivedAt: result.receivedAt,
            durationMs: result.durationMs,
            success: true,
          };
        } catch (err) {
          calibrationResults[i] = {
            ...calibrationResults[i],
            success: false,
            error: err instanceof Error ? err.message : 'Unknown error',
          };
        }

        setResults([...calibrationResults]);
      }

      // Calculate summary
      const successfulResults = calibrationResults.filter((r) => r.success && r.durationMs);

      if (successfulResults.length === 0) {
        setError('No successful responses received from Clay');
        setIsCalibrating(false);
        return;
      }

      const durations = successfulResults.map((r) => r.durationMs!).sort((a, b) => a - b);
      const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
      const p95Index = Math.floor(durations.length * 0.95);

      const newSummary: ClayCalibrationSummary = {
        calibratedAt: new Date(),
        sampleCount: samplesToTest.length,
        successCount: successfulResults.length,
        avgMs: Math.round(avg),
        minMs: durations[0],
        maxMs: durations[durations.length - 1],
        p95Ms: durations[p95Index] || durations[durations.length - 1],
        recommendedTimeoutMs: 0, // Will be calculated
      };
      newSummary.recommendedTimeoutMs = calculateRecommendedTimeout(newSummary);

      setSummary(newSummary);
      onConfigChange({
        ...config,
        calibration: newSummary,
        callbackUrl,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Calibration failed');
    } finally {
      setIsCalibrating(false);
    }
  };

  const pollForResponse = (
    requestId: string,
    timeoutMs: number
  ): Promise<{ receivedAt: Date; durationMs: number }> => {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      const pollInterval = 1000; // Check every second

      const checkResponse = async () => {
        try {
          const response = await fetch(`/api/webhooks/clay?request_id=${requestId}`);

          if (response.ok) {
            const data = await response.json();
            if (data.status === 'received') {
              const receivedAt = new Date(data.receivedAt);
              const durationMs = receivedAt.getTime() - startTime;
              resolve({ receivedAt, durationMs });
              return;
            }
          }

          // Check timeout
          if (Date.now() - startTime > timeoutMs) {
            reject(new Error('Timeout waiting for Clay response'));
            return;
          }

          // Continue polling
          pollingRef.current = setTimeout(checkResponse, pollInterval);
        } catch (err) {
          reject(err);
        }
      };

      checkResponse();
    });
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  return (
    <div className="space-y-6">
      {/* Webhook Configuration */}
      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
        <h4 className="font-medium text-black mb-3 flex items-center gap-2">
          <Settings size={16} />
          Webhook Configuration
        </h4>
        <div className="grid grid-cols-1 gap-3 text-sm">
          <div>
            <label className="text-gray-500">Your Clay Webhook URL</label>
            <div className="font-mono text-xs bg-white px-2 py-1 rounded border border-gray-200 truncate">
              {webhookUrl || 'Not configured'}
            </div>
          </div>
          <div>
            <label className="text-gray-500">Callback URL (configure in Clay)</label>
            <div className="font-mono text-xs bg-white px-2 py-1 rounded border border-gray-200 truncate">
              {callbackUrl}
            </div>
          </div>
        </div>
      </div>

      {/* Calibration */}
      <div className="border border-gray-200 rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h4 className="font-medium text-black flex items-center gap-2">
              <Timer size={16} />
              Calibrate Timing
            </h4>
            <p className="text-sm text-gray-500 mt-1">
              Test with sample records to measure Clay response time
            </p>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={sampleSize}
              onChange={(e) => setSampleSize(Number(e.target.value))}
              disabled={isCalibrating}
              className="px-2 py-1 text-sm border border-gray-200 rounded-lg"
            >
              <option value={1}>1 record</option>
              <option value={3}>3 records</option>
              <option value={5}>5 records</option>
            </select>
            <button
              onClick={runCalibration}
              disabled={isCalibrating || !webhookUrl}
              className="inline-flex items-center gap-2 px-4 py-2 bg-black text-white rounded-full text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              {isCalibrating ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  Calibrating...
                </>
              ) : (
                <>
                  <Play size={14} />
                  Run Calibration
                </>
              )}
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-start gap-2">
            <XCircle size={16} className="mt-0.5 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Results */}
        {results.length > 0 && (
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-medium text-gray-700">Test Results</span>
            </div>
            <div className="flex gap-2">
              {results.map((result, i) => (
                <div
                  key={result.recordId}
                  className={`flex-1 p-3 rounded-lg border ${
                    result.success
                      ? 'bg-green-50 border-green-200'
                      : result.error
                      ? 'bg-red-50 border-red-200'
                      : 'bg-yellow-50 border-yellow-200'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    {result.success ? (
                      <CheckCircle2 size={14} className="text-green-600" />
                    ) : result.error ? (
                      <XCircle size={14} className="text-red-600" />
                    ) : (
                      <RefreshCw size={14} className="text-yellow-600 animate-spin" />
                    )}
                    <span className="text-sm font-medium">Record {i + 1}</span>
                  </div>
                  <div className="text-xs text-gray-600">
                    {result.success && result.durationMs
                      ? formatDuration(result.durationMs)
                      : result.error
                      ? 'Failed'
                      : 'Waiting...'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Summary */}
        {summary && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <Zap size={16} className="text-blue-600" />
              <span className="font-medium text-blue-900">Calibration Results</span>
              <span className="text-xs text-blue-600 ml-auto">
                {new Date(summary.calibratedAt).toLocaleString()}
              </span>
            </div>
            <div className="grid grid-cols-4 gap-4 text-center">
              <div>
                <div className="text-2xl font-semibold text-blue-900">
                  {formatDuration(summary.avgMs)}
                </div>
                <div className="text-xs text-blue-600">Average</div>
              </div>
              <div>
                <div className="text-2xl font-semibold text-blue-900">
                  {formatDuration(summary.minMs)}
                </div>
                <div className="text-xs text-blue-600">Min</div>
              </div>
              <div>
                <div className="text-2xl font-semibold text-blue-900">
                  {formatDuration(summary.maxMs)}
                </div>
                <div className="text-xs text-blue-600">Max</div>
              </div>
              <div>
                <div className="text-2xl font-semibold text-green-700">
                  {formatDuration(summary.recommendedTimeoutMs)}
                </div>
                <div className="text-xs text-green-600">Recommended</div>
              </div>
            </div>
            <div className="mt-3 text-xs text-blue-700">
              {summary.successCount}/{summary.sampleCount} records completed successfully
            </div>
          </div>
        )}
      </div>

      {/* Timeout Settings */}
      <div className="border border-gray-200 rounded-lg p-4">
        <h4 className="font-medium text-black mb-4 flex items-center gap-2">
          <Clock size={16} />
          Timeout Settings
        </h4>

        <div className="space-y-3">
          {/* Timeout Mode */}
          <div className="space-y-2">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="radio"
                name="timeoutMode"
                checked={timeoutMode === 'recommended'}
                onChange={() => onConfigChange({ ...config, timeoutMode: 'recommended' })}
                className="w-4 h-4 text-black"
                disabled={!summary}
              />
              <span className="text-sm">
                Use recommended ({summary ? formatDuration(summary.recommendedTimeoutMs) : 'run calibration first'})
              </span>
              {summary && (
                <span className="text-xs text-gray-500">
                  includes {bufferPercent}% buffer
                </span>
              )}
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="radio"
                name="timeoutMode"
                checked={timeoutMode === 'custom'}
                onChange={() => onConfigChange({ ...config, timeoutMode: 'custom' })}
                className="w-4 h-4 text-black"
              />
              <span className="text-sm">Custom timeout:</span>
              <input
                type="number"
                value={customTimeoutMs / 1000}
                onChange={(e) =>
                  onConfigChange({
                    ...config,
                    timeoutMode: 'custom',
                    customTimeoutMs: Number(e.target.value) * 1000,
                  })
                }
                className="w-20 px-2 py-1 text-sm border border-gray-200 rounded"
                min={5}
                max={300}
              />
              <span className="text-sm text-gray-500">seconds</span>
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="radio"
                name="timeoutMode"
                checked={timeoutMode === 'ask_each_run'}
                onChange={() => onConfigChange({ ...config, timeoutMode: 'ask_each_run' })}
                className="w-4 h-4 text-black"
              />
              <span className="text-sm">Ask before each run</span>
            </label>
          </div>

          {/* On Timeout Action */}
          <div className="pt-3 border-t border-gray-100">
            <label className="text-sm font-medium text-gray-700 mb-2 block">
              When timeout is reached:
            </label>
            <div className="space-y-2">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="onTimeout"
                  checked={onTimeout === 'skip'}
                  onChange={() => onConfigChange({ ...config, onTimeout: 'skip' })}
                  className="w-4 h-4 text-black"
                />
                <span className="text-sm">Skip Clay step, continue with existing data</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="onTimeout"
                  checked={onTimeout === 'retry_once'}
                  onChange={() => onConfigChange({ ...config, onTimeout: 'retry_once' })}
                  className="w-4 h-4 text-black"
                />
                <span className="text-sm">Retry once with 2x timeout</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="onTimeout"
                  checked={onTimeout === 'fail'}
                  onChange={() => onConfigChange({ ...config, onTimeout: 'fail' })}
                  className="w-4 h-4 text-black"
                />
                <span className="text-sm">Fail the record</span>
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Warning Banner */}
      {effectiveTimeout && (
        <div className="flex items-start gap-3 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <AlertTriangle size={18} className="text-yellow-600 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-yellow-800">Async Step Warning</p>
            <p className="text-yellow-700 mt-1">
              Clay is an async provider. Each record will wait up to{' '}
              <strong>{formatDuration(effectiveTimeout)}</strong> for a response.
              For {sampleSize} records, worst case total time:{' '}
              <strong>{formatDuration(effectiveTimeout * sampleSize)}</strong>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
