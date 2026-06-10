'use client';

import { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';

interface QueueStats {
  name: string;
  waiting: number;
  active: number;
  priority1: number; // Scale
  priority2: number; // Growth
  priority3: number; // Trial
}

export default function QueueStats() {
  const [stats, setStats] = useState<QueueStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchStats = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/admin/queue-stats');
      if (!res.ok) throw new Error('Failed to fetch queue stats');
      const data = await res.json();
      setStats(data.stats || []);
      setLastRefresh(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load queue stats');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();

    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading && stats.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            <div className="h-3 bg-gray-200 rounded"></div>
            <div className="h-3 bg-gray-200 rounded"></div>
            <div className="h-3 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <p className="text-sm text-red-600">{error}</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg">
      <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-black">Queue Priority Status</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Last updated: {lastRefresh.toLocaleTimeString()}
          </p>
        </div>
        <button
          onClick={fetchStats}
          disabled={loading}
          className="p-2 hover:bg-gray-50 rounded-md transition-colors disabled:opacity-50"
          title="Refresh stats"
        >
          <RefreshCw size={16} className={`text-gray-600 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Queue
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Waiting
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Active
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Priority 1 (Scale)
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Priority 2 (Growth)
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Priority 3 (Trial)
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {stats.map((queue) => (
              <tr key={queue.name} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-2 text-sm font-medium text-gray-900">
                  {queue.name}
                </td>
                <td className="px-4 py-2 text-sm text-gray-600">
                  {queue.waiting}
                </td>
                <td className="px-4 py-2 text-sm text-gray-600">
                  {queue.active}
                </td>
                <td className="px-4 py-2">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 border border-green-200">
                    {queue.priority1}
                  </span>
                </td>
                <td className="px-4 py-2">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200">
                    {queue.priority2}
                  </span>
                </td>
                <td className="px-4 py-2">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 border border-gray-200">
                    {queue.priority3}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {stats.length === 0 && (
        <div className="px-4 py-8 text-center text-sm text-gray-500">
          No queue data available
        </div>
      )}

      <div className="px-4 py-2 bg-gray-50 border-t border-gray-200 text-xs text-gray-500">
        <p className="mb-1">
          <strong>Priority 1 (Scale):</strong> Scale tier + internal orgs - highest priority
        </p>
        <p className="mb-1">
          <strong>Priority 2 (Growth):</strong> Growth + Starter tiers - medium priority
        </p>
        <p>
          <strong>Priority 3 (Trial):</strong> Trial tier + cancelled/past_due - lowest priority
        </p>
      </div>
    </div>
  );
}
