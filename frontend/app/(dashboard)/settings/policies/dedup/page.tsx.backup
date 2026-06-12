'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { addToast } from '@/components/ui/toast';
import { C, F } from '@/lib/design-tokens';
import { ChevronDown, ArrowUp, ArrowDown, X, Plus, Lock } from 'lucide-react';
import { OrderEditor } from '../components/OrderEditor';
import { useRole } from '@/hooks/useRole';
import { AdminOnlyNotice } from '@/components/auth/AdminOnlyNotice';
import {
  COMPANY_FIELDS,
  CONTACT_FIELDS,
  MATCH_TYPES,
  ACCURACY_LEVELS,
  TEMPLATES,
  getFieldLabel,
  getMatchTypeLabel,
  getAccuracyLabel,
} from '@/lib/dedup/signal-groups-ui';
import {
  COMPANY_COMMON_FIELDS,
  CONTACT_COMMON_FIELDS,
  EXCLUSION_TYPES,
  SEPARATOR_OPTIONS,
  COMPLIANCE_FIELDS,
  getExclusionTypeLabel,
  getSeparatorLabel,
  isComplianceField,
  getTypeBadgeColor,
} from '@/lib/dedup/field-exclusions-ui';

interface FieldRule {
  field: string;
  rule: string;
  config: Record<string, any>;
}

interface HubSpotField {
  name: string;
  label: string;
  type: string;
  fieldType: string;
  options?: Array<{ label: string; value: string }>;
}

interface DedupPolicy {
  id: string;
  org_id: string;
  name: string;
  block_if_different_parent: boolean;
  block_if_closed_won_deals: boolean;
  compliance_fields: string[];
  field_rules: FieldRule[];
}

const RULE_TYPES = [
  { value: 'fill_empty', label: 'Fill empty', description: 'Use duplicate value if master is blank' },
  { value: 'keep_master', label: 'Keep master', description: 'Always use master value' },
  { value: 'append_both', label: 'Append both', description: 'Concatenate both values with separator' },
  { value: 'keep_highest', label: 'Keep highest', description: 'Use highest numeric value' },
  { value: 'keep_lowest', label: 'Keep lowest', description: 'Use lowest numeric value' },
  { value: 'keep_newest', label: 'Keep newest', description: 'Use most recently modified value' },
  { value: 'keep_oldest', label: 'Keep oldest', description: 'Use oldest record\'s value' },
  { value: 'keep_most_advanced', label: 'Keep most advanced', description: 'Use value furthest in funnel order' },
];

const DEFAULT_COMPLIANCE_FIELDS = [
  'hs_email_optout',
  'hs_email_bounce',
  'hs_email_hardbounce_reason',
  'hs_legal_basis',
];

// Map HubSpot field names to human-readable labels
const COMPLIANCE_FIELD_LABELS: Record<string, string> = {
  'hs_email_optout': 'Email Opt-out',
  'hs_email_bounce': 'Email Bounce',
  'hs_email_hardbounce_reason': 'Email Hard Bounce Reason',
  'hs_legal_basis': 'Legal Basis',
};

function getComplianceFieldLabel(field: string): string {
  return COMPLIANCE_FIELD_LABELS[field] || field;
}

