'use client';

/**
 * Import Progress Page
 *
 * Shows real-time progress for an import session.
 * Polls /api/import/status/[session_id] every 2 seconds.
 */

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { CheckCircle, XCircle, Loader2, Download, ArrowLeft } from 'lucide-react';

interface ImportStatus {
  id: string;
  status: 'parsed' | 'matched' | 'running' | 'completed' | 'failed';
  filename: string;
  row_count: number;
  matched_count: number;
  created_count: number;
  updated_count: number;
  skipped_count: number;
  match_summary: Record<string, number>;
  hubspot_list_id: string | null;
  created_at: string;
  updated_at: string;
}

export default function ImportProgressPage() {
  const router = useRouter();
  const params = useParams();
  const sessionId = params.session_id as string;

  const [status, setStatus] = useState<ImportStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Poll for status
  useEffect(() => {
    if (!sessionId) return;

    const fetchStatus = async () => {
      try {
        const response = await fetch(`/api/import/status/${sessionId}`);

        if (!response.ok) {
          throw new Error('Failed to fetch status');
        }

        const data = await response.json();
        setStatus(data);
        setLoading(false);

        // Stop polling when completed or failed
        if (data.status === 'completed' || data.status === 'failed') {
          clearInterval(interval);
        }
      } catch (err: any) {
        setError(err.message);
        setLoading(false);
        clearInterval(interval);
      }
    };

    // Initial fetch
    fetchStatus();

    // Poll every 2 seconds
    const interval = setInterval(fetchStatus, 2000);

    return () => clearInterval(interval);
  }, [sessionId]);

  if (loading) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
        </div>
      </div>
    );
  }

  if (error || !status) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <div className="p-6 bg-red-500/10 border border-red-500/20 rounded-lg">
          <p className="text-red-400">{error || 'Import session not found'}</p>
        </div>
      </div>
    );
  }

  const isRunning = status.status === 'running';
  const isCompleted = status.status === 'completed';
  const isFailed = status.status === 'failed';

  const totalProcessed =
    (status.created_count || 0) +
    (status.updated_count || 0) +
    (status.skipped_count || 0);
  const progress = status.matched_count
    ? Math.round((totalProcessed / status.matched_count) * 100)
    : 0;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-8">
        <button
          onClick={() => router.push('/import')}
          className="flex items-center gap-2 text-zinc-400 hover:text-white mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Import
        </button>

        <h1 className="text-2xl font-semibold text-white mb-2">
          Import Progress
        </h1>
        <p className="text-zinc-400">{status.filename}</p>
      </div>

      {/* Running State */}
      {isRunning && (
        <div>
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-zinc-400">Processing...</span>
              <span className="text-sm text-white">{progress}%</span>
            </div>
            <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-600 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 bg-zinc-800 border border-zinc-700 rounded-lg">
              <div className="text-2xl font-semibold text-green-400">
                {status.created_count || 0}
              </div>
              <div className="text-sm text-zinc-400">Created</div>
            </div>

            <div className="p-4 bg-zinc-800 border border-zinc-700 rounded-lg">
              <div className="text-2xl font-semibold text-blue-400">
                {status.updated_count || 0}
              </div>
              <div className="text-sm text-zinc-400">Updated</div>
            </div>

            <div className="p-4 bg-zinc-800 border border-zinc-700 rounded-lg">
              <div className="text-2xl font-semibold text-zinc-400">
                {status.skipped_count || 0}
              </div>
              <div className="text-sm text-zinc-400">Skipped</div>
            </div>
          </div>
        </div>
      )}

      {/* Completed State */}
      {isCompleted && (
        <div>
          <div className="mb-6 p-6 bg-green-500/10 border border-green-500/20 rounded-lg flex items-center gap-4">
            <CheckCircle className="w-8 h-8 text-green-500" />
            <div>
              <h3 className="text-lg font-semibold text-white">
                Import Completed
              </h3>
              <p className="text-sm text-zinc-400">
                {totalProcessed} contacts processed
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="p-4 bg-zinc-800 border border-zinc-700 rounded-lg">
              <div className="text-2xl font-semibold text-green-400">
                {status.created_count || 0}
              </div>
              <div className="text-sm text-zinc-400">Created</div>
            </div>

            <div className="p-4 bg-zinc-800 border border-zinc-700 rounded-lg">
              <div className="text-2xl font-semibold text-blue-400">
                {status.updated_count || 0}
              </div>
              <div className="text-sm text-zinc-400">Updated</div>
            </div>

            <div className="p-4 bg-zinc-800 border border-zinc-700 rounded-lg">
              <div className="text-2xl font-semibold text-zinc-400">
                {status.skipped_count || 0}
              </div>
              <div className="text-sm text-zinc-400">Skipped</div>
            </div>
          </div>

          {status.hubspot_list_id && (
            <div className="mb-6 p-4 bg-zinc-800 border border-zinc-700 rounded-lg">
              <div className="text-sm text-zinc-400 mb-1">HubSpot List</div>
              <div className="text-white font-mono">{status.hubspot_list_id}</div>
            </div>
          )}

          <div className="flex gap-3">
            <a
              href={`/api/import/export/${sessionId}`}
              className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Download Report
            </a>

            <button
              onClick={() => router.push('/import')}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg"
            >
              New Import
            </button>
          </div>
        </div>
      )}

      {/* Failed State */}
      {isFailed && (
        <div>
          <div className="mb-6 p-6 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-4">
            <XCircle className="w-8 h-8 text-red-500" />
            <div>
              <h3 className="text-lg font-semibold text-white">
                Import Failed
              </h3>
              <p className="text-sm text-zinc-400">
                An error occurred during import
              </p>
            </div>
          </div>

          <button
            onClick={() => router.push('/import')}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg"
          >
            Try Again
          </button>
        </div>
      )}
    </div>
  );
}
