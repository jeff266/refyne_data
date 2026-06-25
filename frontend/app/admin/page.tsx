'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { C, F } from '@/lib/design-tokens';
import { FileText } from 'lucide-react';
import OrgsTab from '@/components/admin/OrgsTab';
import AdminSettings from '@/components/admin/AdminSettings';
import QueueStats from '@/components/admin/QueueStats';

type Tab = 'orgs' | 'blog' | 'settings' | 'requests';

interface Config {
  segments: any[];
  providers: Record<string, any>;
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
  const [activeTab, setActiveTab] = useState<Tab>('orgs');
  const [isSuperAdmin, setIsSuperAdmin] = useState<boolean | null>(null);
  const [config, setConfig] = useState<Config | null>(null);
  const [providerRequests, setProviderRequests] = useState<ProviderRequest[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [updatingRequestId, setUpdatingRequestId] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    checkSuperAdmin();
    if (activeTab === 'settings') fetchConfig();
    if (activeTab === 'requests') fetchProviderRequests();
  }, [activeTab]);

  async function checkSuperAdmin() {
    try {
      const res = await fetch('/api/admin/orgs');
      if (res.status === 403) {
        setIsSuperAdmin(false);
        router.push('/dashboard');
      } else {
        setIsSuperAdmin(true);
      }
    } catch (err) {
      setIsSuperAdmin(false);
      router.push('/dashboard');
    }
  }

  async function fetchConfig() {
    try {
      const res = await fetch('/api/config');
      if (res.ok) {
        const data = await res.json();
        setConfig(data);
      }
    } catch (err) {
      console.error('Failed to fetch config:', err);
    }
  }

  async function saveConfig(newConfig: Config) {
    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newConfig),
      });

      if (res.ok) {
        setConfig(newConfig);
      }
    } catch (err) {
      console.error('Failed to save config:', err);
    }
  }

  async function fetchProviderRequests() {
    setLoadingRequests(true);
    try {
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
  }

  async function updateRequestStatus(requestId: string, status: ProviderRequest['status']) {
    setUpdatingRequestId(requestId);
    try {
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
  }

  if (isSuperAdmin === null) {
    return (
      <div style={{
        background: C.bg,
        minHeight: '100vh',
        padding: 32,
        color: C.text3,
      }}>
        Checking permissions...
      </div>
    );
  }

  if (isSuperAdmin === false) {
    return null; // Redirecting
  }

  const tabs = [
    { id: 'orgs' as Tab, label: 'Orgs' },
    { id: 'blog' as Tab, label: 'Blog' },
    { id: 'settings' as Tab, label: 'Settings' },
    { id: 'requests' as Tab, label: 'Provider requests' },
  ];

  return (
    <div style={{
      background: C.bg,
      minHeight: '100vh',
      color: C.text,
      fontFamily: F.sans,
    }}>
      {/* Header */}
      <div style={{
        borderBottom: `1px solid ${C.border}`,
        padding: '16px 32px',
        background: C.surface,
      }}>
        <h1 style={{
          fontSize: 24,
          fontWeight: 600,
          fontFamily: F.serif,
          color: C.text,
        }}>
          Admin
        </h1>
      </div>

      {/* Tabs */}
      <nav style={{
        display: 'flex',
        gap: 32,
        padding: '0 32px',
        borderBottom: `1px solid ${C.border}`,
        background: C.surface,
      }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '16px 0',
              borderBottom: activeTab === tab.id ? `2px solid ${C.indigo}` : '2px solid transparent',
              color: activeTab === tab.id ? C.text : C.text2,
              fontSize: 14,
              fontWeight: 500,
              background: 'none',
              cursor: 'pointer',
            }}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {/* Tab content */}
      <div style={{ maxWidth: 1400, margin: '0 auto' }}>
        {activeTab === 'orgs' && <OrgsTab />}

        {activeTab === 'blog' && (
          <div style={{ padding: 32 }}>
            <div style={{ marginBottom: 24 }}>
              <h2 style={{ fontSize: 24, fontWeight: 600, color: C.text, fontFamily: F.serif, marginBottom: 8 }}>
                Blog Management
              </h2>
              <p style={{ fontSize: 14, color: C.text2 }}>
                Create and manage blog posts for blog.refynedata.com
              </p>
            </div>
            <div style={{
              background: C.surface,
              border: `1px solid ${C.border}`,
              padding: 48,
              textAlign: 'center',
            }}>
              <FileText size={48} style={{ margin: '0 auto 16px', color: C.text3 }} />
              <h3 style={{ fontSize: 18, fontWeight: 600, color: C.text, marginBottom: 8 }}>
                Blog Admin
              </h3>
              <p style={{ fontSize: 14, color: C.text2, marginBottom: 24 }}>
                Manage blog posts, create new content, and publish to the blog.
              </p>
              <a
                href="/blog-admin"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '12px 24px',
                  background: C.indigo,
                  color: '#fff',
                  fontSize: 14,
                  fontWeight: 500,
                  textDecoration: 'none',
                  cursor: 'pointer',
                }}
              >
                <FileText size={16} />
                Go to Blog Admin
              </a>
            </div>
          </div>
        )}

        {activeTab === 'settings' && config && (
          <div style={{ padding: 32 }}>
            <div style={{ marginBottom: 24 }}>
              <h2 style={{ fontSize: 24, fontWeight: 600, color: C.text, fontFamily: F.serif, marginBottom: 8 }}>
                Settings
              </h2>
              <p style={{ fontSize: 14, color: C.text2 }}>
                Application-wide settings and configuration
              </p>
            </div>
            <AdminSettings
              config={config}
              onReload={fetchConfig}
              onSave={saveConfig}
            />
            <div style={{ marginTop: 32 }}>
              <QueueStats />
            </div>
          </div>
        )}

        {activeTab === 'requests' && (
          <div style={{ padding: 32 }}>
            <div style={{ marginBottom: 24 }}>
              <h2 style={{ fontSize: 24, fontWeight: 600, color: C.text, fontFamily: F.serif, marginBottom: 8 }}>
                Provider requests
              </h2>
              <p style={{ fontSize: 14, color: C.text2 }}>
                Customer requests for new provider integrations
              </p>
            </div>

            {loadingRequests ? (
              <div style={{ color: C.text3 }}>Loading requests...</div>
            ) : providerRequests.length === 0 ? (
              <div style={{ color: C.text3 }}>No requests yet</div>
            ) : (
              <div style={{
                background: C.surface,
                border: `1px solid ${C.border}`,
                overflow: 'hidden',
              }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                      <th style={{ padding: 12, textAlign: 'left', color: C.text2, fontSize: 12, fontWeight: 500 }}>Org ID</th>
                      <th style={{ padding: 12, textAlign: 'left', color: C.text2, fontSize: 12, fontWeight: 500 }}>Provider name</th>
                      <th style={{ padding: 12, textAlign: 'left', color: C.text2, fontSize: 12, fontWeight: 500 }}>Reason</th>
                      <th style={{ padding: 12, textAlign: 'left', color: C.text2, fontSize: 12, fontWeight: 500 }}>Status</th>
                      <th style={{ padding: 12, textAlign: 'left', color: C.text2, fontSize: 12, fontWeight: 500 }}>Requested</th>
                      <th style={{ padding: 12, textAlign: 'left', color: C.text2, fontSize: 12, fontWeight: 500 }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {providerRequests.map((request) => {
                      const getStatusStyle = () => {
                        switch (request.status) {
                          case 'pending':
                            return { bg: C.amber + '30', text: C.amber, border: C.amber };
                          case 'reviewing':
                            return { bg: C.indigo + '30', text: C.indigo, border: C.indigo };
                          case 'shipped':
                            return { bg: '#22c55e30', text: '#22c55e', border: '#22c55e' };
                          case 'declined':
                            return { bg: C.red + '30', text: C.red, border: C.red };
                        }
                      };
                      const statusStyle = getStatusStyle();

                      return (
                        <tr key={request.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                          <td style={{ padding: 12, fontSize: 13, color: C.text, fontFamily: F.mono }}>
                            {request.org_id.slice(0, 12)}...
                          </td>
                          <td style={{ padding: 12, fontSize: 14, color: C.text, fontWeight: 500 }}>
                            {request.provider_name}
                          </td>
                          <td style={{ padding: 12, fontSize: 13, color: C.text2, maxWidth: 300 }}>
                            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {request.reason || '—'}
                            </div>
                          </td>
                          <td style={{ padding: 12 }}>
                            <span style={{
                              display: 'inline-block',
                              padding: '4px 8px',
                              background: statusStyle.bg,
                              border: `1px solid ${statusStyle.border}`,
                              color: statusStyle.text,
                              fontSize: 12,
                              fontWeight: 500,
                            }}>
                              {request.status}
                            </span>
                          </td>
                          <td style={{ padding: 12, fontSize: 13, color: C.text2 }}>
                            {new Date(request.created_at).toLocaleDateString()}
                          </td>
                          <td style={{ padding: 12 }}>
                            <div style={{ display: 'flex', gap: 8 }}>
                              {request.status !== 'reviewing' && (
                                <button
                                  onClick={() => updateRequestStatus(request.id, 'reviewing')}
                                  disabled={updatingRequestId === request.id}
                                  style={{
                                    padding: '6px 12px',
                                    background: C.indigo,
                                    color: '#fff',
                                    border: 'none',
                                    fontSize: 12,
                                    cursor: updatingRequestId === request.id ? 'not-allowed' : 'pointer',
                                    opacity: updatingRequestId === request.id ? 0.6 : 1,
                                  }}
                                >
                                  Review
                                </button>
                              )}
                              {request.status !== 'shipped' && (
                                <button
                                  onClick={() => updateRequestStatus(request.id, 'shipped')}
                                  disabled={updatingRequestId === request.id}
                                  style={{
                                    padding: '6px 12px',
                                    background: '#22c55e',
                                    color: '#fff',
                                    border: 'none',
                                    fontSize: 12,
                                    cursor: updatingRequestId === request.id ? 'not-allowed' : 'pointer',
                                    opacity: updatingRequestId === request.id ? 0.6 : 1,
                                  }}
                                >
                                  Ship
                                </button>
                              )}
                              {request.status !== 'declined' && (
                                <button
                                  onClick={() => updateRequestStatus(request.id, 'declined')}
                                  disabled={updatingRequestId === request.id}
                                  style={{
                                    padding: '6px 12px',
                                    background: C.surface,
                                    border: `1px solid ${C.border}`,
                                    color: C.text,
                                    fontSize: 12,
                                    cursor: updatingRequestId === request.id ? 'not-allowed' : 'pointer',
                                    opacity: updatingRequestId === request.id ? 0.6 : 1,
                                  }}
                                >
                                  Decline
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
      </div>
    </div>
  );
}
