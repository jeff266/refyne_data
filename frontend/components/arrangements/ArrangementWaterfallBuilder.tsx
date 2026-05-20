'use client';

import { useState, useEffect } from 'react';
import { C } from '@/lib/design-tokens';
import { GhostBtn, PrimaryBtn } from '@/components/refyne';
import { addToast } from '@/components/ui/toast';
import {
  ChevronDown,
  ChevronRight,
  GripVertical,
  Plus,
  Settings,
  X,
  AlertCircle,
  CheckCircle,
  Lock,
} from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// Field configuration shape (matches migration 033)
export interface FieldConfig {
  field_key: string;
  field_type: 'categorical' | 'numeric' | 'url' | 'text' | 'boolean';
  aggregation_strategy: 'waterfall' | 'max' | 'min' | 'average' | 'cluster_average';
  apply_harmony: boolean;
  harmony_id: string | null;
  steps: ProviderStep[];
}

export interface ProviderStep {
  order: number;
  provider: string;
  policy: 'fill_empty' | 'overwrite';
}

export interface ProviderConnection {
  provider: string;
  connected: boolean;
  hasError: boolean;
}

export interface RehearsalCoverage {
  field_key: string;
  coverage_percent: number;
  step_hit_rates: Record<string, number>; // provider -> hit %
}

interface ArrangementWaterfallBuilderProps {
  value: FieldConfig[];
  onChange: (configs: FieldConfig[]) => void;
  providers: ProviderConnection[];
  rehearsalData?: RehearsalCoverage[];
  onManageFields?: () => void;
}

const PROVIDER_COLORS: Record<string, string> = {
  apollo: '#FF6B35',
  zoominfo: '#004E89',
  clearbit: '#6A4C93',
  cognism: '#1A936F',
  refyne: '#534AB7',
};

const AGGREGATION_STRATEGIES = [
  { value: 'waterfall', label: 'Waterfall (first found)' },
  { value: 'max', label: 'Max' },
  { value: 'min', label: 'Min' },
  { value: 'average', label: 'Average' },
  { value: 'cluster_average', label: 'Cluster Average' },
];

// Sortable provider step component
function SortableProviderStep({
  step,
  fieldKey,
  isWaterfall,
  hitRate,
  onRemove,
  onPolicyChange,
}: {
  step: ProviderStep;
  fieldKey: string;
  isWaterfall: boolean;
  hitRate?: number;
  onRemove: () => void;
  onPolicyChange: (policy: 'fill_empty' | 'overwrite') => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `${fieldKey}-${step.provider}`,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const providerColor = PROVIDER_COLORS[step.provider] || C.text3;

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 12px',
        background: C.bg,
        border: `1px solid ${C.border}`,
        borderRadius: 6,
        marginBottom: 8,
      }}
    >
      {/* Drag handle */}
      <div {...attributes} {...listeners} style={{ cursor: 'grab', color: C.text3 }}>
        <GripVertical size={16} />
      </div>

      {/* Step number */}
      <div
        style={{
          width: 24,
          height: 24,
          borderRadius: '50%',
          background: C.hover,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 12,
          fontWeight: 600,
          color: C.text2,
        }}
      >
        {step.order}
      </div>

      {/* Provider badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: providerColor,
          }}
        />
        <span style={{ fontSize: 14, fontWeight: 500, color: C.text }}>
          {step.provider.charAt(0).toUpperCase() + step.provider.slice(1)}
        </span>
      </div>

      {/* Policy toggle (only for waterfall) */}
      {isWaterfall && (
        <select
          value={step.policy}
          onChange={(e) => onPolicyChange(e.target.value as 'fill_empty' | 'overwrite')}
          style={{
            padding: '4px 8px',
            fontSize: 12,
            background: C.surface,
            border: `1px solid ${C.border}`,
            borderRadius: 4,
            color: C.text,
          }}
        >
          <option value="fill_empty">Fill empty</option>
          <option value="overwrite">Overwrite</option>
        </select>
      )}

      {/* Hit rate */}
      {hitRate !== undefined && (
        <span style={{ fontSize: 12, color: C.text3 }}>
          {Math.round(hitRate)}% hit
        </span>
      )}

      {/* Remove button */}
      <button
        onClick={onRemove}
        style={{
          background: 'transparent',
          border: 'none',
          color: C.text3,
          cursor: 'pointer',
          padding: 4,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = C.red;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = C.text3;
        }}
      >
        <X size={16} />
      </button>
    </div>
  );
}

