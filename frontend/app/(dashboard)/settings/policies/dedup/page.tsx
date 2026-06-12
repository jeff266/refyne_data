'use client';

// Cache bust v4: June 12 2026 18:15 - comprehensive ?? [] pattern on ALL .map() calls
/**
 * Unified Dedup Configuration
 *
 * Consolidates all dedup configuration into one guided 6-step flow:
 * 1. MATCHING - How Refyne identifies duplicates (signal groups)
 * 2. AUTO-MERGE - When to merge automatically (threshold)
 * 3. WHICH RECORD SURVIVES - Compound rules + field rules
 * 4. PROTECTED FIELDS - Compliance, never merge, append
 * 5. HIERARCHY & OWNERS - Parent/child, closed-won, inactive owner
 * 6. BLOCKED MERGES - Block conditions + excluded domains
 */

import { useState, useEffect } from 'react';
import { C, F } from '@/lib/design-tokens';
import { addToast } from '@/components/ui/toast';
import { Plus, ArrowUp, ArrowDown, X, Lock } from 'lucide-react';
import { useRole } from '@/hooks/useRole';
import { AdminOnlyNotice } from '@/components/auth/AdminOnlyNotice';
import { CompoundRuleWizard } from '../components/CompoundRuleWizard';
import {
  COMPANY_FIELDS,
  CONTACT_FIELDS,
  MATCH_TYPES,
  ACCURACY_LEVELS,
  TEMPLATES,
} from '@/lib/dedup/signal-groups-ui';
import {
  COMPANY_COMMON_FIELDS,
  CONTACT_COMMON_FIELDS,
  EXCLUSION_TYPES,
  SEPARATOR_OPTIONS,
  COMPLIANCE_FIELDS,
  isComplianceField,
} from '@/lib/dedup/field-exclusions-ui';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

interface SignalGroup {
  id: string;
  name: string;
  object_type: 'company' | 'contact';
  group_order: number;
  conditions: SignalCondition[];
}

interface SignalCondition {
  field: string;
  match_type: string;
  fuzzy_threshold: number;
  weight: number;
}

interface CompoundRuleGroup {
  id: string;
  org_id: string;
  object_type: string;
  name: string;
  group_priority: number;
  is_active: boolean;
  conditions: CompoundCondition[];
}

interface CompoundCondition {
  id: string;
  group_id: string;
  field_key: string;
  operator: string;
  comparison_value?: string | null;
}

interface SurvivorshipRule {
  id: string;
  org_id: string | null;
  field_key: string;
  object_type: string;
  rule_type: string;
  priority: number;
  is_active: boolean;
  rule_config: Record<string, any>;
}

interface FieldExclusion {
  id: string;
  org_id: string;
  object_type: string;
  field_name: string;
  exclusion_type: string;
  separator?: string;
}

interface DedupConfig {
  inactive_owner_action: string;
  inactive_owner_fallback_id: string | null;
  parent_child_awareness: boolean;
  require_closed_won_survivor: boolean;
}

interface DedupPolicy {
  block_if_different_parent: boolean;
  block_if_closed_won_deals: boolean;
}

