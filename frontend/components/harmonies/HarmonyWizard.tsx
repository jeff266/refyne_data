'use client';

import { useState, useEffect, useMemo } from 'react';
import { X, ChevronRight, ChevronLeft, Loader2, Check, AlertTriangle, Info } from 'lucide-react';
import { C, F } from '@/lib/design-tokens';
import { PrimaryBtn, GhostBtn } from '@/components/refyne';
import { HubSpotPropertyPicker } from './HubSpotPropertyPicker';
import { ConditionBuilder } from './ConditionBuilder';
import { SearchableCountrySelect } from '@/components/SearchableCountrySelect';
import type { ConditionGroups } from '@/lib/harmonies/condition-evaluator';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  useDroppable,
  useDraggable,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface HarmonyWizardProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

interface DistinctValue {
  value: string;
  count: number;
  group?: string;
}

interface ValueGroup {
  id: string;
  label: string;
  values: string[];
}

export function HarmonyWizard({ open, onClose, onSuccess }: HarmonyWizardProps) {
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  // Step 1: Basics
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<'company' | 'contact'>('company');
  const [field, setField] = useState('');
  const [fieldLabel, setFieldLabel] = useState('');
  const [fieldType, setFieldType] = useState<string>(''); // HubSpot field type (string, number, enumeration, etc.)
  const [transformType, setTransformType] = useState<'format' | 'group'>('group');
  const [formatFunction, setFormatFunction] = useState<string>('');

  // Phone config state
  const [phoneConfig, setPhoneConfig] = useState({
    format: 'e164_formatted',
    default_country_code: '1'
  });

  // Step 2: Scan
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [distinctValues, setDistinctValues] = useState<DistinctValue[]>([]);
  const [scanJobId, setScanJobId] = useState<string | null>(null);
  const [scanCompleted, setScanCompleted] = useState(false);

  // Step 3: Grouping
  const [approach, setApproach] = useState<'reference_list' | 'rule_based' | 'regex'>('reference_list');
  const [groups, setGroups] = useState<ValueGroup[]>([]);
  const [ungrouped, setUngrouped] = useState<string[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null); // For drag-and-drop
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null); // For click-to-add
  const [ungroupedSearch, setUngroupedSearch] = useState('');
  const [ungroupedSort, setUngroupedSort] = useState<'alpha' | 'count'>('alpha');

  // Filter state
  const [filterOperator, setFilterOperator] = useState<string>('contains');
  const [filterValue, setFilterValue] = useState('');
  const [filterValue2, setFilterValue2] = useState(''); // For "between" operator

  // Multi-select state
  const [selectedValues, setSelectedValues] = useState<Set<string>>(new Set());
  const [lastClickedIndex, setLastClickedIndex] = useState<number | null>(null);
  const [batchGroupId, setBatchGroupId] = useState<string>('');

  // Step 4: Add Conditions (optional)
  const [conditionMode, setConditionMode] = useState<'all' | 'conditional'>('all');
  const [conditionGroups, setConditionGroups] = useState<ConditionGroups | null>(null);

  // Step 5: Preview
  const [harmonyId, setHarmonyId] = useState<string | null>(null);

  // Error handling
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const steps = [
    { number: 1, label: 'Basics' },
    { number: 2, label: 'Scan Field' },
    { number: 3, label: 'Group Values' },
    { number: 4, label: 'Add Conditions' },
    { number: 5, label: 'Preview' },
  ];

  // Map field types to allowed transform functions
  const getAvailableFunctions = (fieldName: string): string[] => {
    const fieldLower = fieldName.toLowerCase();

    // Phone fields
    if (['phone', 'mobilephone', 'fax'].includes(fieldLower)) {
      return ['e164_phone'];
    }

    // Email fields
    if (fieldLower === 'email') {
      return ['email_lowercase'];
    }

    // URL fields
    if (['website', 'linkedin_company_page', 'linkedin_url'].includes(fieldLower)) {
      return ['linkedin_url', 'url_canonical'];
    }

    // Name fields
    if (['name', 'firstname', 'lastname', 'company'].includes(fieldLower)) {
      return ['smart_title_case'];
    }

    // Numeric fields
    if (['numberofemployees', 'annualrevenue'].includes(fieldLower)) {
      return ['numeric_parse'];
    }

    // Default: show all options
    return ['e164_phone', 'email_lowercase', 'linkedin_url', 'smart_title_case', 'numeric_parse', 'url_canonical'];
  };

  // Filter dropdown options based on selected field
  const availableFunctions = useMemo(() => {
    if (!field) return ['e164_phone', 'email_lowercase', 'linkedin_url', 'smart_title_case', 'numeric_parse', 'url_canonical'];
    return getAvailableFunctions(field);
  }, [field]);

  // Auto-select format function if only one option available
  useEffect(() => {
    if (transformType === 'format' && availableFunctions.length === 1 && !formatFunction) {
      setFormatFunction(availableFunctions[0]);
    }
  }, [transformType, availableFunctions, formatFunction]);

  const canAdvance = () => {
    if (step === 1) {
      if (transformType === 'format') {
        return name && field && formatFunction;
      }
      return name && field;
    }
    if (step === 2) return distinctValues.length > 0;
    if (step === 3) return groups.length > 0;
    if (step === 4) {
      // Conditions are optional - allow advancement regardless
      // If conditional mode, must have at least one valid condition
      if (conditionMode === 'conditional') {
        return conditionGroups && conditionGroups.groups.length > 0;
      }
      return true;
    }
    return true;
  };

  const handleNext = async () => {
    if (step === 1) {
      // Create harmony
      try {
        setSaving(true);

        // Branch on transform type
        if (transformType === 'format') {
          // Format function: skip Steps 2 & 3, go directly to Step 4
          const transform_config = formatFunction === 'e164_phone' ? phoneConfig : undefined;

          const res = await fetch('/api/harmonies', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name,
              description,
              category,
              field,
              transform_type: 'format',
              transform_function: formatFunction,
              transform_config,
            }),
          });

          if (res.ok) {
            const data = await res.json();
            setHarmonyId(data.id);
            setStep(4); // Skip Steps 2 & 3
          } else {
            alert('Failed to create harmony');
          }
        } else {
          // Group values: existing behavior
          const res = await fetch('/api/harmonies', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name,
              description,
              category,
              field,
              approach: 'reference_list', // Default, will be set in step 3
            }),
          });

          if (res.ok) {
            const data = await res.json();
            setHarmonyId(data.id);
            setStep(2);
          } else {
            alert('Failed to create harmony');
          }
        }
      } catch (err) {
        console.error('Failed to create harmony:', err);
        alert('Failed to create harmony');
      } finally {
        setSaving(false);
      }
    } else if (step === 2) {
      // Initialize grouping with all values as ungrouped
      setUngrouped(distinctValues.map((v) => v.value));
      setStep(3);
    } else if (step === 3) {
      // Save groups as rules and proceed to conditions
      try {
        setSaving(true);
        const rules = groups.flatMap((group, groupIndex) =>
          group.values.map((value, valueIndex) => ({
            input_pattern: value,
            normalized_value: group.label,
            match_type: 'exact' as const,
            sort_order: groupIndex * 1000 + valueIndex,
          }))
        );

        const res = await fetch(`/api/harmonies/${harmonyId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ approach, rules }),
        });

        if (res.ok) {
          setStep(4);
        } else {
          const errorData = await res.json().catch(() => ({}));
          const message = errorData.error || `Failed to save rules (${res.status})`;
          console.error('Failed to save rules:', message, errorData);
          setErrorMessage(message);
        }
      } catch (err) {
        console.error('Failed to save rules:', err);
        setErrorMessage(err instanceof Error ? err.message : 'Failed to save rules. Please try again.');
      } finally {
        setSaving(false);
      }
    } else if (step === 4) {
      // Save conditions and proceed to preview
      try {
        setSaving(true);
        const res = await fetch(`/api/harmonies/${harmonyId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            conditionGroups: conditionMode === 'conditional' ? conditionGroups : null,
          }),
        });

        if (res.ok) {
          setStep(5);
        } else {
          alert('Failed to save conditions');
        }
      } catch (err) {
        console.error('Failed to save conditions:', err);
        alert('Failed to save conditions');
      } finally {
        setSaving(false);
      }
    } else {
      // Final step - activate and close
      try {
        setSaving(true);
        const res = await fetch(`/api/harmonies/${harmonyId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_active: true }),
        });

        if (res.ok) {
          onSuccess?.();
          handleClose();
        } else {
          alert('Failed to activate harmony');
        }
      } catch (err) {
        console.error('Failed to activate harmony:', err);
        alert('Failed to activate harmony');
      } finally {
        setSaving(false);
      }
    }
  };

  const handleBack = () => {
    setStep(Math.max(1, step - 1));
  };

  const handleClose = () => {
    // Reset all state
    setStep(1);
    setName('');
    setDescription('');
    setCategory('company');
    setField('');
    setTransformType('group');
    setFormatFunction('');
    setScanning(false);
    setScanProgress(0);
    setDistinctValues([]);
    setScanJobId(null);
    setApproach('reference_list');
    setGroups([]);
    setUngrouped([]);
    setHarmonyId(null);
    onClose();
  };

  const startScan = async () => {
    if (!harmonyId) return;

    try {
      setScanning(true);
      setScanProgress(0);
      setScanCompleted(false);

      const res = await fetch(`/api/harmonies/${harmonyId}/scan`, {
        method: 'POST',
      });

      if (res.ok) {
        const data = await res.json();
        setScanJobId(data.jobId);
        // Start polling for progress
        pollScanProgress(data.jobId);
      } else {
        const errorData = await res.json().catch(() => ({ error: 'Unknown error' }));
        const errorMessage = errorData.error || 'Failed to start scan';
        console.error('Failed to start scan:', errorMessage);
        alert(errorMessage);
        setScanning(false);
      }
    } catch (err) {
      console.error('Failed to start scan:', err);
      alert('Failed to start scan: Network error');
      setScanning(false);
    }
  };

  const pollScanProgress = async (jobId: string) => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/harmonies/${harmonyId}/scan/status?jobId=${jobId}`);
        if (res.ok) {
          const data = await res.json();
          setScanProgress(data.progress || 0);

          if (data.status === 'completed') {
            clearInterval(interval);
            setScanning(false);
            setScanProgress(100);
            setDistinctValues(data.distinctValues || []);
            setScanCompleted(true);
          } else if (data.status === 'failed') {
            clearInterval(interval);
            setScanning(false);
            alert('Scan failed: ' + (data.error || 'Unknown error'));
          }
        }
      } catch (err) {
        console.error('Failed to poll scan progress:', err);
      }
    }, 1000);
  };

  const addGroup = () => {
    const newGroup: ValueGroup = {
      id: `group-${Date.now()}`,
      label: `Group ${groups.length + 1}`,
      values: [],
    };
    setGroups([...groups, newGroup]);
    setActiveGroupId(newGroup.id); // New group becomes active
  };

  const updateGroupLabel = (groupId: string, label: string) => {
    setGroups(groups.map((g) => (g.id === groupId ? { ...g, label } : g)));
  };

  const moveToGroup = (value: string, groupId: string) => {
    // Remove from ungrouped
    setUngrouped(ungrouped.filter((v) => v !== value));

    // Remove from any existing group
    const updatedGroups = groups.map((g) => ({
      ...g,
      values: g.values.filter((v) => v !== value),
    }));

    // Add to target group
    const finalGroups = updatedGroups.map((g) =>
      g.id === groupId ? { ...g, values: [...g.values, value] } : g
    );

    setGroups(finalGroups);
  };

  const moveToUngrouped = (value: string) => {
    // Remove from all groups
    setGroups(groups.map((g) => ({ ...g, values: g.values.filter((v) => v !== value) })));
    // Add to ungrouped
    if (!ungrouped.includes(value)) {
      setUngrouped([...ungrouped, value]);
    }
  };

  const handleUngroupedValueClick = (value: string) => {
    // Only add to group if there's an active group
    if (activeGroupId) {
      moveToGroup(value, activeGroupId);
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) {
      return;
    }

    const activeValue = active.id as string;
    const overId = over.id as string;

    // Check if dropped on a group
    if (overId.startsWith('group-')) {
      moveToGroup(activeValue, overId);
    } else if (overId === 'ungrouped') {
      moveToUngrouped(activeValue);
    }
  };

  // Filter and sort ungrouped values
  const getFilteredSortedUngrouped = () => {
    let filtered = ungrouped;

    // Apply advanced filter
    if (filterValue) {
      const isNumber = fieldType === 'number';

      filtered = filtered.filter((v) => {
        if (isNumber) {
          const numValue = parseFloat(v);
          const filterNum = parseFloat(filterValue);
          if (isNaN(numValue) || isNaN(filterNum)) return false;

          switch (filterOperator) {
            case '>': return numValue > filterNum;
            case '<': return numValue < filterNum;
            case '>=': return numValue >= filterNum;
            case '<=': return numValue <= filterNum;
            case '=': return numValue === filterNum;
            case 'between': {
              const filterNum2 = parseFloat(filterValue2);
              if (isNaN(filterNum2)) return false;
              return numValue >= filterNum && numValue <= filterNum2;
            }
            default: return true;
          }
        } else {
          // String/enum filtering
          const lowerValue = v.toLowerCase();
          const lowerFilter = filterValue.toLowerCase();

          switch (filterOperator) {
            case 'contains': return lowerValue.includes(lowerFilter);
            case 'starts with': return lowerValue.startsWith(lowerFilter);
            case 'ends with': return lowerValue.endsWith(lowerFilter);
            case 'is exactly': return lowerValue === lowerFilter;
            default: return true;
          }
        }
      });
    }

    // Apply sort
    if (ungroupedSort === 'alpha') {
      filtered = [...filtered].sort((a, b) => a.localeCompare(b));
    } else if (ungroupedSort === 'count') {
      // Sort by count from distinctValues
      filtered = [...filtered].sort((a, b) => {
        const aCount = distinctValues.find((d) => d.value === a)?.count || 0;
        const bCount = distinctValues.find((d) => d.value === b)?.count || 0;
        return bCount - aCount; // Descending
      });
    }

    return filtered;
  };

  // Multi-select handlers
  const handleValueClick = (value: string, index: number, event: React.MouseEvent) => {
    const filteredValues = getFilteredSortedUngrouped();

    if (event.shiftKey && lastClickedIndex !== null) {
      // Shift-click: select range
      const start = Math.min(lastClickedIndex, index);
      const end = Math.max(lastClickedIndex, index);
      const newSelection = new Set(selectedValues);

      for (let i = start; i <= end; i++) {
        newSelection.add(filteredValues[i]);
      }

      setSelectedValues(newSelection);
    } else {
      // Regular click: toggle selection
      const newSelection = new Set(selectedValues);
      if (newSelection.has(value)) {
        newSelection.delete(value);
      } else {
        newSelection.add(value);
      }
      setSelectedValues(newSelection);
    }

    setLastClickedIndex(index);
  };

  const handleSelectAllVisible = () => {
    const filteredValues = getFilteredSortedUngrouped();
    const newSelection = new Set(selectedValues);
    filteredValues.forEach((v) => newSelection.add(v));
    setSelectedValues(newSelection);
  };

  const handleClearSelection = () => {
    setSelectedValues(new Set());
    setLastClickedIndex(null);
  };

  const handleBatchAddToGroup = (groupId: string) => {
    // Move all selected values to the target group
    selectedValues.forEach((value) => {
      moveToGroup(value, groupId);
    });
    // Clear selection
    handleClearSelection();
  };

  const clearFilter = () => {
    setFilterValue('');
    setFilterValue2('');
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          zIndex: 999,
        }}
        onClick={handleClose}
      />

      {/* Slide-over */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: '600px',
          background: C.bg,
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '-4px 0 24px rgba(0, 0, 0, 0.2)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: `1px solid ${C.border}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 600, color: C.text, marginBottom: 4 }}>
              New Harmony
            </h2>
            <p style={{ fontSize: 13, color: C.text3 }}>
              Step {step} of {steps.length}
            </p>
          </div>
          <button
            onClick={handleClose}
            style={{
              padding: 8,
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: C.text3,
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Progress Bar */}
        <div style={{ padding: '16px 24px', borderBottom: `1px solid ${C.border}` }}>
          <div style={{ display: 'flex', gap: 8 }}>
            {steps.map((s) => {
              // Dim Steps 2 & 3 for format harmonies when on Step 4 or 5
              const isSkipped = transformType === 'format' && step >= 4 && (s.number === 2 || s.number === 3);

              return (
                <div key={s.number} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div
                    style={{
                      height: 4,
                      background: isSkipped ? C.border : (step >= s.number ? C.indigo : C.border),
                      borderRadius: 2,
                      transition: 'background 0.2s',
                      opacity: isSkipped ? 0.3 : 1,
                    }}
                  />
                  <div
                    style={{
                      fontSize: 10,
                      color: isSkipped ? C.text3 : (step >= s.number ? C.text : C.text3),
                      textAlign: 'center',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      fontWeight: 600,
                      opacity: isSkipped ? 0.4 : 1,
                    }}
                  >
                    {s.label}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: C.text, marginBottom: 6 }}>
                  Name *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Company Industry"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    fontSize: 13,
                    background: C.surface,
                    border: `1px solid ${C.border}`,
                    borderRadius: 6,
                    color: C.text,
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: C.text, marginBottom: 6 }}>
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional description of what this harmony does..."
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    fontSize: 13,
                    background: C.surface,
                    border: `1px solid ${C.border}`,
                    borderRadius: 6,
                    color: C.text,
                    resize: 'vertical',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: C.text, marginBottom: 6 }}>
                  Object Type *
                </label>
                <div style={{ display: 'flex', gap: 12 }}>
                  {(['company', 'contact'] as const).map((cat) => (
                    <label
                      key={cat}
                      style={{
                        flex: 1,
                        padding: '12px 16px',
                        background: category === cat ? C.indigoDim : C.surface,
                        border: `1px solid ${category === cat ? C.indigoBrd : C.border}`,
                        borderRadius: 6,
                        cursor: 'pointer',
                        textAlign: 'center',
                        fontSize: 13,
                        fontWeight: 500,
                        color: category === cat ? C.indigo : C.text,
                        textTransform: 'capitalize',
                      }}
                    >
                      <input
                        type="radio"
                        value={cat}
                        checked={category === cat}
                        onChange={(e) => setCategory(e.target.value as 'company' | 'contact')}
                        style={{ display: 'none' }}
                      />
                      {cat}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: C.text, marginBottom: 6 }}>
                  HubSpot Field *
                </label>
                <HubSpotPropertyPicker
                  objectType={category}
                  value={field}
                  onChange={(propertyName, propertyLabel, propertyType) => {
                    setField(propertyName);
                    setFieldLabel(propertyLabel);
                    setFieldType(propertyType || 'string');
                  }}
                  placeholder="Select a HubSpot property..."
                />
                <p style={{ fontSize: 11, color: C.text3, marginTop: 4 }}>
                  The internal HubSpot property name (e.g., "industry", "company_size")
                </p>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: C.text, marginBottom: 6 }}>
                  Transform Type *
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <label
                    style={{
                      padding: '12px 16px',
                      background: transformType === 'format' ? C.indigoDim : C.surface,
                      border: `1px solid ${transformType === 'format' ? C.indigoBrd : C.border}`,
                      borderRadius: 0,
                      cursor: 'pointer',
                      fontSize: 13,
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 10,
                    }}
                  >
                    <input
                      type="radio"
                      value="format"
                      checked={transformType === 'format'}
                      onChange={(e) => setTransformType(e.target.value as 'format' | 'group')}
                      style={{ marginTop: 2, cursor: 'pointer' }}
                    />
                    <div>
                      <div style={{ fontWeight: 600, color: C.text, marginBottom: 4 }}>
                        Format function
                      </div>
                      <div style={{ fontSize: 12, color: C.text3 }}>
                        Apply a built-in rule (phone, email, URL, name casing)
                      </div>
                    </div>
                  </label>

                  <label
                    style={{
                      padding: '12px 16px',
                      background: transformType === 'group' ? C.indigoDim : C.surface,
                      border: `1px solid ${transformType === 'group' ? C.indigoBrd : C.border}`,
                      borderRadius: 0,
                      cursor: 'pointer',
                      fontSize: 13,
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 10,
                    }}
                  >
                    <input
                      type="radio"
                      value="group"
                      checked={transformType === 'group'}
                      onChange={(e) => setTransformType(e.target.value as 'format' | 'group')}
                      style={{ marginTop: 2, cursor: 'pointer' }}
                    />
                    <div>
                      <div style={{ fontWeight: 600, color: C.text, marginBottom: 4 }}>
                        Group values
                      </div>
                      <div style={{ fontSize: 12, color: C.text3 }}>
                        Map raw values to canonical groups (lookup table)
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              {transformType === 'format' && (
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: C.text, marginBottom: 6 }}>
                    Format Function *
                  </label>
                  <select
                    value={formatFunction}
                    onChange={(e) => setFormatFunction(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      fontSize: 13,
                      background: C.surface,
                      border: `1px solid ${C.border}`,
                      borderRadius: 0,
                      color: C.text,
                    }}
                  >
                    <option value="" disabled>Select a format function...</option>
                    {availableFunctions.includes('e164_phone') && <option value="e164_phone">E.164 Phone</option>}
                    {availableFunctions.includes('email_lowercase') && <option value="email_lowercase">Lowercase Email</option>}
                    {availableFunctions.includes('linkedin_url') && <option value="linkedin_url">LinkedIn URL</option>}
                    {availableFunctions.includes('smart_title_case') && <option value="smart_title_case">Smart Title Case</option>}
                    {availableFunctions.includes('numeric_parse') && <option value="numeric_parse">Numeric Parse</option>}
                    {availableFunctions.includes('url_canonical') && <option value="url_canonical">Canonical URL</option>}
                  </select>
                  <p style={{ fontSize: 11, color: C.text3, marginTop: 4 }}>
                    Built-in transformations for common data cleaning tasks
                  </p>

                  {/* Phone format sub-options */}
                  {formatFunction === 'e164_phone' && (
                    <div style={{
                      marginTop: 16,
                      padding: 16,
                      background: C.surface,
                      border: `1px solid ${C.border2}`,
                      borderRadius: 0
                    }}>
                      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>
                        Phone format
                      </div>

                      {/* Format options */}
                      <label style={{ display: 'flex', alignItems: 'start', gap: 8, marginBottom: 12, cursor: 'pointer' }}>
                        <input
                          type="radio"
                          name="phone-format"
                          checked={phoneConfig.format === 'e164_formatted'}
                          onChange={() => setPhoneConfig({ ...phoneConfig, format: 'e164_formatted' })}
                        />
                        <div>
                          <div style={{ fontSize: 12, color: C.text }}>
                            +1 (310) 387-9598
                            <span style={{
                              marginLeft: 8,
                              fontSize: 10,
                              color: C.indigo,
                              fontWeight: 600
                            }}>
                              International with formatting
                            </span>
                          </div>
                          <div style={{ fontSize: 10, color: C.text3, marginTop: 2 }}>
                            Recommended for US teams
                          </div>
                        </div>
                      </label>

                      <label style={{ display: 'flex', alignItems: 'start', gap: 8, marginBottom: 12, cursor: 'pointer' }}>
                        <input
                          type="radio"
                          name="phone-format"
                          checked={phoneConfig.format === 'e164_compact'}
                          onChange={() => setPhoneConfig({ ...phoneConfig, format: 'e164_compact' })}
                        />
                        <div>
                          <div style={{ fontSize: 12, color: C.text }}>
                            +13103879598
                            <span style={{ marginLeft: 8, fontSize: 10, color: C.text2 }}>
                              E.164 compact
                            </span>
                          </div>
                          <div style={{ fontSize: 10, color: C.text3, marginTop: 2 }}>
                            Best for dialers and APIs
                          </div>
                        </div>
                      </label>

                      <label style={{ display: 'flex', alignItems: 'start', gap: 8, marginBottom: 16, cursor: 'pointer' }}>
                        <input
                          type="radio"
                          name="phone-format"
                          checked={phoneConfig.format === 'national'}
                          onChange={() => setPhoneConfig({ ...phoneConfig, format: 'national' })}
                        />
                        <div>
                          <div style={{ fontSize: 12, color: C.text }}>
                            (310) 387-9598
                            <span style={{ marginLeft: 8, fontSize: 10, color: C.text2 }}>
                              US national (no country code)
                            </span>
                          </div>
                        </div>
                      </label>

                      {/* Country code dropdown */}
                      <div style={{ marginTop: 16 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 4 }}>
                          Default country code
                        </div>
                        <SearchableCountrySelect
                          value={phoneConfig.default_country_code}
                          onChange={(code) => setPhoneConfig({ ...phoneConfig, default_country_code: code })}
                        />
                        <div style={{ fontSize: 9, color: C.text3, marginTop: 4 }}>
                          Applied to numbers without a country code prefix
                        </div>
                      </div>

                      {/* International handling info note */}
                      <div style={{
                        marginTop: 12,
                        padding: 12,
                        background: C.blueDim,
                        border: `1px solid ${C.blueBrd}`,
                        borderRadius: 0,
                        display: 'flex',
                        gap: 8
                      }}>
                        <Info size={16} color={C.blue} style={{ flexShrink: 0, marginTop: 2 }} />
                        <div style={{ fontSize: 11, color: C.text2, lineHeight: 1.4 }}>
                          Numbers already containing a country code (+44, +966, etc.) are preserved as-is. For numbers without a country code prefix, the default above is applied. If your data contains numbers from multiple countries without prefixes, consider normalizing them in HubSpot before importing.
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div>
                <h3 style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 8 }}>
                  Scan HubSpot Field
                </h3>
                <p style={{ fontSize: 12, color: C.text3, marginBottom: 16 }}>
                  We'll scan your HubSpot account to find all distinct values for "{field}" and show you the most common ones to help you create normalization rules.
                </p>

                {distinctValues.length === 0 ? (
                  <div>
                    {scanCompleted ? (
                      <div
                        style={{
                          background: C.amberDim,
                          border: `1px solid ${C.amberBrd}`,
                          borderRadius: 6,
                          padding: 16,
                          marginBottom: 16,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                          <AlertTriangle size={18} color={C.amber} style={{ flexShrink: 0, marginTop: 2 }} />
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 4 }}>
                              Field is empty
                            </div>
                            <div style={{ fontSize: 12, color: C.text2, marginBottom: 12 }}>
                              The field "{field}" has no values across your {category === 'company' ? 'companies' : 'contacts'}.
                              You cannot create normalization rules for an empty field.
                            </div>
                            <div style={{ fontSize: 11, color: C.text3 }}>
                              Try selecting a different field or populate this field in HubSpot first.
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : null}
                    <PrimaryBtn onClick={startScan} disabled={scanning}>
                      {scanning ? (
                        <>
                          <Loader2 size={14} />
                          Scanning... {scanProgress}%
                        </>
                      ) : (
                        scanCompleted ? 'Scan Again' : 'Start Scan'
                      )}
                    </PrimaryBtn>
                  </div>
                ) : (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                      <Check size={16} color={C.green} />
                      <span style={{ fontSize: 13, color: C.text }}>
                        Found {distinctValues.length} distinct values
                      </span>
                    </div>

                    <div
                      style={{
                        background: C.surface,
                        border: `1px solid ${C.border}`,
                        borderRadius: 6,
                        maxHeight: 400,
                        overflowY: 'auto',
                      }}
                    >
                      {distinctValues.map((dv, i) => (
                        <div
                          key={i}
                          style={{
                            padding: '10px 14px',
                            borderBottom: i < distinctValues.length - 1 ? `1px solid ${C.border}` : 'none',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                          }}
                        >
                          <span style={{ fontSize: 13, color: C.text, fontFamily: F.mono }}>{dv.value}</span>
                          <span style={{ fontSize: 11, color: C.text3 }}>{dv.count} records</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 3 && (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div>
                  <h3 style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 8 }}>
                    Group Values
                  </h3>
                  <p style={{ fontSize: 12, color: C.text3, marginBottom: 16 }}>
                    Drag values into groups to normalize them. Each group will map to a single canonical value.
                  </p>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: C.text, marginBottom: 6 }}>
                    Approach
                  </label>
                  <select
                    value={approach}
                    onChange={(e) => setApproach(e.target.value as any)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      fontSize: 13,
                      background: C.surface,
                      border: `1px solid ${C.border}`,
                      borderRadius: 6,
                      color: C.text,
                    }}
                  >
                    <option value="reference_list">Reference List (exact match)</option>
                    <option value="rule_based">Rule-Based (fuzzy match)</option>
                    <option value="regex">Regex Pattern</option>
                  </select>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: C.text }}>Groups</span>
                    <GhostBtn onClick={addGroup} style={{ fontSize: 12, padding: '4px 8px' }}>
                      + Add Group
                    </GhostBtn>
                  </div>

                  {groups.map((group) => (
                    <GroupContainer
                      key={group.id}
                      group={group}
                      isActive={activeGroupId === group.id}
                      onUpdateLabel={updateGroupLabel}
                      onRemoveValue={moveToUngrouped}
                      onSelect={() => setActiveGroupId(group.id)}
                    />
                  ))}

                  {ungrouped.length > 0 && (
                    <div
                      style={{
                        background: C.surface,
                        border: `1px dashed ${C.border}`,
                        borderRadius: 6,
                        padding: 16,
                        marginTop: 12,
                        position: 'relative',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: C.text3 }}>
                          Ungrouped Values ({ungrouped.length})
                        </div>
                        <select
                          value={ungroupedSort}
                          onChange={(e) => setUngroupedSort(e.target.value as 'alpha' | 'count')}
                          style={{
                            padding: '4px 8px',
                            fontSize: 11,
                            background: C.bg,
                            border: `1px solid ${C.border}`,
                            borderRadius: 4,
                            color: C.text,
                          }}
                        >
                          <option value="alpha">A-Z</option>
                          <option value="count">By Count</option>
                        </select>
                      </div>

                      {/* Filter Bar */}
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                          <select
                            value={filterOperator}
                            onChange={(e) => setFilterOperator(e.target.value)}
                            style={{
                              padding: '6px 8px',
                              fontSize: 11,
                              background: C.bg,
                              border: `1px solid ${C.border}`,
                              borderRadius: 4,
                              color: C.text,
                              minWidth: 100,
                            }}
                          >
                            {fieldType === 'number' ? (
                              <>
                                <option value=">">{'>'}</option>
                                <option value="<">{'<'}</option>
                                <option value=">=">{'>='}</option>
                                <option value="<=">{'<='}</option>
                                <option value="=">=</option>
                                <option value="between">between</option>
                              </>
                            ) : (
                              <>
                                <option value="contains">contains</option>
                                <option value="starts with">starts with</option>
                                <option value="ends with">ends with</option>
                                <option value="is exactly">is exactly</option>
                              </>
                            )}
                          </select>
                          <input
                            type={fieldType === 'number' ? 'number' : 'text'}
                            placeholder={fieldType === 'number' ? 'Value' : 'Filter...'}
                            value={filterValue}
                            onChange={(e) => setFilterValue(e.target.value)}
                            style={{
                              padding: '6px 8px',
                              fontSize: 11,
                              background: C.bg,
                              border: `1px solid ${C.border}`,
                              borderRadius: 4,
                              color: C.text,
                              flex: 1,
                            }}
                          />
                          {filterOperator === 'between' && (
                            <input
                              type="number"
                              placeholder="Max"
                              value={filterValue2}
                              onChange={(e) => setFilterValue2(e.target.value)}
                              style={{
                                padding: '6px 8px',
                                fontSize: 11,
                                background: C.bg,
                                border: `1px solid ${C.border}`,
                                borderRadius: 4,
                                color: C.text,
                                width: 80,
                              }}
                            />
                          )}
                          {filterValue && (
                            <button
                              onClick={clearFilter}
                              style={{
                                padding: '6px 10px',
                                fontSize: 11,
                                background: C.bg,
                                border: `1px solid ${C.border}`,
                                borderRadius: 4,
                                color: C.text3,
                                cursor: 'pointer',
                              }}
                            >
                              Clear
                            </button>
                          )}
                        </div>
                        {filterValue && (
                          <div style={{ fontSize: 10, color: C.text3 }}>
                            Showing {getFilteredSortedUngrouped().length} of {ungrouped.length}
                          </div>
                        )}
                      </div>

                      {/* Select All */}
                      {getFilteredSortedUngrouped().length > 0 && (
                        <div style={{ marginBottom: 10 }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: C.text2, cursor: 'pointer' }}>
                            <input
                              type="checkbox"
                              checked={getFilteredSortedUngrouped().every((v) => selectedValues.has(v))}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  handleSelectAllVisible();
                                } else {
                                  handleClearSelection();
                                }
                              }}
                              style={{ cursor: 'pointer' }}
                            />
                            Select all visible ({getFilteredSortedUngrouped().length})
                          </label>
                        </div>
                      )}

                      {/* Values */}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: selectedValues.size > 0 ? 56 : 0 }}>
                        {getFilteredSortedUngrouped().map((value, index) => (
                          <DraggableValue
                            key={value}
                            value={value}
                            isSelected={selectedValues.has(value)}
                            onClick={(e) => {
                              if (activeGroupId) {
                                // Original click-to-add behavior
                                handleUngroupedValueClick(value);
                              } else {
                                // Multi-select behavior
                                handleValueClick(value, index, e);
                              }
                            }}
                          />
                        ))}
                      </div>

                      {/* Action Bar */}
                      {selectedValues.size > 0 && (
                        <div
                          style={{
                            position: 'absolute',
                            bottom: 0,
                            left: 0,
                            right: 0,
                            background: C.indigoDim,
                            border: `1px solid ${C.indigoBrd}`,
                            borderRadius: '0 0 6px 6px',
                            padding: '10px 16px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 12,
                          }}
                        >
                          <div style={{ fontSize: 12, fontWeight: 500, color: C.indigo }}>
                            Add {selectedValues.size} to group:
                          </div>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <select
                              value={batchGroupId}
                              onChange={(e) => {
                                const groupId = e.target.value;
                                setBatchGroupId(groupId);
                                if (groupId) {
                                  handleBatchAddToGroup(groupId);
                                  setBatchGroupId(''); // Reset dropdown
                                }
                              }}
                              style={{
                                padding: '6px 8px',
                                fontSize: 11,
                                background: C.bg,
                                border: `1px solid ${C.border}`,
                                borderRadius: 4,
                                color: C.text,
                                minWidth: 150,
                              }}
                            >
                              <option value="" disabled>Select group...</option>
                              {groups.map((g) => (
                                <option key={g.id} value={g.id}>{g.label}</option>
                              ))}
                            </select>
                            <button
                              onClick={handleClearSelection}
                              style={{
                                padding: '6px 10px',
                                fontSize: 11,
                                background: 'transparent',
                                border: `1px solid ${C.indigo}`,
                                borderRadius: 4,
                                color: C.indigo,
                                cursor: 'pointer',
                                fontWeight: 500,
                              }}
                            >
                              Clear selection
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <DragOverlay>
                {activeId ? (
                  <div
                    style={{
                      padding: '6px 10px',
                      background: C.indigoDim,
                      border: `1px solid ${C.indigoBrd}`,
                      borderRadius: 4,
                      fontSize: 12,
                      fontFamily: F.mono,
                      color: C.indigo,
                      cursor: 'grabbing',
                    }}
                  >
                    {activeId}
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
          )}

          {step === 4 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div>
                <h3 style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 8 }}>
                  Add Conditions (Optional)
                </h3>
                <p style={{ fontSize: 12, color: C.text3, marginBottom: 16 }}>
                  By default, this harmony will run on all {category} records. Add conditions to limit which records it applies to.
                </p>
              </div>

              {/* Condition mode selector */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: 12,
                    border: `2px solid ${conditionMode === 'all' ? C.indigo : C.border}`,
                    borderRadius: 8,
                    background: conditionMode === 'all' ? C.indigoDim : C.surface,
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="radio"
                    name="conditionMode"
                    value="all"
                    checked={conditionMode === 'all'}
                    onChange={() => {
                      setConditionMode('all');
                      setConditionGroups(null);
                    }}
                    style={{ cursor: 'pointer' }}
                  />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>
                      Run on all records
                    </div>
                    <div style={{ fontSize: 11, color: C.text3 }}>
                      This harmony will process every {category} record (default)
                    </div>
                  </div>
                </label>

                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: 12,
                    border: `2px solid ${conditionMode === 'conditional' ? C.indigo : C.border}`,
                    borderRadius: 8,
                    background: conditionMode === 'conditional' ? C.indigoDim : C.surface,
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="radio"
                    name="conditionMode"
                    value="conditional"
                    checked={conditionMode === 'conditional'}
                    onChange={() => setConditionMode('conditional')}
                    style={{ cursor: 'pointer' }}
                  />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>
                      Only records matching conditions
                    </div>
                    <div style={{ fontSize: 11, color: C.text3 }}>
                      Add rules to filter which records this harmony applies to
                    </div>
                  </div>
                </label>
              </div>

              {/* Condition builder (shown when conditional mode selected) */}
              {conditionMode === 'conditional' && (
                <div
                  style={{
                    border: `1px solid ${C.border}`,
                    borderRadius: 8,
                    padding: 16,
                    background: C.surface,
                  }}
                >
                  <ConditionBuilder
                    value={conditionGroups}
                    onChange={setConditionGroups}
                    objectType={category}
                  />
                </div>
              )}
            </div>
          )}

          {step === 5 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div>
                <h3 style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 8 }}>
                  Preview
                </h3>
                <p style={{ fontSize: 12, color: C.text3, marginBottom: 16 }}>
                  Review your harmony rules before activating.
                </p>
              </div>

              <div
                style={{
                  background: C.surface,
                  border: `1px solid ${C.border}`,
                  borderRadius: 6,
                  padding: 16,
                }}
              >
                {transformType === 'format' ? (
                  // Format function preview
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: C.text, marginBottom: 12 }}>
                      Format function: {formatFunction === 'e164_phone' ? 'E.164 Phone' :
                        formatFunction === 'email_lowercase' ? 'Lowercase Email' :
                        formatFunction === 'linkedin_url' ? 'LinkedIn URL' :
                        formatFunction === 'smart_title_case' ? 'Smart Title Case' :
                        formatFunction === 'numeric_parse' ? 'Numeric Parse' :
                        formatFunction === 'url_canonical' ? 'Canonical URL' : formatFunction}
                    </div>
                    <div style={{ fontSize: 11, color: C.text3, marginBottom: 12 }}>
                      {formatFunction === 'e164_phone' && 'Transforms values like "(415) 555-1234" → "+14155551234"'}
                      {formatFunction === 'email_lowercase' && 'Transforms values like "John.Doe@Example.COM" → "john.doe@example.com"'}
                      {formatFunction === 'linkedin_url' && 'Transforms values like "linkedin.com/in/john-doe" → "https://linkedin.com/in/john-doe"'}
                      {formatFunction === 'smart_title_case' && 'Transforms values like "JOHN DOE" → "John Doe"'}
                      {formatFunction === 'numeric_parse' && 'Transforms values like "$1,234.56" → "1234.56"'}
                      {formatFunction === 'url_canonical' && 'Transforms values like "example.com?utm=..." → "https://example.com"'}
                    </div>
                    <div style={{ fontSize: 11, color: C.text2, fontFamily: F.mono }}>
                      Applies to: {category}.{field}
                    </div>
                  </div>
                ) : (
                  // Group values preview
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: C.text, marginBottom: 12 }}>
                      {groups.length} groups, {groups.reduce((sum, g) => sum + g.values.length, 0)} rules
                    </div>
                    {groups.map((group) => (
                      <div key={group.id} style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: 12, fontWeight: 500, color: C.text, marginBottom: 4 }}>
                          → {group.label}
                        </div>
                        <div style={{ fontSize: 11, color: C.text3, fontFamily: F.mono, marginLeft: 16 }}>
                          {group.values.join(', ')}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div
                style={{
                  background: C.amberDim,
                  border: `1px solid ${C.amberBrd}`,
                  borderRadius: 6,
                  padding: 12,
                }}
              >
                <p style={{ fontSize: 12, color: C.text }}>
                  <strong>Note:</strong> This harmony will be activated immediately. You can deactivate it anytime from the Harmonies page.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: `1px solid ${C.border}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <GhostBtn onClick={step === 1 ? handleClose : handleBack} disabled={saving}>
            {step === 1 ? 'Cancel' : (
              <>
                <ChevronLeft size={14} /> Back
              </>
            )}
          </GhostBtn>

          <PrimaryBtn onClick={handleNext} disabled={!canAdvance() || saving}>
            {saving ? (
              <>
                <Loader2 size={14} />
                Saving...
              </>
            ) : step === 5 ? (
              'Activate'
            ) : (
              <>
                Next <ChevronRight size={14} />
              </>
            )}
          </PrimaryBtn>
        </div>
      </div>
      {/* Error Modal */}
      {errorMessage && (
        <>
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0, 0, 0, 0.6)',
              zIndex: 1001,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onClick={() => setErrorMessage(null)}
          >
            <div
              style={{
                background: C.surface,
                border: `1px solid ${C.border}`,
                borderRadius: 8,
                padding: 24,
                maxWidth: 480,
                width: '90%',
                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
                <AlertTriangle size={20} color={C.red} style={{ flexShrink: 0 }} />
                <div>
                  <h3
                    style={{
                      fontSize: 16,
                      fontWeight: 600,
                      color: C.text,
                      marginBottom: 8,
                      fontFamily: F.sans,
                    }}
                  >
                    Failed to save
                  </h3>
                  <p
                    style={{
                      fontSize: 14,
                      color: C.text2,
                      lineHeight: 1.5,
                      fontFamily: F.sans,
                      margin: 0,
                    }}
                  >
                    {errorMessage}
                  </p>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setErrorMessage(null)}
                  style={{
                    padding: '8px 16px',
                    fontSize: 14,
                    fontWeight: 500,
                    background: C.indigo,
                    border: 'none',
                    borderRadius: 6,
                    color: '#fff',
                    cursor: 'pointer',
                    fontFamily: F.sans,
                  }}
                >
                  OK
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}

function GroupContainer({
  group,
  isActive,
  onUpdateLabel,
  onRemoveValue,
  onSelect,
}: {
  group: ValueGroup;
  isActive: boolean;
  onUpdateLabel: (id: string, label: string) => void;
  onRemoveValue: (value: string) => void;
  onSelect: () => void;
}) {
  const { setNodeRef } = useDroppable({ id: group.id });

  return (
    <div
      ref={setNodeRef}
      onClick={onSelect}
      style={{
        background: C.surface,
        border: `2px solid ${isActive ? C.indigo : C.border}`,
        borderRadius: 6,
        padding: 12,
        marginBottom: 12,
        cursor: 'pointer',
        transition: 'border-color 0.2s',
        boxShadow: isActive ? `0 0 0 3px ${C.indigoDim}` : 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <input
          type="text"
          value={group.label}
          onChange={(e) => onUpdateLabel(group.id, e.target.value)}
          placeholder="Group label..."
          style={{
            flex: 1,
            padding: '6px 10px',
            fontSize: 13,
            fontWeight: 500,
            background: C.bg,
            border: `1px solid ${C.border}`,
            borderRadius: 4,
            color: C.text,
          }}
        />
        {isActive && (
          <span
            style={{
              padding: '4px 8px',
              fontSize: 10,
              fontWeight: 600,
              background: C.indigoDim,
              border: `1px solid ${C.indigoBrd}`,
              borderRadius: 4,
              color: C.indigo,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}
          >
            Active
          </span>
        )}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, minHeight: 32 }}>
        {group.values.length === 0 ? (
          <div style={{ fontSize: 11, color: C.text3, fontStyle: 'italic' }}>
            {isActive ? 'Click values below to add them here' : 'Drag values here or click to activate'}
          </div>
        ) : (
          group.values.map((value) => (
            <div
              key={value}
              style={{
                padding: '4px 8px',
                background: C.indigoDim,
                border: `1px solid ${C.indigoBrd}`,
                borderRadius: 4,
                fontSize: 11,
                fontFamily: F.mono,
                color: C.indigo,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <span>{value}</span>
              <button
                onClick={() => onRemoveValue(value)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  color: C.indigo,
                  opacity: 0.7,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.7')}
                title="Remove from group"
              >
                <X size={12} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function DraggableValue({ value, isSelected, onClick }: { value: string; isSelected?: boolean; onClick?: (e: React.MouseEvent) => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: value,
  });

  const style = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    opacity: isDragging ? 0.5 : 1,
    padding: '6px 10px',
    background: isSelected ? C.indigoDim : C.surface,
    border: `1px solid ${isSelected ? C.indigo : C.border}`,
    borderRadius: 4,
    fontSize: 12,
    fontFamily: F.mono,
    color: isSelected ? C.indigo : C.text,
    cursor: 'pointer',
    transition: 'background 0.15s, border-color 0.15s',
    fontWeight: isSelected ? 500 : 400,
  };

  const handleClick = (e: React.MouseEvent) => {
    // Only trigger click if not dragging
    if (!isDragging && onClick) {
      onClick(e);
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={handleClick}
      onMouseEnter={(e) => {
        if (!isSelected) {
          e.currentTarget.style.background = C.hover;
          e.currentTarget.style.borderColor = C.border2;
        }
      }}
      onMouseLeave={(e) => {
        if (!isSelected) {
          e.currentTarget.style.background = C.surface;
          e.currentTarget.style.borderColor = C.border;
        }
      }}
    >
      {value}
    </div>
  );
}
