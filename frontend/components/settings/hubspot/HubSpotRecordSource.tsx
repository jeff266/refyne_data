'use client';

/**
 * HubSpotRecordSource - H1 Implementation
 *
 * RecordSource implementation for loading companies from HubSpot.
 * Implements the RecordSourceProps interface from Phase 9.
 */

import { useState, useEffect, useCallback } from 'react';
import { Database, RefreshCw, X, AlertCircle, Link2, List, Building2, ChevronDown } from 'lucide-react';
import type { RecordSourceProps } from '../normalization/RecordSource';
import type { RawRecord } from '@/lib/mcp/types';

interface HubSpotList {
  listId: string;
  name: string;
  memberCount: number;
}

interface ConnectionStatus {
  connected: boolean;
  portalId: string | null;
  scopes: string[] | null;
}

/**
 * HubSpot Record Source Component.
 * Allows users to connect to HubSpot and pull company records.
 */
export function HubSpotRecordSource({
  onRecordsLoaded,
  onClear,
  loadedRecords,
  sourceName,
  disabled = false,
}: RecordSourceProps) {
  // Connection state
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus | null>(null);
  const [checkingConnection, setCheckingConnection] = useState(true);
  const [tokenInput, setTokenInput] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  // List state
  const [lists, setLists] = useState<HubSpotList[]>([]);
  const [loadingLists, setLoadingLists] = useState(false);
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [listDropdownOpen, setListDropdownOpen] = useState(false);

  // Loading state
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Check connection on mount
  useEffect(() => {
    checkConnection();
  }, []);

  const checkConnection = async () => {
    setCheckingConnection(true);
    try {
      const response = await fetch('/api/hubspot/connect');
      const data = await response.json();
      setConnectionStatus({
        connected: data.connected,
        portalId: data.portalId,
        scopes: data.scopes,
      });

      if (data.connected) {
        fetchLists();
      }
    } catch (error) {
      setConnectionStatus({ connected: false, portalId: null, scopes: null });
    } finally {
      setCheckingConnection(false);
    }
  };

  const fetchLists = async () => {
    setLoadingLists(true);
    try {
      const response = await fetch('/api/hubspot/lists');
      if (response.ok) {
        const data = await response.json();
        setLists(data.lists || []);
      }
    } catch (error) {
      console.error('Failed to fetch lists:', error);
    } finally {
      setLoadingLists(false);
    }
  };

  const handleConnect = async () => {
    if (!tokenInput.trim()) return;

    setConnecting(true);
    setConnectionError(null);

    try {
      const response = await fetch('/api/hubspot/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: tokenInput.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        setConnectionError(data.error || 'Failed to connect');
        return;
      }

      setConnectionStatus({
        connected: true,
        portalId: data.portalId,
        scopes: data.scopes,
      });
      setTokenInput('');
      fetchLists();
    } catch (error) {
      setConnectionError('Failed to connect to HubSpot');
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await fetch('/api/hubspot/connect', { method: 'DELETE' });
      setConnectionStatus({ connected: false, portalId: null, scopes: null });
      setLists([]);
      setSelectedListId(null);
    } catch (error) {
      console.error('Failed to disconnect:', error);
    }
  };

  const handleLoadRecords = useCallback(async () => {
    setLoadingRecords(true);
    setLoadError(null);

    try {
      let url = '/api/hubspot/companies?limit=500';

      if (selectedListId) {
        url = `/api/hubspot/lists/${selectedListId}/members`;
      }

      const response = await fetch(url);
      const data = await response.json();

      if (!response.ok) {
        setLoadError(data.error || 'Failed to load records');
        return;
      }

      const selectedList = lists.find(l => l.listId === selectedListId);
      const listName = selectedList?.name || 'All Companies';

      onRecordsLoaded({
        records: data.records,
        sourceName: `HubSpot: ${listName}`,
        count: data.records.length,
      });
    } catch (error) {
      setLoadError('Failed to load records from HubSpot');
    } finally {
      setLoadingRecords(false);
    }
  }, [selectedListId, lists, onRecordsLoaded]);

  // If records are loaded, show summary
  if (loadedRecords && loadedRecords.length > 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
            <Database className="w-5 h-5 text-orange-600" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-mplc-gray-900">HubSpot Records</h3>
            <p className="text-xs text-mplc-gray-500">
              {loadedRecords.length} records loaded
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between p-4 border border-mplc-gray-200 rounded-xl bg-mplc-gray-50">
          <div className="flex items-center gap-3">
            <Building2 className="w-5 h-5 text-mplc-gray-500" />
            <div>
              <span className="text-sm font-medium text-mplc-gray-900">
                {loadedRecords.length} companies
              </span>
              {sourceName && (
                <span className="text-xs text-mplc-gray-500 ml-2">
                  · {sourceName}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClear}
            disabled={disabled}
            className="p-2 text-mplc-gray-400 hover:text-mplc-gray-600 hover:bg-mplc-gray-200 rounded-lg
              disabled:opacity-50 transition-colors"
            title="Clear records"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  // Loading connection check
  if (checkingConnection) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
            <Database className="w-5 h-5 text-orange-600" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-mplc-gray-900">HubSpot</h3>
            <p className="text-xs text-mplc-gray-500">Checking connection...</p>
          </div>
        </div>
        <div className="flex items-center justify-center p-8">
          <RefreshCw className="w-5 h-5 animate-spin text-mplc-gray-400" />
        </div>
      </div>
    );
  }

  // Not connected - show connection form
  if (!connectionStatus?.connected) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
            <Database className="w-5 h-5 text-orange-600" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-mplc-gray-900">HubSpot</h3>
            <p className="text-xs text-mplc-gray-500">Connect to load companies</p>
          </div>
        </div>

        <div className="p-4 border border-mplc-gray-200 rounded-xl space-y-4">
          <div>
            <label className="block text-sm font-medium text-mplc-gray-700 mb-1">
              Private App Access Token
            </label>
            <input
              type="password"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              placeholder="pat-na1-xxxxxxxx..."
              className="w-full px-3 py-2 text-sm border border-mplc-gray-200 rounded-lg
                focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
              disabled={connecting || disabled}
            />
          </div>

          <div className="flex items-center justify-between">
            <a
              href="https://developers.hubspot.com/docs/api/private-apps"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-mplc-gray-500 hover:text-mplc-gray-700 flex items-center gap-1"
            >
              <Link2 className="w-3 h-3" />
              How to create a private app
            </a>
            <button
              onClick={handleConnect}
              disabled={!tokenInput.trim() || connecting || disabled}
              className="px-4 py-2 text-sm font-medium text-white bg-orange-500 rounded-lg
                hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed
                transition-colors flex items-center gap-2"
            >
              {connecting && <RefreshCw className="w-4 h-4 animate-spin" />}
              Connect
            </button>
          </div>

          {connectionError && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
              <span className="text-sm text-red-700">{connectionError}</span>
            </div>
          )}
        </div>

        <div className="text-xs text-mplc-gray-500">
          <p className="font-medium mb-1">Required scopes:</p>
          <ul className="list-disc list-inside space-y-0.5">
            <li>crm.objects.companies.read</li>
            <li>crm.objects.companies.write</li>
            <li>crm.schemas.companies.read</li>
            <li>crm.lists.read</li>
          </ul>
        </div>
      </div>
    );
  }

  // Connected - show list selector
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
            <Database className="w-5 h-5 text-orange-600" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-mplc-gray-900">HubSpot</h3>
            <p className="text-xs text-mplc-gray-500">
              Portal {connectionStatus.portalId} connected
            </p>
          </div>
        </div>
        <button
          onClick={handleDisconnect}
          className="text-xs text-mplc-gray-500 hover:text-red-600 transition-colors"
        >
          Disconnect
        </button>
      </div>

      <div className="p-4 border border-mplc-gray-200 rounded-xl space-y-4">
        {/* List selector */}
        <div>
          <label className="block text-sm font-medium text-mplc-gray-700 mb-1">
            Select Company List
          </label>
          <div className="relative">
            <button
              onClick={() => setListDropdownOpen(!listDropdownOpen)}
              disabled={loadingLists || disabled}
              className="w-full flex items-center justify-between px-3 py-2 text-sm border border-mplc-gray-200
                rounded-lg bg-white hover:bg-mplc-gray-50 disabled:opacity-50 transition-colors"
            >
              <span className="flex items-center gap-2">
                <List className="w-4 h-4 text-mplc-gray-400" />
                {loadingLists ? (
                  'Loading lists...'
                ) : selectedListId ? (
                  lists.find(l => l.listId === selectedListId)?.name || 'Select list'
                ) : (
                  'All Companies (no list filter)'
                )}
              </span>
              <ChevronDown className={`w-4 h-4 text-mplc-gray-400 transition-transform ${listDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {listDropdownOpen && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-mplc-gray-200 rounded-lg shadow-lg max-h-60 overflow-auto">
                <button
                  onClick={() => {
                    setSelectedListId(null);
                    setListDropdownOpen(false);
                  }}
                  className="w-full px-3 py-2 text-sm text-left hover:bg-mplc-gray-50 flex items-center gap-2"
                >
                  <Building2 className="w-4 h-4 text-mplc-gray-400" />
                  All Companies (no list filter)
                </button>
                {lists.map(list => (
                  <button
                    key={list.listId}
                    onClick={() => {
                      setSelectedListId(list.listId);
                      setListDropdownOpen(false);
                    }}
                    className="w-full px-3 py-2 text-sm text-left hover:bg-mplc-gray-50 flex items-center justify-between"
                  >
                    <span className="flex items-center gap-2">
                      <List className="w-4 h-4 text-mplc-gray-400" />
                      {list.name}
                    </span>
                    <span className="text-xs text-mplc-gray-400">
                      {list.memberCount} companies
                    </span>
                  </button>
                ))}
                {lists.length === 0 && !loadingLists && (
                  <div className="px-3 py-2 text-sm text-mplc-gray-500">
                    No company lists found
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Load button */}
        <div className="flex justify-end">
          <button
            onClick={handleLoadRecords}
            disabled={loadingRecords || disabled}
            className="px-4 py-2 text-sm font-medium text-white bg-orange-500 rounded-lg
              hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed
              transition-colors flex items-center gap-2"
          >
            {loadingRecords && <RefreshCw className="w-4 h-4 animate-spin" />}
            {loadingRecords ? 'Loading...' : 'Load Companies'}
          </button>
        </div>

        {loadError && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
            <span className="text-sm text-red-700">{loadError}</span>
          </div>
        )}
      </div>
    </div>
  );
}
