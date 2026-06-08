'use client';

/**
 * Import History Page
 *
 * Shows past import sessions with status, counts, and download links.
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Download, Eye, Loader2 } from 'lucide-react';

interface ImportSession {
  id: string;
  status: 'parsed' | 'matched' | 'running' | 'completed' | 'failed';
  filename: string;
  row_count: number;
  matched_count: number;
  created_count: number;
  updated_count: number;
  skipped_count: number;
  created_at: string;
  updated_at: string;
}

export default function ImportHistoryPage() {
  const router = useRouter();
  const [imports, setImports] = useState<ImportSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const response = await fetch('/api/import/history');

        if (!response.ok) {
          throw new Error('Failed to fetch history');
        }

        const data = await response.json();
        setImports(data.imports);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, []);

  if (loading) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="p-6 bg-red-500/10 border border-red-500/20 rounded-lg">
          <p className="text-red-400">{error}</p>
        </div>
      </div>
    );
  }

  const getStatusBadge = (status: ImportSession['status']) => {
    switch (status) {
      case 'completed':
        return (
          <span className="px-2 py-1 text-xs font-medium bg-green-500/20 text-green-400 rounded">
            Completed
          </span>
        );
      case 'running':
        return (
          <span className="px-2 py-1 text-xs font-medium bg-blue-500/20 text-blue-400 rounded">
            Running
          </span>
        );
      case 'failed':
        return (
          <span className="px-2 py-1 text-xs font-medium bg-red-500/20 text-red-400 rounded">
            Failed
          </span>
        );
      case 'matched':
        return (
          <span className="px-2 py-1 text-xs font-medium bg-indigo-500/20 text-indigo-400 rounded">
            Matched
          </span>
        );
      case 'parsed':
        return (
          <span className="px-2 py-1 text-xs font-medium bg-zinc-500/20 text-zinc-400 rounded">
            Parsed
          </span>
        );
      default:
        return (
          <span className="px-2 py-1 text-xs font-medium bg-zinc-500/20 text-zinc-400 rounded">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-white mb-2">
          Import History
        </h1>
        <p className="text-zinc-400">
          View and download past import sessions.
        </p>
      </div>

      {imports.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-zinc-400">No import history yet.</p>
          <button
            onClick={() => router.push('/import')}
            className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg"
          >
            Start First Import
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="text-left py-3 px-4 text-sm font-medium text-zinc-400">
                  Filename
                </th>
                <th className="text-left py-3 px-4 text-sm font-medium text-zinc-400">
                  Status
                </th>
                <th className="text-right py-3 px-4 text-sm font-medium text-zinc-400">
                  Total Rows
                </th>
                <th className="text-right py-3 px-4 text-sm font-medium text-zinc-400">
                  Created
                </th>
                <th className="text-right py-3 px-4 text-sm font-medium text-zinc-400">
                  Updated
                </th>
                <th className="text-right py-3 px-4 text-sm font-medium text-zinc-400">
                  Skipped
                </th>
                <th className="text-left py-3 px-4 text-sm font-medium text-zinc-400">
                  Date
                </th>
                <th className="text-right py-3 px-4 text-sm font-medium text-zinc-400">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {imports.map((session) => (
                <tr
                  key={session.id}
                  className="border-b border-zinc-800 hover:bg-zinc-900/50"
                >
                  <td className="py-3 px-4">
                    <div className="text-sm text-white">{session.filename}</div>
                  </td>
                  <td className="py-3 px-4">{getStatusBadge(session.status)}</td>
                  <td className="py-3 px-4 text-right text-sm text-white">
                    {session.row_count || 0}
                  </td>
                  <td className="py-3 px-4 text-right text-sm text-green-400">
                    {session.created_count || 0}
                  </td>
                  <td className="py-3 px-4 text-right text-sm text-blue-400">
                    {session.updated_count || 0}
                  </td>
                  <td className="py-3 px-4 text-right text-sm text-zinc-400">
                    {session.skipped_count || 0}
                  </td>
                  <td className="py-3 px-4 text-sm text-zinc-400">
                    {new Date(session.created_at).toLocaleDateString()}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => router.push(`/import/${session.id}`)}
                        className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
                        title="View details"
                      >
                        <Eye className="w-4 h-4 text-zinc-400" />
                      </button>
                      {session.status === 'completed' && (
                        <a
                          href={`/api/import/export/${session.id}`}
                          className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
                          title="Download report"
                        >
                          <Download className="w-4 h-4 text-zinc-400" />
                        </a>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