// Field row component
function FieldRow({
  config,
  expanded,
  onToggle,
  onChange,
  onRemove,
  availableProviders,
  calibrationRecommendation,
  rehearsalCoverage,
  harmonies,
}: {
  config: FieldConfig;
  expanded: boolean;
  onToggle: () => void;
  onChange: (config: FieldConfig) => void;
  onRemove: () => void;
  availableProviders: ProviderConnection[];
  calibrationRecommendation?: string;
  rehearsalCoverage?: RehearsalCoverage;
  harmonies: Array<{ id: string; name: string }>;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = config.steps.findIndex((s) => `${config.field_key}-${s.provider}` === active.id);
      const newIndex = config.steps.findIndex((s) => `${config.field_key}-${s.provider}` === over.id);

      const reorderedSteps = arrayMove(config.steps, oldIndex, newIndex).map((step, idx) => ({
        ...step,
        order: idx + 1,
      }));

      onChange({ ...config, steps: reorderedSteps });
    }
  };

  const handleAddProvider = (provider: string) => {
    const newStep: ProviderStep = {
      order: config.steps.length + 1,
      provider,
      policy: 'fill_empty',
    };
    onChange({ ...config, steps: [...config.steps, newStep] });
  };

  const handleRemoveStep = (provider: string) => {
    const updatedSteps = config.steps
      .filter((s) => s.provider !== provider)
      .map((step, idx) => ({ ...step, order: idx + 1 }));
    onChange({ ...config, steps: updatedSteps });
  };

  const handlePolicyChange = (provider: string, policy: 'fill_empty' | 'overwrite') => {
    const updatedSteps = config.steps.map((s) =>
      s.provider === provider ? { ...s, policy } : s
    );
    onChange({ ...config, steps: updatedSteps });
  };

  const isWaterfall = config.aggregation_strategy === 'waterfall';
  const coveragePercent = rehearsalCoverage?.coverage_percent ?? 0;
  const hasCalibration = !!calibrationRecommendation;

  // Filter out already-added providers
  const unusedProviders = availableProviders.filter(
    (p) => !config.steps.some((s) => s.provider === p.provider)
  );

  return (
    <div
      style={{
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: 8,
        marginBottom: 12,
        overflow: 'hidden',
      }}
    >
      {/* Collapsed header */}
      <div
        onClick={onToggle}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: 16,
          cursor: 'pointer',
          transition: 'background 0.15s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = C.hover;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent';
        }}
      >
        <div style={{ color: C.text3 }}>
          {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </div>

        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>
              {config.field_key.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
            </span>
            <span
              style={{
                fontSize: 11,
                padding: '2px 8px',
                background: C.hover,
                color: C.text3,
                borderRadius: 4,
              }}
            >
              {config.field_type}
            </span>
            {hasCalibration && (
              <span
                style={{
                  fontSize: 11,
                  padding: '2px 8px',
                  background: C.greenDim,
                  color: C.green,
                  borderRadius: 4,
                  fontWeight: 500,
                }}
              >
                calibrated
              </span>
            )}
          </div>

          <div style={{ fontSize: 12, color: C.text3 }}>
            {config.steps.length === 0 ? (
              <span style={{ color: C.amber }}>No providers configured</span>
            ) : (
              <span>{config.steps.length} provider(s)</span>
            )}
          </div>
        </div>

        {/* Coverage bar */}
        {rehearsalCoverage && (
          <div style={{ width: 120 }}>
            <div
              style={{
                height: 6,
                background: C.border,
                borderRadius: 3,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${coveragePercent}%`,
                  background: C.green,
                }}
              />
            </div>
            <div style={{ fontSize: 11, color: C.text3, marginTop: 4 }}>
              {Math.round(coveragePercent)}% coverage
            </div>
          </div>
        )}

        {!rehearsalCoverage && (
          <div style={{ fontSize: 11, color: C.text3 }}>—</div>
        )}
      </div>

      {/* Expanded waterfall panel */}
      {expanded && (
        <div style={{ padding: '0 16px 16px', borderTop: `1px solid ${C.border}` }}>
          <div style={{ marginTop: 16 }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>
                Provider waterfall
              </span>

              {/* Aggregation strategy selector (numeric only) */}
              {config.field_type === 'numeric' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 12, color: C.text3 }}>Strategy:</span>
                  <select
                    value={config.aggregation_strategy}
                    onChange={(e) =>
                      onChange({
                        ...config,
                        aggregation_strategy: e.target.value as any,
                      })
                    }
                    style={{
                      padding: '4px 8px',
                      fontSize: 12,
                      background: C.surface,
                      border: `1px solid ${C.border}`,
                      borderRadius: 4,
                      color: C.text,
                    }}
                  >
                    {AGGREGATION_STRATEGIES.map((strat) => (
                      <option key={strat.value} value={strat.value}>
                        {strat.label}
                      </option>
                    ))}
                  </select>
                  {calibrationRecommendation &&
                    calibrationRecommendation === config.aggregation_strategy && (
                      <span
                        style={{
                          fontSize: 10,
                          padding: '2px 6px',
                          background: C.greenDim,
                          color: C.green,
                          borderRadius: 3,
                          fontWeight: 600,
                        }}
                      >
                        RECOMMENDED
                      </span>
                    )}
                </div>
              )}
            </div>

            {/* Provider steps */}
            {config.steps.length > 0 && (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext
                  items={config.steps.map((s) => `${config.field_key}-${s.provider}`)}
                  strategy={verticalListSortingStrategy}
                >
                  {config.steps.map((step) => (
                    <div key={step.provider}>
                      <SortableProviderStep
                        step={step}
                        fieldKey={config.field_key}
                        isWaterfall={isWaterfall}
                        hitRate={rehearsalCoverage?.step_hit_rates[step.provider]}
                        onRemove={() => handleRemoveStep(step.provider)}
                        onPolicyChange={(policy) => handlePolicyChange(step.provider, policy)}
                      />
                      {/* Fallthrough label */}
                      {isWaterfall && step.order < config.steps.length && (
                        <div
                          style={{
                            fontSize: 11,
                            color: C.text3,
                            textAlign: 'center',
                            margin: '4px 0',
                          }}
                        >
                          ↓ if empty, fall through to...
                        </div>
                      )}
                    </div>
                  ))}
                </SortableContext>
              </DndContext>
            )}

            {/* Add provider button */}
            {unusedProviders.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    // Show provider picker (simplified - just pick first for now)
                    const firstAvailable = unusedProviders.find((p) => p.connected);
                    if (firstAvailable) {
                      handleAddProvider(firstAvailable.provider);
                    } else {
                      addToast('warning', 'No more connected providers available');
                    }
                  }}
                  style={{
                    width: '100%',
                    padding: 12,
                    background: 'transparent',
                    border: `2px dashed ${C.border}`,
                    borderRadius: 6,
                    color: C.text3,
                    fontSize: 13,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = C.indigo;
                    e.currentTarget.style.color = C.indigo;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = C.border;
                    e.currentTarget.style.color = C.text3;
                  }}
                >
                  <Plus size={14} />
                  Add provider
                </button>
              </div>
            )}

            {/* Harmony selector (categorical only) */}
            {config.field_type === 'categorical' && harmonies.length > 0 && (
              <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${C.border}` }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <input
                    type="checkbox"
                    checked={config.apply_harmony}
                    onChange={(e) =>
                      onChange({
                        ...config,
                        apply_harmony: e.target.checked,
                        harmony_id: e.target.checked ? (harmonies[0]?.id ?? null) : null,
                      })
                    }
                  />
                  <span style={{ fontSize: 13, color: C.text2 }}>Apply harmony normalization</span>
                </label>

                {config.apply_harmony && (
                  <select
                    value={config.harmony_id || ''}
                    onChange={(e) => onChange({ ...config, harmony_id: e.target.value || null })}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      background: C.bg,
                      border: `1px solid ${C.border}`,
                      borderRadius: 6,
                      color: C.text,
                      fontSize: 13,
                    }}
                  >
                    {harmonies.map((h) => (
                      <option key={h.id} value={h.id}>
                        {h.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {/* Remove field button */}
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${C.border}` }}>
              <button
                onClick={onRemove}
                style={{
                  fontSize: 12,
                  color: C.text3,
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px 0',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = C.red;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = C.text3;
                }}
              >
                Remove field from arrangement
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Main component
export function ArrangementWaterfallBuilder({
  value,
  onChange,
  providers,
  rehearsalData = [],
  onManageFields,
}: ArrangementWaterfallBuilderProps) {
  const [expandedFields, setExpandedFields] = useState<Set<string>>(new Set());
  const [calibrationScores, setCalibrationScores] = useState<Record<string, string>>({});
  const [harmonies, setHarmonies] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    loadCalibrationData();
    loadHarmonies();
  }, []);

  const loadCalibrationData = async () => {
    try {
      const res = await fetch('/api/arrangements/calibration/scores');
      if (res.ok) {
        const { scores } = await res.json();
        // Map field_key -> recommended strategy
        const recommendations: Record<string, string> = {};
        scores.forEach((score: any) => {
          if (!recommendations[score.field_key] && score.score > 0.7) {
            recommendations[score.field_key] = 'cluster_average'; // Simplified
          }
        });
        setCalibrationScores(recommendations);
      }
    } catch (error) {
      console.error('Failed to load calibration:', error);
    }
  };

  const loadHarmonies = async () => {
    try {
      // Placeholder - implement harmonies API
      setHarmonies([]);
    } catch (error) {
      console.error('Failed to load harmonies:', error);
    }
  };

  const handleToggleExpanded = (fieldKey: string) => {
    const newSet = new Set(expandedFields);
    if (newSet.has(fieldKey)) {
      newSet.delete(fieldKey);
    } else {
      newSet.add(fieldKey);
    }
    setExpandedFields(newSet);
  };

  const handleFieldChange = (fieldKey: string, config: FieldConfig) => {
    const updated = value.map((c) => (c.field_key === fieldKey ? config : c));
    onChange(updated);
  };

  const handleRemoveField = (fieldKey: string) => {
    const updated = value.filter((c) => c.field_key !== fieldKey);
    onChange(updated);
  };

  const handleApplyToAll = () => {
    // Apply first provider order to all fields
    if (value.length === 0) return;

    const firstField = value[0];
    if (firstField.steps.length === 0) {
      addToast('warning', 'Configure at least one field first');
      return;
    }

    const templateSteps = firstField.steps.map((s) => ({
      ...s,
      policy: 'fill_empty',
    }));

    const updated = value.map((config) => ({
      ...config,
      steps: templateSteps.map((s, idx) => ({ ...s, order: idx + 1 })),
    }));

    onChange(updated);
    addToast('success', 'Provider order applied to all fields');
  };

  const connectedProviders = providers.filter((p) => p.connected);
  const allProvidersUnconfigured = connectedProviders.length === 0;

  return (
    <div>
      {/* Toolbar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 20,
          paddingBottom: 16,
          borderBottom: `1px solid ${C.border}`,
        }}
      >
        {/* Legend */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontSize: 12, color: C.text3, fontWeight: 500 }}>Providers:</span>
          {connectedProviders.map((p) => (
            <div key={p.provider} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: PROVIDER_COLORS[p.provider] || C.text3,
                }}
              />
              <span style={{ fontSize: 12, color: C.text2 }}>
                {p.provider.charAt(0).toUpperCase() + p.provider.slice(1)}
              </span>
            </div>
          ))}
          {allProvidersUnconfigured && (
            <span style={{ fontSize: 12, color: C.amber }}>
              <Lock size={12} style={{ display: 'inline', marginRight: 4 }} />
              No providers connected
            </span>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8 }}>
          {value.length > 1 && (
            <GhostBtn onClick={handleApplyToAll}>Apply to all fields</GhostBtn>
          )}
          {onManageFields && (
            <GhostBtn onClick={onManageFields}>
              <Settings size={14} />
              Manage fields
            </GhostBtn>
          )}
        </div>
      </div>

      {/* Empty state */}
      {value.length === 0 && (
        <div
          style={{
            padding: 40,
            textAlign: 'center',
            border: `2px dashed ${C.border}`,
            borderRadius: 8,
            color: C.text3,
          }}
        >
          <p style={{ fontSize: 14, marginBottom: 12 }}>No fields configured yet</p>
          {onManageFields && (
            <GhostBtn onClick={onManageFields}>
              <Plus size={14} />
              Add fields
            </GhostBtn>
          )}
        </div>
      )}

      {/* Field list */}
      {value.map((config) => {
        const coverage = rehearsalData.find((r) => r.field_key === config.field_key);
        return (
          <FieldRow
            key={config.field_key}
            config={config}
            expanded={expandedFields.has(config.field_key)}
            onToggle={() => handleToggleExpanded(config.field_key)}
            onChange={(updated) => handleFieldChange(config.field_key, updated)}
            onRemove={() => handleRemoveField(config.field_key)}
            availableProviders={providers}
            calibrationRecommendation={calibrationScores[config.field_key]}
            rehearsalCoverage={coverage}
            harmonies={harmonies}
          />
        );
      })}

      {/* Provider connection warning */}
      {allProvidersUnconfigured && value.length > 0 && (
        <div
          style={{
            marginTop: 20,
            padding: 16,
            background: C.amberDim,
            border: `1px solid ${C.amberBrd}`,
            borderRadius: 8,
            display: 'flex',
            alignItems: 'start',
            gap: 12,
          }}
        >
          <AlertCircle size={20} color={C.amber} />
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 13, color: C.text, marginBottom: 6, fontWeight: 500 }}>
              No providers connected
            </p>
            <p style={{ fontSize: 13, color: C.text2, marginBottom: 12 }}>
              You're using Refyne Data as your only provider. Connect Apollo, ZoomInfo, Cognism,
              or Clearbit to unlock multi-provider waterfalls.
            </p>
            <a
              href="/settings/connections"
              style={{
                fontSize: 13,
                color: C.indigo,
                textDecoration: 'underline',
              }}
            >
              Connect a provider →
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
