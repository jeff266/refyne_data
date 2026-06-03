import { useState, useEffect, useRef } from 'react';

export interface JobProgress {
  completed: number;
  total: number;
  percentage: number;
  currentCompany: string | null;
  step?: number;
  stepName?: string;
  current?: number;
  recordsProcessed?: number;
}

export interface JobStatus {
  jobId: string;
  runId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress: JobProgress;
  error: string | null;
}

/**
 * Hook to poll a BullMQ job status until completion or failure.
 *
 * @param jobId - The BullMQ job ID to poll
 * @param enabled - Whether polling is enabled (default true)
 * @returns Current job status, or null if no job or polling disabled
 *
 * @example
 * const jobStatus = useJobPoller(jobId);
 * if (jobStatus?.status === 'processing') {
 *   console.log(`Progress: ${jobStatus.progress.percentage}%`);
 * }
 */
export function useJobPoller(
  jobId: string | null,
  enabled: boolean = true
): JobStatus | null {
  const [status, setStatus] = useState<JobStatus | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!jobId || !enabled) {
      setStatus(null);
      return;
    }

    const poll = async () => {
      try {
        const res = await fetch(`/api/jobs/${jobId}/status`);
        if (!res.ok) {
          console.error(`[useJobPoller] Failed to fetch status: ${res.status}`);
          return;
        }

        const data: JobStatus = await res.json();
        setStatus(data);

        // Stop polling when job is completed or failed
        if (data.status === 'completed' || data.status === 'failed') {
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
        }
      } catch (error) {
        console.error('[useJobPoller] Error polling job status:', error);
      }
    };

    // Immediate first poll
    poll();

    // Then poll every 1.5 seconds
    intervalRef.current = setInterval(poll, 1500);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [jobId, enabled]);

  return status;
}

/**
 * Hook to fetch job results once completed.
 *
 * @param jobId - The BullMQ job ID
 * @param status - Current job status (from useJobPoller)
 * @returns Job results, or null if not completed
 */
export function useJobResults<T = any>(
  jobId: string | null,
  status: JobStatus | null
): { results: T[] | null; loading: boolean; error: string | null } {
  const [results, setResults] = useState<T[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (!jobId || !status || status.status !== 'completed' || fetchedRef.current) {
      if (!jobId) console.log('[useJobResults] No jobId');
      if (!status) console.log('[useJobResults] No status');
      if (status && status.status !== 'completed') console.log('[useJobResults] Status not completed:', status.status);
      if (fetchedRef.current) console.log('[useJobResults] Already fetched');
      return;
    }

    console.log('[useJobResults] Fetching results for job:', jobId);
    fetchedRef.current = true;
    setLoading(true);

    const fetchResults = async () => {
      try {
        const res = await fetch(`/api/jobs/${jobId}/results`);
        if (!res.ok) {
          const errorText = await res.text();
          console.error('[useJobResults] Response not OK:', res.status, errorText);
          throw new Error(`Failed to fetch results: ${res.status} - ${errorText}`);
        }

        const data = await res.json();
        console.log('[useJobResults] Got results:', { count: data.results?.length, data });
        setResults(data.results);
        setError(null);
      } catch (err) {
        console.error('[useJobResults] Error fetching results:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch results');
      } finally {
        setLoading(false);
      }
    };

    fetchResults();
  }, [jobId, status]);

  // Reset when jobId changes
  useEffect(() => {
    fetchedRef.current = false;
    setResults(null);
    setError(null);
  }, [jobId]);

  return { results, loading, error };
}
