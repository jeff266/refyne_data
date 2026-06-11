'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Mail,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Users,
  Database,
  Activity,
} from 'lucide-react';
import Link from 'next/link';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import AdminWorkspaceControls from '@/components/admin/AdminWorkspaceControls';

interface WorkspaceDetail {
  org_id: string;
  org_name: string;
  plan: string;
  status: string;
  always_on: boolean;
  always_on_since: string | null;
  credits_used: number;
  credits_limit: number;
  joined_date: string | null;
  trial_ends_at: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  allow_operator_push: boolean;
  duplicate_push_policy: string;
}

interface DigestRun {
  id: string;
  run_at: string;
  status: string;
  score_before: number | null;
  score_after: number | null;
  score_delta: number | null;
  new_pairs_detected: number;
  new_insights: number;
  records_scanned: number;
  digest_sent: boolean;
  slack_sent: boolean;
}

interface CompliancePoint {
  score: number;
  compliant: number;
  stale: number;
  unprocessed: number;
  total: number;
  computed_at: string;
}

interface DedupPair {
  id: string;
  record_a_id: string;
  record_b_id: string;
  confidence: number;
  status: string;
  created_at: string;
}

export default function WorkspaceDetailPage() {
  const router = useRouter();
  const params = useParams();
  const orgId = params.orgId as string;

  const [workspace, setWorkspace] = useState<WorkspaceDetail | null>(null);
  const [digestRuns, setDigestRuns] = useState<DigestRun[]>([]);
  const [complianceTrend, setComplianceTrend] = useState<CompliancePoint[]>([]);
  const [dedupPairs, setDedupPairs] = useState<DedupPair[]>([]);
  const [recordStats, setRecordStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (orgId) {
      fetchWorkspaceDetail();
    }
  }, [orgId]);

  const fetchWorkspaceDetail = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/admin/workspaces/${orgId}`);

      if (res.status === 404) {
        router.push('/');
        return;
      }

      if (!res.ok) {
        throw new Error('Failed to fetch workspace details');
      }

      const data = await res.json();
      setWorkspace(data.workspace);
      setDigestRuns(data.digest_runs || []);
      setComplianceTrend(data.compliance_trend || []);
      setDedupPairs(data.dedup_pairs || []);
      setRecordStats(data.record_stats || {});
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load workspace details');
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Loading workspace details...</div>
      </div>
    );
  }

  if (error || !workspace) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 mb-4">{error || 'Workspace not found'}</div>
          <button
            onClick={() => router.push('/admin/workspaces')}
            className="px-4 py-2 bg-black text-white rounded-lg text-sm hover:bg-gray-800 transition-colors"
          >
            Back to Workspaces
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
                href="/admin/workspaces"
                className="flex items-center gap-2 text-gray-500 hover:text-black transition-colors"
              >
                <ArrowLeft size={18} />
                <span className="text-sm">Back</span>
              </Link>
              <div className="h-6 w-px bg-gray-200" />
              <div>
                <h1 className="text-2xl font-semibold text-black">{workspace.org_name}</h1>
                <p className="text-sm text-gray-500 mt-1">
                  {workspace.plan} • {workspace.status}
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Admin Controls */}
        <AdminWorkspaceControls orgId={orgId} />

        {/* Workspace Info */}
        <div className="grid grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="text-sm text-gray-500 mb-2">Subscription</div>
            <div className="text-2xl font-semibold text-black mb-2">{workspace.plan}</div>
            <div className="text-sm text-gray-700">
              {workspace.stripe_customer_id ? (
                <span className="text-green-600">Stripe Customer</span>
              ) : (
                <span className="text-gray-400">No Stripe</span>
              )}
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="text-sm text-gray-500 mb-2">Credits</div>
            <div className="text-2xl font-semibold text-black mb-2">
              {workspace.credits_used} / {workspace.credits_limit}
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full ${
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

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="text-sm text-gray-500 mb-2">Records Monitored</div>
            <div className="text-2xl font-semibold text-black mb-2">
              {recordStats?.total?.toLocaleString() || 0}
            </div>
            <div className="text-sm text-gray-700">
              {recordStats && (
                <span>
                  {recordStats.compliant} compliant • {recordStats.stale} stale
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Compliance Trend */}
        {complianceTrend.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 p-6 mb-8">
            <h2 className="text-lg font-semibold text-black mb-4">Compliance Trend (30 Days)</h2>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={complianceTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="computed_at"
                  tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                />
                <YAxis domain={[0, 100]} />
                <Tooltip
                  labelFormatter={(value) => formatDateTime(value)}
                  formatter={(value: any) => [`${value.toFixed(1)}%`, 'Score']}
                />
                <Line type="monotone" dataKey="score" stroke="#2563eb" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Recent Digest Runs */}
        <div className="bg-white rounded-lg border border-gray-200 mb-8 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-black">Recent Digest Runs</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Run Time
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Score Change
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    New Pairs
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Records Scanned
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Notifications
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {digestRuns.map((run) => (
                  <tr key={run.id} className="hover:bg-gray-50">
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">
                      {formatDateTime(run.run_at)}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      {run.status === 'completed' ? (
                        <span className="flex items-center gap-1 text-green-600">
                          <CheckCircle size={14} />
                          <span className="text-xs">Completed</span>
                        </span>
                      ) : run.status === 'failed' ? (
                        <span className="flex items-center gap-1 text-red-600">
                          <XCircle size={14} />
                          <span className="text-xs">Failed</span>
                        </span>
                      ) : (
                        <span className="text-xs text-gray-500">{run.status}</span>
                      )}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      {run.score_delta !== null ? (
                        <div className="flex items-center gap-1">
                          {run.score_delta > 0 ? (
                            <TrendingUp size={14} className="text-green-600" />
                          ) : run.score_delta < 0 ? (
                            <TrendingDown size={14} className="text-red-600" />
                          ) : null}
                          <span className={`text-sm ${
                            run.score_delta > 0 ? 'text-green-600' :
                            run.score_delta < 0 ? 'text-red-600' :
                            'text-gray-500'
                          }`}>
                            {run.score_delta > 0 ? '+' : ''}{run.score_delta.toFixed(1)}%
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">N/A</span>
                      )}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">
                      {run.new_pairs_detected}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">
                      {run.records_scanned.toLocaleString()}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {run.digest_sent && (
                          <span title="Email sent">
                            <Mail size={14} className="text-blue-600" />
                          </span>
                        )}
                        {run.slack_sent && (
                          <span className="text-xs text-purple-600" title="Slack sent">Slack</span>
                        )}
                        {!run.digest_sent && !run.slack_sent && (
                          <span className="text-xs text-gray-400">None</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {digestRuns.length === 0 && (
            <div className="text-center py-12">
              <Clock size={48} className="mx-auto text-gray-400 mb-4" />
              <div className="text-gray-500">No digest runs yet</div>
            </div>
          )}
        </div>

        {/* Dedup Pair History */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-black">Recent Dedup Pairs</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Record A
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Record B
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Confidence
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Created
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {dedupPairs.slice(0, 20).map((pair) => (
                  <tr key={pair.id} className="hover:bg-gray-50">
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700 font-mono">
                      {pair.record_a_id.substring(0, 12)}...
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700 font-mono">
                      {pair.record_b_id.substring(0, 12)}...
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-700">
                          {(pair.confidence * 100).toFixed(0)}%
                        </span>
                        <div className="w-16 bg-gray-200 rounded-full h-1.5">
                          <div
                            className={`h-1.5 rounded-full ${
                              pair.confidence > 0.9 ? 'bg-red-600' :
                              pair.confidence > 0.7 ? 'bg-yellow-600' :
                              'bg-green-600'
                            }`}
                            style={{ width: `${pair.confidence * 100}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        pair.status === 'merged' ? 'bg-green-100 text-green-800' :
                        pair.status === 'dismissed' ? 'bg-gray-100 text-gray-800' :
                        'bg-blue-100 text-blue-800'
                      }`}>
                        {pair.status}
                      </span>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">
                      {formatDate(pair.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {dedupPairs.length === 0 && (
            <div className="text-center py-12">
              <Database size={48} className="mx-auto text-gray-400 mb-4" />
              <div className="text-gray-500">No dedup pairs found</div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
