'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Database, AlertCircle } from 'lucide-react';
import { C, F } from '@/lib/design-tokens';
import { Card, Chip, GhostBtn, StatusDot } from '@/components/refyne';

interface HubSpotConnection {
  id: string;
  portalId: string;
  connectionStatus: 'active' | 'expired' | 'disconnected' | 'error';
  lastActiveAt: string | null;
  createdAt: string;
}

// Available providers remain static
const otherProviders = [
  { name: 'Apollo.io',  desc: 'People and company data', tag: 'Enrichment' },
  { name: 'ZoomInfo',   desc: 'B2B contact database',    tag: 'Enrichment' },
  { name: 'Serper',     desc: 'Web search API',          tag: 'Research' },
  { name: 'TinyFish',   desc: 'Web agent automation',    tag: 'Research' },
  { name: 'ProxyCurl',  desc: 'LinkedIn company data',   tag: 'Enrichment' },
  { name: 'Clearbit',   desc: 'Real-time enrichment',    tag: 'Enrichment' },
];

function tagColor(t: string): 'indigo' | 'green' {
  return t === 'Research' ? 'indigo' : 'green';
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'active':
      return { color: C.green, dot: C.green, text: 'Connected' };
    case 'expired':
      return { color: C.amber, dot: C.amber, text: 'Token expired — reconnect' };
    case 'disconnected':
      return { color: C.text3, dot: C.text3, text: 'Disconnected' };
    case 'error':
      return { color: C.red, dot: C.red, text: 'Error — reconnect' };
    default:
      return { color: C.text3, dot: C.text3, text: 'Unknown' };
  }
}

