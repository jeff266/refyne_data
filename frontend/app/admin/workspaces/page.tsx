'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Database,
  TrendingUp,
  AlertCircle,
  Clock,
  Mail,
  Users,
  Calendar,
  Activity,
  CheckCircle,
  XCircle,
  ArrowLeft,
} from 'lucide-react';
import Link from 'next/link';

interface Workspace {
  org_id: string;
  org_name: string;
  plan: string;
  status: string;
  compliance_score: number | null;
  compliance_computed_at: string | null;
  last_scan: string | null;
  last_scan_status: string | null;
  active_portals: number;
  always_on: boolean;
  always_on_since: string | null;
  credits_used: number;
  credits_limit: number;
  joined_date: string | null;
  trial_ends_at: string | null;
  stripe_customer_id: string | null;
  records_monitored: number;
}

interface Summary {
  total_workspaces: number;
  active_subscriptions: number;
  trialing: number;
  total_records_monitored: number;
  digests_sent_this_month: number;
}

export default function AdminWorkspacesPage() {
  const router = useRouter();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchWorkspaces();
  }, []);

  const fetchWorkspaces = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/workspaces');

      if (res.status === 404) {
        // User is not authorized, redirect to home
        router.push('/');
        return;
      }

      if (!res.ok) {
        throw new Error('Failed to fetch workspaces');
      }

      const data = await res.json();
      setWorkspaces(data.workspaces || []);
      setSummary(data.summary || null);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load workspaces');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Never';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return 'Never';
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; className: string }> = {
      active: { label: 'Active', className: 'bg-green-100 text-green-800' },
      trialing: { label: 'Trial', className: 'bg-blue-100 text-blue-800' },
      trial_expired: { label: 'Trial Expired', className: 'bg-red-100 text-red-800' },
      past_due: { label: 'Past Due', className: 'bg-orange-100 text-orange-800' },
      cancelled: { label: 'Cancelled', className: 'bg-gray-100 text-gray-800' },
      paused: { label: 'Paused', className: 'bg-gray-100 text-gray-800' },
    };

    const config = statusConfig[status] || { label: status, className: 'bg-gray-100 text-gray-800' };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.className}`}>
        {config.label}
      </span>
    );
  };

  const getPlanBadge = (plan: string) => {
    const planConfig: Record<string, { className: string }> = {
      trialing: { className: 'bg-blue-100 text-blue-800' },
      prospect_solo: { className: 'bg-purple-100 text-purple-800' },
      prospect_team: { className: 'bg-purple-100 text-purple-800' },
      starter: { className: 'bg-green-100 text-green-800' },
      growth: { className: 'bg-indigo-100 text-indigo-800' },
      scale: { className: 'bg-pink-100 text-pink-800' },
      enterprise: { className: 'bg-yellow-100 text-yellow-800' },
    };

    const config = planConfig[plan] || { className: 'bg-gray-100 text-gray-800' };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.className}`}>
        {plan.replace('_', ' ')}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Loading workspaces...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 mb-4">{error}</div>
          <button
            onClick={fetchWorkspaces}
            className="px-4 py-2 bg-black text-white rounded-lg text-sm hover:bg-gray-800 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/"
                className="flex items-center gap-2 text-gray-500 hover:text-black transition-colors"
              >
                <ArrowLeft size={18} />
                <span className="text-sm">Back</span>
              </Link>
              <div className="h-6 w-px bg-gray-200" />
              <div>
                <h1 className="text-2xl font-semibold text-black">Admin Dashboard</h1>
                <p className="text-sm text-gray-500 mt-1">
                  All workspaces across all organizations
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Summary Bar */}
      {summary && (
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-6 py-6">
            <div className="grid grid-cols-5 gap-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Database size={20} className="text-blue-600" />
                </div>
                <div>
                  <div className="text-2xl font-semibold text-black">
                    {summary.total_workspaces}
                  </div>
                  <div className="text-xs text-gray-500">Total Workspaces</div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <CheckCircle size={20} className="text-green-600" />
                </div>
                <div>
                  <div className="text-2xl font-semibold text-black">
                    {summary.active_subscriptions}
                  </div>
                  <div className="text-xs text-gray-500">Active Subscriptions</div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Clock size={20} className="text-purple-600" />
                </div>
                <div>
                  <div className="text-2xl font-semibold text-black">
                    {summary.trialing}
                  </div>
                  <div className="text-xs text-gray-500">Trialing</div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 rounded-lg">
                  <Activity size={20} className="text-indigo-600" />
                </div>
                <div>
                  <div className="text-2xl font-semibold text-black">
                    {summary.total_records_monitored.toLocaleString()}
                  </div>
                  <div className="text-xs text-gray-500">Records Monitored</div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <Mail size={20} className="text-orange-600" />
                </div>
                <div>
                  <div className="text-2xl font-semibold text-black">
                    {summary.digests_sent_this_month}
                  </div>
                  <div className="text-xs text-gray-500">Digests This Month</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Workspaces Table */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Organization
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Plan
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Compliance
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Last Scan
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Portals
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Always On
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Credits
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Joined
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {workspaces.map((workspace) => (
                  <tr
                    key={workspace.org_id}
                    onClick={() => router.push(`/admin/workspaces/${workspace.org_id}`)}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-gray-100 rounded-lg">
                          <Users size={16} className="text-gray-600" />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-black">
                            {workspace.org_name}
                          </div>
                          <div className="text-xs text-gray-500">
                            {workspace.records_monitored.toLocaleString()} records
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      {getPlanBadge(workspace.plan)}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      {getStatusBadge(workspace.status)}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      {workspace.compliance_score !== null ? (
                        <div className="flex items-center gap-2">
                          <div className="text-sm font-medium text-black">
                            {workspace.compliance_score.toFixed(1)}%
                          </div>
                          {workspace.compliance_score >= 90 ? (
                            <CheckCircle size={14} className="text-green-600" />
                          ) : workspace.compliance_score >= 70 ? (
                            <AlertCircle size={14} className="text-yellow-600" />
                          ) : (
                            <XCircle size={14} className="text-red-600" />
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">N/A</span>
                      )}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-700">
                        {formatDateTime(workspace.last_scan)}
                      </div>
                      {workspace.last_scan_status && (
                        <div className="text-xs text-gray-500">
                          {workspace.last_scan_status}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">
                      {workspace.active_portals}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      {workspace.always_on ? (
                        <div className="flex items-center gap-1">
                          <CheckCircle size={14} className="text-green-600" />
                          <span className="text-xs text-gray-500">
                            {workspace.always_on_since && formatDate(workspace.always_on_since)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">Off</span>
                      )}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className="text-sm text-gray-700">
                          {workspace.credits_used} / {workspace.credits_limit}
                        </div>
                        <div className="w-16 bg-gray-200 rounded-full h-1.5">
                          <div
                            className={`h-1.5 rounded-full ${
                              workspace.credits_used / workspace.credits_limit > 0.8
                                ? 'bg-red-600'
                                : workspace.credits_used / workspace.credits_limit > 0.5
                                ? 'bg-yellow-600'
                                : 'bg-green-600'
                            }`}
                            style={{
                              width: `${Math.min(
                                (workspace.credits_used / workspace.credits_limit) * 100,
                                100
                              )}%`,
                            }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">
                      {formatDate(workspace.joined_date)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {workspaces.length === 0 && (
            <div className="text-center py-12">
              <Database size={48} className="mx-auto text-gray-400 mb-4" />
              <div className="text-gray-500">No workspaces found</div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
