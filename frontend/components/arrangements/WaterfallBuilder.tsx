'use client';

import { useState } from 'react';
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
import { GripVertical, Plus, Check } from 'lucide-react';
import { C, F } from '@/lib/design-tokens';

interface Provider {
  id: string;
  name: string;
  displayName: string;
  connected: boolean;
  coverage: string;
  fields: string[];
}

interface WaterfallStep {
  id: string;
  provider: string;
  fields: string[];
  order: number;
}

interface WaterfallBuilderProps {
  steps: WaterfallStep[];
  onChange: (steps: WaterfallStep[]) => void;
  availableFields: string[];
}

const AVAILABLE_PROVIDERS: Provider[] = [
  {
    id: 'apollo',
    name: 'apollo',
    displayName: 'Apollo.io',
    connected: true,
    coverage: '~70% of B2B companies',
    fields: ['industry', 'phone', 'revenue', 'employee_count'],
  },
  {
    id: 'clearbit',
    name: 'clearbit',
    displayName: 'Clearbit',
    connected: true,
    coverage: '~60% of B2B companies',
    fields: ['employee_count', 'domain', 'industry', 'company_type'],
  },
  {
    id: 'zoominfo',
    name: 'zoominfo',
    displayName: 'ZoomInfo',
    connected: false,
    coverage: '~75% of B2B companies',
    fields: ['phone', 'revenue', 'employee_count', 'technologies'],
  },
  {
    id: 'serper',
    name: 'serper',
    displayName: 'Serper',
    connected: true,
    coverage: '~40% of companies',
    fields: ['domain', 'description', 'phone'],
  },
];

const FIELD_LABELS: Record<string, string> = {
  industry: 'Industry',
  phone: 'Phone',
  revenue: 'Revenue',
  employee_count: 'Employee Count',
  domain: 'Domain',
  company_type: 'Company Type',
  description: 'Description',
  technologies: 'Technologies',
};