export default function ConnectionsPage() {
  const [hubspotConnection, setHubspotConnection] = useState<HubSpotConnection | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDisconnectDialog, setShowDisconnectDialog] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const searchParams = useSearchParams();

  useEffect(() => {
    fetchHubSpotConnection();
    handleOAuthCallback();
  }, []);

  async function fetchHubSpotConnection() {
    try {
      const res = await fetch('/api/hubspot/connections');
      if (res.ok) {
        const data = await res.json();
        if (data.connections && data.connections.length > 0) {
          setHubspotConnection(data.connections[0]);
        }
      }
    } catch (err) {
      console.error('Failed to fetch HubSpot connection:', err);
    } finally {
      setLoading(false);
    }
  }

  function handleOAuthCallback() {
    const connected = searchParams?.get('connected');
    const error = searchParams?.get('error');

    if (connected === 'true') {
      showToast('Portal connected successfully', 'success');
      fetchHubSpotConnection();
      // Remove query params from URL
      window.history.replaceState({}, '', '/connections');
    } else if (error) {
      if (error === 'access_denied') {
        showToast('Connection cancelled', 'error');
      } else {
        showToast('Connection failed — try again', 'error');
      }
      // Remove query params from URL
      window.history.replaceState({}, '', '/connections');
    }
  }

  function showToast(message: string, type: 'success' | 'error') {
    // Simple toast implementation - could be replaced with a proper toast library
    const toast = document.createElement('div');
    toast.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      padding: 12px 20px;
      background: ${type === 'success' ? C.greenDim : C.redDim};
      border: 1px solid ${type === 'success' ? C.greenBrd : C.border};
      color: ${type === 'success' ? C.green : C.red};
      border-radius: 8px;
      font-size: 13px;
      font-family: ${F.sans};
      z-index: 1000;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  }

  function handleConnectHubSpot() {
    // OAuth flow - redirects to HubSpot
    window.location.href = '/api/hubspot/connect';
  }

  async function handleDisconnect() {
    if (!hubspotConnection) return;

    setDisconnecting(true);
    try {
      const res = await fetch('/api/hubspot/connect', {
        method: 'DELETE',
      });

      if (res.ok) {
        showToast('Portal disconnected', 'success');
        setHubspotConnection(null);
        setShowDisconnectDialog(false);
      } else {
        showToast('Failed to disconnect', 'error');
      }
    } catch (error) {
      console.error('Disconnect error:', error);
      showToast('Failed to disconnect', 'error');
    } finally {
      setDisconnecting(false);
    }
  }

  if (loading) {
    return (
      <div style={{ padding: '28px 32px', fontFamily: F.sans }}>
        <div style={{ fontSize: 13, color: C.text3 }}>Loading connections...</div>
      </div>
    );
  }

  const isConnected = hubspotConnection && hubspotConnection.connectionStatus !== 'disconnected';
  const needsReconnect = hubspotConnection && ['expired', 'error'].includes(hubspotConnection.connectionStatus);

  return (
    <div style={{ padding: '28px 32px', fontFamily: F.sans, maxWidth: 820 }}>
      {/* Connected section */}
      {isConnected && (
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 11, color: C.text3, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 14 }}>Connected</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Card style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 36, height: 36, borderRadius: 9, background: C.indigoDim, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${C.indigoBrd}` }}>
                  <Database size={15} color={C.indigoLt} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3 }}>
                    <span style={{ fontSize: 13, color: C.text, fontWeight: 600, letterSpacing: '-0.01em' }}>HubSpot</span>
                    <span style={{ fontSize: 11, color: C.text3 }}>·</span>
                    <span style={{ fontSize: 12, color: C.text2 }}>Portal {hubspotConnection.portalId}</span>
                    <Chip color="green">CRM</Chip>
                  </div>
                  <div style={{ fontSize: 11, fontFamily: F.mono, color: C.text3 }}>
                    {hubspotConnection.lastActiveAt
                      ? `Last active ${new Date(hubspotConnection.lastActiveAt).toLocaleDateString()}`
                      : `Connected ${new Date(hubspotConnection.createdAt).toLocaleDateString()}`
                    }
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: getStatusBadge(hubspotConnection.connectionStatus).dot,
                  }}
                />
                <span style={{ fontSize: 11, color: getStatusBadge(hubspotConnection.connectionStatus).color }}>
                  {getStatusBadge(hubspotConnection.connectionStatus).text}
                </span>
                {needsReconnect ? (
                  <button
                    onClick={handleConnectHubSpot}
                    style={{
                      padding: '5px 12px',
                      border: `1px solid ${C.indigoBrd}`,
                      color: C.indigoLt,
                      borderRadius: 7,
                      fontSize: 11,
                      fontWeight: 500,
                      background: C.indigoDim,
                      cursor: 'pointer',
                    }}
                  >
                    Reconnect
                  </button>
                ) : (
                  <button
                    onClick={() => setShowDisconnectDialog(true)}
                    style={{
                      padding: '5px 12px',
                      border: `1px solid ${C.border}`,
                      color: C.text2,
                      borderRadius: 7,
                      fontSize: 11,
                      fontWeight: 500,
                      background: 'transparent',
                      cursor: 'pointer',
                    }}
                  >
                    Disconnect
                  </button>
                )}
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* Available section */}
      <div>
        <div style={{ fontSize: 11, color: C.text3, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 14 }}>Available</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
          {/* HubSpot - show only if not connected */}
          {!isConnected && (
            <Card style={{ padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3 }}>
                  <span style={{ fontSize: 13, color: C.text, fontWeight: 600, letterSpacing: '-0.01em' }}>HubSpot</span>
                  <Chip color="green">CRM</Chip>
                </div>
                <div style={{ fontSize: 11, color: C.text3 }}>CRM platform integration</div>
              </div>
              <button
                onClick={handleConnectHubSpot}
                style={{
                  padding: '5px 12px',
                  border: `1px solid ${C.indigoBrd}`,
                  color: C.indigoLt,
                  borderRadius: 7,
                  fontSize: 11,
                  fontWeight: 500,
                  marginLeft: 14,
                  flexShrink: 0,
                  background: C.indigoDim,
                  cursor: 'pointer',
                }}
              >
                Connect
              </button>
            </Card>
          )}

          {/* Other providers */}
          {otherProviders.map((c, i) => (
            <Card key={i} style={{ padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3 }}>
                  <span style={{ fontSize: 13, color: C.text, fontWeight: 600, letterSpacing: '-0.01em' }}>{c.name}</span>
                  <Chip color={tagColor(c.tag)}>{c.tag}</Chip>
                </div>
                <div style={{ fontSize: 11, color: C.text3 }}>{c.desc}</div>
              </div>
              <button
                style={{
                  padding: '5px 12px',
                  border: `1px solid ${C.indigoBrd}`,
                  color: C.indigoLt,
                  borderRadius: 7,
                  fontSize: 11,
                  fontWeight: 500,
                  marginLeft: 14,
                  flexShrink: 0,
                  background: C.indigoDim,
                  cursor: 'pointer',
                  opacity: 0.5,
                }}
                disabled
              >
                Connect
              </button>
            </Card>
          ))}
        </div>
      </div>

      {/* Disconnect confirmation dialog */}
      {showDisconnectDialog && hubspotConnection && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => !disconnecting && setShowDisconnectDialog(false)}
        >
          <div
            style={{
              background: C.surface,
              border: `1px solid ${C.border}`,
              borderRadius: 12,
              padding: 24,
              maxWidth: 400,
              width: '90%',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <AlertCircle size={20} color={C.amber} />
              <h3 style={{ fontSize: 16, fontWeight: 600, color: C.text, margin: 0 }}>
                Disconnect HubSpot?
              </h3>
            </div>
            <p style={{ fontSize: 14, color: C.text2, lineHeight: 1.6, marginBottom: 24 }}>
              Disconnecting Portal {hubspotConnection.portalId} will stop all syncs and scans.
              Your data in Refyne is preserved.
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowDisconnectDialog(false)}
                disabled={disconnecting}
                style={{
                  padding: '8px 16px',
                  fontSize: 13,
                  fontWeight: 500,
                  border: `1px solid ${C.border}`,
                  background: 'transparent',
                  color: C.text,
                  borderRadius: 7,
                  cursor: disconnecting ? 'not-allowed' : 'pointer',
                  opacity: disconnecting ? 0.5 : 1,
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleDisconnect}
                disabled={disconnecting}
                style={{
                  padding: '8px 16px',
                  fontSize: 13,
                  fontWeight: 500,
                  border: 'none',
                  background: C.red,
                  color: 'white',
                  borderRadius: 7,
                  cursor: disconnecting ? 'not-allowed' : 'pointer',
                  opacity: disconnecting ? 0.5 : 1,
                }}
              >
                {disconnecting ? 'Disconnecting...' : 'Disconnect'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
