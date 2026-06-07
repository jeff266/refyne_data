'use client';

import { useState, useEffect } from 'react';
import { useRole } from '@/hooks/useRole';
import { C, F } from '@/lib/design-tokens';

/**
 * Type definitions for Name Registry data structures
 */

interface QueueItem {
  id: string;
  org_id: string;
  name_type: 'company' | 'person';
  original_value: string;
  normalized_value: string;
  confidence: number;
  metadata: Record<string, any>;
  created_at: string;
}

interface NameRegistryEntry {
  id: string;
  org_id: string | null;
  name_type: 'company' | 'person';
  scope: 'org' | 'global';
  original_value: string;
  canonical_value: string;
  created_at: string;
  updated_at: string;
}

/**
 * Main component for managing name registry entries
 *
 * Three sections:
 * A. Pending Review Queue - Shows items needing admin approval (only if has items)
 * B. Workspace Registry - Org-specific name mappings with CRUD operations
 * C. Global Registry - Read-only global entries with override option
 */
export function NameRegistryTab() {
  const { isAdmin } = useRole();

  // State for all three sections
  const [queueItems, setQueueItems] = useState<QueueItem[]>([]);
  const [orgEntries, setOrgEntries] = useState<NameRegistryEntry[]>([]);
  const [globalEntries, setGlobalEntries] = useState<NameRegistryEntry[]>([]);

  // Loading states
  const [loadingQueue, setLoadingQueue] = useState(true);
  const [loadingOrg, setLoadingOrg] = useState(true);
  const [loadingGlobal, setLoadingGlobal] = useState(true);

  // Error states
  const [error, setError] = useState<string | null>(null);

  // Only render if admin
  if (!isAdmin) {
    return (
      <div style={{ padding: 32 }}>
        <div style={{
          background: C.surface,
          border: `1px solid ${C.border}`,
          padding: 20,
        }}>
          <p style={{ fontSize: 13, color: C.text3 }}>
            Only administrators can manage name registry settings.
          </p>
        </div>
      </div>
    );
  }

  // Fetch data on mount
  useEffect(() => {
    fetchQueueItems();
    fetchOrgEntries();
    fetchGlobalEntries();
  }, []);

  async function fetchQueueItems() {
    try {
      setLoadingQueue(true);
      const res = await fetch('/api/name-registry/queue');
      if (res.ok) {
        const data = await res.json();
        setQueueItems(data.items || []);
      } else {
        console.error('Failed to fetch queue items');
      }
    } catch (err) {
      console.error('Error fetching queue items:', err);
      setError('Failed to load pending reviews');
    } finally {
      setLoadingQueue(false);
    }
  }

  async function fetchOrgEntries() {
    try {
      setLoadingOrg(true);
      const res = await fetch('/api/name-registry?type=company&scope=org');
      if (res.ok) {
        const data = await res.json();
        setOrgEntries(data.entries || []);
      } else {
        console.error('Failed to fetch org entries');
      }
    } catch (err) {
      console.error('Error fetching org entries:', err);
      setError('Failed to load workspace registry');
    } finally {
      setLoadingOrg(false);
    }
  }

  async function fetchGlobalEntries() {
    try {
      setLoadingGlobal(true);
      const res = await fetch('/api/name-registry?type=company&scope=global');
      if (res.ok) {
        const data = await res.json();
        setGlobalEntries(data.entries || []);
      } else {
        console.error('Failed to fetch global entries');
      }
    } catch (err) {
      console.error('Error fetching global entries:', err);
      setError('Failed to load global registry');
    } finally {
      setLoadingGlobal(false);
    }
  }

  const isLoading = loadingQueue || loadingOrg || loadingGlobal;

  if (isLoading) {
    return (
      <div style={{ padding: 32, color: C.text3, fontSize: 13 }}>
        Loading name registry...
      </div>
    );
  }

  return (
    <div style={{ padding: 32, maxWidth: 1200 }}>
      {/* Error banner */}
      {error && (
        <div style={{
          background: C.redDim,
          border: `1px solid ${C.redBrd}`,
          padding: 16,
          marginBottom: 24,
        }}>
          <p style={{ fontSize: 13, color: C.red, margin: 0 }}>
            {error}
          </p>
        </div>
      )}

      {/* Section A: Pending Review Queue (only if has items) */}
      {queueItems.length > 0 && (
        <PendingReviewSection
          items={queueItems}
          onRefresh={fetchQueueItems}
        />
      )}

      {/* Section B: Workspace Registry */}
      <WorkspaceRegistrySection
        entries={orgEntries}
        onRefresh={fetchOrgEntries}
      />

      {/* Section C: Global Registry (read-only) */}
      <GlobalRegistrySection
        entries={globalEntries}
        onRefresh={fetchGlobalEntries}
      />
    </div>
  );
}

/**
 * Section A: Pending Review Queue
 * Shows queue items with approve/edit/reject actions
 */
