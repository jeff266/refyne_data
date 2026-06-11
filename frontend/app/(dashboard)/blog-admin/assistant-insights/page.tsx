'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/refyne';
import { C, F } from '@/lib/design-tokens';
import { Check, X } from 'lucide-react';
import { supabaseAdmin } from '@/lib/db/supabase';

interface Pattern {
  id: string;
  question_normalized: string;
  count: number;
  example_question: string;
  last_asked_at: string;
  is_suggested: boolean;
  suggested_prompt_text: string | null;
  suggested_prompt_icon: string | null;
}

export default function AssistantInsightsPage() {
  const [patterns, setPatterns] = useState<Pattern[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Record<string, Partial<Pattern>>>({});

  useEffect(() => {
    fetchPatterns();
  }, []);

  const fetchPatterns = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabaseAdmin
        .from('assistant_question_patterns')
        .select('*')
        .order('count', { ascending: false });

      if (error) throw error;
      setPatterns(data || []);
    } catch (error) {
      console.error('Failed to fetch patterns:', error);
    } finally {
      setLoading(false);
    }
  };

  const updatePattern = async (id: string) => {
    const updates = editing[id];
    if (!updates) return;

    try {
      const res = await fetch(`/api/admin/assistant-patterns/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      if (!res.ok) throw new Error('Update failed');

      await fetchPatterns();
      setEditing((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    } catch (error) {
      console.error('Failed to update pattern:', error);
    }
  };

  const handleEdit = (id: string, field: keyof Pattern, value: any) => {
    setEditing((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: value },
    }));
  };

  return (
    <div style={{ padding: 32, fontFamily: F.sans }}>
      <h1 style={{ fontSize: 24, fontWeight: 600, color: C.text, marginBottom: 24 }}>
        Assistant Insights
      </h1>

      <Card>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${C.border}` }}>
              <th style={{ padding: 12, textAlign: 'left', fontSize: 12, color: C.text2 }}>Normalized</th>
              <th style={{ padding: 12, textAlign: 'left', fontSize: 12, color: C.text2 }}>Count</th>
              <th style={{ padding: 12, textAlign: 'left', fontSize: 12, color: C.text2 }}>Example</th>
              <th style={{ padding: 12, textAlign: 'left', fontSize: 12, color: C.text2 }}>Last Asked</th>
              <th style={{ padding: 12, textAlign: 'left', fontSize: 12, color: C.text2 }}>Suggested</th>
              <th style={{ padding: 12, textAlign: 'left', fontSize: 12, color: C.text2 }}>Prompt Text</th>
              <th style={{ padding: 12, textAlign: 'left', fontSize: 12, color: C.text2 }}>Icon</th>
              <th style={{ padding: 12, textAlign: 'left', fontSize: 12, color: C.text2 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {patterns.map((pattern) => (
              <tr key={pattern.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                <td style={{ padding: 12, fontSize: 13, color: C.text }}>{pattern.question_normalized}</td>
                <td style={{ padding: 12, fontSize: 13, color: C.text }}>{pattern.count}</td>
                <td style={{ padding: 12, fontSize: 13, color: C.text2 }}>{pattern.example_question}</td>
                <td style={{ padding: 12, fontSize: 13, color: C.text3 }}>
                  {new Date(pattern.last_asked_at).toLocaleDateString()}
                </td>
                <td style={{ padding: 12 }}>
                  <input
                    type="checkbox"
                    checked={editing[pattern.id]?.is_suggested ?? pattern.is_suggested}
                    onChange={(e) => handleEdit(pattern.id, 'is_suggested', e.target.checked)}
                  />
                </td>
                <td style={{ padding: 12 }}>
                  <input
                    type="text"
                    value={editing[pattern.id]?.suggested_prompt_text ?? pattern.suggested_prompt_text ?? ''}
                    onChange={(e) => handleEdit(pattern.id, 'suggested_prompt_text', e.target.value)}
                    style={{
                      width: '100%',
                      padding: 6,
                      background: C.surface,
                      border: `1px solid ${C.border}`,
                      color: C.text,
                      fontSize: 13,
                    }}
                  />
                </td>
                <td style={{ padding: 12 }}>
                  <input
                    type="text"
                    value={editing[pattern.id]?.suggested_prompt_icon ?? pattern.suggested_prompt_icon ?? ''}
                    onChange={(e) => handleEdit(pattern.id, 'suggested_prompt_icon', e.target.value)}
                    style={{
                      width: '100%',
                      padding: 6,
                      background: C.surface,
                      border: `1px solid ${C.border}`,
                      color: C.text,
                      fontSize: 13,
                    }}
                  />
                </td>
                <td style={{ padding: 12 }}>
                  {editing[pattern.id] && (
                    <button
                      onClick={() => updatePattern(pattern.id)}
                      style={{
                        padding: '4px 12px',
                        background: C.indigo,
                        color: C.text,
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: 12,
                      }}
                    >
                      Save
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
