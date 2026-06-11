'use client';

import { useState, useEffect } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { C, F } from '@/lib/design-tokens';
import { Card, PrimaryBtn } from '@/components/refyne';

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

interface ScanProgress {
  phase: 'started' | 'progress' | 'completed' | 'failed';
  message: string;
  progress: number;
  pairsFound: number;
  scanType?: 'full' | 'incremental';
  recordsScanned?: number;
  gradeBreakdown?: {
    A: number;
    B: number;
    C: number;
    D: number;
  };
  clustersBuilt?: number;
  largestClusterSize?: number;
  completed: boolean;
  error?: string;
}

interface ScanningStateProps {
  jobId: string;
  orgId: string;
  onComplete: () => void;
}

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

export function ScanningState({ jobId, orgId, onComplete }: ScanningStateProps) {
  const [progress, setProgress] = useState<ScanProgress>({
    phase: 'started',
    message: 'Starting scan...',
    progress: 0,
    pairsFound: 0,
    completed: false,
  });
  const [showComplete, setShowComplete] = useState(false);

  // Log component mount
  useEffect(() => {
    console.log(`[ScanningState] Component mounted with jobId: ${jobId}, orgId: ${orgId}`);
    return () => {
      console.log(`[ScanningState] Component unmounting for jobId: ${jobId}`);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;
    let autoTransitionTimeout: NodeJS.Timeout | null = null;
    let safetyTimeout: NodeJS.Timeout | null = null;
    let isPolling = true;

    const stopPolling = () => {
      console.log(`[ScanningState] Stopping polling for jobId: ${jobId}`);
      isPolling = false;
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };

    const pollProgress = async () => {
      if (!isPolling) return;

      try {
        console.log(`[ScanningState] Polling progress for jobId: ${jobId}`);
        const res = await fetch(`/api/dedup/scan-progress?jobId=${jobId}`, {
          headers: { 'x-org-id': orgId },
        });

        console.log(`[ScanningState] Poll response: status=${res.status}, ok=${res.ok}`);

        if (res.ok) {
          const data = await res.json();
          console.log(`[ScanningState] Progress data:`, data);
          setProgress(data);

          // If scan is complete, show completion state for 2 seconds then transition
          if (data.phase === 'completed') {
            console.log(`[ScanningState] Scan completed, showing completion state for 2s`);
            setShowComplete(true);
            stopPolling();

            autoTransitionTimeout = setTimeout(() => {
              console.log(`[ScanningState] Calling onComplete after 2s delay`);
              onComplete();
            }, 2000);
          }

          // If scan failed, show error and stop polling
          if (data.phase === 'failed') {
            console.log(`[ScanningState] Scan failed: ${data.error}`);
            stopPolling();
          }
        } else {
          const errorData = await res.json().catch(() => ({}));
          console.error(`[ScanningState] Poll failed: status=${res.status}, error=`, errorData);
        }
      } catch (error) {
        console.error('[ScanningState] Failed to fetch scan progress:', error);
      }
    };

    // Initial poll
    pollProgress();

    // Poll every 2 seconds
    intervalId = setInterval(pollProgress, 2000);

    // Safety timeout: stop polling after 10 minutes
    safetyTimeout = setTimeout(() => {
      console.warn(`[ScanningState] Safety timeout reached (10 minutes), stopping polling for jobId: ${jobId}`);
      stopPolling();
      setProgress(prev => ({
        ...prev,
        phase: 'failed',
        error: 'Scan timed out after 10 minutes',
        completed: true,
      }));
    }, 600000); // 10 minutes

    return () => {
      console.log(`[ScanningState] Cleanup: stopping polling for jobId: ${jobId}`);
      stopPolling();
      if (autoTransitionTimeout) clearTimeout(autoTransitionTimeout);
      if (safetyTimeout) clearTimeout(safetyTimeout);
    };
  }, [jobId, orgId, onComplete]);

  // ─────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────

  return (
    <Card>
      <div style={{
        padding: '60px 40px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 24,
      }}>
        {/* Icon */}
        <div style={{
          width: 64,
          height: 64,
          borderRadius: 12,
          background: showComplete ? C.greenDim : C.indigoDim,
          border: `1px solid ${showComplete ? C.greenBrd : C.indigoBrd}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          {showComplete ? (
            <Check size={32} color={C.green} strokeWidth={2.5} />
          ) : (
            <Loader2 size={32} color={C.indigo} strokeWidth={2.5} className="animate-spin" />
          )}
        </div>

        {/* Title */}
        <div style={{
          fontSize: 20,
          fontWeight: 600,
          color: C.text,
          textAlign: 'center',
        }}>
          {showComplete
            ? `${progress.scanType === 'incremental' ? 'Incremental' : 'Full'} scan complete`
            : progress.scanType === 'incremental'
            ? 'Incremental scan in progress'
            : 'Full scan in progress'}
        </div>

        {/* Message */}
        <div style={{
          fontSize: 14,
          color: C.text3,
          textAlign: 'center',
        }}>
          {progress.message}
        </div>

        {/* Progress bar */}
        {!showComplete && (
          <div style={{
            width: '100%',
            maxWidth: 400,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}>
            <div style={{
              height: 8,
              width: '100%',
              background: C.hover,
              borderRadius: 4,
              overflow: 'hidden',
            }}>
              <div style={{
                height: '100%',
                width: `${progress.progress}%`,
                background: C.indigo,
                borderRadius: 4,
                transition: 'width 0.3s ease',
              }} />
            </div>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 12,
              color: C.text3,
              fontFamily: F.mono,
            }}>
              <span>{Math.round(progress.progress)}%</span>
              <span>
                {progress.clustersBuilt !== undefined
                  ? `${progress.clustersBuilt} duplicate clusters found`
                  : `${progress.pairsFound} potential duplicates found`}
              </span>
            </div>
          </div>
        )}

        {/* Completion state - grade breakdown */}
        {showComplete && progress.gradeBreakdown && (
          <div style={{
            display: 'flex',
            gap: 16,
            padding: '16px 24px',
            background: C.surface,
            borderRadius: 8,
            border: `1px solid ${C.border}`,
          }}>
            {(['A', 'B', 'C', 'D'] as const).map((grade) => (
              <div key={grade} style={{ textAlign: 'center' }}>
                <div style={{
                  fontSize: 11,
                  color: C.text3,
                  marginBottom: 4,
                  fontWeight: 500,
                }}>
                  Grade {grade}
                </div>
                <div style={{
                  fontSize: 18,
                  fontWeight: 700,
                  fontFamily: F.mono,
                  color: C.text,
                }}>
                  {progress.gradeBreakdown?.[grade] || 0}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Completion state - largest cluster */}
        {showComplete && progress.largestClusterSize && (
          <div style={{ fontSize: 13, color: C.text2, marginTop: -8 }}>
            Largest cluster: {progress.largestClusterSize} records
          </div>
        )}

        {/* Completion button */}
        {showComplete && (
          <PrimaryBtn onClick={onComplete}>
            Review clusters →
          </PrimaryBtn>
        )}

        {/* Error state */}
        {progress.phase === 'failed' && (
          <div style={{
            padding: 16,
            background: C.redDim,
            border: `1px solid ${C.redBrd}`,
            borderRadius: 8,
            color: C.red,
            fontSize: 13,
            textAlign: 'center',
          }}>
            {progress.error || 'Scan failed'}
          </div>
        )}
      </div>
    </Card>
  );
}
