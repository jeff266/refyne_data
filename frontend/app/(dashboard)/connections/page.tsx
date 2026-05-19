'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Database, AlertCircle, X, Plus, Check } from 'lucide-react';
import { C, F } from '@/lib/design-tokens';
import { Card, Chip, GhostBtn, StatusDot, PrimaryBtn } from '@/components/refyne';

interface HubSpotConnection {
  id: string;
  portalId: string;
  connectionStatus: 'active' | 'expired' | 'disconnected' | 'error';
  lastActiveAt: string | null;
  createdAt: string;
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

function getStatusBadge(status: string) {
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

export default function ConnectionsPage() {
  const [hubspotConnections, setHubspotConnections] = useState<HubSpotConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [addDialogTab, setAddDialogTab] = useState<'crm' | 'enrichment'>('crm');
  const [showApiKeyInput, setShowApiKeyInput] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState('');
  const searchParams = useSearchParams();

  useEffect(() => {
    fetchHubSpotConnections();
    handleOAuthCallback();
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

  function handleOAuthCallback() {
    const connected = searchParams?.get('connected');
    const error = searchParams?.get('error');

    if (connected === 'true') {
      showToast('Portal connected successfully', 'success');
      fetchHubSpotConnections();
      window.history.replaceState({}, '', '/connections');
    } else if (error) {
      if (error === 'access_denied') {
        showToast('Connection cancelled', 'error');
      } else {
        showToast('Connection failed — try again', 'error');
      }
      window.history.replaceState({}, '', '/connections');
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
  }

  function handleSaveApiKey() {
    // TODO: Save API key to backend
    showToast(`${showApiKeyInput} connected`, 'success');
    setShowApiKeyInput(null);
    setApiKey('');
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
              const badge = getStatusBadge(conn.connectionStatus);
              return (
                <Card key={conn.id} style={{ padding: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
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
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 4 }}>
                          HubSpot — Portal {conn.portalId}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <StatusDot color={badge.dot} />
                            <span style={{ fontSize: 13, color: badge.color }}>{badge.text}</span>
                          </div>
                          <span style={{ fontSize: 13, color: C.text3 }}>•</span>
                          <span style={{ fontSize: 13, color: C.text2 }}>2,798 companies</span>
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 8 }}>
                      <GhostBtn onClick={() => {}}>Sync</GhostBtn>
                      <GhostBtn onClick={() => handleDisconnectHubSpot(conn.id)}>
                        Disconnect
                      </GhostBtn>
                    </div>
                  </div>
                </Card>
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
            <div style={{ padding: '0 24px', borderBottom: `1px solid ${C.border}`, display: 'flex', gap: 24 }}>
              <button
                onClick={() => setAddDialogTab('crm')}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: '12px 0',
                  fontSize: 14,
                  fontWeight: 500,
                  color: addDialogTab === 'crm' ? C.text : C.text3,
                  borderBottom: addDialogTab === 'crm' ? `2px solid ${C.indigo}` : '2px solid transparent',
                  cursor: 'pointer',
                }}
              >
                CRM
              </button>
              <button
                onClick={() => setAddDialogTab('enrichment')}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: '12px 0',
                  fontSize: 14,
                  fontWeight: 500,
                  color: addDialogTab === 'enrichment' ? C.text : C.text3,
                  borderBottom: addDialogTab === 'enrichment' ? `2px solid ${C.indigo}` : '2px solid transparent',
                  cursor: 'pointer',
                }}
              >
                Enrichment
              </button>
            </div>

            {/* Content */}
            <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
              {addDialogTab === 'crm' ? (
                <div>
                  <h3 style={{ fontSize: 15, fontWeight: 500, marginBottom: 8 }}>Connect a HubSpot portal</h3>
                  <p style={{ fontSize: 13, color: C.text2, marginBottom: 20 }}>
                    Connect your HubSpot account to sync contacts and companies.
                  </p>
                  <div style={{ width: '100%' }}>
                    <PrimaryBtn onClick={handleConnectHubSpot}>
                      Connect HubSpot →
                    </PrimaryBtn>
                  </div>
                </div>
              ) : showApiKeyInput ? (
                <div>
                  <h3 style={{ fontSize: 15, fontWeight: 500, marginBottom: 8 }}>
                    Connect {PROVIDERS.find(p => p.id === showApiKeyInput)?.name}
                  </h3>
                  <p style={{ fontSize: 13, color: C.text2, marginBottom: 20 }}>
                    Enter your API key to connect this provider.
                  </p>
                  <input
                    type="password"
                    placeholder="API key"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      background: C.bg,
                      border: `1px solid ${C.border}`,
                      borderRadius: 6,
                      fontSize: 14,
                      color: C.text,
                      marginBottom: 16,
                      fontFamily: F.mono,
                    }}
                  />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <div style={{ flex: 1 }}>
                      <GhostBtn onClick={() => setShowApiKeyInput(null)}>
                        Cancel
                      </GhostBtn>
                    </div>
                    <div style={{ flex: 1 }}>
                      <PrimaryBtn onClick={handleSaveApiKey} disabled={!apiKey}>
                        Save
                      </PrimaryBtn>
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {PROVIDERS.filter(p => p.category === 'enrichment' || p.category === 'research').map((provider) => (
                    <Card key={provider.id} style={{ padding: 16 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>{provider.name}</div>
                          <div style={{ fontSize: 12, color: C.text3, marginBottom: 8 }}>
                            {provider.description}
                          </div>
                          {provider.managed && (
                            <div style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                              padding: '4px 8px',
                              background: C.indigoDim,
                              border: `1px solid ${C.indigoBrd}`,
                              borderRadius: 4,
                              fontSize: 11,
                              fontWeight: 500,
                              color: C.indigoLt,
                            }}>
                              <Check size={12} />
                              Included
                            </div>
                          )}
                        </div>
                        {!provider.managed && (
                          <GhostBtn onClick={() => handleConnectProvider(provider.id)}>
                            Connect
                          </GhostBtn>
                        )}
                      </div>
                      {provider.managed && (
                        <div style={{ fontSize: 11, color: C.text3, marginTop: 8 }}>
                          {provider.managedCredits}
                        </div>
                      )}
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
