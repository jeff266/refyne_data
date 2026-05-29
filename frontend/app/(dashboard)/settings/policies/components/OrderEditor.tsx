'use client';

/**
 * Order Editor
 *
 * Drag-and-drop editor for configuring value order in never_downgrade rules.
 * Higher in list = more advanced in funnel (will never be overwritten by lower values).
 */

import { useState } from 'react';
import { C } from '@/lib/design-tokens';
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
import { Plus, X } from 'lucide-react';

interface OrderEditorProps {
  values: string[];
  onChange: (values: string[]) => void;
  fieldKey?: string; // Used to determine if we should show presets
  topLabel?: string; // Label for highest priority item
  bottomLabel?: string; // Label for lowest priority item
}

// Preset orders for common fields
const PRESETS: Record<string, string[]> = {
  lifecyclestage: [
    'Opportunity',
    'Sales Qualified Lead',
    'Marketing Qualified Lead',
    'Lead',
    'Subscriber',
    'Other',
  ],
};

function SortableValueItem({
  value,
  index,
  onRemove,
  canRemove,
  isFirst,
  isLast,
  topLabel,
  bottomLabel,
}: {
  value: string;
  index: number;
  onRemove: () => void;
  canRemove: boolean;
  isFirst: boolean;
  isLast: boolean;
  topLabel?: string;
  bottomLabel?: string;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: value,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 12px',
        background: C.surface,
        border: `1px solid ${C.border}`,
        marginBottom: 8,
      }}
    >
      {/* Drag handle */}
      <div
        {...attributes}
        {...listeners}
        style={{ cursor: 'grab', color: C.text3, display: 'flex', alignItems: 'center' }}
      >
        ⠿
      </div>

      {/* Rank number */}
      <div
        style={{
          minWidth: 24,
          fontSize: 13,
          fontWeight: 500,
          color: C.text3,
        }}
      >
        {index + 1}
      </div>

      {/* Value */}
      <div style={{ flex: 1, fontSize: 13, color: C.text }}>
        {value}
      </div>

      {/* Priority indicator */}
      {isFirst && topLabel && (
        <div style={{ fontSize: 11, color: C.text3 }}>
          {topLabel}
        </div>
      )}
      {isLast && bottomLabel && (
        <div style={{ fontSize: 11, color: C.text3 }}>
          {bottomLabel}
        </div>
      )}

      {/* Remove button (only show if custom values can be removed) */}
      {canRemove && (
        <button
          onClick={onRemove}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: C.text3,
            padding: 4,
            display: 'flex',
            alignItems: 'center',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = C.text;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = C.text3;
          }}
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}

export function OrderEditor({
  values,
  onChange,
  fieldKey,
  topLabel = 'Most advanced',
  bottomLabel = 'Least advanced',
}: OrderEditorProps) {
  const [newValue, setNewValue] = useState('');

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = values.indexOf(active.id as string);
      const newIndex = values.indexOf(over.id as string);
      onChange(arrayMove(values, oldIndex, newIndex));
    }
  };

  const handleAddValue = () => {
    if (newValue.trim() && !values.includes(newValue.trim())) {
      onChange([...values, newValue.trim()]);
      setNewValue('');
    }
  };

  const handleRemoveValue = (value: string) => {
    onChange(values.filter((v) => v !== value));
  };

  const isPreset = fieldKey && PRESETS[fieldKey];

  return (
    <div>
      <div style={{ fontSize: 12, color: C.text3, marginBottom: 12 }}>
        Define the value order. Higher values will never be overwritten by lower ones.
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={values} strategy={verticalListSortingStrategy}>
          {values.map((value, index) => (
            <SortableValueItem
              key={value}
              value={value}
              index={index}
              onRemove={() => handleRemoveValue(value)}
              canRemove={!isPreset} // Only allow removal for custom values
              isFirst={index === 0}
              isLast={index === values.length - 1}
              topLabel={topLabel}
              bottomLabel={bottomLabel}
            />
          ))}
        </SortableContext>
      </DndContext>

      {/* Add custom value input (only for non-preset fields) */}
      {!isPreset && (
        <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
          <input
            type="text"
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddValue();
              }
            }}
            placeholder="Add custom value..."
            style={{
              flex: 1,
              padding: '8px 12px',
              fontSize: 13,
              background: C.surface,
              border: `1px solid ${C.border}`,
              borderRadius: 0,
              color: C.text,
              outline: 'none',
            }}
          />
          <button
            onClick={handleAddValue}
            disabled={!newValue.trim()}
            style={{
              padding: '8px 12px',
              fontSize: 13,
              background: newValue.trim() ? C.indigo : C.surface,
              color: newValue.trim() ? C.text : C.text3,
              border: `1px solid ${newValue.trim() ? C.indigo : C.border}`,
              borderRadius: 0,
              cursor: newValue.trim() ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Plus size={14} /> Add
          </button>
        </div>
      )}
    </div>
  );
}
