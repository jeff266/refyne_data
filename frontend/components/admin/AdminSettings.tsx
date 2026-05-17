'use client';

import { useState } from 'react';
import { Settings, Key, Clock, RefreshCw, Download, Upload, ChevronDown, ChevronUp, Plus, Trash2, ExternalLink } from 'lucide-react';
import Link from 'next/link';

interface Provider {
  name: string;
  type: string;
  env_key?: string;
  env_keys?: string[];
}

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

interface Config {
  segments: Segment[];
  providers: Record<string, Provider>;
}

interface AdminSettingsProps {
  config: Config;
  onReload: () => void;
  onSave: (config: Config) => Promise<void>;
}

export default function AdminSettings({ config, onReload, onSave }: AdminSettingsProps) {
  const [expandedSection, setExpandedSection] = useState<string | null>('defaults');
  const [defaultTimeout, setDefaultTimeout] = useState(10000);
  const [defaultRetries, setDefaultRetries] = useState(2);
  const [dedupStrategy, setDedupStrategy] = useState<'domain' | 'name' | 'composite'>('domain');
  const [fieldPriority, setFieldPriority] = useState<'first_wins' | 'last_wins' | 'most_complete'>('first_wins');

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'segments-config.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const text = await file.text();
        try {
          const imported = JSON.parse(text);
          if (imported.segments && imported.providers) {
            onSave(imported);
          } else {
            alert('Invalid configuration file format');
          }
        } catch {
          alert('Failed to parse configuration file');
        }
      }
    };
    input.click();
  };

  return (
    <div className="space-y-4">
      {/* Default Settings */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <button
          onClick={() => toggleSection('defaults')}
          className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
              <Clock size={20} className="text-gray-600" />
            </div>
            <div className="text-left">
              <h3 className="font-medium text-black">Default Settings</h3>
              <p className="text-sm text-gray-500">Timeouts, retries, and cascade behavior</p>
            </div>
          </div>
          {expandedSection === 'defaults' ? <ChevronUp size={20} className="text-gray-400" /> : <ChevronDown size={20} className="text-gray-400" />}
        </button>

        {expandedSection === 'defaults' && (
          <div className="px-6 pb-6 pt-2 border-t border-gray-100">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Default Timeout (ms)
                </label>
                <input
                  type="number"
                  value={defaultTimeout}
                  onChange={(e) => setDefaultTimeout(parseInt(e.target.value))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                  min={1000}
                  max={60000}
                  step={1000}
                />
                <p className="text-xs text-gray-500 mt-1">How long to wait for each provider</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Default Retries
                </label>
                <input
                  type="number"
                  value={defaultRetries}
                  onChange={(e) => setDefaultRetries(parseInt(e.target.value))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                  min={0}
                  max={5}
                />
                <p className="text-xs text-gray-500 mt-1">Retry attempts on failure</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Deduplication Strategy
                </label>
                <select
                  value={dedupStrategy}
                  onChange={(e) => setDedupStrategy(e.target.value as any)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent bg-white"
                >
                  <option value="domain">Domain (exact match)</option>
                  <option value="name">Company Name (fuzzy)</option>
                  <option value="composite">Composite (domain + name)</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">How to identify duplicate records</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Field Priority
                </label>
                <select
                  value={fieldPriority}
                  onChange={(e) => setFieldPriority(e.target.value as any)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent bg-white"
                >
                  <option value="first_wins">First Provider Wins</option>
                  <option value="last_wins">Last Provider Wins</option>
                  <option value="most_complete">Most Complete Record</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">Which value to keep when merging</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* API Keys */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <button
          onClick={() => toggleSection('keys')}
          className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
              <Key size={20} className="text-gray-600" />
            </div>
            <div className="text-left">
              <h3 className="font-medium text-black">API Keys</h3>
              <p className="text-sm text-gray-500">Manage provider credentials</p>
            </div>
          </div>
          {expandedSection === 'keys' ? <ChevronUp size={20} className="text-gray-400" /> : <ChevronDown size={20} className="text-gray-400" />}
        </button>

        {expandedSection === 'keys' && (
          <div className="px-6 pb-6 pt-2 border-t border-gray-100">
            <div className="space-y-3">
              {Object.entries(config.providers).map(([id, provider]) => {
                const envKeys = provider.env_keys || (provider.env_key ? [provider.env_key] : []);
                return (
                  <div key={id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <div>
                        <div className="font-medium text-black">{provider.name}</div>
                        <div className="text-xs text-gray-500">
                          {envKeys.length > 0 ? envKeys.join(', ') : 'No keys configured'}
                        </div>
                      </div>
                    </div>
                    <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">
                      Connected
                    </span>
                  </div>
                );
              })}
            </div>
            <Link
              href="/settings"
              className="mt-4 inline-flex items-center gap-2 text-sm text-gray-600 hover:text-black transition-colors"
            >
              <ExternalLink size={14} />
              Manage API Keys in Settings
            </Link>
          </div>
        )}
      </div>

      {/* Providers Overview */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <button
          onClick={() => toggleSection('providers')}
          className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
              <Settings size={20} className="text-gray-600" />
            </div>
            <div className="text-left">
              <h3 className="font-medium text-black">Providers</h3>
              <p className="text-sm text-gray-500">{Object.keys(config.providers).length} providers configured</p>
            </div>
          </div>
          {expandedSection === 'providers' ? <ChevronUp size={20} className="text-gray-400" /> : <ChevronDown size={20} className="text-gray-400" />}
        </button>

        {expandedSection === 'providers' && (
          <div className="px-6 pb-6 pt-2 border-t border-gray-100">
            <div className="grid grid-cols-2 gap-4">
              {Object.entries(config.providers).map(([id, provider]) => {
                const usedBy = config.segments.filter(s => s.providers.cascade.includes(id));
                return (
                  <div key={id} className="p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-black">{provider.name}</span>
                      <span className="px-2 py-0.5 bg-gray-200 text-gray-600 text-xs rounded-full">
                        {provider.type}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500">
                      Used in: {usedBy.length > 0 ? usedBy.map(s => s.display_name).join(', ') : 'None'}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Import/Export */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <button
          onClick={() => toggleSection('backup')}
          className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
              <Download size={20} className="text-gray-600" />
            </div>
            <div className="text-left">
              <h3 className="font-medium text-black">Backup & Restore</h3>
              <p className="text-sm text-gray-500">Export or import configuration</p>
            </div>
          </div>
          {expandedSection === 'backup' ? <ChevronUp size={20} className="text-gray-400" /> : <ChevronDown size={20} className="text-gray-400" />}
        </button>

        {expandedSection === 'backup' && (
          <div className="px-6 pb-6 pt-2 border-t border-gray-100">
            <div className="grid grid-cols-3 gap-4">
              <button
                onClick={handleExport}
                className="flex items-center justify-center gap-2 px-4 py-3 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                <Download size={16} />
                Export Config
              </button>
              <button
                onClick={handleImport}
                className="flex items-center justify-center gap-2 px-4 py-3 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                <Upload size={16} />
                Import Config
              </button>
              <button
                onClick={onReload}
                className="flex items-center justify-center gap-2 px-4 py-3 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                <RefreshCw size={16} />
                Reload
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-3">
              Configuration is stored in <code className="bg-gray-100 px-1.5 py-0.5 rounded">config/segments.json</code>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