interface OrgPolicies {
  dedup_auto_merge_threshold: number | null;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function UnifiedDedupConfigPage() {
  const { isAdmin } = useRole();

  // ──────────────────────────────────────────────────────────────────────
  // STATE - Loading & Saving
  // ──────────────────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // ──────────────────────────────────────────────────────────────────────
  // STATE - Step 1: Matching (Signal Groups)
  // ──────────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<'company' | 'contact'>('company');
  const [signalGroups, setSignalGroups] = useState<SignalGroup[]>([]);
  const [editingGroups, setEditingGroups] = useState<SignalGroup[]>([]);
  const [groupErrors, setGroupErrors] = useState<Record<number, string>>({});

  // ──────────────────────────────────────────────────────────────────────
  // STATE - Step 2: Auto-merge
  // ──────────────────────────────────────────────────────────────────────
  const [autoMergeThreshold, setAutoMergeThreshold] = useState<number | null>(null);

  // ──────────────────────────────────────────────────────────────────────
  // STATE - Step 3a: Compound Rules
  // ──────────────────────────────────────────────────────────────────────
  const [compoundGroups, setCompoundGroups] = useState<CompoundRuleGroup[]>([]);
  const [showCompoundWizard, setShowCompoundWizard] = useState(false);

  // ──────────────────────────────────────────────────────────────────────
  // STATE - Step 3b: Field Rules (Survivorship)
  // ──────────────────────────────────────────────────────────────────────
  const [defaultRules, setDefaultRules] = useState<SurvivorshipRule[]>([]);
  const [orgRules, setOrgRules] = useState<SurvivorshipRule[]>([]);

  // ──────────────────────────────────────────────────────────────────────
  // STATE - Step 4: Protected Fields
  // ──────────────────────────────────────────────────────────────────────
  const [fieldExclusions, setFieldExclusions] = useState<FieldExclusion[]>([]);
  const [complianceFields, setComplianceFields] = useState<string[]>([
    'hs_email_optout',
    'hs_email_bounce',
    'hs_email_hardbounce_reason',
    'hs_legal_basis',
  ]);
  const [newComplianceField, setNewComplianceField] = useState('');
  const [hubspotFieldOptions, setHubspotFieldOptions] = useState<Array<{ key: string; label: string; type: string }>>([]);

  // ──────────────────────────────────────────────────────────────────────
  // STATE - Step 5: Hierarchy & Owners
  // ──────────────────────────────────────────────────────────────────────
  const [parentChildAwareness, setParentChildAwareness] = useState(false);
  const [requireClosedWonSurvivor, setRequireClosedWonSurvivor] = useState(false);
  const [inactiveOwnerAction, setInactiveOwnerAction] = useState('warn');
  const [inactiveOwnerFallbackId, setInactiveOwnerFallbackId] = useState('');

  // ──────────────────────────────────────────────────────────────────────
  // STATE - Step 6: Blocked Merges
  // ──────────────────────────────────────────────────────────────────────
  const [blockDifferentParent, setBlockDifferentParent] = useState(false);
  const [blockClosedWonDeals, setBlockClosedWonDeals] = useState(false);

  // ============================================================================
  // DATA LOADING - Fetch all config in parallel
  // ============================================================================

  useEffect(() => {
    loadAllConfig();
  }, []);

  async function loadAllConfig() {
    setLoading(true);
    try {
      await Promise.all([
        loadOrgPolicies(),
        loadDedupConfig(),
        loadSignalGroups(),
        loadCompoundGroups(),
        loadSurvivorshipRules(),
        loadFieldExclusions(),
        loadDedupPolicies(),
      ]);
    } catch (error) {
      console.error('Failed to load config:', error);
      addToast('error', 'Failed to load dedup configuration');
    } finally {
      setLoading(false);
    }
  }

  async function loadOrgPolicies() {
    try {
      const res = await fetch('/api/org/policies');
      if (res.ok) {
        const data = await res.json();
        setAutoMergeThreshold(data.policies?.dedup_auto_merge_threshold ?? null);
      }
    } catch (error) {
      console.error('Failed to load org policies:', error);
    }
  }

  async function loadDedupConfig() {
    try {
      const res = await fetch('/api/dedup/config');
      if (res.ok) {
        const data = await res.json();
        if (data.config) {
          setInactiveOwnerAction(data.config.inactive_owner_action || 'warn');
          setInactiveOwnerFallbackId(data.config.inactive_owner_fallback_id || '');
          setParentChildAwareness(data.config.parent_child_awareness || false);
          setRequireClosedWonSurvivor(data.config.require_closed_won_survivor || false);
        }
      }
    } catch (error) {
      console.error('Failed to load dedup config:', error);
    }
  }

  async function loadSignalGroups() {
    try {
      const res = await fetch(`/api/dedup/signal-groups?object_type=${activeTab}`);
      if (res.ok) {
        const data = await res.json();
        setSignalGroups(data.groups || []);
        setEditingGroups(data.groups || []);
      }
    } catch (error) {
      console.error('Failed to load signal groups:', error);
    }
  }

  async function loadCompoundGroups() {
    try {
      const res = await fetch('/api/settings/survivorship-rule-groups');
      if (res.ok) {
        const data = await res.json();
        // Defensive: ensure we always set an array, even if API shape changes
        const groups = Array.isArray(data) ? data : (data?.groups ?? []);
        setCompoundGroups(groups);
      } else {
        // Explicitly set empty array on error to prevent undefined state
        setCompoundGroups([]);
      }
    } catch (error) {
      console.error('Failed to load compound groups:', error);
      setCompoundGroups([]);
    }
  }

  async function loadSurvivorshipRules() {
    try {
      const res = await fetch('/api/settings/survivorship-rules?objectType=company');
      if (res.ok) {
        const data = await res.json();
        const defaults = data.rules.filter((r: SurvivorshipRule) => !r.org_id);
        const orgSpecific = data.rules.filter((r: SurvivorshipRule) => r.org_id);
        setDefaultRules(defaults);
        setOrgRules(orgSpecific);

        // Store field options for compliance field dropdown
        if (data.field_options && Array.isArray(data.field_options)) {
          setHubspotFieldOptions(data.field_options);
        }
      }
    } catch (error) {
      console.error('Failed to load survivorship rules:', error);
    }
  }

  async function loadFieldExclusions() {
    try {
      const res = await fetch('/api/dedup/field-exclusions?object_type=company');
      if (res.ok) {
        const data = await res.json();
        setFieldExclusions(data.exclusions || []);

        // Extract compliance fields
        const complianceExclusions = (data.exclusions || [])
          .filter((e: FieldExclusion) => e.exclusion_type === 'union_true')
          .map((e: FieldExclusion) => e.field_name);
        if (complianceExclusions.length > 0) {
          setComplianceFields(complianceExclusions);
        }
      }
    } catch (error) {
      console.error('Failed to load field exclusions:', error);
    }
  }

  async function loadDedupPolicies() {
    try {
      const res = await fetch('/api/settings/dedup-policies');
      if (res.ok) {
        const data = await res.json();
        if (data.policy) {
          setBlockDifferentParent(data.policy.block_if_different_parent || false);
          setBlockClosedWonDeals(data.policy.block_if_closed_won_deals || false);
        }
      }
    } catch (error) {
      console.error('Failed to load dedup policies:', error);
    }
  }

  // Reload signal groups when tab changes
  useEffect(() => {
    if (!loading) {
      loadSignalGroups();
    }
  }, [activeTab]);

  // ============================================================================
  // STEP 1: MATCHING - Signal Groups Handlers
  // ============================================================================

  function addGroup(templateKey?: string) {
    const newGroup: any = {
      id: `new-${Date.now()}`,
      name: '',
      object_type: activeTab,
      group_order: editingGroups.length + 1,
      conditions: templateKey && TEMPLATES[templateKey as keyof typeof TEMPLATES]
        ? [...TEMPLATES[templateKey as keyof typeof TEMPLATES].conditions]
        : [{ field: '', match_type: 'exact', fuzzy_threshold: 0.85, weight: 10 }],
    };
    setEditingGroups([...editingGroups, newGroup]);
  }

  function removeGroup(groupIndex: number) {
    setEditingGroups(editingGroups.filter((_, i) => i !== groupIndex));
    const newErrors = { ...groupErrors };
    delete newErrors[groupIndex];
    setGroupErrors(newErrors);
  }

  function moveGroup(groupIndex: number, direction: 'up' | 'down') {
    if (
      (direction === 'up' && groupIndex === 0) ||
      (direction === 'down' && groupIndex === editingGroups.length - 1)
    ) {
      return;
    }

    const newGroups = [...editingGroups];
    const targetIndex = direction === 'up' ? groupIndex - 1 : groupIndex + 1;
    [newGroups[groupIndex], newGroups[targetIndex]] = [newGroups[targetIndex], newGroups[groupIndex]];

    newGroups.forEach((group, idx) => {
      group.group_order = idx + 1;
    });

    setEditingGroups(newGroups);
  }

  function addCondition(groupIndex: number) {
    const newGroups = [...editingGroups];
    newGroups[groupIndex].conditions.push({
      field: '',
      match_type: 'exact',
      fuzzy_threshold: 0.85,
      weight: 10,
    });
    setEditingGroups(newGroups);
  }

  function removeCondition(groupIndex: number, conditionIndex: number) {
    const newGroups = [...editingGroups];
    newGroups[groupIndex].conditions = newGroups[groupIndex].conditions.filter(
      (_: any, i: number) => i !== conditionIndex
    );
    setEditingGroups(newGroups);
  }

  function updateCondition(groupIndex: number, conditionIndex: number, updates: any) {
    const newGroups = [...editingGroups];
    newGroups[groupIndex].conditions[conditionIndex] = {
      ...newGroups[groupIndex].conditions[conditionIndex],
      ...updates,
    };
    setEditingGroups(newGroups);
  }

  // ============================================================================
  // STEP 3a: COMPOUND RULES Handlers
  // ============================================================================

  async function handleSaveCompoundGroup(group: { name: string; conditions: any[] }) {
    try {
      const res = await fetch('/api/settings/survivorship-rule-groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(group),
      });

      if (!res.ok) throw new Error('Failed to create group');

      addToast('success', 'Compound rule created');
      await loadCompoundGroups();
    } catch (error) {
      console.error('Failed to create group:', error);
      addToast('error', 'Failed to create compound rule');
      throw error;
    }
  }

