'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { Database, AlertCircle, X, Plus, Check, Pencil, ChevronDown, ChevronUp } from 'lucide-react';
import { C, F } from '@/lib/design-tokens';
import { Card, Chip, GhostBtn, StatusDot, PrimaryBtn } from '@/components/refyne';

interface HubSpotConnection {
  id: string;
  portalId: string;
  hubId?: string;
  friendlyName?: string;
  connectionStatus: 'active' | 'expired' | 'disconnected' | 'error';
  lastActiveAt: string | null;
  createdAt: string;
  accessToken?: string;
  encryptedToken?: string;
  lastSyncAt?: string | null;
  lastSyncStatus?: 'success' | 'failed' | 'running' | null;
  lastSyncDurationMs?: number | null;
  lastSyncError?: string | null;
  syncFrequency?: 'manual' | 'nightly' | 'every_6h' | 'hourly';
}

interface SyncHistoryEntry {
  runAt: string;
  status: string;
  recordsScanned: number;
  durationMs: number;
  errorMessage?: string;
}

interface SyncHistory {
  history: SyncHistoryEntry[];
  apiUsage: {
    today: number;
    month: number;
    dailyLimit: number;
    monthlyLimit: number | null;
  };
  lastSync: {
    at: string;
    status: string;
    durationMs: number;
    error?: string;
  } | null;
}

interface Provider {
  id: string;
  name: string;
  description: string;
  category: 'crm' | 'enrichment' | 'research';
  managed?: boolean;
  managedCredits?: string;
}

const PROVIDERS: Provider[] = [
  { id: 'hubspot', name: 'HubSpot', description: 'CRM platform integration', category: 'crm' },
  { id: 'apollo', name: 'Apollo.io', description: 'People and company data', category: 'enrichment' },
  { id: 'zoominfo', name: 'ZoomInfo', description: 'B2B contact database', category: 'enrichment' },
  { id: 'serper', name: 'Serper', description: 'Web search API', category: 'research', managed: true, managedCredits: 'Credits included in your plan' },
  { id: 'graphiq', name: 'GraphIQ', description: 'AI-powered company search', category: 'research', managed: true, managedCredits: 'Credits included in your plan' },
  { id: 'tinyfish', name: 'TinyFish', description: 'Web agent automation', category: 'research' },
  { id: 'proxycurl', name: 'ProxyCurl', description: 'LinkedIn company data', category: 'enrichment' },
  { id: 'clearbit', name: 'Clearbit', description: 'Real-time enrichment', category: 'enrichment' },
];

function getStatusBadge(status: string, authType: 'oauth' | 'pat' | 'unknown') {
  // For PAT connections, show amber badge
  if (authType === 'pat') {
    return { color: C.amber, dot: C.amber, text: 'Connected (API key)' };
  }

  switch (status) {
    case 'active':
      return { color: C.green, dot: C.green, text: 'Active' };
    case 'expired':
      return { color: C.amber, dot: C.amber, text: 'Token expired' };
    case 'disconnected':
      return { color: C.text3, dot: C.text3, text: 'Disconnected' };
    case 'error':
      return { color: C.red, dot: C.red, text: 'Error' };
    default:
      return { color: C.text3, dot: C.text3, text: 'Unknown' };
  }
}

function formatTimeAgo(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins} min ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;

  return date.toLocaleDateString();
}

function getSyncStatusVariant(
  lastSyncAt: string | null | undefined,
  lastSyncStatus: string | null | undefined,
  syncFrequency: string = 'nightly'
): { color: string; text: string; showRetry?: boolean } {
  if (!lastSyncAt) {
    return { color: C.text3, text: 'Never synced' };
  }

  if (lastSyncStatus === 'running') {
    return { color: C.text3, text: 'Syncing...' };
  }

  if (lastSyncStatus === 'failed') {
    return { color: C.red, text: `Last sync failed ${formatTimeAgo(lastSyncAt)}`, showRetry: true };
  }

  // Calculate expected interval in hours
  const intervalHours = syncFrequency === 'hourly' ? 1
    : syncFrequency === 'every_6h' ? 6
    : 24; // nightly or manual

  const hoursSinceSync = (new Date().getTime() - new Date(lastSyncAt).getTime()) / (1000 * 60 * 60);
  const isOverdue = hoursSinceSync > (intervalHours * 2);

  if (isOverdue && syncFrequency !== 'manual') {
    return { color: C.amber, text: `Last sync: ${formatTimeAgo(lastSyncAt)}` };
  }

  return { color: C.green, text: `Last sync: ${formatTimeAgo(lastSyncAt)}` };
}

