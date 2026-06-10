'use client';

import { useState, useEffect } from 'react';
import { Settings, Layers, Database, Swords, Plus, ArrowLeft, FileText } from 'lucide-react';
import Link from 'next/link';
import SegmentList from '@/components/admin/SegmentList';
import ProviderStatus from '@/components/admin/ProviderStatus';
import AddSegmentModal from '@/components/admin/AddSegmentModal';
import CascadeEditorModal from '@/components/admin/CascadeEditorModal';
import AdminSettings from '@/components/admin/AdminSettings';
import ProviderShowdown from '@/components/admin/ProviderShowdown';
import ProviderSetupWizard from '@/components/admin/ProviderSetupWizard';
import QueueStats from '@/components/admin/QueueStats';
import type { CascadeTrigger } from '@/types';

interface Segment {
  id: string;
  display_name: string;
  description: string;
  icon: string;
  visible: boolean;
  order: number;
  providers: {
    cascade: string[];
    fallback_enabled: boolean;
    fallback?: string[];
  };
  input_fields: any[];
}

interface Provider {
  name: string;
  type: string;
  env_key?: string;
  env_keys?: string[];
}

interface Config {
  segments: Segment[];
  providers: Record<string, Provider>;
}

type Tab = 'segments' | 'providers' | 'compare' | 'blog' | 'settings' | 'requests';

interface CascadeStep {
  providerId: string;
  trigger: CascadeTrigger;
  triggerConfig?: Record<string, any>;
  timeoutMs?: number;
  retryCount?: number;
}

