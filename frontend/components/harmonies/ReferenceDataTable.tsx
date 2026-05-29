'use client';

import { useState, useEffect } from 'react';
import { C, F } from '@/lib/design-tokens';
import { PrimaryBtn, GhostBtn, Toggle } from '@/components/refyne';
import { Plus, Download, Upload, Trash2 } from 'lucide-react';

interface ReferenceDataRow {
  id: string;
  input_value: string;
  canonical_value: string;
  language: string;
  source: 'refyne' | 'user';
  fuzzy_eligible: boolean;
  is_active: boolean;
}

interface UnmatchedValue {
  value: string;
  count: number;
}

interface ReferenceDataTableProps {
  harmonyId: string;
  tableName: string;
}

export function ReferenceDataTable({ harmonyId, tableName }: ReferenceDataTableProps) {
  const [rows, setRows] = useState<ReferenceDataRow[]>([]);
  const [unmatchedValues, setUnmatchedValues] = useState<UnmatchedValue[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(0);
  const [editingRow, setEditingRow] = useState<string | null>(null);
  const [newRow, setNewRow] = useState<Partial<ReferenceDataRow> | null>(null);

  const PAGE_SIZE = 50;

  useEffect(() => {
    fetchData();
    fetchUnmatchedValues();
  }, [harmonyId, tableName]);

  async function fetchData() {
    try {
      setLoading(true);
      const res = await fetch(`/api/harmonies/${harmonyId}/reference-data?tableName=${tableName}`);
      if (res.ok) {
        const data = await res.json();
        setRows(data.rows || []);
      }
    } catch (err) {
      console.error('Failed to fetch reference data:', err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchUnmatchedValues() {
    try {
      const res = await fetch(`/api/harmonies/${harmonyId}/unmatched-values?tableName=${tableName}`);
      if (res.ok) {
        const data = await res.json();
        setUnmatchedValues(data.values || []);
      }
    } catch (err) {
      console.error('Failed to fetch unmatched values:', err);
    }
  }

  async function handleSaveRow(row: ReferenceDataRow) {
    try {
      const res = await fetch(`/api/harmonies/${harmonyId}/reference-data/${row.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(row),
      });

      if (res.ok) {
        await fetchData();
        setEditingRow(null);
      }
    } catch (err) {
      console.error('Failed to save row:', err);
    }
  }

  async function handleDeleteRow(rowId: string) {
    if (!confirm('Delete this mapping?')) return;

    try {
      const res = await fetch(`/api/harmonies/${harmonyId}/reference-data/${rowId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        await fetchData();
      }
    } catch (err) {
      console.error('Failed to delete row:', err);
    }
  }

  async function handleToggleActive(rowId: string, isActive: boolean) {
    try {
      const res = await fetch(`/api/harmonies/${harmonyId}/reference-data/${rowId}/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: isActive }),
      });

      if (res.ok) {
        await fetchData();
      }
    } catch (err) {
      console.error('Failed to toggle active:', err);
    }
  }

  async function handleAddMapping(inputValue?: string, canonicalValue?: string) {
    setNewRow({
      input_value: inputValue || '',
      canonical_value: canonicalValue || '',
      language: 'universal',
      source: 'user',
      fuzzy_eligible: true,
      is_active: true,
    });
  }

  async function handleSaveNewRow() {
    if (!newRow || !newRow.input_value || !newRow.canonical_value) {
      alert('Input value and canonical value are required');
      return;
    }

    try {
      const res = await fetch(`/api/harmonies/${harmonyId}/reference-data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newRow,
          table_name: tableName,
          // org_id will be added by backend from Clerk context
        }),
      });

      if (res.ok) {
        await fetchData();
        await fetchUnmatchedValues();
        setNewRow(null);
      }
    } catch (err) {
      console.error('Failed to create row:', err);
    }
  }

  function handleDownloadCSV() {
    const csvContent = [
      ['Input Value', 'Canonical Value', 'Language', 'Source', 'Fuzzy Eligible', 'Active'].join(','),
      ...rows.map((row) =>
        [
          `"${row.input_value}"`,
          `"${row.canonical_value}"`,
          row.language,
          row.source,
          row.fuzzy_eligible,
          row.is_active,
        ].join(',')
      ),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${tableName}-reference-data.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleUploadCSV() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const formData = new FormData();
      formData.append('file', file);
      formData.append('tableName', tableName);

      try {
        const res = await fetch(`/api/harmonies/${harmonyId}/reference-data/upload`, {
          method: 'POST',
          body: formData,
        });

        if (res.ok) {
          await fetchData();
          alert('CSV uploaded successfully');
        }
      } catch (err) {
        console.error('Failed to upload CSV:', err);
        alert('Failed to upload CSV');
      }
    };
    input.click();
  }

  const filteredRows = rows.filter((row) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      row.input_value.toLowerCase().includes(q) ||
      row.canonical_value.toLowerCase().includes(q)
    );
  });

  const paginatedRows = filteredRows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(filteredRows.length / PAGE_SIZE);

  if (loading) {
    return <div style={{ padding: 20, color: C.text3 }}>Loading reference data...</div>;
  }

  return (
    <div style={{ padding: '16px 20px', background: C.surface, borderTop: `1px solid ${C.border}` }}>
      {/* Actions Bar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center' }}>
        <input
          type="text"
          placeholder="Search mappings..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            flex: 1,
            padding: '8px 12px',
            fontSize: 13,
            background: C.bg,
            border: `1px solid ${C.border}`,
            borderRadius: 6,
            color: C.text,
          }}
        />
        <GhostBtn onClick={() => handleAddMapping()}>
          <Plus size={12} /> Add mapping
        </GhostBtn>
        <GhostBtn onClick={handleDownloadCSV}>
          <Download size={12} /> Download CSV
        </GhostBtn>
        <GhostBtn onClick={handleUploadCSV}>
          <Upload size={12} /> Upload CSV
        </GhostBtn>
      </div>

      {/* New Row Form */}
      {newRow && (
        <div
          style={{
            padding: 12,
            background: C.indigoDim,
            border: `1px solid ${C.indigoBrd}`,
            borderRadius: 6,
            marginBottom: 12,
          }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 120px 120px auto', gap: 8, alignItems: 'end' }}>
            <div>
              <label style={{ fontSize: 11, color: C.text3, marginBottom: 4, display: 'block' }}>Input Value</label>
              <input
                type="text"
                value={newRow.input_value || ''}
                onChange={(e) => setNewRow({ ...newRow, input_value: e.target.value })}
                style={{
                  width: '100%',
                  padding: '6px 8px',
                  fontSize: 13,
                  background: C.bg,
                  border: `1px solid ${C.border}`,
                  borderRadius: 4,
                  color: C.text,
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: 11, color: C.text3, marginBottom: 4, display: 'block' }}>Canonical Value</label>
              <input
                type="text"
                value={newRow.canonical_value || ''}
                onChange={(e) => setNewRow({ ...newRow, canonical_value: e.target.value })}
                style={{
                  width: '100%',
                  padding: '6px 8px',
                  fontSize: 13,
                  background: C.bg,
                  border: `1px solid ${C.border}`,
                  borderRadius: 4,
                  color: C.text,
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: 11, color: C.text3, marginBottom: 4, display: 'block' }}>Language</label>
              <input
                type="text"
                value={newRow.language || 'universal'}
                onChange={(e) => setNewRow({ ...newRow, language: e.target.value })}
                style={{
                  width: '100%',
                  padding: '6px 8px',
                  fontSize: 13,
                  background: C.bg,
                  border: `1px solid ${C.border}`,
                  borderRadius: 4,
                  color: C.text,
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: 11, color: C.text3, marginBottom: 4, display: 'block' }}>Fuzzy</label>
              <Toggle
                on={newRow.fuzzy_eligible ?? true}
                onToggle={() => setNewRow({ ...newRow, fuzzy_eligible: !(newRow.fuzzy_eligible ?? true) })}
              />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={handleSaveNewRow}
                style={{
                  padding: '6px 12px',
                  fontSize: 12,
                  background: C.indigo,
                  color: 'white',
                  border: 'none',
                  borderRadius: 4,
                  cursor: 'pointer',
                }}
              >
                Save
              </button>
              <button
                onClick={() => setNewRow(null)}
                style={{
                  padding: '6px 12px',
                  fontSize: 12,
                  background: 'transparent',
                  color: C.text2,
                  border: `1px solid ${C.border}`,
                  borderRadius: 4,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div style={{ border: `1px solid ${C.border}`, borderRadius: 6, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: C.bg, borderBottom: `1px solid ${C.border}` }}>
              <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: C.text3 }}>
                Input Value
              </th>
              <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: C.text3 }}>
                Canonical Value
              </th>
              <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: C.text3 }}>
                Language
              </th>
              <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: C.text3 }}>
                Source
              </th>
              <th style={{ padding: '10px 12px', textAlign: 'center', fontSize: 11, fontWeight: 600, color: C.text3 }}>
                Fuzzy
              </th>
              <th style={{ padding: '10px 12px', textAlign: 'center', fontSize: 11, fontWeight: 600, color: C.text3 }}>
                Active
              </th>
              <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: 11, fontWeight: 600, color: C.text3 }}>
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {paginatedRows.map((row) => (
              <tr key={row.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                <td style={{ padding: '10px 12px', fontSize: 13, fontFamily: F.mono, color: C.text }}>
                  {row.input_value}
                </td>
                <td style={{ padding: '10px 12px', fontSize: 13, fontFamily: F.mono, color: C.text }}>
                  {row.canonical_value}
                </td>
                <td style={{ padding: '10px 12px', fontSize: 12, color: C.text2 }}>{row.language}</td>
                <td style={{ padding: '10px 12px', fontSize: 12 }}>
                  <span
                    style={{
                      padding: '2px 6px',
                      background: row.source === 'refyne' ? C.indigoDim : C.greenDim,
                      color: row.source === 'refyne' ? C.indigo : C.green,
                      borderRadius: 3,
                      fontSize: 11,
                    }}
                  >
                    {row.source === 'refyne' ? 'Refyne' : 'You'}
                  </span>
                </td>
                <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                  <Toggle on={row.fuzzy_eligible} onToggle={() => {}} disabled={row.source === 'refyne'} />
                </td>
                <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                  <Toggle on={row.is_active} onToggle={() => handleToggleActive(row.id, !row.is_active)} />
                </td>
                <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                  {row.source === 'user' && (
                    <button
                      onClick={() => handleDeleteRow(row.id)}
                      style={{
                        padding: '4px 8px',
                        fontSize: 11,
                        background: 'transparent',
                        color: C.red,
                        border: `1px solid ${C.redBrd}`,
                        borderRadius: 4,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <Trash2 size={12} /> Delete
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
          <div style={{ fontSize: 12, color: C.text3 }}>
            Showing {page * PAGE_SIZE + 1}-{Math.min((page + 1) * PAGE_SIZE, filteredRows.length)} of {filteredRows.length}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => setPage(page - 1)}
              disabled={page === 0}
              style={{
                padding: '6px 12px',
                fontSize: 12,
                background: page === 0 ? C.surface : C.bg,
                color: page === 0 ? C.text3 : C.text,
                border: `1px solid ${C.border}`,
                borderRadius: 4,
                cursor: page === 0 ? 'not-allowed' : 'pointer',
              }}
            >
              Previous
            </button>
            <button
              onClick={() => setPage(page + 1)}
              disabled={page === totalPages - 1}
              style={{
                padding: '6px 12px',
                fontSize: 12,
                background: page === totalPages - 1 ? C.surface : C.bg,
                color: page === totalPages - 1 ? C.text3 : C.text,
                border: `1px solid ${C.border}`,
                borderRadius: 4,
                cursor: page === totalPages - 1 ? 'not-allowed' : 'pointer',
              }}
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Unmatched Values Section */}
      {unmatchedValues.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: C.text2, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Unmatched Values from Last Scan
          </div>
          <div style={{ fontSize: 11, color: C.text3, marginBottom: 12 }}>
            These values appeared in your HubSpot data but didn't match any rule. Add them to fix your score.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {unmatchedValues.slice(0, 10).map((uv, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  background: C.bg,
                  border: `1px solid ${C.border}`,
                  borderRadius: 4,
                }}
              >
                <div>
                  <span style={{ fontSize: 13, fontFamily: F.mono, color: C.text }}>{uv.value}</span>
                  <span style={{ fontSize: 11, color: C.text3, marginLeft: 12 }}>{uv.count} records</span>
                </div>
                <button
                  onClick={() => handleAddMapping(uv.value)}
                  style={{
                    padding: '4px 10px',
                    fontSize: 11,
                    background: C.indigo,
                    color: 'white',
                    border: 'none',
                    borderRadius: 4,
                    cursor: 'pointer',
                  }}
                >
                  Add mapping →
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