export default function ConnectionsPage() {
  const { orgRole } = useAuth();
  const [hubspotConnections, setHubspotConnections] = useState<HubSpotConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [addDialogTab, setAddDialogTab] = useState<'crm' | 'enrichment'>('crm');
  const [showApiKeyInput, setShowApiKeyInput] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [editingConnectionId, setEditingConnectionId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [expandedConnectionId, setExpandedConnectionId] = useState<string | null>(null);
  const [syncHistory, setSyncHistory] = useState<Record<string, SyncHistory>>({});
  const [loadingHistory, setLoadingHistory] = useState<Record<string, boolean>>({});
  const [syncing, setSyncing] = useState<Record<string, boolean>>({});
  const [providerConnections, setProviderConnections] = useState<Array<{ provider: string; status: string; hint: string; last_tested_at: string | null }>>([]);
  const [connectingProvider, setConnectingProvider] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const searchParams = useSearchParams();

  const isAdmin = orgRole === 'org:admin';

  useEffect(() => {
    fetchHubSpotConnections();
    fetchProviderConnections();
    handleOAuthCallback();
    handleProviderDeepLink();
  }, []);

  async function fetchHubSpotConnections() {
    try {
      const res = await fetch('/api/hubspot/connections');
      if (res.ok) {
        const data = await res.json();
        setHubspotConnections(data.connections || []);
      }
    } catch (err) {
      console.error('Failed to fetch HubSpot connections:', err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchProviderConnections() {
    try {
      const res = await fetch('/api/connections/providers');
      if (res.ok) {
        const data = await res.json();
        setProviderConnections(data.connections || []);
      }
    } catch (err) {
      console.error('Failed to fetch provider connections:', err);
    }
  }

  function handleOAuthCallback() {
    const connected = searchParams?.get('connected');
    const error = searchParams?.get('error');

    if (connected === 'true') {
      showToast('Portal connected successfully', 'success');
      fetchHubSpotConnections();

      // Check for return URL param and redirect after successful connection
      const returnUrl = searchParams?.get('return');
      if (returnUrl) {
        window.location.href = decodeURIComponent(returnUrl);
      } else {
        window.history.replaceState({}, '', '/connections');
      }
    } else if (error) {
      if (error === 'access_denied') {
        showToast('Connection cancelled', 'error');
      } else {
        showToast('Connection failed — try again', 'error');
      }
      window.history.replaceState({}, '', '/connections');
    }
  }

  function handleProviderDeepLink() {
    const provider = searchParams?.get('provider');
    if (provider && isAdmin) {
      // Auto-open the connection dialog for the specified provider
      setShowAddDialog(true);
      setAddDialogTab('enrichment'); // Most providers are enrichment
      // Auto-expand the provider's API key input
      setTimeout(() => {
        setShowApiKeyInput(provider);
      }, 100);
    }
  }

  function showToast(message: string, type: 'success' | 'error') {
    const toast = document.createElement('div');
    toast.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      padding: 12px 20px;
      background: ${type === 'success' ? C.greenDim : C.redDim};
      border: 1px solid ${type === 'success' ? C.greenBrd : C.redBrd};
      color: ${type === 'success' ? C.greenLt : C.redLt};
      border-radius: 8px;
      font-size: 14px;
      z-index: 10000;
      font-family: ${F.sans};
    `;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  }

  async function handleConnectHubSpot() {
    window.location.href = '/api/hubspot/connect';
  }

  async function handleDisconnectHubSpot(connectionId: string) {
    if (!confirm('Disconnect this HubSpot portal?')) return;

    try {
      const res = await fetch('/api/hubspot/connect', { method: 'DELETE' });
      if (res.ok) {
        showToast('Portal disconnected', 'success');
        fetchHubSpotConnections();
      } else {
        showToast('Failed to disconnect', 'error');
      }
    } catch (err) {
      showToast('Failed to disconnect', 'error');
    }
  }

  function handleConnectProvider(providerId: string) {
    setShowApiKeyInput(providerId);
    setApiKey('');
    setConnectionError(null);
  }

  async function handleSaveApiKey() {
    if (!showApiKeyInput || !apiKey.trim()) return;

    setConnectingProvider(true);
    setConnectionError(null);

    try {
      const res = await fetch('/api/connections/provider', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: showApiKeyInput, apiKey: apiKey.trim() }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        showToast(`${showApiKeyInput} connected successfully`, 'success');
        setShowApiKeyInput(null);
        setApiKey('');
        setConnectionError(null);
        await fetchProviderConnections();

        // Check for return URL param and redirect after successful connection
        const returnUrl = searchParams?.get('return');
        if (returnUrl) {
          setTimeout(() => {
            window.location.href = decodeURIComponent(returnUrl);
          }, 1000); // Brief delay to show success toast
        }
      } else {
        setConnectionError(data.error || 'Failed to connect provider');
      }
    } catch (error) {
      setConnectionError('Network error — please try again');
    } finally {
      setConnectingProvider(false);
    }
  }

  async function handleDisconnectProvider(providerId: string) {
    if (!confirm('Disconnecting this provider will stop enrichment arrangements that use it. Continue?')) {
      return;
    }

    try {
      const res = await fetch('/api/connections/provider', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: providerId }),
      });

      if (res.ok) {
        showToast(`${providerId} disconnected`, 'success');
        await fetchProviderConnections();
      } else {
        showToast('Failed to disconnect provider', 'error');
      }
    } catch (error) {
      showToast('Failed to disconnect provider', 'error');
    }
  }

  async function handleTestProvider(providerId: string) {
    try {
      const res = await fetch('/api/connections/provider/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: providerId }),
      });

      const data = await res.json();

      if (data.success) {
        showToast(`${providerId} connection test passed`, 'success');
      } else {
        showToast(data.error || 'Connection test failed', 'error');
      }

      await fetchProviderConnections();
    } catch (error) {
      showToast('Failed to test connection', 'error');
    }
  }

  function handleEditName(connection: HubSpotConnection) {
    setEditingConnectionId(connection.id);
    setEditingName(connection.friendlyName || connection.hubId || `Portal ${connection.portalId}`);
  }

  function handleCancelEdit() {
    setEditingConnectionId(null);
    setEditingName('');
  }

  async function handleSaveName(connectionId: string) {
    try {
      const res = await fetch(`/api/hubspot/connections/${connectionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ friendlyName: editingName }),
      });

      if (res.ok) {
        showToast('Connection name updated', 'success');
        setEditingConnectionId(null);
        setEditingName('');
        fetchHubSpotConnections();
      } else {
        showToast('Failed to update name', 'error');
      }
    } catch (err) {
      showToast('Failed to update name', 'error');
    }
  }

  async function toggleHistoryPanel(connectionId: string) {
    if (expandedConnectionId === connectionId) {
      setExpandedConnectionId(null);
      return;
    }

    setExpandedConnectionId(connectionId);

    // Fetch history if not already loaded
    if (!syncHistory[connectionId]) {
      setLoadingHistory({ ...loadingHistory, [connectionId]: true });
      try {
        const res = await fetch(`/api/hubspot/connections/${connectionId}/sync-history`);
        if (res.ok) {
          const data = await res.json();
          setSyncHistory({ ...syncHistory, [connectionId]: data });
        }
      } catch (err) {
        console.error('Failed to fetch sync history:', err);
      } finally {
        setLoadingHistory({ ...loadingHistory, [connectionId]: false });
      }
    }
  }

  async function handleSync(connectionId: string) {
    if (syncing[connectionId]) return;

    setSyncing({ ...syncing, [connectionId]: true });
    try {
      const res = await fetch(`/api/hubspot/connections/${connectionId}/sync`, {
        method: 'POST',
      });

      if (res.ok) {
        showToast('Sync started', 'success');
        // Refresh connections to show updated status
        setTimeout(() => {
          fetchHubSpotConnections();
          setSyncing({ ...syncing, [connectionId]: false });
        }, 2000);
      } else {
        showToast('Failed to start sync', 'error');
        setSyncing({ ...syncing, [connectionId]: false });
      }
    } catch (err) {
      showToast('Failed to start sync', 'error');
      setSyncing({ ...syncing, [connectionId]: false });
    }
  }

  const connectedProviderIds = new Set(hubspotConnections.map(() => 'hubspot'));
  const availableProviders = PROVIDERS.filter(p => !connectedProviderIds.has(p.id));

  return (
    <div style={{ fontFamily: F.sans, color: C.text, padding: 40 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 600, marginBottom: 4 }}>Connections</h1>
          <p style={{ fontSize: 14, color: C.text2 }}>
            Connect data sources and enrichment providers
          </p>
        </div>
        <PrimaryBtn onClick={() => setShowAddDialog(true)}>
          <Plus size={16} style={{ marginRight: 6 }} />
          Add connection
        </PrimaryBtn>
      </div>

      {/* Connected Section */}
      {(hubspotConnections.length > 0) && (
        <div style={{ marginBottom: 48 }}>
          <h2 style={{ fontSize: 12, fontWeight: 600, color: C.text3, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 16 }}>
            Connected
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {hubspotConnections.map((conn) => {
              // Determine auth type per connection
              const authType = conn.accessToken
                ? 'oauth'
                : conn.encryptedToken
                ? 'pat'
                : 'unknown';
              const badge = getStatusBadge(conn.connectionStatus, authType);
              const displayName = conn.friendlyName || conn.hubId || `Portal ${conn.portalId}`;
              const isEditing = editingConnectionId === conn.id;
              const isExpanded = expandedConnectionId === conn.id;
              const history = syncHistory[conn.id];
              const isLoadingHistory = loadingHistory[conn.id];
              const isSyncing = syncing[conn.id] || conn.lastSyncStatus === 'running';

              // Get sync status for admin view
              const syncStatus = isAdmin && conn.lastSyncAt
                ? getSyncStatusVariant(conn.lastSyncAt, conn.lastSyncStatus, conn.syncFrequency)
                : null;

              return (
                <div key={conn.id}>
                  <Card style={{ padding: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flex: 1 }}>
                        <div style={{
                          width: 40,
                          height: 40,
                          background: C.indigoDim,
                          border: `1px solid ${C.indigoBrd}`,
                          borderRadius: 8,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}>
                          <Database size={20} style={{ color: C.indigoLt }} />
                        </div>
                        <div style={{ flex: 1 }}>
                          {isEditing ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                              <input
                                type="text"
                                value={editingName}
                                onChange={(e) => setEditingName(e.target.value)}
                                style={{
                                  padding: '6px 10px',
                                  background: C.bg,
                                  border: `1px solid ${C.border}`,
                                  borderRadius: 4,
                                  fontSize: 15,
                                  fontWeight: 500,
                                  color: C.text,
                                  fontFamily: F.sans,
                                  width: 250,
                                }}
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSaveName(conn.id);
                                  if (e.key === 'Escape') handleCancelEdit();
                                }}
                              />
                              <button
                                onClick={() => handleSaveName(conn.id)}
                                style={{
                                  padding: '6px 12px',
                                  background: C.indigo,
                                  border: 'none',
                                  borderRadius: 4,
                                  color: 'white',
                                  fontSize: 13,
                                  fontWeight: 500,
                                  cursor: 'pointer',
                                  fontFamily: F.sans,
                                }}
                              >
                                Save
                              </button>
                              <button
                                onClick={handleCancelEdit}
                                style={{
                                  padding: '6px 12px',
                                  background: 'transparent',
                                  border: `1px solid ${C.border}`,
                                  borderRadius: 4,
                                  color: C.text2,
                                  fontSize: 13,
                                  fontWeight: 500,
                                  cursor: 'pointer',
                                  fontFamily: F.sans,
                                }}
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                              <div style={{ fontSize: 15, fontWeight: 500 }}>
                                HubSpot — {displayName}
                              </div>
                              {isAdmin && (
                                <button
                                  onClick={() => handleEditName(conn)}
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    color: C.text3,
                                    cursor: 'pointer',
                                    padding: 4,
                                    display: 'flex',
                                    alignItems: 'center',
                                  }}
                                  title="Edit connection name"
                                >
                                  <Pencil size={14} />
                                </button>
                              )}
                            </div>
                          )}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <StatusDot color={badge.dot} />
                              <span style={{ fontSize: 13, color: badge.color }}>{badge.text}</span>
                            </div>
                            {authType === 'pat' && (
                              <>
                                <span style={{ fontSize: 13, color: C.text3 }}>•</span>
                                <button
                                  style={{
                                    fontSize: 13,
                                    color: C.amber,
                                    textDecoration: 'none',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 4,
                                    background: 'none',
                                    border: 'none',
                                    padding: 0,
                                    cursor: 'pointer',
                                    fontFamily: F.sans,
                                  }}
                                  onClick={() => {
                                    window.location.href = '/api/hubspot/connect';
                                  }}
                                >
                                  Upgrade to OAuth ↗
                                </button>
                              </>
                            )}
                            <span style={{ fontSize: 13, color: C.text3 }}>•</span>
                            <span style={{ fontSize: 13, color: C.text2 }}>2,798 companies</span>

                            {/* Sync status line (admin only) */}
                            {isAdmin && syncStatus && (
                              <>
                                <span style={{ fontSize: 13, color: C.text3 }}>•</span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <span style={{ fontSize: 13, color: syncStatus.color }}>
                                    {isSyncing ? (
                                      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <span className="spinner" style={{
                                          width: 12,
                                          height: 12,
                                          border: `2px solid ${C.border}`,
                                          borderTopColor: C.indigo,
                                          borderRadius: '50%',
                                          animation: 'spin 0.8s linear infinite',
                                        }} />
                                        Syncing...
                                      </span>
                                    ) : (
                                      syncStatus.text
                                    )}
                                  </span>
                                  {syncStatus.showRetry && isAdmin && (
                                    <button
                                      onClick={() => handleSync(conn.id)}
                                      style={{
                                        fontSize: 13,
                                        color: C.indigo,
                                        background: 'none',
                                        border: 'none',
                                        padding: 0,
                                        cursor: 'pointer',
                                        textDecoration: 'underline',
                                        fontFamily: F.sans,
                                      }}
                                    >
                                      Retry
                                    </button>
                                  )}
                                  <button
                                    onClick={() => toggleHistoryPanel(conn.id)}
                                    style={{
                                      background: 'none',
                                      border: 'none',
                                      color: C.text3,
                                      cursor: 'pointer',
                                      padding: 4,
                                      display: 'flex',
                                      alignItems: 'center',
                                    }}
                                    title="Toggle sync history"
                                  >
                                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: 8 }}>
                        {isAdmin && (
                          <GhostBtn
                            onClick={() => handleSync(conn.id)}
                            disabled={isSyncing}
                          >
                            {isSyncing ? 'Syncing...' : 'Sync'}
                          </GhostBtn>
                        )}
                        {isAdmin && (
                          <GhostBtn onClick={() => handleDisconnectHubSpot(conn.id)}>
                            Disconnect
                          </GhostBtn>
                        )}
                      </div>
                    </div>
                  </Card>

                  {/* Sync History Panel (expandable, admin only) */}
                  {isAdmin && isExpanded && (
                    <Card style={{ marginTop: 8, padding: 24 }}>
                      {isLoadingHistory ? (
                        <div style={{ textAlign: 'center', color: C.text3, padding: 20 }}>
                          Loading sync history...
                        </div>
                      ) : history ? (
                        <>
                          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Sync history</h3>

                          {history.history.length > 0 ? (
                            <div style={{ marginBottom: 24 }}>
                              {history.history.map((entry, idx) => (
                                <div
                                  key={idx}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: '8px 0',
                                    borderBottom: idx < history.history.length - 1 ? `1px solid ${C.border}` : 'none',
                                  }}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <span style={{ fontSize: 13, color: C.text2, minWidth: 140 }}>
                                      {formatTimeAgo(entry.runAt)}
                                    </span>
                                    <span style={{ fontSize: 20 }}>
                                      {entry.status === 'completed' || entry.status === 'success' ? '✓' : '✗'}
                                    </span>
                                    <span style={{ fontSize: 13, color: C.text }}>
                                      {entry.recordsScanned?.toLocaleString() || 0} records
                                    </span>
                                    <span style={{ fontSize: 13, color: C.text3 }}>
                                      {entry.durationMs ? `${entry.durationMs}ms` : '—'}
                                    </span>
                                  </div>
                                  {entry.errorMessage && (
                                    <button
                                      style={{
                                        fontSize: 13,
                                        color: C.indigo,
                                        background: 'none',
                                        border: 'none',
                                        padding: 0,
                                        cursor: 'pointer',
                                        textDecoration: 'underline',
                                        fontFamily: F.sans,
                                      }}
                                      onClick={() => alert(entry.errorMessage)}
                                    >
                                      Details
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div style={{ fontSize: 13, color: C.text3, marginBottom: 24 }}>
                              No sync history yet
                            </div>
                          )}

                          {/* API Usage Bar */}
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>
                              API usage this month
                            </div>
                            <div style={{ marginBottom: 8 }}>
                              {(() => {
                                const percentage = (history.apiUsage.today / history.apiUsage.dailyLimit) * 100;
                                const barColor = percentage >= 90 ? C.red
                                  : percentage >= 70 ? C.amber
                                  : C.indigo;

                                return (
                                  <>
                                    <div style={{
                                      width: '100%',
                                      height: 8,
                                      background: C.border,
                                      borderRadius: 4,
                                      overflow: 'hidden',
                                    }}>
                                      <div style={{
                                        width: `${Math.min(percentage, 100)}%`,
                                        height: '100%',
                                        background: barColor,
                                        transition: 'width 0.3s ease',
                                      }} />
                                    </div>
                                    <div style={{ fontSize: 12, color: C.text3, marginTop: 4 }}>
                                      {history.apiUsage.today.toLocaleString()} / {history.apiUsage.dailyLimit.toLocaleString()} daily limit ({percentage.toFixed(1)}%)
                                    </div>
                                  </>
                                );
                              })()}
                            </div>
                            <div style={{ fontSize: 12, color: C.text3 }}>
                              Monthly total: {history.apiUsage.month.toLocaleString()} calls
                            </div>
                          </div>
                        </>
                      ) : (
                        <div style={{ fontSize: 13, color: C.text3 }}>
                          Failed to load sync history
                        </div>
                      )}
                    </Card>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Available Section */}
      {availableProviders.length > 0 && (
        <div>
          <h2 style={{ fontSize: 12, fontWeight: 600, color: C.text3, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 16 }}>
            Available
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
            {availableProviders.map((provider) => (
              <div key={provider.id} style={{ cursor: 'pointer' }} onClick={() => setShowAddDialog(true)}>
                <Card style={{ padding: 16 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>{provider.name}</div>
                  <div style={{ fontSize: 12, color: C.text3 }}>{provider.description}</div>
                </Card>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Connection Slide-over */}
      {showAddDialog && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 1000,
            display: 'flex',
            justifyContent: 'flex-end',
          }}
          onClick={() => setShowAddDialog(false)}
        >
          <div
            style={{
              width: 500,
              background: C.sidebar,
              borderLeft: `1px solid ${C.border}`,
              display: 'flex',
              flexDirection: 'column',
              maxHeight: '100vh',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ padding: 24, borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: 18, fontWeight: 600 }}>Add connection</h2>
              <button
                onClick={() => setShowAddDialog(false)}
                style={{ background: 'none', border: 'none', color: C.text3, cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', borderBottom: `1px solid ${C.border}`, padding: '0 24px' }}>
              <button
                onClick={() => setAddDialogTab('crm')}
                style={{
                  padding: '12px 16px',
                  background: 'none',
                  border: 'none',
                  borderBottom: addDialogTab === 'crm' ? `2px solid ${C.indigo}` : '2px solid transparent',
                  color: addDialogTab === 'crm' ? C.text : C.text3,
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: 'pointer',
                  fontFamily: F.sans,
                }}
              >
                CRM
              </button>
              <button
                onClick={() => setAddDialogTab('enrichment')}
                style={{
                  padding: '12px 16px',
                  background: 'none',
                  border: 'none',
                  borderBottom: addDialogTab === 'enrichment' ? `2px solid ${C.indigo}` : '2px solid transparent',
                  color: addDialogTab === 'enrichment' ? C.text : C.text3,
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: 'pointer',
                  fontFamily: F.sans,
                }}
              >
                Enrichment
              </button>
            </div>

            {/* Content */}
            <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
              {addDialogTab === 'crm' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {PROVIDERS.filter(p => p.category === 'crm').map((provider) => (
                    <div key={provider.id} style={{ cursor: 'pointer' }} onClick={handleConnectHubSpot}>
                      <Card style={{ padding: 16 }}>
                        <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>{provider.name}</div>
                        <div style={{ fontSize: 12, color: C.text3 }}>{provider.description}</div>
                      </Card>
                    </div>
                  ))}
                </div>
              )}

              {addDialogTab === 'enrichment' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {PROVIDERS.filter(p => p.category === 'enrichment' || p.category === 'research').map((provider) => {
                    const isConnected = providerConnections.some(c => c.provider === provider.id);
                    const connection = providerConnections.find(c => c.provider === provider.id);
                    const isExpanded = showApiKeyInput === provider.id;

                    return (
                      <div key={provider.id}>
                        <Card style={{ padding: 16 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 4 }}>
                            <div style={{ fontSize: 14, fontWeight: 500 }}>{provider.name}</div>
                            {provider.managed && <Chip>Managed</Chip>}
                            {isConnected && !provider.managed && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <StatusDot color={C.green} />
                                <span style={{ fontSize: 12, color: C.text2 }}>••••••••{connection?.hint}</span>
                              </div>
                            )}
                          </div>
                          <div style={{ fontSize: 12, color: C.text3, marginBottom: provider.managedCredits ? 4 : 0 }}>
                            {provider.description}
                          </div>
                          {provider.managedCredits && (
                            <div style={{ fontSize: 11, color: C.text3, fontStyle: 'italic', marginBottom: 8 }}>
                              {provider.managedCredits}
                            </div>
                          )}

                          {/* API Key Input (expanded state) */}
                          {isExpanded && !isConnected && (
                            <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${C.border}` }}>
                              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 6, color: C.text }}>
                                API key
                              </label>
                              <input
                                type="password"
                                value={apiKey}
                                onChange={(e) => setApiKey(e.target.value)}
                                placeholder="Enter your API key"
                                style={{
                                  width: '100%',
                                  padding: '8px 12px',
                                  background: C.bg,
                                  border: `1px solid ${C.border}`,
                                  borderRadius: 6,
                                  fontSize: 13,
                                  color: C.text,
                                  fontFamily: F.sans,
                                  marginBottom: 8,
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSaveApiKey();
                                }}
                              />
                              <div style={{ fontSize: 11, color: C.text3, marginBottom: 12, lineHeight: 1.5 }}>
                                Your key is encrypted before storage and never returned to the browser. Hint: last 4 chars shown.
                              </div>

                              {connectionError && (
                                <div style={{
                                  padding: '8px 12px',
                                  background: C.redDim,
                                  border: `1px solid ${C.redBrd}`,
                                  borderRadius: 6,
                                  fontSize: 12,
                                  color: C.red,
                                  marginBottom: 12,
                                }}>
                                  {connectionError}
                                </div>
                              )}

                              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                                <GhostBtn onClick={() => { setShowApiKeyInput(null); setApiKey(''); setConnectionError(null); }}>
                                  Cancel
                                </GhostBtn>
                                <PrimaryBtn onClick={handleSaveApiKey} disabled={connectingProvider || !apiKey.trim()}>
                                  {connectingProvider ? 'Connecting...' : 'Connect'}
                                </PrimaryBtn>
                              </div>
                            </div>
                          )}

                          {/* Action buttons */}
                          {!isExpanded && (
                            <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                              {!isConnected && !provider.managed && isAdmin && (
                                <PrimaryBtn onClick={() => handleConnectProvider(provider.id)}>
                                  Connect
                                </PrimaryBtn>
                              )}
                              {isConnected && !provider.managed && isAdmin && (
                                <>
                                  <GhostBtn onClick={() => handleTestProvider(provider.id)}>Test</GhostBtn>
                                  <GhostBtn onClick={() => handleDisconnectProvider(provider.id)}>Disconnect</GhostBtn>
                                </>
                              )}
                              {provider.managed && (
                                <div style={{ fontSize: 12, color: C.text3 }}>
                                  Included in your Refyne plan
                                </div>
                              )}
                            </div>
                          )}
                        </Card>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Spinner animation */}
      <style jsx>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