  async function handleReorderCompoundGroup(groupId: string, direction: 'up' | 'down') {
    const currentIndex = compoundGroups.findIndex(g => g.id === groupId);
    if (currentIndex === -1) return;
    if (direction === 'up' && currentIndex === 0) return;
    if (direction === 'down' && currentIndex === compoundGroups.length - 1) return;

    const swapIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

    try {
      await Promise.all([
        fetch(`/api/settings/survivorship-rule-groups/${compoundGroups[currentIndex].id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ group_priority: compoundGroups[swapIndex].group_priority }),
        }),
        fetch(`/api/settings/survivorship-rule-groups/${compoundGroups[swapIndex].id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ group_priority: compoundGroups[currentIndex].group_priority }),
        }),
      ]);

      await loadCompoundGroups();
      addToast('success', 'Group order updated');
    } catch (error) {
      console.error('Failed to reorder group:', error);
      addToast('error', 'Failed to reorder group');
    }
  }

  async function handleDeleteCompoundGroup(groupId: string) {
    if (!confirm('Are you sure you want to delete this compound rule?')) {
      return;
    }

    try {
      const res = await fetch(`/api/settings/survivorship-rule-groups/${groupId}`, {
        method: 'DELETE',
      });

      if (!res.ok) throw new Error('Failed to delete group');

      addToast('success', 'Compound rule deleted');
      await loadCompoundGroups();
    } catch (error) {
      console.error('Failed to delete group:', error);
      addToast('error', 'Failed to delete compound rule');
    }
  }

  // ============================================================================
  // STEP 3b: FIELD RULES (Survivorship) Handlers
  // ============================================================================

  async function handleReorderRule(ruleId: string, direction: 'up' | 'down') {
    const currentIndex = orgRules.findIndex(r => r.id === ruleId);
    if (currentIndex === -1) return;
    if (direction === 'up' && currentIndex === 0) return;
    if (direction === 'down' && currentIndex === orgRules.length - 1) return;

    const swapIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

    try {
      await Promise.all([
        fetch(`/api/settings/survivorship-rules/${orgRules[currentIndex].id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ priority: orgRules[swapIndex].priority }),
        }),
        fetch(`/api/settings/survivorship-rules/${orgRules[swapIndex].id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ priority: orgRules[currentIndex].priority }),
        }),
      ]);

      await loadSurvivorshipRules();
      addToast('success', 'Rule order updated');
    } catch (error) {
      console.error('Failed to reorder rule:', error);
      addToast('error', 'Failed to reorder rule');
    }
  }

  async function handleDeleteRule(ruleId: string) {
    if (!confirm('Are you sure you want to delete this rule?')) {
      return;
    }

    try {
      const res = await fetch(`/api/settings/survivorship-rules/${ruleId}`, {
        method: 'DELETE',
      });

      if (!res.ok) throw new Error('Failed to delete rule');

      addToast('success', 'Rule deleted');
      await loadSurvivorshipRules();
    } catch (error) {
      console.error('Failed to delete rule:', error);
      addToast('error', 'Failed to delete rule');
    }
  }

  // ============================================================================
  // STEP 4: PROTECTED FIELDS Handlers
  // ============================================================================

  function addComplianceField() {
    if (newComplianceField && !complianceFields.includes(newComplianceField)) {
      setComplianceFields([...complianceFields, newComplianceField]);
      setNewComplianceField('');
    }
  }

  function removeComplianceField(field: string) {
    setComplianceFields(complianceFields.filter(f => f !== field));
  }

  // ============================================================================
  // SAVE ALL CHANGES
  // ============================================================================

  async function handleSaveAll() {
    setSaving(true);
    try {
      // Save in parallel where possible
      await Promise.all([
        // Step 1: Signal groups
        saveSignalGroups(),

        // Step 2: Auto-merge threshold
        saveOrgPolicies(),

        // Step 4: Protected fields (field exclusions)
        saveFieldExclusions(),

        // Step 5: Hierarchy & owners
        saveDedupConfig(),

        // Step 6: Blocked merges
        saveDedupPolicies(),
      ]);

      // Step 3a and 3b (compound rules and field rules) are saved via modals, no action needed here

      addToast('success', 'Dedup configuration saved');
      await loadAllConfig();
    } catch (error) {
      console.error('Failed to save configuration:', error);
      addToast('error', 'Failed to save configuration');
    } finally {
      setSaving(false);
    }
  }

  async function saveSignalGroups() {
    // Validate
    const errors: Record<number, string> = {};
    editingGroups.forEach((group, idx) => {
      if (!group.conditions || group.conditions.length === 0) {
        errors[idx] = 'Group must have at least 1 condition';
      } else {
        group.conditions.forEach((condition: any) => {
          if (!condition.field) {
            errors[idx] = 'Select a field to continue';
          }
        });
      }
    });

    if (Object.keys(errors).length > 0) {
      setGroupErrors(errors);
      throw new Error('Signal groups validation failed');
    }

    setGroupErrors({});

    const res = await fetch('/api/dedup/signal-groups/bulk', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        objectType: activeTab,
        groups: (editingGroups ?? []).map((group) => ({
          name: group.name || `Group ${group.group_order}`,
          group_order: group.group_order,
          conditions: group.conditions,
        })),
      }),
    });

    if (!res.ok) throw new Error('Failed to save signal groups');
  }

  async function saveOrgPolicies() {
    const res = await fetch('/api/org/policies', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dedup_auto_merge_threshold: autoMergeThreshold,
      }),
    });

    if (!res.ok) throw new Error('Failed to save org policies');
  }

  async function saveFieldExclusions() {
    // Build exclusions from all three subsections
    const exclusions: any[] = [];

    // Compliance fields (union_true)
    complianceFields.forEach(field => {
      exclusions.push({
        fieldName: field,
        exclusionType: 'union_true',
        separator: null,
      });
    });

    // Never merge and Append from existing exclusions
    fieldExclusions
      .filter(e => e.exclusion_type !== 'union_true')
      .forEach(e => {
        exclusions.push({
          fieldName: e.field_name,
          exclusionType: e.exclusion_type,
          separator: e.separator || null,
        });
      });

    const res = await fetch('/api/dedup/field-exclusions/bulk', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        objectType: 'company',
        exclusions,
      }),
    });

    if (!res.ok) throw new Error('Failed to save field exclusions');
  }

  async function saveDedupConfig() {
    const res = await fetch('/api/dedup/config', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        inactive_owner_action: inactiveOwnerAction,
        inactive_owner_fallback_id: inactiveOwnerFallbackId || null,
        parent_child_awareness: parentChildAwareness,
        require_closed_won_survivor: requireClosedWonSurvivor,
      }),
    });

    if (!res.ok) throw new Error('Failed to save dedup config');
  }

  async function saveDedupPolicies() {
    const res = await fetch('/api/settings/dedup-policies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Default Policy',
        block_if_different_parent: blockDifferentParent,
        block_if_closed_won_deals: blockClosedWonDeals,
        compliance_fields: complianceFields,
        field_rules: [],
      }),
    });

    if (!res.ok) throw new Error('Failed to save dedup policies');
  }

  // ============================================================================
  // HELPER FUNCTIONS
  // ============================================================================

  function getOperatorLabel(operator: string) {
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
  }

  function getRuleBehaviorText(rule: SurvivorshipRule): string {
    switch (rule.rule_type) {
      case 'never_downgrade':
        return 'Never use less advanced value';
      case 'prefer_nonempty':
        return 'Prefer record with value';
      case 'tld_disqualifier':
        return 'Penalize mismatched TLDs';
      case 'specific_value':
        const valueOrder = rule.rule_config.value_order;
        const preferredValue = rule.rule_config.preferred_value;
        if (valueOrder && valueOrder.length > 0) {
          return `Prefer: ${valueOrder[0]} first`;
        } else if (preferredValue) {
          return `Always prefer: ${preferredValue}`;
        }
        return 'Always prefer specific value';
      case 'prefer_if_populated':
        return 'Prefer record with non-zero value';
      case 'source_preference':
        return 'Prefer specific provider';
      case 'rollup':
        const aggregation = rule.rule_config.method || 'maximum';
        return `${aggregation.charAt(0).toUpperCase() + aggregation.slice(1)} of values`;
      default:
        return rule.rule_type;
    }
  }

  function getRuleTypeLabel(ruleType: string): string {
    const labels: Record<string, string> = {
      never_downgrade: 'Never downgrade',
      prefer_nonempty: 'Prefer nonempty',
      tld_disqualifier: 'TLD disqualifier',
      specific_value: 'Specific value',
      prefer_if_populated: 'Prefer if populated',
      source_preference: 'Source preference',
      rollup: 'Rollup',
    };
    return labels[ruleType] || ruleType;
  }

  // ============================================================================
  // RENDER
  // ============================================================================

  if (loading) {
    return (
      <div style={{ padding: 32 }}>
        <div style={{ fontSize: 14, color: C.text2 }}>Loading dedup configuration...</div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div style={{ padding: 32 }}>
        <h1 style={{ fontSize: 24, fontWeight: 600, color: C.text, marginBottom: 8 }}>
          Dedup Configuration
        </h1>
        <AdminOnlyNotice action="configure dedup settings" />
      </div>
    );
  }

  return (
    <div style={{ padding: 32, maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 48 }}>
        <h1 style={{ fontSize: 28, fontWeight: 600, color: C.text, marginBottom: 8, fontFamily: F.serif }}>
          Dedup Configuration
        </h1>
        <div style={{ fontSize: 14, color: C.text2 }}>
          Configure how Refyne finds and merges duplicates.
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* STEP 1: MATCHING                                                       */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <div style={{ display: 'flex', gap: 24, padding: '40px 0', borderBottom: '1px solid rgba(255, 255, 255, 0.06)' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#2E6BA8', fontFamily: F.serif, textTransform: 'uppercase', minWidth: 80 }}>
          STEP 1
        </div>
        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, fontFamily: F.serif, color: C.text, marginBottom: 8 }}>
            MATCHING
          </h2>
          <p style={{ fontSize: 13, color: C.text3, lineHeight: 1.6, marginBottom: 24 }}>
            How should Refyne identify duplicates?
          </p>

          {/* Object Type Tabs */}
          <div style={{ display: 'flex', gap: 0, marginBottom: 24, borderBottom: `1px solid ${C.border}` }}>
            <button
              onClick={() => setActiveTab('company')}
              style={{
                padding: '10px 20px',
                fontSize: 13,
                fontWeight: 500,
                color: activeTab === 'company' ? C.text : C.text3,
                background: 'transparent',
                border: 'none',
                borderBottom: activeTab === 'company' ? `2px solid #2E6BA8` : '2px solid transparent',
                cursor: 'pointer',
              }}
            >
              Companies
            </button>
            <button
              onClick={() => setActiveTab('contact')}
              style={{
                padding: '10px 20px',
                fontSize: 13,
                fontWeight: 500,
                color: activeTab === 'contact' ? C.text : C.text3,
                background: 'transparent',
                border: 'none',
                borderBottom: activeTab === 'contact' ? `2px solid #2E6BA8` : '2px solid transparent',
                cursor: 'pointer',
              }}
            >
              Contacts
            </button>
          </div>

          {editingGroups.length === 0 ? (
            <div style={{ marginBottom: 24 }}>
              <div style={{ padding: 32, background: C.surface, border: `1px solid ${C.border}`, textAlign: 'center' }}>
                <div style={{ fontSize: 14, color: C.text, marginBottom: 8 }}>
                  No custom matching rules configured.
                </div>
                <div style={{ fontSize: 13, color: C.text3, marginBottom: 16 }}>
                  Refyne uses standard matching by default: domain, LinkedIn URL, phone, name, industry.
                </div>
                <button
                  onClick={() => addGroup()}
                  style={{
                    padding: '10px 20px',
                    fontSize: 13,
                    fontWeight: 500,
                    color: '#2E6BA8',
                    background: 'white',
                    border: `1px solid #2E6BA8`,
                    cursor: 'pointer',
                  }}
                >
                  + Add your first rule group
                </button>
              </div>

              {/* Templates */}
              <div style={{ marginTop: 24 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: C.text, marginBottom: 12 }}>
                  Start from a template:
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                  {Object.entries(TEMPLATES).map(([key, template]) => (
                    <button
                      key={key}
                      onClick={() => addGroup(key)}
                      style={{
                        flex: 1,
                        padding: 16,
                        background: C.surface,
                        border: `1px solid ${C.border}`,
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      <div style={{ fontSize: 13, fontWeight: 500, color: C.text, marginBottom: 4 }}>
                        {template.name}
                      </div>
                      <div style={{ fontSize: 12, color: C.text3 }}>
                        {template.description}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div style={{ marginBottom: 24 }}>
              {(editingGroups ?? []).map((group, groupIdx) => (
                <div key={group.id || groupIdx} style={{ marginBottom: 24 }}>
                  {/* Group Header */}
                  <div
                    style={{
                      padding: '12px 16px',
                      background: C.surface,
                      border: `1px solid rgba(255, 255, 255, 0.08)`,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div style={{ fontSize: 14, fontWeight: 500, color: C.text }}>
                      Group {groupIdx + 1} of {editingGroups.length}
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        onClick={() => moveGroup(groupIdx, 'up')}
                        disabled={groupIdx === 0}
                        style={{
                          padding: '4px 8px',
                          fontSize: 12,
                          color: groupIdx === 0 ? C.text3 : C.text,
                          background: 'transparent',
                          border: `1px solid ${C.border}`,
                          cursor: groupIdx === 0 ? 'not-allowed' : 'pointer',
                        }}
                      >
                        <ArrowUp size={12} />
                      </button>
                      <button
                        onClick={() => moveGroup(groupIdx, 'down')}
                        disabled={groupIdx === editingGroups.length - 1}
                        style={{
                          padding: '4px 8px',
                          fontSize: 12,
                          color: groupIdx === editingGroups.length - 1 ? C.text3 : C.text,
                          background: 'transparent',
                          border: `1px solid ${C.border}`,
                          cursor: groupIdx === editingGroups.length - 1 ? 'not-allowed' : 'pointer',
                        }}
                      >
                        <ArrowDown size={12} />
                      </button>
                      <button
                        onClick={() => removeGroup(groupIdx)}
                        style={{
                          padding: '4px 8px',
                          fontSize: 12,
                          color: C.red,
                          background: 'transparent',
                          border: `1px solid ${C.red}`,
                          cursor: 'pointer',
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  {/* Group Description */}
                  <div
                    style={{
                      padding: '12px 16px',
                      background: C.bg,
                      border: `1px solid rgba(255, 255, 255, 0.08)`,
                      borderTop: 'none',
                      fontSize: 12,
                      color: C.text3,
                    }}
                  >
                    A record matches this group when ALL of these conditions are true:
                  </div>

                  {/* Conditions Table */}
                  <div style={{ border: `1px solid rgba(255, 255, 255, 0.08)`, borderTop: 'none' }}>
                    {/* Table Header */}
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr 1fr 40px',
                        gap: 12,
                        padding: '8px 16px',
                        background: C.surface,
                        borderBottom: `1px solid rgba(255, 255, 255, 0.08)`,
                      }}
                    >
                      <div style={{ fontSize: 11, fontWeight: 600, color: C.text3, textTransform: 'uppercase' }}>
                        Field
                      </div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: C.text3, textTransform: 'uppercase' }}>
                        Match type
                      </div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: C.text3, textTransform: 'uppercase' }}>
                        Accuracy
                      </div>
                      <div></div>
                    </div>

                    {/* Condition Rows */}
                    {(group.conditions ?? []).map((condition: any, condIdx: number) => (
                      <div
                        key={condIdx}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '1fr 1fr 1fr 40px',
                          gap: 12,
                          padding: '12px 16px',
                          background: C.bg,
                          borderBottom: condIdx < group.conditions.length - 1 ? `1px solid rgba(255, 255, 255, 0.04)` : 'none',
                        }}
                      >
                        <select
                          value={condition.field}
                          onChange={(e) => updateCondition(groupIdx, condIdx, { field: e.target.value })}
                          style={{
                            padding: '8px 12px',
                            fontSize: 13,
                            border: `1px solid ${C.border}`,
                            background: C.surface,
                            color: C.text,
                            cursor: 'pointer',
                          }}
                        >
                          <option value="">Select field...</option>
                          {(activeTab === 'company' ? COMPANY_FIELDS : CONTACT_FIELDS).map((field) => (
                            <option key={field.value} value={field.value}>
                              {field.label}
                            </option>
                          ))}
                        </select>

                        <select
                          value={condition.match_type}
                          onChange={(e) => updateCondition(groupIdx, condIdx, { match_type: e.target.value })}
                          style={{
                            padding: '8px 12px',
                            fontSize: 13,
                            border: `1px solid ${C.border}`,
                            background: C.surface,
                            color: C.text,
                            cursor: 'pointer',
                          }}
                        >
                          {MATCH_TYPES.map((type) => (
                            <option key={type.value} value={type.value}>
                              {type.label}
                            </option>
                          ))}
                        </select>

                        {condition.match_type === 'fuzzy' ? (
                          <select
                            value={condition.fuzzy_threshold}
                            onChange={(e) => updateCondition(groupIdx, condIdx, { fuzzy_threshold: parseFloat(e.target.value) })}
                            style={{
                              padding: '8px 12px',
                              fontSize: 13,
                              border: `1px solid ${C.border}`,
                              background: C.surface,
                              color: C.text,
                              cursor: 'pointer',
                            }}
                          >
                            {ACCURACY_LEVELS.map((level) => (
                              <option key={level.value} value={level.value}>
                                {level.label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <div style={{ fontSize: 13, color: C.text3, alignSelf: 'center' }}>—</div>
                        )}

                        <button
                          onClick={() => removeCondition(groupIdx, condIdx)}
                          style={{
                            padding: 0,
                            background: 'transparent',
                            border: 'none',
                            color: C.text3,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ))}

                    {/* Add Condition Button */}
                    <div style={{ padding: '12px 16px', background: C.bg }}>
                      <button
                        onClick={() => addCondition(groupIdx)}
                        style={{
                          padding: '6px 12px',
                          fontSize: 12,
                          fontWeight: 500,
                          color: '#2E6BA8',
                          background: 'transparent',
                          border: `1px solid #2E6BA8`,
                          cursor: 'pointer',
                        }}
                      >
                        + Add
                      </button>
                    </div>
                  </div>

                  {/* Error Message */}
                  {groupErrors[groupIdx] && (
                    <div
                      style={{
                        padding: '8px 16px',
                        background: '#FEF3C7',
                        border: '1px solid #FCD34D',
                        borderTop: 'none',
                        fontSize: 12,
                        color: '#92400E',
                      }}
                    >
                      {groupErrors[groupIdx]}
                    </div>
                  )}

                  {/* OR Divider */}
                  {groupIdx < editingGroups.length - 1 && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 16,
                        margin: '16px 0',
                      }}
                    >
                      <div style={{ flex: 1, height: 1, background: C.border }}></div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: C.text3 }}>OR</div>
                      <div style={{ flex: 1, height: 1, background: C.border }}></div>
                    </div>
                  )}
                </div>
              ))}

              <button
                onClick={() => addGroup()}
                style={{
                  padding: '10px 20px',
                  fontSize: 13,
                  fontWeight: 500,
                  color: 'white',
                  background: '#2E6BA8',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Plus size={14} />
                Add rule group
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* STEP 2: AUTO-MERGE                                                     */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <div style={{ display: 'flex', gap: 24, padding: '40px 0', borderBottom: '1px solid rgba(255, 255, 255, 0.06)' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#2E6BA8', fontFamily: F.serif, textTransform: 'uppercase', minWidth: 80 }}>
          STEP 2
        </div>
        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, fontFamily: F.serif, color: C.text, marginBottom: 8 }}>
            AUTO-MERGE
          </h2>
          <p style={{ fontSize: 13, color: C.text3, lineHeight: 1.6, marginBottom: 16 }}>
            When should Refyne merge automatically?
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              { value: null, label: 'Never', sub: 'always require manual review' },
              { value: 90, label: 'Grade A only', sub: '(97%+ confidence)' },
              { value: 75, label: 'Grade B and above', sub: '(85%+)' },
            ].map((opt) => (
              <label key={String(opt.value)} style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
                <input
                  type="radio"
                  checked={autoMergeThreshold === opt.value}
                  onChange={() => setAutoMergeThreshold(opt.value)}
                  style={{ cursor: 'pointer' }}
                />
                <div>
                  <span style={{ fontSize: 13, color: C.text }}>{opt.label}</span>
                  <span style={{ fontSize: 11, color: C.text3, marginLeft: 8 }}>{opt.sub}</span>
                </div>
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* STEP 3: WHICH RECORD SURVIVES                                          */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <div style={{ display: 'flex', gap: 24, padding: '40px 0', borderBottom: '1px solid rgba(255, 255, 255, 0.06)' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#2E6BA8', fontFamily: F.serif, textTransform: 'uppercase', minWidth: 80 }}>
          STEP 3
        </div>
        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, fontFamily: F.serif, color: C.text, marginBottom: 8 }}>
            WHICH RECORD SURVIVES
          </h2>
          <p style={{ fontSize: 13, color: C.text3, lineHeight: 1.6, marginBottom: 24 }}>
            When two records merge, which values win?
          </p>

          <div style={{ fontSize: 12, color: '#2E6BA8', marginBottom: 24, padding: 12, background: 'rgba(46, 107, 168, 0.1)', border: '1px solid rgba(46, 107, 168, 0.3)' }}>
            Compound rules are checked first. If no compound rule matches, field rules apply one by one.
          </div>

          {/* 3a. Compound Rules */}
          <div style={{ marginBottom: 40 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 600, color: C.text, marginBottom: 4 }}>
                  Compound rules (checked first)
                </h3>
                <p style={{ fontSize: 12, color: C.text3 }}>
                  If ALL these conditions match a record, that record survives.
                </p>
              </div>
              <button
                onClick={() => setShowCompoundWizard(true)}
                style={{
                  padding: '8px 16px',
                  fontSize: 13,
                  background: '#2E6BA8',
                  color: 'white',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Plus size={14} /> Add compound rule
              </button>
            </div>

            {compoundGroups.length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center', border: `1px solid ${C.border}`, background: C.surface }}>
                <div style={{ fontSize: 13, color: C.text3, marginBottom: 16 }}>
                  No compound rules yet. Compound rules are evaluated before individual field rules.
                </div>
                <button
                  onClick={() => setShowCompoundWizard(true)}
                  style={{
                    padding: '8px 16px',
                    fontSize: 13,
                    background: '#2E6BA8',
                    color: 'white',
                    border: 'none',
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
                {(compoundGroups ?? []).map((group, index) => (
                  <div key={group.id}>
                    <div style={{ border: `1px solid ${C.border}`, background: C.surface, padding: '16px 20px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <div style={{ fontSize: 14, fontWeight: 500, color: C.text }}>
                          Group {index + 1}: {group.name}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <button
                              onClick={() => handleReorderCompoundGroup(group.id, 'up')}
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
                              <ArrowUp size={14} />
                            </button>
                            <button
                              onClick={() => handleReorderCompoundGroup(group.id, 'down')}
                              disabled={index === compoundGroups.length - 1}
                              style={{
                                background: 'none',
                                border: 'none',
                                cursor: index === compoundGroups.length - 1 ? 'not-allowed' : 'pointer',
                                color: index === compoundGroups.length - 1 ? C.border : C.text3,
                                padding: 0,
                                opacity: index === compoundGroups.length - 1 ? 0.3 : 1,
                              }}
                            >
                              <ArrowDown size={14} />
                            </button>
                          </div>
                          <button
                            onClick={() => handleDeleteCompoundGroup(group.id)}
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

                      <div style={{ fontSize: 12, color: C.text3, marginBottom: 8 }}>
                        Survive when ALL of these are true:
                      </div>
                      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                        {(group.conditions ?? []).map((condition) => (
                          <li key={condition.id} style={{ fontSize: 12, color: C.text2, marginBottom: 4, fontFamily: F.mono }}>
                            {condition.field_key} {getOperatorLabel(condition.operator)}
                            {condition.comparison_value && ` ${condition.comparison_value}`}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {index < compoundGroups.length - 1 && (
                      <div style={{ textAlign: 'center', padding: '8px 0', fontSize: 11, color: C.text3, fontWeight: 600 }}>
                        OR
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 3b. Field Rules */}
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: C.text, marginBottom: 16 }}>
              Field rules (applied field by field)
            </h3>

            {/* DEFAULT RULES */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: C.text, marginBottom: 12 }}>
                DEFAULT (always active)
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', border: `1px solid ${C.border}` }}>
                <thead>
                  <tr style={{ background: C.surface }}>
                    <th style={{ padding: 12, textAlign: 'left', fontSize: 11, fontWeight: 600, color: C.text3, textTransform: 'uppercase' }}>
                      Field
                    </th>
                    <th style={{ padding: 12, textAlign: 'left', fontSize: 11, fontWeight: 600, color: C.text3, textTransform: 'uppercase' }}>
                      Rule
                    </th>
                    <th style={{ padding: 12, textAlign: 'left', fontSize: 11, fontWeight: 600, color: C.text3, textTransform: 'uppercase' }}>
                      Behavior
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {(defaultRules ?? []).map((rule) => (
                    <tr key={rule.id} style={{ background: C.bg, borderBottom: `1px solid rgba(255, 255, 255, 0.04)` }}>
                      <td style={{ padding: 12, fontSize: 13, color: C.text }}>{rule.field_key}</td>
                      <td style={{ padding: 12, fontSize: 13, color: C.text }}>{getRuleTypeLabel(rule.rule_type)}</td>
                      <td style={{ padding: 12, fontSize: 12, color: C.text3 }}>{getRuleBehaviorText(rule)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* YOUR RULES */}
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: C.text, marginBottom: 12 }}>
                YOUR RULES
              </div>
              {orgRules.length === 0 ? (
                <div style={{ padding: '32px 20px', textAlign: 'center', border: `1px solid ${C.border}`, background: C.surface }}>
                  <div style={{ fontSize: 13, color: C.text3, marginBottom: 16 }}>
                    No custom field rules yet.
                  </div>
                  <div style={{ fontSize: 12, color: C.text3 }}>
                    Note: Field rule UI (Add rule modal) preserved from existing SurvivorshipRulesPanel component.
                    Integration point for AddRuleModal would go here.
                  </div>
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', border: `1px solid ${C.border}` }}>
                  <thead>
                    <tr style={{ background: C.surface }}>
                      <th style={{ padding: 12, textAlign: 'left', fontSize: 11, fontWeight: 600, color: C.text3, textTransform: 'uppercase', width: '60px' }}>
                        #
                      </th>
                      <th style={{ padding: 12, textAlign: 'left', fontSize: 11, fontWeight: 600, color: C.text3, textTransform: 'uppercase' }}>
                        Field
                      </th>
                      <th style={{ padding: 12, textAlign: 'left', fontSize: 11, fontWeight: 600, color: C.text3, textTransform: 'uppercase' }}>
                        Rule
                      </th>
                      <th style={{ padding: 12, textAlign: 'left', fontSize: 11, fontWeight: 600, color: C.text3, textTransform: 'uppercase' }}>
                        Behavior
                      </th>
                      <th style={{ width: '100px' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {(orgRules ?? []).map((rule, index) => (
                      <tr key={rule.id} style={{ background: C.bg, borderBottom: `1px solid rgba(255, 255, 255, 0.04)` }}>
                        <td style={{ padding: 12, fontSize: 13, color: C.text3 }}>{index + 1}</td>
                        <td style={{ padding: 12, fontSize: 13, color: C.text }}>{rule.field_key}</td>
                        <td style={{ padding: 12, fontSize: 13, color: C.text }}>{getRuleTypeLabel(rule.rule_type)}</td>
                        <td style={{ padding: 12, fontSize: 12, color: C.text3 }}>{getRuleBehaviorText(rule)}</td>
                        <td style={{ padding: 12 }}>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button
                              onClick={() => handleReorderRule(rule.id, 'up')}
                              disabled={index === 0}
                              style={{
                                padding: 4,
                                background: 'transparent',
                                border: 'none',
                                cursor: index === 0 ? 'not-allowed' : 'pointer',
                                color: index === 0 ? C.border : C.text3,
                                opacity: index === 0 ? 0.3 : 1,
                              }}
                            >
                              <ArrowUp size={14} />
                            </button>
                            <button
                              onClick={() => handleReorderRule(rule.id, 'down')}
                              disabled={index === orgRules.length - 1}
                              style={{
                                padding: 4,
                                background: 'transparent',
                                border: 'none',
                                cursor: index === orgRules.length - 1 ? 'not-allowed' : 'pointer',
                                color: index === orgRules.length - 1 ? C.border : C.text3,
                                opacity: index === orgRules.length - 1 ? 0.3 : 1,
                              }}
                            >
                              <ArrowDown size={14} />
                            </button>
                            <button
                              onClick={() => handleDeleteRule(rule.id)}
                              style={{
                                padding: 4,
                                background: 'transparent',
                                border: 'none',
                                cursor: 'pointer',
                                color: C.text3,
                              }}
                            >
                              <X size={14} />
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
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* STEP 4: PROTECTED FIELDS                                               */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <div style={{ display: 'flex', gap: 24, padding: '40px 0', borderBottom: '1px solid rgba(255, 255, 255, 0.06)' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#2E6BA8', fontFamily: F.serif, textTransform: 'uppercase', minWidth: 80 }}>
          STEP 4
        </div>
        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, fontFamily: F.serif, color: C.text, marginBottom: 8 }}>
            PROTECTED FIELDS
          </h2>
          <p style={{ fontSize: 13, color: C.text3, lineHeight: 1.6, marginBottom: 24 }}>
            These fields get special treatment during merge.
          </p>

          {/* 4a. Compliance */}
          <div style={{ marginBottom: 32 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 8 }}>
              Compliance (always most restrictive)
            </h3>
            <p style={{ fontSize: 12, color: C.text3, marginBottom: 12 }}>
              These fields always use the most restrictive value across all records:
            </p>

            <div style={{ marginBottom: 12 }}>
              {(complianceFields ?? []).map((field) => (
                <div
                  key={field}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 16px',
                    background: C.surface,
                    border: `1px solid ${C.border}`,
                    marginBottom: 8,
                  }}
                >
                  <div style={{ fontSize: 13, color: C.text }}>{field}</div>
                  <button
                    onClick={() => removeComplianceField(field)}
                    style={{
                      padding: '4px 8px',
                      fontSize: 12,
                      color: C.red,
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <select
                value={newComplianceField}
                onChange={(e) => setNewComplianceField(e.target.value)}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  fontSize: 14,
                  fontFamily: 'monospace',
                  border: `1px solid ${C.border}`,
                  background: 'white',
                  color: C.text,
                }}
              >
                <option value="">Select a field...</option>
                {(hubspotFieldOptions ?? [])
                  .filter(opt => !complianceFields.includes(opt.key) && !opt.key.startsWith('hs_object_'))
                  .map(opt => (
                    <option key={opt.key} value={opt.key}>
                      {opt.label} ({opt.key})
                    </option>
                  ))}
              </select>
              <button
                onClick={addComplianceField}
                disabled={!newComplianceField}
                style={{
                  padding: '8px 16px',
                  fontSize: 14,
                  color: newComplianceField ? '#2E6BA8' : C.text3,
                  background: 'white',
                  border: `1px solid ${newComplianceField ? '#2E6BA8' : C.border}`,
                  cursor: newComplianceField ? 'pointer' : 'not-allowed',
                  opacity: newComplianceField ? 1 : 0.6,
                }}
              >
                Add Field
              </button>
            </div>
          </div>

          {/* 4b. Never merge */}
          <div style={{ marginBottom: 32 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 8 }}>
              Never merge (field value never changes)
            </h3>
            <div style={{ fontSize: 12, color: C.text3 }}>
              No fields configured. Field exception editor would go here (from field_exclusions with exclusion_type='never_merge').
            </div>
          </div>

          {/* 4c. Append on merge */}
          <div>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 8 }}>
              Append on merge (values combined)
            </h3>
            <div style={{ fontSize: 12, color: C.text3 }}>
              No fields configured. Field exception editor would go here (from field_exclusions with exclusion_type='append').
            </div>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* STEP 5: HIERARCHY & OWNERS                                             */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <div style={{ display: 'flex', gap: 24, padding: '40px 0', borderBottom: '1px solid rgba(255, 255, 255, 0.06)' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#2E6BA8', fontFamily: F.serif, textTransform: 'uppercase', minWidth: 80 }}>
          STEP 5
        </div>
        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, fontFamily: F.serif, color: C.text, marginBottom: 8 }}>
            HIERARCHY AND OWNERS
          </h2>
          <p style={{ fontSize: 13, color: C.text3, lineHeight: 1.6, marginBottom: 16 }}>
            Special handling for company relationships.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={parentChildAwareness}
                onChange={(e) => setParentChildAwareness(e.target.checked)}
                style={{ cursor: 'pointer' }}
              />
              <span style={{ color: C.text }}>
                Parent/child awareness (prefer companies without parents as survivors)
              </span>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={requireClosedWonSurvivor}
                onChange={(e) => setRequireClosedWonSurvivor(e.target.checked)}
                style={{ cursor: 'pointer' }}
              />
              <span style={{ color: C.text }}>
                Require closed-won deals on survivor (block merge if duplicate has deals but master doesn't)
              </span>
            </label>

            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: C.text, marginBottom: 8 }}>
                Inactive owner
              </div>
              <select
                value={inactiveOwnerAction}
                onChange={(e) => setInactiveOwnerAction(e.target.value)}
                style={{
                  padding: '10px 12px',
                  fontSize: 13,
                  border: `1px solid ${C.border}`,
                  background: C.bg,
                  color: C.text,
                  cursor: 'pointer',
                  width: 300,
                }}
              >
                <option value="warn">Warn (keep inactive owner)</option>
                <option value="assign_fallback">Assign Fallback Owner</option>
                <option value="leave_unassigned">Leave Unassigned</option>
              </select>
            </div>

            {inactiveOwnerAction === 'assign_fallback' && (
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: C.text, marginBottom: 8 }}>
                  Fallback Owner ID
                </div>
                <input
                  type="text"
                  value={inactiveOwnerFallbackId}
                  onChange={(e) => setInactiveOwnerFallbackId(e.target.value)}
                  placeholder="HubSpot owner ID"
                  style={{
                    padding: '10px 12px',
                    fontSize: 13,
                    fontFamily: 'monospace',
                    border: `1px solid ${C.border}`,
                    background: C.bg,
                    color: C.text,
                    width: 300,
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* STEP 6: BLOCKED MERGES                                                 */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <div style={{ display: 'flex', gap: 24, padding: '40px 0', borderBottom: '1px solid rgba(255, 255, 255, 0.06)' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#2E6BA8', fontFamily: F.serif, textTransform: 'uppercase', minWidth: 80 }}>
          STEP 6
        </div>
        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, fontFamily: F.serif, color: C.text, marginBottom: 8 }}>
            BLOCKED MERGES
          </h2>
          <p style={{ fontSize: 13, color: C.text3, lineHeight: 1.6, marginBottom: 16 }}>
            Never merge these:
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={blockDifferentParent}
                onChange={(e) => setBlockDifferentParent(e.target.checked)}
                style={{ cursor: 'pointer' }}
              />
              <span style={{ color: C.text }}>Block if records have different parent companies</span>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={blockClosedWonDeals}
                onChange={(e) => setBlockClosedWonDeals(e.target.checked)}
                style={{ cursor: 'pointer' }}
              />
              <span style={{ color: C.text }}>Block if any record has closed-won deals</span>
            </label>
          </div>

          <div style={{ marginTop: 24 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: C.text, marginBottom: 8 }}>
              Excluded domains
            </div>
            <div style={{ fontSize: 12, color: C.text3, marginBottom: 12 }}>
              e.g. gmail.com
            </div>
            <div style={{ fontSize: 12, color: C.text3 }}>
              No domains excluded. Domain exclusion editor would go here (future enhancement).
            </div>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* SAVE ALL CHANGES BUTTON                                                */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <div style={{ marginTop: 40, display: 'flex', justifyContent: 'flex-end' }}>
        <button
          onClick={handleSaveAll}
          disabled={saving}
          style={{
            padding: '12px 32px',
            fontSize: 14,
            fontWeight: 500,
            color: 'white',
            background: saving ? C.text3 : '#2E6BA8',
            border: 'none',
            cursor: saving ? 'not-allowed' : 'pointer',
          }}
        >
          {saving ? 'Saving...' : 'Save all changes'}
        </button>
      </div>

      {/* Compound Rule Wizard Modal */}
      <CompoundRuleWizard
        isOpen={showCompoundWizard}
        onClose={() => setShowCompoundWizard(false)}
        onSave={handleSaveCompoundGroup}
      />
    </div>
  );
}