interface ProviderRequest {
  id: string;
  org_id: string;
  requested_by: string;
  provider_name: string;
  reason: string | null;
  status: 'pending' | 'reviewing' | 'shipped' | 'declined';
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
}

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<Tab>('segments');
  const [config, setConfig] = useState<Config | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [cascadeEditorSegmentId, setCascadeEditorSegmentId] = useState<string | null>(null);
  const [isProviderWizardOpen, setIsProviderWizardOpen] = useState(false);
  const [providerRequests, setProviderRequests] = useState<ProviderRequest[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [updatingRequestId, setUpdatingRequestId] = useState<string | null>(null);

  // Fetch config on mount
  useEffect(() => {
    fetchConfig();
    fetchProviderRequests();
  }, []);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/config');
      if (!res.ok) throw new Error('Failed to fetch config');
      const data = await res.json();
      setConfig(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load configuration');
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async (newConfig: Config) => {
    try {
      setSaveStatus('saving');
      const res = await fetch('/api/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newConfig),
      });
      if (!res.ok) throw new Error('Failed to save config');
      setConfig(newConfig);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (err) {
      setSaveStatus('error');
      setError(err instanceof Error ? err.message : 'Failed to save configuration');
    }
  };

  const handleSegmentsReorder = (newSegments: Segment[]) => {
    if (!config) return;
    const newConfig = { ...config, segments: newSegments };
    setConfig(newConfig);
    saveConfig(newConfig);
  };

  const handleSegmentUpdate = (segmentId: string, updates: Partial<Segment>) => {
    if (!config) return;
    const newSegments = config.segments.map((seg) =>
      seg.id === segmentId ? { ...seg, ...updates } : seg
    );
    const newConfig = { ...config, segments: newSegments };
    setConfig(newConfig);
    saveConfig(newConfig);
  };

  const handleSegmentDelete = (segmentId: string) => {
    if (!config) return;
    const newSegments = config.segments.filter((seg) => seg.id !== segmentId);
    const newConfig = { ...config, segments: newSegments };
    setConfig(newConfig);
    saveConfig(newConfig);
  };

  const handleAddSegment = (newSegment: Segment) => {
    if (!config) return;
    const newSegments = [...config.segments, newSegment];
    const newConfig = { ...config, segments: newSegments };
    setConfig(newConfig);
    saveConfig(newConfig);
    setIsAddModalOpen(false);
  };

  const handleOpenCascadeEditor = (segmentId: string) => {
    setCascadeEditorSegmentId(segmentId);
  };

  const handleCloseCascadeEditor = () => {
    setCascadeEditorSegmentId(null);
  };

  const handleSaveCascade = (cascade: CascadeStep[], fallbackEnabled: boolean) => {
    if (!config || !cascadeEditorSegmentId) return;

    // Convert CascadeStep[] back to string[] for backward compatibility
    // In a full implementation, you might want to store the full CascadeStep data
    const cascadeIds = cascade.map((step) => step.providerId);

    const newSegments = config.segments.map((seg) =>
      seg.id === cascadeEditorSegmentId
        ? {
            ...seg,
            providers: {
              ...seg.providers,
              cascade: cascadeIds,
              fallback_enabled: fallbackEnabled,
            },
          }
        : seg
    );
    const newConfig = { ...config, segments: newSegments };
    setConfig(newConfig);
    saveConfig(newConfig);
  };

  const fetchProviderRequests = async () => {
    try {
      setLoadingRequests(true);
      const res = await fetch('/api/admin/provider-requests');
      if (res.ok) {
        const data = await res.json();
        setProviderRequests(data.requests || []);
      }
    } catch (err) {
      console.error('Failed to fetch provider requests:', err);
    } finally {
      setLoadingRequests(false);
    }
  };

  const handleUpdateRequestStatus = async (requestId: string, status: string) => {
    try {
      setUpdatingRequestId(requestId);
      const res = await fetch(`/api/admin/provider-requests/${requestId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        await fetchProviderRequests();
      }
    } catch (err) {
      console.error('Failed to update request:', err);
    } finally {
      setUpdatingRequestId(null);
    }
  };

  // Get the segment being edited in the cascade editor
  const cascadeEditorSegment = cascadeEditorSegmentId
    ? config?.segments.find((s) => s.id === cascadeEditorSegmentId)
    : null;

  const pendingCount = providerRequests.filter(r => r.status === 'pending').length;

  const tabs = [
    { id: 'segments' as Tab, label: 'Segments', icon: Layers },
    { id: 'providers' as Tab, label: 'Providers', icon: Database },
    { id: 'compare' as Tab, label: 'Compare', icon: Swords },
    { id: 'blog' as Tab, label: 'Blog', icon: FileText },
    { id: 'settings' as Tab, label: 'Settings', icon: Settings },
    { id: 'requests' as Tab, label: `Provider requests${pendingCount > 0 ? ` (${pendingCount})` : ''}`, icon: Database },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-gray-500">Loading configuration...</div>
      </div>
    );
  }

  if (error && !config) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 mb-4">{error}</div>
          <button
            onClick={fetchConfig}
            className="px-4 py-2 bg-black text-white rounded-full text-sm hover:bg-gray-800 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6 py-4">
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
                <h1 className="text-2xl font-medium text-black">Admin Configuration</h1>
                <p className="text-sm text-gray-500 mt-1">
                  Manage segments and provider settings
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {saveStatus === 'saving' && (
                <span className="text-sm text-gray-500">Saving...</span>
              )}
              {saveStatus === 'saved' && (
                <span className="text-sm text-green-600">Saved</span>
              )}
              {saveStatus === 'error' && (
                <span className="text-sm text-red-500">Error saving</span>
              )}
              <Link href="/" className="font-medium tracking-widest text-black px-3 py-2 border-l-2 border-t-2 border-black hover:bg-gray-50 transition-colors">
                MPLC
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6">
          <nav className="flex gap-8">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 py-4 border-b-2 transition-colors ${
                    isActive
                      ? 'border-black text-black'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Icon size={18} />
                  <span className="text-sm font-medium">{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-6 py-8">
        {activeTab === 'segments' && config && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-medium text-black">Segment Configuration</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Drag to reorder segments. Changes are saved automatically.
                </p>
              </div>
              <button
                onClick={() => setIsAddModalOpen(true)}
                className="px-4 py-2 bg-black text-white rounded-full text-sm font-medium hover:bg-gray-800 transition-colors"
              >
                Add Segment
              </button>
            </div>
            <SegmentList
              segments={config.segments}
              providers={config.providers}
              onReorder={handleSegmentsReorder}
              onUpdate={handleSegmentUpdate}
              onDelete={handleSegmentDelete}
              onConfigureCascade={handleOpenCascadeEditor}
            />
          </div>
        )}

        {activeTab === 'providers' && config && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-medium text-black">Provider Status</h2>
                <p className="text-sm text-gray-500 mt-1">
                  View connection status and segment usage for each provider.
                </p>
              </div>
              <button
                onClick={() => setIsProviderWizardOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-black text-white rounded-full text-sm font-medium hover:bg-gray-800 transition-colors"
              >
                <Plus size={16} />
                Add Provider
              </button>
            </div>
            <ProviderStatus
              providers={config.providers}
              segments={config.segments}
            />
          </div>
        )}

        {activeTab === 'compare' && config && (
          <div>
            <div className="mb-6">
              <h2 className="text-lg font-medium text-black">Provider Comparison</h2>
              <p className="text-sm text-gray-500 mt-1">
                Run A/B tests to find which provider has the best data for your use case.
              </p>
            </div>
            <ProviderShowdown providers={config.providers} />
          </div>
        )}

        {activeTab === 'blog' && (
          <div>
            <div className="mb-6">
              <h2 className="text-lg font-medium text-black">Blog Management</h2>
              <p className="text-sm text-gray-500 mt-1">
                Create and manage blog posts for blog.refynedata.com
              </p>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
              <FileText size={48} className="mx-auto mb-4 text-gray-400" />
              <h3 className="text-lg font-medium text-black mb-2">Blog Admin</h3>
              <p className="text-sm text-gray-500 mb-6">
                Manage blog posts, create new content, and publish to the blog.
              </p>
              <Link
                href="/blog-admin"
                className="inline-flex items-center gap-2 px-6 py-3 bg-black text-white rounded-full text-sm font-medium hover:bg-gray-800 transition-colors"
              >
                <FileText size={16} />
                Go to Blog Admin
              </Link>
            </div>
          </div>
        )}

        {activeTab === 'settings' && config && (
          <div>
            <div className="mb-6">
              <h2 className="text-lg font-medium text-black">Settings</h2>
              <p className="text-sm text-gray-500 mt-1">
                Application-wide settings and configuration.
              </p>
            </div>
            <AdminSettings
              config={config}
              onReload={fetchConfig}
              onSave={saveConfig}
            />

            <div className="mt-8">
              <QueueStats />
            </div>
          </div>
        )}

        {activeTab === 'requests' && (
          <div>
            <div className="mb-6">
              <h2 className="text-lg font-medium text-black">Provider requests</h2>
              <p className="text-sm text-gray-500 mt-1">
                Customer requests for new provider integrations
              </p>
            </div>

            {loadingRequests ? (
              <div className="text-gray-500">Loading requests...</div>
            ) : providerRequests.length === 0 ? (
              <div className="text-gray-500">No requests yet</div>
            ) : (
              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Org ID</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Provider name</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Reason</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Requested</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {providerRequests.map((request) => {
                      const statusColors = {
                        pending: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
                        reviewing: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
                        shipped: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
                        declined: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
                      };
                      const statusStyle = statusColors[request.status];

                      return (
                        <tr key={request.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm text-gray-900 font-mono">{request.org_id.slice(0, 12)}...</td>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">{request.provider_name}</td>
                          <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">{request.reason || '—'}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium border ${statusStyle.bg} ${statusStyle.text} ${statusStyle.border}`}>
                              {request.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {new Date(request.created_at).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex gap-2">
                              {request.status !== 'reviewing' && (
                                <button
                                  onClick={() => handleUpdateRequestStatus(request.id, 'reviewing')}
                                  disabled={updatingRequestId === request.id}
                                  className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
                                >
                                  Mark reviewing
                                </button>
                              )}
                              {request.status !== 'shipped' && (
                                <button
                                  onClick={() => handleUpdateRequestStatus(request.id, 'shipped')}
                                  disabled={updatingRequestId === request.id}
                                  className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
                                >
                                  Mark shipped
                                </button>
                              )}
                              {request.status !== 'declined' && (
                                <button
                                  onClick={() => handleUpdateRequestStatus(request.id, 'declined')}
                                  disabled={updatingRequestId === request.id}
                                  className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
                                >
                                  Mark declined
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Add Segment Modal */}
      {isAddModalOpen && config && (
        <AddSegmentModal
          providers={config.providers}
          existingIds={config.segments.map((s) => s.id)}
          maxOrder={Math.max(...config.segments.map((s) => s.order), 0)}
          onAdd={handleAddSegment}
          onClose={() => setIsAddModalOpen(false)}
        />
      )}

      {/* Cascade Editor Modal */}
      {cascadeEditorSegment && config && (
        <CascadeEditorModal
          isOpen={true}
          segmentName={cascadeEditorSegment.display_name}
          segmentId={cascadeEditorSegment.id}
          initialCascade={cascadeEditorSegment.providers.cascade}
          fallbackEnabled={cascadeEditorSegment.providers.fallback_enabled}
          providers={config.providers}
          onSave={handleSaveCascade}
          onClose={handleCloseCascadeEditor}
        />
      )}

      {/* Provider Setup Wizard */}
      <ProviderSetupWizard
        isOpen={isProviderWizardOpen}
        onClose={() => setIsProviderWizardOpen(false)}
        onComplete={(providerConfig) => {
          // Add new provider to config
          if (config) {
            const newConfig = {
              ...config,
              providers: {
                ...config.providers,
                [providerConfig.id]: {
                  name: providerConfig.name,
                  type: providerConfig.type,
                  env_key: providerConfig.envKey,
                },
              },
            };
            saveConfig(newConfig);
          }
          setIsProviderWizardOpen(false);
        }}
      />
    </div>
  );
}
