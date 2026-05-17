'use client';

import { useState, useEffect, useCallback } from 'react';
import { Key, RefreshCw } from 'lucide-react';
import { KeyRow, PROVIDERS, type Provider } from './KeyRow';
import { AddKeyModal } from './AddKeyModal';
import { addToast } from '../ui/toast';

interface KeyStatus {
  provider: string;
  configured: boolean;
  maskedKey?: string;
}

interface ApiKeyManagerProps {
  apiBaseUrl?: string;
}

export function ApiKeyManager({ apiBaseUrl = '/api' }: ApiKeyManagerProps) {
  const [keyStatuses, setKeyStatuses] = useState<Map<string, KeyStatus>>(new Map());
  const [loading, setLoading] = useState(true);
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  // Fetch key statuses
  const fetchKeyStatuses = useCallback(async () => {
    try {
      const response = await fetch(`${apiBaseUrl}/keys`);
      if (!response.ok) throw new Error('Failed to fetch keys');

      const data = await response.json();
      const statusMap = new Map<string, KeyStatus>();

      // Initialize all providers as not configured
      PROVIDERS.forEach(provider => {
        statusMap.set(provider.id, {
          provider: provider.id,
          configured: false,
        });
      });

      // Update with actual statuses
      if (Array.isArray(data)) {
        data.forEach((status: KeyStatus) => {
          statusMap.set(status.provider, status);
        });
      }

      setKeyStatuses(statusMap);
    } catch (error) {
      console.error('Error fetching key statuses:', error);
      // Initialize all as not configured on error
      const statusMap = new Map<string, KeyStatus>();
      PROVIDERS.forEach(provider => {
        statusMap.set(provider.id, {
          provider: provider.id,
          configured: false,
        });
      });
      setKeyStatuses(statusMap);
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl]);

  useEffect(() => {
    fetchKeyStatuses();
  }, [fetchKeyStatuses]);

  // Test a key
  const testKey = async (providerId: string, key?: string): Promise<boolean> => {
    try {
      const response = await fetch(`${apiBaseUrl}/keys/${providerId}/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: key ? JSON.stringify({ key }) : undefined,
      });
      const data = await response.json();
      return data.success === true;
    } catch {
      return false;
    }
  };

  // Save a key
  const saveKey = async (providerId: string, key: string): Promise<void> => {
    const response = await fetch(`${apiBaseUrl}/keys/${providerId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key }),
    });

    if (!response.ok) {
      throw new Error('Failed to save key');
    }

    await fetchKeyStatuses();
    addToast('success', `${PROVIDERS.find(p => p.id === providerId)?.name} API key saved successfully`);
  };

  // Delete a key
  const deleteKey = async (providerId: string): Promise<void> => {
    try {
      const response = await fetch(`${apiBaseUrl}/keys/${providerId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete key');
      }

      await fetchKeyStatuses();
      addToast('success', `${PROVIDERS.find(p => p.id === providerId)?.name} API key deleted`);
    } catch (error) {
      addToast('error', 'Failed to delete API key');
    }
  };

  const openAddModal = (provider: Provider) => {
    setSelectedProvider(provider);
    setModalOpen(true);
  };

  const closeAddModal = () => {
    setSelectedProvider(null);
    setModalOpen(false);
  };

  const configuredCount = Array.from(keyStatuses.values()).filter(s => s.configured).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-mplc-gray-100 flex items-center justify-center">
            <Key className="w-5 h-5 text-mplc-gray-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-mplc-gray-900">API Keys</h2>
            <p className="text-sm text-mplc-gray-500">
              {configuredCount} of {PROVIDERS.length} providers configured
            </p>
          </div>
        </div>
        <button
          onClick={() => fetchKeyStatuses()}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-mplc-gray-700
            border border-mplc-gray-300 rounded-lg hover:bg-mplc-gray-50 transition-colors
            disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Provider List */}
      <div className="bg-white border border-mplc-gray-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <RefreshCw className="w-6 h-6 animate-spin text-mplc-gray-400 mx-auto mb-2" />
            <p className="text-sm text-mplc-gray-500">Loading API keys...</p>
          </div>
        ) : (
          PROVIDERS.map(provider => {
            const status = keyStatuses.get(provider.id);
            return (
              <KeyRow
                key={provider.id}
                provider={provider}
                isConfigured={status?.configured ?? false}
                maskedKey={status?.maskedKey}
                onAddKey={() => openAddModal(provider)}
                onTestKey={() => testKey(provider.id)}
                onDeleteKey={() => deleteKey(provider.id)}
              />
            );
          })
        )}
      </div>

      {/* Info Box */}
      <div className="p-4 bg-mplc-gray-50 border border-mplc-gray-200 rounded-xl">
        <h3 className="text-sm font-medium text-mplc-gray-900 mb-1">
          About API Keys
        </h3>
        <p className="text-sm text-mplc-gray-600">
          API keys are stored securely and encrypted at rest. Keys are never exposed in full after being saved.
          Use the &quot;Test&quot; button to verify your connection is working correctly.
        </p>
      </div>

      {/* Add Key Modal */}
      {selectedProvider && (
        <AddKeyModal
          provider={selectedProvider}
          isOpen={modalOpen}
          onClose={closeAddModal}
          onSave={(key) => saveKey(selectedProvider.id, key)}
          onTest={(key) => testKey(selectedProvider.id, key)}
        />
      )}
    </div>
  );
}
