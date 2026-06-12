'use client';

/**
 * Compound Rules Panel
 *
 * Displays and manages compound survivorship rule groups.
 * Groups are evaluated BEFORE individual field rules.
 */

import { useState, useEffect } from 'react';
import { C, F } from '@/lib/design-tokens';
import { Plus, ChevronUp, ChevronDown, X } from 'lucide-react';
import { CompoundRuleWizard } from './CompoundRuleWizard';
import { addToast } from '@/components/ui/toast';

interface Condition {
  id: string;
  group_id: string;
  field_key: string;
  operator: string;
  value?: string | null;
}

interface RuleGroup {
  id: string;
  org_id: string;
  name: string;
  group_priority: number;
  is_active: boolean;
  conditions: Condition[];
}

export function CompoundRulesPanel() {
  const [groups, setGroups] = useState<RuleGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [showWizard, setShowWizard] = useState(false);

  useEffect(() => {
    loadGroups();
  }, []);

  const loadGroups = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/settings/survivorship-rule-groups');
      if (res.ok) {
        const data = await res.json();
        setGroups(data.groups || []);
      }
    } catch (error) {
      console.error('Failed to load groups:', error);
      addToast('error', 'Failed to load compound rules');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveGroup = async (group: { name: string; conditions: any[] }) => {
    try {
      const res = await fetch('/api/settings/survivorship-rule-groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(group),
      });

      if (!res.ok) throw new Error('Failed to create group');

      addToast('success', 'Compound rule created');
      await loadGroups();
    } catch (error) {
      console.error('Failed to create group:', error);
      addToast('error', 'Failed to create compound rule');
      throw error;
    }
  };

  const handleReorder = async (groupId: string, direction: 'up' | 'down') => {
    const currentIndex = groups.findIndex(g => g.id === groupId);
    if (currentIndex === -1) return;
    if (direction === 'up' && currentIndex === 0) return;
    if (direction === 'down' && currentIndex === groups.length - 1) return;

    const swapIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

    try {
      await Promise.all([
        fetch(`/api/settings/survivorship-rule-groups/${groups[currentIndex].id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ group_priority: groups[swapIndex].group_priority }),
        }),
        fetch(`/api/settings/survivorship-rule-groups/${groups[swapIndex].id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ group_priority: groups[currentIndex].group_priority }),
        }),
      ]);

      await loadGroups();
      addToast('success', 'Group order updated');
    } catch (error) {
      console.error('Failed to reorder group:', error);
      addToast('error', 'Failed to reorder group');
    }
  };

  const handleDelete = async (groupId: string) => {
    if (!confirm('Are you sure you want to delete this compound rule?')) {
      return;
    }

    try {
      const res = await fetch(`/api/settings/survivorship-rule-groups/${groupId}`, {
        method: 'DELETE',
      });

      if (!res.ok) throw new Error('Failed to delete group');

      addToast('success', 'Compound rule deleted');
      await loadGroups();
    } catch (error) {
      console.error('Failed to delete group:', error);
      addToast('error', 'Failed to delete compound rule');
    }
  };

  const getOperatorLabel = (operator: string) => {
    const labels: Record<string, string> = {
      gt: '>',
      gte: '>=',
      lt: '<',
      lte: '<=',
      eq: '=',
      neq: '!=',
      is_populated: 'is populated',
      is_empty: 'is empty',
      contains: 'contains',
    };
    return labels[operator] || operator;
  };

  if (loading) {
    return (
      <div style={{ padding: '40px 0', textAlign: 'center', color: C.text3 }}>
        Loading compound rules...
      </div>
    );
  }

  return (
    <div style={{ fontFamily: F.sans, marginBottom: 48 }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{
          fontSize: 18,
          fontWeight: 500,
          color: C.text,
          marginBottom: 8,
          fontFamily: F.sans,
        }}>
          COMPOUND RULES
        </h2>
        <p style={{ fontSize: 13, color: C.text3, lineHeight: 1.6, maxWidth: 800 }}>
          Define multi-condition rules. The first group where all conditions match selects the survivor.
        </p>
      </div>

      {/* Add button */}
      <button
        onClick={() => setShowWizard(true)}
        style={{
          padding: '8px 16px',
          fontSize: 13,
          background: C.indigo,
          color: C.text,
          border: `1px solid ${C.indigo}`,
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          marginBottom: 16,
        }}
      >
        <Plus size={14} /> Add compound rule
      </button>

      {/* Groups */}
      {groups.length === 0 ? (
        <div style={{
          padding: '40px 20px',
          textAlign: 'center',
          border: `1px solid ${C.border}`,
          background: C.surface,
        }}>
          <div style={{ fontSize: 13, color: C.text3, marginBottom: 16 }}>
            No compound rules yet. Compound rules are evaluated before individual field rules.
          </div>
          <button
            onClick={() => setShowWizard(true)}
            style={{
              padding: '8px 16px',
              fontSize: 13,
              background: C.indigo,
              color: C.text,
              border: `1px solid ${C.indigo}`,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Plus size={14} /> Add compound rule
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {groups.map((group, index) => (
            <div key={group.id}>
              <div style={{
                border: `1px solid ${C.border}`,
                background: C.surface,
                padding: '16px 20px',
              }}>
                {/* Group header */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 12,
                }}>
                  <div style={{ fontSize: 14, fontWeight: 500, color: C.text }}>
                    Group {index + 1}: {group.name}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {/* Reorder buttons */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <button
                        onClick={() => handleReorder(group.id, 'up')}
                        disabled={index === 0}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: index === 0 ? 'not-allowed' : 'pointer',
                          color: index === 0 ? C.border : C.text3,
                          padding: 0,
                          opacity: index === 0 ? 0.3 : 1,
                        }}
                      >
                        <ChevronUp size={14} />
                      </button>
                      <button
                        onClick={() => handleReorder(group.id, 'down')}
                        disabled={index === groups.length - 1}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: index === groups.length - 1 ? 'not-allowed' : 'pointer',
                          color: index === groups.length - 1 ? C.border : C.text3,
                          padding: 0,
                          opacity: index === groups.length - 1 ? 0.3 : 1,
                        }}
                      >
                        <ChevronDown size={14} />
                      </button>
                    </div>

                    {/* Delete button */}
                    <button
                      onClick={() => handleDelete(group.id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: C.text3,
                        padding: 4,
                      }}
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>

                {/* Conditions */}
                <div style={{ fontSize: 12, color: C.text3, marginBottom: 8 }}>
                  Survive when ALL of these are true:
                </div>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {group.conditions.map((condition) => (
                    <li key={condition.id} style={{
                      fontSize: 12,
                      color: C.text2,
                      marginBottom: 4,
                      fontFamily: F.mono,
                    }}>
                      {condition.field_key} {getOperatorLabel(condition.operator)}
                      {condition.value && ` ${condition.value}`}
                    </li>
                  ))}
                </ul>
              </div>

              {/* OR divider between groups */}
              {index < groups.length - 1 && (
                <div style={{
                  textAlign: 'center',
                  padding: '8px 0',
                  fontSize: 11,
                  color: C.text3,
                  fontWeight: 600,
                }}>
                  OR
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Wizard */}
      <CompoundRuleWizard
        isOpen={showWizard}
        onClose={() => setShowWizard(false)}
        onSave={handleSaveGroup}
      />
    </div>
  );
}