export default function DedupPoliciesPage() {
  const { isAdmin } = useRole();
  // Phase 1: Object type support
  const searchParams = useSearchParams();
  const objectType = (searchParams.get('object') as 'company' | 'contact') || 'company';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [policy, setPolicy] = useState<DedupPolicy | null>(null);
  const [isDefault, setIsDefault] = useState(false);

  // Phase 2: Field options for dropdown
  const [fieldOptions, setFieldOptions] = useState<HubSpotField[]>([]);
  const [loadingFields, setLoadingFields] = useState(false);

  // Form state (D3)
  const [policyName, setPolicyName] = useState('Default Policy');
  const [blockDifferentParent, setBlockDifferentParent] = useState(false);
  const [blockClosedWonDeals, setBlockClosedWonDeals] = useState(false);
  const [complianceFields, setComplianceFields] = useState<string[]>(DEFAULT_COMPLIANCE_FIELDS);
  const [fieldRules, setFieldRules] = useState<FieldRule[]>([]);
  const [newComplianceField, setNewComplianceField] = useState('');

  // Form state (V2)
  const [signalGroups, setSignalGroups] = useState<any[]>([]);
  const [fieldExclusions, setFieldExclusions] = useState<any[]>([]);
  const [dedupConfig, setDedupConfig] = useState<any>(null);
  const [inactiveOwnerAction, setInactiveOwnerAction] = useState<string>('warn');
  const [inactiveOwnerFallbackId, setInactiveOwnerFallbackId] = useState<string>('');
  const [parentChildAwareness, setParentChildAwareness] = useState(false);
  const [requireClosedWonSurvivor, setRequireClosedWonSurvivor] = useState(false);

  // Signal Groups Builder state
  const [activeTab, setActiveTab] = useState<'company' | 'contact'>('company');
  const [editingGroups, setEditingGroups] = useState<any[]>([]);
  const [groupErrors, setGroupErrors] = useState<Record<number, string>>({});
  const [savingGroups, setSavingGroups] = useState(false);

  // Field Exclusions Builder state
  const [editingExclusions, setEditingExclusions] = useState<any[]>([]);
  const [exclusionErrors, setExclusionErrors] = useState<Record<number, string>>({});
  const [savingExclusions, setSavingExclusions] = useState(false);

  // Phase 3: Track field types for each rule
  const [fieldTypes, setFieldTypes] = useState<Record<number, string>>({});

  // Load policy on mount and when object type changes
  useEffect(() => {
    loadPolicy();
    loadFieldOptions();
    loadSignalGroups();
    loadFieldExclusions();
    loadDedupConfig();
  }, [objectType]);

  async function loadPolicy() {
    try {
      const res = await fetch('/api/settings/dedup-policies');
      if (!res.ok) throw new Error('Failed to load policy');

      const data = await res.json();
      setPolicy(data.policy);
      setIsDefault(data.isDefault);

      if (data.policy) {
        setPolicyName(data.policy.name);
        setBlockDifferentParent(data.policy.block_if_different_parent);
        setBlockClosedWonDeals(data.policy.block_if_closed_won_deals);
        setComplianceFields(data.policy.compliance_fields || DEFAULT_COMPLIANCE_FIELDS);
        setFieldRules(data.policy.field_rules || []);
      }
    } catch (error) {
      console.error('Failed to load policy:', error);
      addToast('error', 'Failed to load dedup policy');
    } finally {
      setLoading(false);
    }
  }

  // Phase 2: Load HubSpot field options for the current object type
  async function loadFieldOptions() {
    setLoadingFields(true);
    try {
      const res = await fetch(`/api/hubspot/properties?objectType=${objectType}`);
      if (!res.ok) throw new Error('Failed to load fields');

      const data = await res.json();
      if (data.properties) {
        const allFields = [...(data.properties.standard || []), ...(data.properties.custom || [])];
        setFieldOptions(allFields);
      }
    } catch (error) {
      console.error('Failed to load field options:', error);
      addToast('error', 'Failed to load field options');
    } finally {
      setLoadingFields(false);
    }
  }

  // V2: Load signal groups
  async function loadSignalGroups() {
    try {
      const res = await fetch(`/api/dedup/signal-groups?object_type=${objectType}`);
      if (!res.ok) throw new Error('Failed to load signal groups');
      const data = await res.json();
      setSignalGroups(data.groups || []);
    } catch (error) {
      console.error('Failed to load signal groups:', error);
    }
  }

  // V2: Load field exclusions
  async function loadFieldExclusions() {
    try {
      const res = await fetch(`/api/dedup/field-exclusions?object_type=${objectType}`);
      if (!res.ok) throw new Error('Failed to load field exclusions');
      const data = await res.json();
      setFieldExclusions(data.exclusions || []);
    } catch (error) {
      console.error('Failed to load field exclusions:', error);
    }
  }

  // V2: Load dedup config
  async function loadDedupConfig() {
    try {
      const res = await fetch('/api/dedup/config');
      if (!res.ok) throw new Error('Failed to load dedup config');
      const data = await res.json();
      if (data.config) {
        setDedupConfig(data.config);
        setInactiveOwnerAction(data.config.inactive_owner_action || 'warn');
        setInactiveOwnerFallbackId(data.config.inactive_owner_fallback_id || '');
        setParentChildAwareness(data.config.parent_child_awareness || false);
        setRequireClosedWonSurvivor(data.config.require_closed_won_survivor || false);
      }
    } catch (error) {
      console.error('Failed to load dedup config:', error);
    }
  }

  // Phase 3: Get applicable rule types based on field type
  function getApplicableRules(fieldType?: string) {
    if (!fieldType || fieldType === '*') {
      return RULE_TYPES; // All rules available for wildcard
    }

    const universalRules = ['fill_empty', 'keep_master', 'keep_newest', 'keep_oldest'];

    if (fieldType === 'string' || fieldType === 'text' || fieldType === 'textarea') {
      return RULE_TYPES.filter(r => [...universalRules, 'append_both'].includes(r.value));
    }
    if (fieldType === 'number') {
      return RULE_TYPES.filter(r => [...universalRules, 'keep_highest', 'keep_lowest'].includes(r.value));
    }
    if (fieldType === 'enumeration' || fieldType === 'booleancheckbox' || fieldType === 'radio' || fieldType === 'checkbox') {
      return RULE_TYPES.filter(r => [...universalRules, 'keep_most_advanced'].includes(r.value));
    }

    return RULE_TYPES.filter(r => universalRules.includes(r.value));
  }

  async function savePolicy() {
    setSaving(true);
    try {
      // Save D3 policy
      const res = await fetch('/api/settings/dedup-policies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: policyName,
          block_if_different_parent: blockDifferentParent,
          block_if_closed_won_deals: blockClosedWonDeals,
          compliance_fields: complianceFields,
          field_rules: fieldRules,
        }),
      });

      if (!res.ok) throw new Error('Failed to save policy');

      const data = await res.json();
      setPolicy(data.policy);
      setIsDefault(false);

      // Save V2 config
      await saveDedupConfig();

      setJustSaved(true);
      addToast('success', data.created ? 'Policy created' : 'Policy updated');
    } catch (error) {
      console.error('Failed to save policy:', error);
      addToast('error', 'Failed to save policy');
    } finally {
      setSaving(false);
    }
  }

  async function saveDedupConfig() {
    try {
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
    } catch (error) {
      console.error('Failed to save dedup config:', error);
      throw error;
    }
  }

  function addFieldRule() {
    setFieldRules([
      ...fieldRules,
      { field: '', rule: 'fill_empty', config: {} },
    ]);
  }

  function updateFieldRule(index: number, updates: Partial<FieldRule>) {
    const updated = [...fieldRules];
    updated[index] = { ...updated[index], ...updates };

    // Phase 3: Track field type when field changes
    if (updates.field !== undefined) {
      const selectedField = fieldOptions.find(f => f.name === updates.field);
      if (selectedField) {
        setFieldTypes(prev => ({ ...prev, [index]: selectedField.type }));

        // Phase 4: Auto-populate enum values for keep_most_advanced
        if (updated[index].rule === 'keep_most_advanced' &&
            (selectedField.type === 'enumeration' || selectedField.type === 'booleancheckbox')) {
          fetchEnumValues(updates.field!, index);
        }
      } else if (updates.field === '*') {
        setFieldTypes(prev => ({ ...prev, [index]: '*' }));
      }
    }

    // Phase 4: Clear config when switching away from keep_most_advanced
    if (updates.rule !== undefined && updates.rule !== 'keep_most_advanced') {
      updated[index].config = {};
    }

    // Phase 4: Fetch enum values when switching to keep_most_advanced
    if (updates.rule === 'keep_most_advanced' && updated[index].field && updated[index].field !== '*') {
      const selectedField = fieldOptions.find(f => f.name === updated[index].field);
      if (selectedField && (selectedField.type === 'enumeration' || selectedField.type === 'booleancheckbox')) {
        fetchEnumValues(updated[index].field, index);
      }
    }

    setFieldRules(updated);
  }

  // Phase 4: Fetch enum values for a field
  async function fetchEnumValues(fieldName: string, ruleIndex: number) {
    try {
      const res = await fetch(`/api/hubspot/properties/${fieldName}/options?objectType=${objectType}`);
      if (!res.ok) return;

      const data = await res.json();
      if (data.options && data.options.length > 0) {
        // Auto-populate with HubSpot's actual enum values
        const values = data.options.map((opt: any) => opt.value);
        updateFieldRuleConfig(ruleIndex, { order: values });
      }
    } catch (error) {
      console.error('Failed to fetch enum values:', error);
    }
  }

  function updateFieldRuleConfig(index: number, config: Record<string, any>) {
    const updated = [...fieldRules];
    updated[index] = { ...updated[index], config: { ...updated[index].config, ...config } };
    setFieldRules(updated);
  }

  // Phase 2: Sort fields with popular ones first
  const POPULAR_FIELDS = ['domain', 'name', 'email', 'phone', 'lifecyclestage', 'industry', 'company', 'city', 'state', 'country'];

  function getSortedFieldOptions(): HubSpotField[] {
    return [...fieldOptions].sort((a, b) => {
      const aPopular = POPULAR_FIELDS.indexOf(a.name);
      const bPopular = POPULAR_FIELDS.indexOf(b.name);

      if (aPopular !== -1 && bPopular !== -1) return aPopular - bPopular;
      if (aPopular !== -1) return -1;
      if (bPopular !== -1) return 1;

      return a.label.localeCompare(b.label);
    });
  }

  function removeFieldRule(index: number) {
    setFieldRules(fieldRules.filter((_, i) => i !== index));
  }

  function moveFieldRule(index: number, direction: 'up' | 'down') {
    if (
      (direction === 'up' && index === 0) ||
      (direction === 'down' && index === fieldRules.length - 1)
    ) {
      return;
    }

    const updated = [...fieldRules];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    [updated[index], updated[targetIndex]] = [updated[targetIndex], updated[index]];
    setFieldRules(updated);
  }

  function addComplianceField() {
    if (newComplianceField && !complianceFields.includes(newComplianceField)) {
      setComplianceFields([...complianceFields, newComplianceField]);
      setNewComplianceField('');
    }
  }

  function removeComplianceField(field: string) {
    setComplianceFields(complianceFields.filter(f => f !== field));
  }

  // Signal Groups helper functions
  function addGroup(templateKey?: string) {
    const newGroup: any = {
      id: `new-${Date.now()}`,
      name: '',
      group_order: editingGroups.length + 1,
      conditions: templateKey && TEMPLATES[templateKey as keyof typeof TEMPLATES]
        ? [...TEMPLATES[templateKey as keyof typeof TEMPLATES].conditions]
        : [{ field: '', match_type: 'exact', fuzzy_threshold: 0.85, weight: 10 }],
    };
    setEditingGroups([...editingGroups, newGroup]);
  }

  function removeGroup(groupIndex: number) {
    setEditingGroups(editingGroups.filter((_, i) => i !== groupIndex));
    // Clear any errors for this group
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

    // Update group_order
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

  async function saveSignalGroups() {
    // Validate
    const errors: Record<number, string> = {};
    editingGroups.forEach((group, idx) => {
      if (!group.conditions || group.conditions.length === 0) {
        errors[idx] = 'Group must have at least 1 condition';
      } else {
        group.conditions.forEach((condition: any, condIdx: number) => {
          if (!condition.field) {
            errors[idx] = 'Select a field to continue';
          }
        });
      }
    });

    if (Object.keys(errors).length > 0) {
      setGroupErrors(errors);
      return;
    }

    setGroupErrors({});
    setSavingGroups(true);

    try {
      const res = await fetch('/api/dedup/signal-groups/bulk', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          objectType: activeTab,
          groups: editingGroups.map((group) => ({
            name: group.name || `Group ${group.group_order}`,
            group_order: group.group_order,
            conditions: group.conditions,
          })),
        }),
      });

      if (!res.ok) throw new Error('Failed to save signal groups');

      const data = await res.json();
      setSignalGroups(data.groups || []);
      setEditingGroups(data.groups || []);

      addToast('success', 'Matching rules saved');
    } catch (error) {
      console.error('Failed to save signal groups:', error);
      addToast('error', 'Failed to save matching rules');
    } finally {
      setSavingGroups(false);
    }
  }

  async function resetToDefaults() {
    if (!confirm('Remove all custom matching rules? Refyne will use standard matching.')) {
      return;
    }

    setSavingGroups(true);

    try {
      const res = await fetch('/api/dedup/signal-groups/bulk', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          objectType: activeTab,
          groups: [],
        }),
      });

      if (!res.ok) throw new Error('Failed to reset signal groups');

      setSignalGroups([]);
      setEditingGroups([]);

      addToast('success', 'Reset to default matching');
    } catch (error) {
      console.error('Failed to reset signal groups:', error);
      addToast('error', 'Failed to reset');
    } finally {
      setSavingGroups(false);
    }
  }

  // Load signal groups when tab changes
  useEffect(() => {
    if (signalGroups.length > 0) {
      // Filter groups for active tab
      const tabGroups = signalGroups.filter((g) => g.object_type === activeTab);
      setEditingGroups(tabGroups.length > 0 ? JSON.parse(JSON.stringify(tabGroups)) : []);
    }
  }, [activeTab]);

  // Field Exclusions helper functions
  function addExclusion() {
    const newExclusion = {
      id: `new-${Date.now()}`,
      field_name: '',
      exclusion_type: 'never_merge',
      separator: '\n',
    };
    setEditingExclusions([...editingExclusions, newExclusion]);
  }

  function removeExclusion(index: number) {
    setEditingExclusions(editingExclusions.filter((_, i) => i !== index));
    // Clear any errors for this exclusion
    const newErrors = { ...exclusionErrors };
    delete newErrors[index];
    setExclusionErrors(newErrors);
  }

  function updateExclusion(index: number, updates: any) {
    const newExclusions = [...editingExclusions];
    newExclusions[index] = { ...newExclusions[index], ...updates };
    setEditingExclusions(newExclusions);
  }

  async function saveFieldExclusions() {
    // Validate
    const errors: Record<number, string> = {};
    editingExclusions.forEach((excl, idx) => {
      // Skip compliance fields (they're read-only)
      if (isComplianceField(excl.field_name)) return;

      if (!excl.field_name) {
        errors[idx] = 'Select a field to continue';
      }
      if (!excl.exclusion_type) {
        errors[idx] = 'Select a type to continue';
      }
    });

    if (Object.keys(errors).length > 0) {
      setExclusionErrors(errors);
      return;
    }

    setExclusionErrors({});
    setSavingExclusions(true);

    try {
      // Filter out compliance fields from save payload
      const customExclusions = editingExclusions.filter(
        (excl) => !isComplianceField(excl.field_name)
      );

      const res = await fetch('/api/dedup/field-exclusions/bulk', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          objectType: activeTab,
          exclusions: customExclusions.map((excl) => ({
            fieldName: excl.field_name,
            exclusionType: excl.exclusion_type,
            separator: excl.separator,
          })),
        }),
      });

      if (!res.ok) throw new Error('Failed to save field exclusions');

      const data = await res.json();
      setFieldExclusions(data.exclusions || []);

      // Update editing state with returned data (includes compliance fields)
      const tabExclusions = (data.exclusions || []).filter((e: any) => e.object_type === activeTab);
      setEditingExclusions(JSON.parse(JSON.stringify(tabExclusions)));

      addToast('success', 'Field exceptions saved');
    } catch (error) {
      console.error('Failed to save field exclusions:', error);
      addToast('error', 'Failed to save field exceptions');
    } finally {
      setSavingExclusions(false);
    }
  }

  // Load field exclusions when tab changes
  useEffect(() => {
    if (fieldExclusions.length > 0) {
      const tabExclusions = fieldExclusions.filter((e) => e.object_type === activeTab);
      setEditingExclusions(tabExclusions.length > 0 ? JSON.parse(JSON.stringify(tabExclusions)) : []);
    }
  }, [activeTab]);

  if (loading) {
    return (
      <div style={{ padding: 32 }}>
        <div style={{ fontSize: 14, color: C.text2 }}>Loading policy...</div>
      </div>
    );
  }

  // Member view - hide entire page
  if (!isAdmin) {
    return (
      <div style={{ padding: 32 }}>
        <h1 style={{ fontSize: 24, fontWeight: 600, color: C.text, marginBottom: 8 }}>
          Dedup Merge Policies
        </h1>
        <AdminOnlyNotice action="configure dedup policies" />
      </div>
    );
  }

  return (
    <div style={{ padding: 32, maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 24, fontWeight: 600, color: C.text, marginBottom: 8 }}>
          Dedup Merge Policies
        </h1>
        <div style={{ fontSize: 14, color: C.text2 }}>
          Configure how duplicate companies are merged together.
        </div>
        {isDefault && (
          <div
            style={{
              marginTop: 12,
              padding: 12,
              background: '#FEF3C7',
              border: '1px solid #FCD34D',
              fontSize: 13,
              color: '#92400E',
            }}
          >
            Using default policy. Save changes to create your own org-specific policy.
          </div>
        )}
      </div>

      {/* Section 1: Policy Name */}
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, color: C.text, marginBottom: 12 }}>
          Policy Name
        </h2>
        <input
          type="text"
          value={policyName}
          onChange={(e) => setPolicyName(e.target.value)}
          style={{
            width: '100%',
            maxWidth: 400,
            padding: '8px 12px',
            fontSize: 14,
            border: `1px solid ${C.border}`,
            borderRadius: 4,
          }}
          placeholder="Default Policy"
        />
      </div>

      {/* Section 2: Exclusion Rules */}
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, color: C.text, marginBottom: 12 }}>
          Exclusion Rules
        </h2>
        <div style={{ fontSize: 13, color: C.text2, marginBottom: 16 }}>
          Block merges if these conditions are detected:
        </div>

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
      </div>

      {/* Section 3: Compliance Fields */}
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, color: C.text, marginBottom: 12 }}>
          Compliance Fields
        </h2>
        <div style={{ fontSize: 13, color: C.text2, marginBottom: 16 }}>
          These fields always use the most restrictive value across all records:
        </div>

        <div style={{ marginBottom: 12 }}>
          {complianceFields.map((field) => (
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ fontSize: 13, color: C.text }}>
                  {getComplianceFieldLabel(field)}
                </div>
                <div style={{ fontSize: 11, fontFamily: 'monospace', color: C.text3 }}>
                  {field}
                </div>
              </div>
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
          <input
            type="text"
            value={newComplianceField}
            onChange={(e) => setNewComplianceField(e.target.value)}
            placeholder="hs_email_optout"
            style={{
              flex: 1,
              padding: '8px 12px',
              fontSize: 14,
              fontFamily: 'monospace',
              border: `1px solid ${C.border}`,
              borderRadius: 4,
            }}
          />
          <button
            onClick={addComplianceField}
            style={{
              padding: '8px 16px',
              fontSize: 14,
              color: C.indigo,
              background: 'white',
              border: `1px solid ${C.indigo}`,
              borderRadius: 4,
              cursor: 'pointer',
            }}
          >
            Add Field
          </button>
        </div>
      </div>

      {/* Section 4: Field Merge Rules */}
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, color: C.text, marginBottom: 12 }}>
          Field Merge Rules
        </h2>
        <div style={{ fontSize: 13, color: C.text2, marginBottom: 16 }}>
          Define how specific fields should be merged. Rules are applied in order (top to bottom).
          Use <code>*</code> for wildcard to match all fields.
        </div>

        {fieldRules.length === 0 && (
          <div
            style={{
              padding: 24,
              background: C.surface,
              border: `1px solid ${C.border}`,
              textAlign: 'center',
              fontSize: 13,
              color: C.text3,
              marginBottom: 16,
            }}
          >
            No field rules defined. Click "Add Rule" to create one.
          </div>
        )}

        {fieldRules.map((rule, index) => (
          <div
            key={index}
            style={{
              padding: 20,
              background: C.surface,
              border: `1px solid ${C.border}`,
              marginBottom: 16,
              borderRadius: 0,
            }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 16, marginBottom: 16 }}>
              {/* Field name */}
              <div>
                <div style={{ fontSize: 11, color: C.text3, marginBottom: 6, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Field
                </div>
                <select
                  value={rule.field}
                  onChange={(e) =>
                    updateFieldRule(index, { field: e.target.value })
                  }
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    fontSize: 13,
                    border: `1px solid ${C.border}`,
                    borderRadius: 0,
                    background: C.bg,
                    color: C.text,
                    cursor: 'pointer',
                  }}
                >
                  <option value="">Select field...</option>
                  <option value="*">* (All fields)</option>
                  {loadingFields ? (
                    <option disabled>Loading fields...</option>
                  ) : (
                    getSortedFieldOptions().map((field) => (
                      <option key={field.name} value={field.name}>
                        {field.label} ({field.name})
                      </option>
                    ))
                  )}
                </select>
              </div>

              {/* Rule type */}
              <div>
                <div style={{ fontSize: 11, color: C.text3, marginBottom: 6, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Rule
                </div>
                <select
                  value={rule.rule}
                  onChange={(e) =>
                    updateFieldRule(index, { rule: e.target.value })
                  }
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    fontSize: 13,
                    border: `1px solid ${C.border}`,
                    borderRadius: 0,
                    background: C.bg,
                    color: C.text,
                    cursor: 'pointer',
                  }}
                >
                  {getApplicableRules(fieldTypes[index]).map((rt) => (
                    <option key={rt.value} value={rt.value}>
                      {rt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Rule description */}
            <div style={{ fontSize: 12, color: C.text3, marginBottom: 16, fontStyle: 'italic' }}>
              {RULE_TYPES.find((rt) => rt.value === rule.rule)?.description}
            </div>

            {/* Config for keep_most_advanced */}
            {rule.rule === 'keep_most_advanced' && (
              <div style={{ marginBottom: 16, padding: 16, background: C.bg, border: `1px solid ${C.border}` }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: C.text, marginBottom: 8 }}>
                  Funnel Order
                </div>
                {rule.config.order && rule.config.order.length > 0 ? (
                  <OrderEditor
                    values={rule.config.order}
                    onChange={(order) => updateFieldRuleConfig(index, { order })}
                    fieldKey={rule.field}
                    topLabel="Most advanced"
                    bottomLabel="Least advanced"
                  />
                ) : (
                  <div style={{ fontSize: 12, color: C.text3, fontStyle: 'italic', padding: '12px 0' }}>
                    {loadingFields ? 'Loading enum values...' : 'Select an enumeration field to configure funnel order'}
                  </div>
                )}
              </div>
            )}

            {/* Config for append_both */}
            {rule.rule === 'append_both' && (
              <div style={{ marginBottom: 16, padding: 12, background: C.bg, border: `1px solid ${C.border}` }}>
                <div style={{ fontSize: 11, color: C.text3, marginBottom: 6, fontWeight: 500 }}>
                  Separator
                </div>
                <input
                  type="text"
                  value={rule.config.separator || '; '}
                  onChange={(e) =>
                    updateFieldRule(index, {
                      config: { separator: e.target.value },
                    })
                  }
                  placeholder="; "
                  style={{
                    width: 200,
                    padding: '8px 12px',
                    fontSize: 13,
                    border: `1px solid ${C.border}`,
                    borderRadius: 0,
                    background: C.surface,
                    color: C.text,
                  }}
                />
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', gap: 8, borderTop: `1px solid ${C.border}`, paddingTop: 12 }}>
              <button
                onClick={() => moveFieldRule(index, 'up')}
                disabled={index === 0}
                style={{
                  padding: '6px 12px',
                  fontSize: 11,
                  background: 'transparent',
                  color: index === 0 ? C.text3 : C.text,
                  border: `1px solid ${C.border}`,
                  borderRadius: 0,
                  cursor: index === 0 ? 'not-allowed' : 'pointer',
                  fontWeight: 500,
                }}
              >
                ↑ Move up
              </button>
              <button
                onClick={() => moveFieldRule(index, 'down')}
                disabled={index === fieldRules.length - 1}
                style={{
                  padding: '6px 12px',
                  fontSize: 11,
                  background: 'transparent',
                  color: index === fieldRules.length - 1 ? C.text3 : C.text,
                  border: `1px solid ${C.border}`,
                  borderRadius: 0,
                  cursor: index === fieldRules.length - 1 ? 'not-allowed' : 'pointer',
                  fontWeight: 500,
                }}
              >
                ↓ Move down
              </button>
              <button
                onClick={() => removeFieldRule(index)}
                style={{
                  marginLeft: 'auto',
                  padding: '6px 12px',
                  fontSize: 11,
                  color: C.red,
                  background: 'transparent',
                  border: `1px solid ${C.red}`,
                  borderRadius: 0,
                  cursor: 'pointer',
                  fontWeight: 500,
                }}
              >
                Remove
              </button>
            </div>
          </div>
        ))}

        <button
          onClick={addFieldRule}
          style={{
            padding: '10px 20px',
            fontSize: 13,
            color: C.text,
            background: C.indigo,
            border: `1px solid ${C.indigo}`,
            borderRadius: 0,
            cursor: 'pointer',
            fontWeight: 500,
          }}
        >
          + Add Rule
        </button>
      </div>

      {/* Section 5: Matching Rules (Signal Groups) */}
      <div style={{ marginBottom: 32, paddingTop: 32, borderTop: `2px solid ${C.border}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 600, color: C.text, marginBottom: 4 }}>
              Matching Rules
            </h2>
            <div style={{ fontSize: 13, color: C.text2, maxWidth: 600 }}>
              Define how Refyne identifies duplicate records. Rules within a group must ALL match.
              Refyne tries each group in order until one matches.
            </div>
          </div>
          <button
            onClick={() => addGroup()}
            style={{
              padding: '8px 16px',
              fontSize: 13,
              fontWeight: 500,
              color: 'white',
              background: C.indigo,
              border: 'none',
              borderRadius: 0,
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
              borderBottom: activeTab === 'company' ? `2px solid ${C.indigo}` : '2px solid transparent',
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
              borderBottom: activeTab === 'contact' ? `2px solid ${C.indigo}` : '2px solid transparent',
              cursor: 'pointer',
            }}
          >
            Contacts
          </button>
        </div>

        {editingGroups.length === 0 ? (
          <div style={{ marginBottom: 24 }}>
            <div
              style={{
                padding: 32,
                background: C.surface,
                border: `1px solid ${C.border}`,
                textAlign: 'center',
              }}
            >
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
                  color: C.indigo,
                  background: 'white',
                  border: `1px solid ${C.indigo}`,
                  borderRadius: 0,
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
                      borderRadius: 0,
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
            {editingGroups.map((group, groupIdx) => (
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
                        borderRadius: 0,
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
                        borderRadius: 0,
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
                        borderRadius: 0,
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
                <div
                  style={{
                    border: `1px solid rgba(255, 255, 255, 0.08)`,
                    borderTop: 'none',
                  }}
                >
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
                  {group.conditions.map((condition: any, condIdx: number) => (
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
                      {/* Field Dropdown */}
                      <select
                        value={condition.field}
                        onChange={(e) => updateCondition(groupIdx, condIdx, { field: e.target.value })}
                        style={{
                          padding: '8px 12px',
                          fontSize: 13,
                          border: `1px solid ${C.border}`,
                          borderRadius: 0,
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

                      {/* Match Type Dropdown */}
                      <select
                        value={condition.match_type}
                        onChange={(e) => updateCondition(groupIdx, condIdx, { match_type: e.target.value })}
                        style={{
                          padding: '8px 12px',
                          fontSize: 13,
                          border: `1px solid ${C.border}`,
                          borderRadius: 0,
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

                      {/* Accuracy Dropdown (only for fuzzy) */}
                      {condition.match_type === 'fuzzy' ? (
                        <select
                          value={condition.fuzzy_threshold}
                          onChange={(e) => updateCondition(groupIdx, condIdx, { fuzzy_threshold: parseFloat(e.target.value) })}
                          style={{
                            padding: '8px 12px',
                            fontSize: 13,
                            border: `1px solid ${C.border}`,
                            borderRadius: 0,
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

                      {/* Delete Button */}
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
                        color: C.indigo,
                        background: 'transparent',
                        border: `1px solid ${C.indigo}`,
                        borderRadius: 0,
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

                {/* OR Divider (except for last group) */}
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

            {/* Add Group Button */}
            <button
              onClick={() => addGroup()}
              style={{
                padding: '10px 20px',
                fontSize: 13,
                fontWeight: 500,
                color: C.text,
                background: C.indigo,
                border: 'none',
                borderRadius: 0,
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

        {/* Save/Reset Buttons */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 12,
            paddingTop: 16,
            borderTop: `1px solid ${C.border}`,
          }}
        >
          <button
            onClick={resetToDefaults}
            disabled={savingGroups}
            style={{
              padding: '10px 20px',
              fontSize: 13,
              fontWeight: 500,
              color: C.text3,
              background: 'transparent',
              border: `1px solid ${C.border}`,
              borderRadius: 0,
              cursor: savingGroups ? 'not-allowed' : 'pointer',
            }}
          >
            Reset to defaults
          </button>
          <button
            onClick={saveSignalGroups}
            disabled={savingGroups}
            style={{
              padding: '10px 20px',
              fontSize: 13,
              fontWeight: 500,
              color: 'white',
              background: savingGroups ? C.text3 : C.indigo,
              border: 'none',
              borderRadius: 0,
              cursor: savingGroups ? 'not-allowed' : 'pointer',
            }}
          >
            {savingGroups ? 'Saving...' : 'Save changes'}
          </button>
        </div>
      </div>

      {/* Section 6: Field Exceptions */}
      <div style={{ marginBottom: 32, paddingTop: 32, borderTop: `2px solid ${C.border}` }}>
        <div style={{ marginBottom: 16 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: C.text, marginBottom: 4 }}>
            Field Exceptions
          </h2>
          <div style={{ fontSize: 13, color: C.text2 }}>
            Configure how specific fields behave during merge. These override the default survivorship rules.
          </div>
        </div>

        {/* Auto-protected compliance fields */}
        {editingExclusions.filter((e) => isComplianceField(e.field_name)).length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: C.text, marginBottom: 8 }}>
              Compliance fields - always protected
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    borderBottom: `1px solid ${C.border}`,
                  }}
                >
                  <th
                    style={{
                      padding: 12,
                      textAlign: 'left',
                      fontSize: 11,
                      fontWeight: 600,
                      color: C.text3,
                      textTransform: 'uppercase',
                    }}
                  >
                    Field
                  </th>
                  <th
                    style={{
                      padding: 12,
                      textAlign: 'left',
                      fontSize: 11,
                      fontWeight: 600,
                      color: C.text3,
                      textTransform: 'uppercase',
                    }}
                  >
                    Behavior
                  </th>
                </tr>
              </thead>
              <tbody>
                {editingExclusions
                  .filter((e) => isComplianceField(e.field_name))
                  .map((exclusion, idx) => (
                    <tr
                      key={exclusion.id || idx}
                      style={{
                        background: 'rgba(255,255,255,0.03)',
                        borderBottom: `1px solid rgba(255,255,255,0.04)`,
                      }}
                    >
                      <td style={{ padding: 12, fontSize: 13, color: C.text, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Lock size={12} color={C.text3} />
                        {exclusion.field_name}
                      </td>
                      <td style={{ padding: 12, fontSize: 13, color: C.text }}>
                        If any record = true → true
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>

            <div
              style={{
                padding: 12,
                background: 'rgba(255,255,255,0.03)',
                fontSize: 12,
                color: C.text3,
                fontStyle: 'italic',
              }}
            >
              These fields are automatically set to the most restrictive value during merge.
            </div>
          </div>
        )}

        {/* Custom exceptions */}
        <div style={{ fontSize: 13, fontWeight: 500, color: C.text, marginBottom: 12 }}>
          Custom exceptions
        </div>

        {editingExclusions.filter((e) => !isComplianceField(e.field_name)).length === 0 ? (
          <div
            style={{
              padding: 32,
              background: C.surface,
              border: `1px solid ${C.border}`,
              textAlign: 'center',
              marginBottom: 16,
            }}
          >
            <div style={{ fontSize: 14, color: C.text, marginBottom: 8 }}>
              No custom exceptions configured.
            </div>
            <div style={{ fontSize: 13, color: C.text3, marginBottom: 16 }}>
              Add exceptions for fields that need special handling during merge.
            </div>
            <button
              onClick={addExclusion}
              style={{
                padding: '10px 20px',
                fontSize: 13,
                fontWeight: 500,
                color: C.indigo,
                background: 'white',
                border: `1px solid ${C.indigo}`,
                borderRadius: 0,
                cursor: 'pointer',
              }}
            >
              + Add exception
            </button>
          </div>
        ) : (
          <div style={{ marginBottom: 16 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', border: `1px solid ${C.border}` }}>
              <thead>
                <tr style={{ background: C.surface, borderBottom: `1px solid ${C.border}` }}>
                  <th
                    style={{
                      padding: 12,
                      textAlign: 'left',
                      fontSize: 11,
                      fontWeight: 600,
                      color: C.text3,
                      textTransform: 'uppercase',
                      width: '30%',
                    }}
                  >
                    Field
                  </th>
                  <th
                    style={{
                      padding: 12,
                      textAlign: 'left',
                      fontSize: 11,
                      fontWeight: 600,
                      color: C.text3,
                      textTransform: 'uppercase',
                      width: '25%',
                    }}
                  >
                    Type
                  </th>
                  <th
                    style={{
                      padding: 12,
                      textAlign: 'left',
                      fontSize: 11,
                      fontWeight: 600,
                      color: C.text3,
                      textTransform: 'uppercase',
                      width: '35%',
                    }}
                  >
                    Config
                  </th>
                  <th style={{ width: '10%' }}></th>
                </tr>
              </thead>
              <tbody>
                {editingExclusions
                  .filter((e) => !isComplianceField(e.field_name))
                  .map((exclusion, idx) => {
                    const actualIndex = editingExclusions.indexOf(exclusion);
                    return (
                      <tr
                        key={exclusion.id || idx}
                        style={{
                          background: C.bg,
                          borderBottom: `1px solid rgba(255,255,255,0.04)`,
                        }}
                      >
                        {/* Field */}
                        <td style={{ padding: 12 }}>
                          <select
                            value={exclusion.field_name}
                            onChange={(e) => updateExclusion(actualIndex, { field_name: e.target.value })}
                            style={{
                              width: '100%',
                              padding: '8px 12px',
                              fontSize: 13,
                              border: `1px solid ${C.border}`,
                              borderRadius: 0,
                              background: C.surface,
                              color: C.text,
                              cursor: 'pointer',
                            }}
                          >
                            <option value="">Select field...</option>
                            {(activeTab === 'company' ? COMPANY_COMMON_FIELDS : CONTACT_COMMON_FIELDS).map(
                              (field) => (
                                <option key={field.value} value={field.value}>
                                  {field.label}
                                </option>
                              )
                            )}
                            <option disabled>─────────────</option>
                            <option value="custom">Type a HubSpot property name...</option>
                          </select>
                        </td>

                        {/* Type */}
                        <td style={{ padding: 12 }}>
                          <select
                            value={exclusion.exclusion_type}
                            onChange={(e) => updateExclusion(actualIndex, { exclusion_type: e.target.value })}
                            style={{
                              width: '100%',
                              padding: '8px 12px',
                              fontSize: 13,
                              border: `1px solid ${C.border}`,
                              borderRadius: 0,
                              background: C.surface,
                              color: C.text,
                              cursor: 'pointer',
                            }}
                          >
                            {EXCLUSION_TYPES.map((type) => (
                              <option key={type.value} value={type.value}>
                                {type.label}
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* Config */}
                        <td style={{ padding: 12 }}>
                          {exclusion.exclusion_type === 'append' ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontSize: 12, color: C.text3 }}>Join with:</span>
                              <select
                                value={exclusion.separator}
                                onChange={(e) => updateExclusion(actualIndex, { separator: e.target.value })}
                                style={{
                                  padding: '8px 12px',
                                  fontSize: 13,
                                  border: `1px solid ${C.border}`,
                                  borderRadius: 0,
                                  background: C.surface,
                                  color: C.text,
                                  cursor: 'pointer',
                                }}
                              >
                                {SEPARATOR_OPTIONS.map((sep) => (
                                  <option key={sep.value} value={sep.value}>
                                    {sep.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                          ) : (
                            <span style={{ fontSize: 13, color: C.text3 }}>—</span>
                          )}
                        </td>

                        {/* Delete */}
                        <td style={{ padding: 12, textAlign: 'center' }}>
                          <button
                            onClick={() => removeExclusion(actualIndex)}
                            style={{
                              padding: 0,
                              background: 'transparent',
                              border: 'none',
                              color: C.text3,
                              cursor: 'pointer',
                            }}
                          >
                            <X size={16} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>

            {/* Add Exception Button */}
            <button
              onClick={addExclusion}
              style={{
                marginTop: 12,
                padding: '8px 16px',
                fontSize: 13,
                fontWeight: 500,
                color: C.indigo,
                background: 'transparent',
                border: `1px solid ${C.indigo}`,
                borderRadius: 0,
                cursor: 'pointer',
              }}
            >
              + Add exception
            </button>
          </div>
        )}

        {/* Save Button */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            paddingTop: 16,
            borderTop: `1px solid ${C.border}`,
          }}
        >
          <button
            onClick={saveFieldExclusions}
            disabled={savingExclusions}
            style={{
              padding: '10px 20px',
              fontSize: 13,
              fontWeight: 500,
              color: 'white',
              background: savingExclusions ? C.text3 : C.indigo,
              border: 'none',
              borderRadius: 0,
              cursor: savingExclusions ? 'not-allowed' : 'pointer',
            }}
          >
            {savingExclusions ? 'Saving...' : 'Save changes'}
          </button>
        </div>
      </div>

      {/* Section 7: Owner & Hierarchy Settings (V2) */}
      <div style={{ marginBottom: 32 }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, color: C.text, marginBottom: 12 }}>
          Owner & Hierarchy Settings
        </h3>
        <div style={{ fontSize: 13, color: C.text2, marginBottom: 16 }}>
          Handle inactive owners and parent/child company relationships during merges.
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Inactive Owner Action */}
          <div>
            <div style={{ fontSize: 13, fontWeight: 500, color: C.text, marginBottom: 8 }}>
              Inactive Owner Action
            </div>
            <select
              value={inactiveOwnerAction}
              onChange={(e) => setInactiveOwnerAction(e.target.value)}
              style={{
                padding: '10px 12px',
                fontSize: 13,
                border: `1px solid ${C.border}`,
                borderRadius: 0,
                background: C.bg,
                color: C.text,
                cursor: 'pointer',
                width: 300,
              }}
            >
              <option value="warn">Warn (keep inactive owner with warning)</option>
              <option value="assign_fallback">Assign Fallback Owner</option>
              <option value="leave_unassigned">Leave Unassigned</option>
            </select>
          </div>

          {/* Fallback Owner ID (only if assign_fallback selected) */}
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
                  borderRadius: 0,
                  background: C.bg,
                  color: C.text,
                  width: 300,
                }}
              />
            </div>
          )}

          {/* Parent/Child Awareness */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={parentChildAwareness}
              onChange={(e) => setParentChildAwareness(e.target.checked)}
              style={{ cursor: 'pointer' }}
            />
            <span style={{ color: C.text }}>
              Enable parent/child awareness (prefer companies without parents as survivors)
            </span>
          </label>

          {/* Require Closed Won Survivor */}
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
        </div>
      </div>

      {/* Save button */}
      <div
        style={{
          borderTop: `1px solid ${C.border}`,
          paddingTop: 24,
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
          gap: 16,
        }}
      >
        {justSaved && (
          <a
            href="/settings/activity?action=dedup_policy.updated"
            style={{
              fontSize: 12,
              color: C.indigo,
              textDecoration: 'none',
            }}
          >
            View in activity log →
          </a>
        )}
        <button
          onClick={savePolicy}
          disabled={saving}
          style={{
            padding: '12px 24px',
            fontSize: 14,
            fontWeight: 500,
            color: 'white',
            background: saving ? C.text3 : C.indigo,
            border: 'none',
            borderRadius: 4,
            cursor: saving ? 'not-allowed' : 'pointer',
          }}
        >
          {saving ? 'Saving...' : 'Save Policy'}
        </button>
      </div>
    </div>
  );
}
