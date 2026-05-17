'use client';

import { useState, useEffect } from 'react';
import { Settings, Layers, Database, Swords, Plus, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import SegmentList from '@/components/admin/SegmentList';
import ProviderStatus from '@/components/admin/ProviderStatus';
import AddSegmentModal from '@/components/admin/AddSegmentModal';
import CascadeEditorModal from '@/components/admin/CascadeEditorModal';
import AdminSettings from '@/components/admin/AdminSettings';
import ProviderShowdown from '@/components/admin/ProviderShowdown';
import ProviderSetupWizard from '@/components/admin/ProviderSetupWizard';
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

type Tab = 'segments' | 'providers' | 'compare' | 'settings';

interface CascadeStep {
  providerId: string;
  trigger: CascadeTrigger;
  triggerConfig?: Record<string, any>;
  timeoutMs?: number;
  retryCount?: number;
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

  // Fetch config on mount
  useEffect(() => {
    fetchConfig();
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

  // Get the segment being edited in the cascade editor
  const cascadeEditorSegment = cascadeEditorSegmentId
    ? config?.segments.find((s) => s.id === cascadeEditorSegmentId)
    : null;

  const tabs = [
    { id: 'segments' as Tab, label: 'Segments', icon: Layers },
    { id: 'providers' as Tab, label: 'Providers', icon: Database },
    { id: 'compare' as Tab, label: 'Compare', icon: Swords },
    { id: 'settings' as Tab, label: 'Settings', icon: Settings },
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