function SortableProviderCard({
  step,
  index,
  onFieldToggle,
  onRemove,
  availableFields,
}: {
  step: WaterfallStep;
  index: number;
  onFieldToggle: (stepId: string, field: string) => void;
  onRemove: (stepId: string) => void;
  availableFields: string[];
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: step.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const provider = AVAILABLE_PROVIDERS.find((p) => p.id === step.provider);
  if (!provider) return null;

  return (
    <div ref={setNodeRef} style={style}>
      <div
        style={{
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderRadius: 8,
          padding: 16,
          marginBottom: 12,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            marginBottom: 12,
          }}
        >
          {/* Drag handle */}
          <div
            {...attributes}
            {...listeners}
            style={{
              cursor: isDragging ? 'grabbing' : 'grab',
              color: C.text3,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <GripVertical size={20} />
          </div>

          {/* Provider info */}
          <div style={{ flex: 1 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 4,
              }}
            >
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: C.text,
                }}
              >
                {index + 1}. {provider.displayName}
              </span>
              {provider.connected && (
                <span
                  style={{
                    fontSize: 11,
                    color: C.green,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 3,
                  }}
                >
                  <Check size={12} />
                  Connected
                </span>
              )}
            </div>
            <div
              style={{
                fontSize: 11,
                color: C.text3,
              }}
            >
              Covers: {provider.coverage}
            </div>
          </div>

          {/* Remove button */}
          <button
            onClick={() => onRemove(step.id)}
            style={{
              padding: '4px 8px',
              fontSize: 11,
              color: C.text3,
              background: 'transparent',
              border: `1px solid ${C.border}`,
              borderRadius: 4,
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = C.red;
              e.currentTarget.style.color = C.red;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = C.border;
              e.currentTarget.style.color = C.text3;
            }}
          >
            Remove
          </button>
        </div>

        {/* Field selection */}
        <div>
          <div
            style={{
              fontSize: 11,
              color: C.text3,
              marginBottom: 8,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            Enrich:
          </div>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 6,
            }}
          >
            {provider.fields
              .filter((f) => availableFields.includes(f))
              .map((field) => {
                const isSelected = step.fields.includes(field);
                return (
                  <button
                    key={field}
                    onClick={() => onFieldToggle(step.id, field)}
                    style={{
                      padding: '4px 10px',
                      fontSize: 11,
                      fontWeight: 500,
                      color: isSelected ? C.indigo : C.text2,
                      background: isSelected ? C.indigoDim : C.bg,
                      border: `1px solid ${isSelected ? C.indigoBrd : C.border}`,
                      borderRadius: 4,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    {isSelected && <Check size={12} />}
                    {FIELD_LABELS[field] || field}
                  </button>
                );
              })}
          </div>
        </div>
      </div>

      {/* Connector */}
      {index !== undefined && (
        <div
          style={{
            textAlign: 'center',
            fontSize: 11,
            color: C.text3,
            margin: '8px 0',
          }}
        >
          ↓ if {provider.displayName} misses
        </div>
      )}
    </div>
  );
}

export function WaterfallBuilder({ steps, onChange, availableFields }: WaterfallBuilderProps) {
  const [showAddProvider, setShowAddProvider] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = steps.findIndex((s) => s.id === active.id);
      const newIndex = steps.findIndex((s) => s.id === over.id);

      const newSteps = arrayMove(steps, oldIndex, newIndex).map((step, idx) => ({
        ...step,
        order: idx + 1,
      }));

      onChange(newSteps);
    }
  };

  const handleFieldToggle = (stepId: string, field: string) => {
    const newSteps = steps.map((step) => {
      if (step.id === stepId) {
        const newFields = step.fields.includes(field)
          ? step.fields.filter((f) => f !== field)
          : [...step.fields, field];
        return { ...step, fields: newFields };
      }
      return step;
    });
    onChange(newSteps);
  };

  const handleRemoveStep = (stepId: string) => {
    const newSteps = steps
      .filter((s) => s.id !== stepId)
      .map((step, idx) => ({ ...step, order: idx + 1 }));
    onChange(newSteps);
  };

  const handleAddProvider = (providerId: string) => {
    const newStep: WaterfallStep = {
      id: `${providerId}-${Date.now()}`,
      provider: providerId,
      fields: [],
      order: steps.length + 1,
    };
    onChange([...steps, newStep]);
    setShowAddProvider(false);
  };

  const usedProviders = new Set(steps.map((s) => s.provider));
  const availableToAdd = AVAILABLE_PROVIDERS.filter((p) => !usedProviders.has(p.id));

  // Calculate fill rate estimate
  const calculateFillRate = () => {
    if (steps.length === 0) return 0;
    if (steps.length === 1) return 70;
    if (steps.length === 2) return 85;
    if (steps.length === 3) return 91;
    return 95;
  };

  const currentFillRate = calculateFillRate();
  const potentialFillRate = steps.length < AVAILABLE_PROVIDERS.length ? calculateFillRate() + 6 : currentFillRate;

  return (
    <div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={steps.map((s) => s.id)} strategy={verticalListSortingStrategy}>
          {steps.map((step, index) => (
            <SortableProviderCard
              key={step.id}
              step={step}
              index={index}
              onFieldToggle={handleFieldToggle}
              onRemove={handleRemoveStep}
              availableFields={availableFields}
            />
          ))}
        </SortableContext>
      </DndContext>

      {/* Add provider button */}
      {!showAddProvider && availableToAdd.length > 0 && (
        <button
          onClick={() => setShowAddProvider(true)}
          style={{
            width: '100%',
            padding: 12,
            background: 'transparent',
            border: `2px dashed ${C.border}`,
            borderRadius: 8,
            color: C.text2,
            fontSize: 13,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            marginTop: 12,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = C.indigo;
            e.currentTarget.style.color = C.indigo;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = C.border;
            e.currentTarget.style.color = C.text2;
          }}
        >
          <Plus size={16} />
          Add fallback provider
        </button>
      )}

      {/* Provider selection */}
      {showAddProvider && (
        <div
          style={{
            background: C.surface,
            border: `1px solid ${C.border}`,
            borderRadius: 8,
            padding: 16,
            marginTop: 12,
          }}
        >
          <div
            style={{
              fontSize: 12,
              color: C.text3,
              marginBottom: 12,
            }}
          >
            Select a provider to add to your waterfall:
          </div>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 8,
            }}
          >
            {availableToAdd.map((provider) => (
              <button
                key={provider.id}
                onClick={() => handleAddProvider(provider.id)}
                disabled={!provider.connected}
                style={{
                  padding: '8px 12px',
                  fontSize: 12,
                  color: provider.connected ? C.text : C.text3,
                  background: C.bg,
                  border: `1px solid ${C.border}`,
                  borderRadius: 6,
                  cursor: provider.connected ? 'pointer' : 'not-allowed',
                  opacity: provider.connected ? 1 : 0.5,
                }}
              >
                {provider.displayName}
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowAddProvider(false)}
            style={{
              marginTop: 12,
              padding: '6px 12px',
              fontSize: 12,
              color: C.text3,
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
        </div>
      )}

      {/* Fill rate estimate */}
      {steps.length > 0 && (
        <div
          style={{
            background: C.surface,
            border: `1px solid ${C.border}`,
            borderRadius: 8,
            padding: 16,
            marginTop: 20,
          }}
        >
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: C.text,
              marginBottom: 12,
            }}
          >
            Estimated fill rate
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            {steps.length >= 1 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ fontSize: 12, color: C.text2, width: 180 }}>
                  {AVAILABLE_PROVIDERS.find((p) => p.id === steps[0]?.provider)?.displayName} alone:
                </div>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div
                    style={{
                      flex: 1,
                      height: 20,
                      background: C.bg,
                      borderRadius: 4,
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        width: '70%',
                        height: '100%',
                        background: C.green,
                        transition: 'width 0.3s ease',
                      }}
                    />
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: C.text, width: 40 }}>
                    70%
                  </div>
                </div>
              </div>
            )}

            {steps.length >= 2 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ fontSize: 12, color: C.text2, width: 180 }}>
                  {AVAILABLE_PROVIDERS.find((p) => p.id === steps[0]?.provider)?.displayName} +{' '}
                  {AVAILABLE_PROVIDERS.find((p) => p.id === steps[1]?.provider)?.displayName}:
                </div>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div
                    style={{
                      flex: 1,
                      height: 20,
                      background: C.bg,
                      borderRadius: 4,
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        width: '85%',
                        height: '100%',
                        background: C.indigo,
                        transition: 'width 0.3s ease',
                      }}
                    />
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: C.text, width: 40 }}>
                    85%
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: C.text3,
                      fontWeight: 500,
                    }}
                  >
                    ← now
                  </div>
                </div>
              </div>
            )}

            {steps.length < AVAILABLE_PROVIDERS.length && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ fontSize: 12, color: C.text2, width: 180 }}>
                  Add one more provider:
                </div>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div
                    style={{
                      flex: 1,
                      height: 20,
                      background: C.bg,
                      borderRadius: 4,
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        width: '91%',
                        height: '100%',
                        background: `${C.indigo}80`,
                        transition: 'width 0.3s ease',
                      }}
                    />
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: C.text3, width: 40 }}>
                    91%
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
