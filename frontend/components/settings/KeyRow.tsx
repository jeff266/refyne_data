'use client';

import { useState } from 'react';
import {
  Search,
  Users,
  Database,
  BarChart3,
  Layers,
  Trash2,
  PlayCircle,
  Loader2,
  CheckCircle,
  XCircle,
  Plus,
  LucideIcon,
} from 'lucide-react';

export interface Provider {
  id: string;
  name: string;
  description: string;
  docsUrl: string;
  icon: LucideIcon;
}

export const PROVIDERS: Provider[] = [
  {
    id: 'serper',
    name: 'Serper',
    description: 'Google Search API for web scraping and search results',
    docsUrl: 'https://serper.dev/api-key',
    icon: Search,
  },
  {
    id: 'apollo',
    name: 'Apollo',
    description: 'B2B contact and company data enrichment',
    docsUrl: 'https://app.apollo.io/#/settings/integrations/api',
    icon: Users,
  },
  {
    id: 'zoominfo',
    name: 'ZoomInfo',
    description: 'Enterprise B2B intelligence platform',
    docsUrl: 'https://www.zoominfo.com/solutions/integrations',
    icon: Database,
  },
  {
    id: 'graphiq',
    name: 'GraphIQ',
    description: 'Knowledge graph and entity enrichment',
    docsUrl: 'https://graphiq.io/settings/api',
    icon: BarChart3,
  },
  {
    id: 'clay',
    name: 'Clay',
    description: 'Data enrichment and outbound automation',
    docsUrl: 'https://app.clay.com/settings/api',
    icon: Layers,
  },
];

interface KeyRowProps {
  provider: Provider;
  isConfigured: boolean;
  maskedKey?: string;
  onAddKey: () => void;
  onTestKey: () => Promise<boolean>;
  onDeleteKey: () => void;
}

export function KeyRow({
  provider,
  isConfigured,
  maskedKey,
  onAddKey,
  onTestKey,
  onDeleteKey,
}: KeyRowProps) {
  const [testState, setTestState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const Icon = provider.icon;

  const handleTest = async () => {
    setTestState('loading');
    try {
      const success = await onTestKey();
      setTestState(success ? 'success' : 'error');
      setTimeout(() => setTestState('idle'), 3000);
    } catch {
      setTestState('error');
      setTimeout(() => setTestState('idle'), 3000);
    }
  };

  const handleDelete = () => {
    if (showDeleteConfirm) {
      onDeleteKey();
      setShowDeleteConfirm(false);
    } else {
      setShowDeleteConfirm(true);
      setTimeout(() => setShowDeleteConfirm(false), 3000);
    }
  };

  return (
    <div className="flex items-center justify-between p-4 border-b border-mplc-gray-200 last:border-b-0 hover:bg-mplc-gray-50 transition-colors">
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-lg bg-mplc-gray-100 flex items-center justify-center">
          <Icon className="w-5 h-5 text-mplc-gray-600" />
        </div>
        <div>
          <h3 className="font-medium text-mplc-gray-900">{provider.name}</h3>
          <p className="text-sm text-mplc-gray-500">{provider.description}</p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {isConfigured ? (
          <>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                Connected
              </span>
              <span className="text-sm text-mplc-gray-400 font-mono">
                {maskedKey}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleTest}
                disabled={testState === 'loading'}
                className={`
                  inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md
                  border transition-all
                  ${testState === 'success'
                    ? 'border-green-300 bg-green-50 text-green-700'
                    : testState === 'error'
                    ? 'border-red-300 bg-red-50 text-red-700'
                    : 'border-mplc-gray-300 hover:bg-mplc-gray-50 text-mplc-gray-700'
                  }
                  disabled:opacity-50 disabled:cursor-not-allowed
                `}
              >
                {testState === 'loading' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : testState === 'success' ? (
                  <CheckCircle className="w-4 h-4" />
                ) : testState === 'error' ? (
                  <XCircle className="w-4 h-4" />
                ) : (
                  <PlayCircle className="w-4 h-4" />
                )}
                {testState === 'loading'
                  ? 'Testing...'
                  : testState === 'success'
                  ? 'Success'
                  : testState === 'error'
                  ? 'Failed'
                  : 'Test'}
              </button>

              <button
                onClick={handleDelete}
                className={`
                  inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md
                  border transition-all
                  ${showDeleteConfirm
                    ? 'border-red-300 bg-red-600 text-white hover:bg-red-700'
                    : 'border-mplc-gray-300 hover:bg-red-50 text-mplc-gray-700 hover:text-red-600 hover:border-red-300'
                  }
                `}
              >
                <Trash2 className="w-4 h-4" />
                {showDeleteConfirm ? 'Confirm' : 'Delete'}
              </button>
            </div>
          </>
        ) : (
          <>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-mplc-gray-100 text-mplc-gray-500">
              Not configured
            </span>
            <button
              onClick={onAddKey}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md bg-mplc-black text-white hover:bg-mplc-gray-800 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Key
            </button>
          </>
        )}
      </div>
    </div>
  );
}
