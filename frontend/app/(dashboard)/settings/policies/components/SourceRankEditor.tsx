'use client';

/**
 * Source Rank Editor
 *
 * Drag-and-drop editor for configuring trusted source order in source_preference rules.
 * Higher in list = more trusted.
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
import { GripVertical } from 'lucide-react';

interface SourceRankEditorProps {
  sources: string[];
  onChange: (sources: string[]) => void;
}

const SOURCE_LABELS: Record<string, string> = {
  graphiq: 'GraphIQ',
  apollo: 'Apollo',
  zoominfo: 'ZoomInfo',
  cognism: 'Cognism',
  refyne_search: 'Refyne Search',
  clearbit: 'Clearbit',
  user_entered: 'User entered',
  hubspot_import: 'HubSpot import',
  unknown: 'Unknown',
};

function SortableSourceItem({ source, index }: { source: string; index: number }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: source,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const label = SOURCE_LABELS[source] || source;
  const isMostTrusted = index === 0;
  const isLeastTrusted = index === 8; // Last item (unknown)

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

      {/* Source name */}
      <div style={{ flex: 1, fontSize: 13, color: C.text }}>
        {label}
      </div>

      {/* Trust indicator */}
      {isMostTrusted && (
        <div style={{ fontSize: 11, color: C.text3 }}>
          Most trusted
        </div>
      )}
      {isLeastTrusted && (
        <div style={{ fontSize: 11, color: C.text3 }}>
          Least trusted
        </div>
      )}
    </div>
  );
}

export function SourceRankEditor({ sources, onChange }: SourceRankEditorProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = sources.indexOf(active.id as string);
      const newIndex = sources.indexOf(over.id as string);
      onChange(arrayMove(sources, oldIndex, newIndex));
    }
  };

  return (
    <div>
      <div style={{ fontSize: 12, color: C.text3, marginBottom: 12 }}>
        Drag to reorder. Higher = more trusted.
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={sources} strategy={verticalListSortingStrategy}>
          {sources.map((source, index) => (
            <SortableSourceItem key={source} source={source} index={index} />
          ))}
        </SortableContext>
      </DndContext>

      <div
        style={{
          marginTop: 12,
          fontSize: 11,
          color: C.text3,
          lineHeight: 1.5,
        }}
      >
        Providers not connected to your workspace are shown but can still be ranked.
      </div>
    </div>
  );
}