interface PendingReviewSectionProps {
  items: QueueItem[];
  onRefresh: () => void;
}

function PendingReviewSection({ items, onRefresh }: PendingReviewSectionProps) {
  return (
    <div style={{ marginBottom: 40 }}>
      <h2 style={{
        fontSize: 18,
        fontFamily: "'Lora', serif",
        color: C.text,
        marginBottom: 8,
      }}>
        Pending Review
      </h2>
      <p style={{
        fontSize: 13,
        color: C.text3,
        marginBottom: 20,
        fontFamily: F.sans,
      }}>
        Review and approve name normalization suggestions before they are added to your workspace registry.
      </p>

      <div style={{
        background: C.surface,
        border: `1px solid ${C.border}`,
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${C.border}` }}>
              <th style={{
                padding: 12,
                textAlign: 'left',
                fontSize: 12,
                fontWeight: 600,
                color: C.text3,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                fontFamily: F.sans,
              }}>
                Original
              </th>
              <th style={{
                padding: 12,
                textAlign: 'left',
                fontSize: 12,
                fontWeight: 600,
                color: C.text3,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                fontFamily: F.sans,
              }}>
                Normalized
              </th>
              <th style={{
                padding: 12,
                textAlign: 'left',
                fontSize: 12,
                fontWeight: 600,
                color: C.text3,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                fontFamily: F.sans,
              }}>
                Confidence
              </th>
              <th style={{
                padding: 12,
                textAlign: 'right',
                fontSize: 12,
                fontWeight: 600,
                color: C.text3,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                fontFamily: F.sans,
              }}>
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                <td style={{ padding: 12, fontSize: 13, color: C.text, fontFamily: F.sans }}>
                  {item.original_value}
                </td>
                <td style={{ padding: 12, fontSize: 13, color: C.text, fontFamily: F.sans }}>
                  {item.normalized_value}
                </td>
                <td style={{ padding: 12, fontSize: 13, color: C.text2, fontFamily: F.mono }}>
                  {Math.round(item.confidence * 100)}%
                </td>
                <td style={{ padding: 12, textAlign: 'right' }}>
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button style={{
                      padding: '6px 12px',
                      fontSize: 12,
                      background: 'transparent',
                      border: `1px solid ${C.border2}`,
                      color: C.text3,
                      cursor: 'pointer',
                      fontFamily: F.sans,
                    }}>
                      Edit
                    </button>
                    <button style={{
                      padding: '6px 12px',
                      fontSize: 12,
                      background: 'transparent',
                      border: `1px solid ${C.redBrd}`,
                      color: C.red,
                      cursor: 'pointer',
                      fontFamily: F.sans,
                    }}>
                      Reject
                    </button>
                    <button style={{
                      padding: '6px 12px',
                      fontSize: 12,
                      background: C.indigo,
                      border: 'none',
                      color: '#fff',
                      cursor: 'pointer',
                      fontFamily: F.sans,
                    }}>
                      Approve
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * Section B: Workspace Registry
 * CRUD for org entries with search, add, edit, delete
 */
interface WorkspaceRegistrySectionProps {
  entries: NameRegistryEntry[];
  onRefresh: () => void;
}

function WorkspaceRegistrySection({ entries, onRefresh }: WorkspaceRegistrySectionProps) {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredEntries = entries.filter(entry =>
    entry.original_value.toLowerCase().includes(searchTerm.toLowerCase()) ||
    entry.canonical_value.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div style={{ marginBottom: 40 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <h2 style={{
          fontSize: 18,
          fontFamily: "'Lora', serif",
          color: C.text,
          margin: 0,
        }}>
          Workspace Registry
        </h2>
        <button style={{
          padding: '8px 16px',
          fontSize: 13,
          background: C.indigo,
          border: 'none',
          color: '#fff',
          cursor: 'pointer',
          fontFamily: F.sans,
        }}>
          Add entry
        </button>
      </div>
      <p style={{
        fontSize: 13,
        color: C.text3,
        marginBottom: 20,
        fontFamily: F.sans,
      }}>
        Custom name mappings specific to your workspace. These override global registry entries.
      </p>

      {/* Search bar */}
      <div style={{ marginBottom: 16 }}>
        <input
          type="text"
          placeholder="Search entries..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            width: '100%',
            padding: '10px 12px',
            background: C.surface,
            border: `1px solid ${C.border2}`,
            color: C.text,
            fontSize: 13,
            fontFamily: F.sans,
          }}
        />
      </div>

      {/* Table */}
      <div style={{
        background: C.surface,
        border: `1px solid ${C.border}`,
      }}>
        {filteredEntries.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center' }}>
            <p style={{ fontSize: 13, color: C.text3, margin: 0, fontFamily: F.sans }}>
              {searchTerm ? 'No entries match your search.' : 'No workspace entries yet. Add your first entry to get started.'}
            </p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                <th style={{
                  padding: 12,
                  textAlign: 'left',
                  fontSize: 12,
                  fontWeight: 600,
                  color: C.text3,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  fontFamily: F.sans,
                }}>
                  Original
                </th>
                <th style={{
                  padding: 12,
                  textAlign: 'left',
                  fontSize: 12,
                  fontWeight: 600,
                  color: C.text3,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  fontFamily: F.sans,
                }}>
                  Canonical
                </th>
                <th style={{
                  padding: 12,
                  textAlign: 'left',
                  fontSize: 12,
                  fontWeight: 600,
                  color: C.text3,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  fontFamily: F.sans,
                }}>
                  Updated
                </th>
                <th style={{
                  padding: 12,
                  textAlign: 'right',
                  fontSize: 12,
                  fontWeight: 600,
                  color: C.text3,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  fontFamily: F.sans,
                }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredEntries.map((entry) => (
                <tr key={entry.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                  <td style={{ padding: 12, fontSize: 13, color: C.text, fontFamily: F.sans }}>
                    {entry.original_value}
                  </td>
                  <td style={{ padding: 12, fontSize: 13, color: C.text, fontFamily: F.sans }}>
                    {entry.canonical_value}
                  </td>
                  <td style={{ padding: 12, fontSize: 13, color: C.text3, fontFamily: F.sans }}>
                    {new Date(entry.updated_at).toLocaleDateString()}
                  </td>
                  <td style={{ padding: 12, textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                      <button style={{
                        padding: '6px 12px',
                        fontSize: 12,
                        background: 'transparent',
                        border: `1px solid ${C.border2}`,
                        color: C.text3,
                        cursor: 'pointer',
                        fontFamily: F.sans,
                      }}>
                        Edit
                      </button>
                      <button style={{
                        padding: '6px 12px',
                        fontSize: 12,
                        background: 'transparent',
                        border: `1px solid ${C.redBrd}`,
                        color: C.red,
                        cursor: 'pointer',
                        fontFamily: F.sans,
                      }}>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

/**
 * Section C: Global Registry
 * Read-only global entries with search and override option
 */
interface GlobalRegistrySectionProps {
  entries: NameRegistryEntry[];
  onRefresh: () => void;
}

function GlobalRegistrySection({ entries, onRefresh }: GlobalRegistrySectionProps) {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredEntries = entries.filter(entry =>
    entry.original_value.toLowerCase().includes(searchTerm.toLowerCase()) ||
    entry.canonical_value.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div style={{ marginBottom: 40 }}>
      <h2 style={{
        fontSize: 18,
        fontFamily: "'Lora', serif",
        color: C.text,
        marginBottom: 8,
      }}>
        Global Registry
      </h2>
      <p style={{
        fontSize: 13,
        color: C.text3,
        marginBottom: 20,
        fontFamily: F.sans,
      }}>
        Standard name mappings available to all workspaces. You can override these in your workspace registry.
      </p>

      {/* Search bar */}
      <div style={{ marginBottom: 16 }}>
        <input
          type="text"
          placeholder="Search global entries..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            width: '100%',
            padding: '10px 12px',
            background: C.surface,
            border: `1px solid ${C.border2}`,
            color: C.text,
            fontSize: 13,
            fontFamily: F.sans,
          }}
        />
      </div>

      {/* Table */}
      <div style={{
        background: C.surface,
        border: `1px solid ${C.border}`,
      }}>
        {filteredEntries.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center' }}>
            <p style={{ fontSize: 13, color: C.text3, margin: 0, fontFamily: F.sans }}>
              {searchTerm ? 'No global entries match your search.' : 'No global entries available.'}
            </p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                <th style={{
                  padding: 12,
                  textAlign: 'left',
                  fontSize: 12,
                  fontWeight: 600,
                  color: C.text3,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  fontFamily: F.sans,
                }}>
                  Original
                </th>
                <th style={{
                  padding: 12,
                  textAlign: 'left',
                  fontSize: 12,
                  fontWeight: 600,
                  color: C.text3,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  fontFamily: F.sans,
                }}>
                  Canonical
                </th>
                <th style={{
                  padding: 12,
                  textAlign: 'right',
                  fontSize: 12,
                  fontWeight: 600,
                  color: C.text3,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  fontFamily: F.sans,
                }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredEntries.map((entry) => (
                <tr key={entry.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                  <td style={{ padding: 12, fontSize: 13, color: C.text, fontFamily: F.sans }}>
                    {entry.original_value}
                  </td>
                  <td style={{ padding: 12, fontSize: 13, color: C.text, fontFamily: F.sans }}>
                    {entry.canonical_value}
                  </td>
                  <td style={{ padding: 12, textAlign: 'right' }}>
                    <button style={{
                      padding: '6px 12px',
                      fontSize: 12,
                      background: 'transparent',
                      border: `1px solid ${C.border2}`,
                      color: C.text3,
                      cursor: 'pointer',
                      fontFamily: F.sans,
                    }}>
                      Override in workspace
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
