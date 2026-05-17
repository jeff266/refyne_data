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
  DragStartEvent,
  DragOverlay,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import SortableSegmentCard from './SortableSegmentCard';

interface Segment {
  id: string;
  display_name: string;
  description: string;
  icon: string;
  visible: boolean;
  order: number;
  providers: {
    cascade: string[];
    fallback_enabled: boolean;
    fallback?: string[];
  };
  input_fields: any[];
}

interface Provider {
  name: string;
  type: string;
  env_key?: string;
  env_keys?: string[];
}

interface SegmentListProps {
  segments: Segment[];
  providers: Record<string, Provider>;
  onReorder: (segments: Segment[]) => void;
  onUpdate: (segmentId: string, updates: Partial<Segment>) => void;
  onDelete: (segmentId: string) => void;
  onConfigureCascade: (segmentId: string) => void;
}

export default function SegmentList({
  segments,
  providers,
  onReorder,
  onUpdate,
  onDelete,
  onConfigureCascade,
}: SegmentListProps) {
  const [activeId, setActiveId] = useState<string | null>(null);

  // Sort segments by order for display
  const sortedSegments = [...segments].sort((a, b) => a.order - b.order);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (over && active.id !== over.id) {
      const oldIndex = sortedSegments.findIndex((s) => s.id === active.id);
      const newIndex = sortedSegments.findIndex((s) => s.id === over.id);

      const reorderedSegments = arrayMove(sortedSegments, oldIndex, newIndex);

      // Update order values based on new positions
      const updatedSegments = reorderedSegments.map((seg, index) => ({
        ...seg,
        order: index + 1,
      }));

      onReorder(updatedSegments);
    }
  };

  const activeSegment = activeId
    ? sortedSegments.find((s) => s.id === activeId)
    : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={sortedSegments.map((s) => s.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="space-y-3">
          {sortedSegments.map((segment) => (
            <SortableSegmentCard
              key={segment.id}
              segment={segment}
              providers={providers}
              onUpdate={onUpdate}
              onDelete={onDelete}
              onConfigureCascade={onConfigureCascade}
              isDragging={activeId === segment.id}
            />
          ))}
        </div>
      </SortableContext>

      <DragOverlay>
        {activeSegment ? (
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-lg opacity-90">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                <span className="text-gray-400 text-xs">{activeSegment.order}</span>
              </div>
              <div>
                <div className="font-medium text-black">{activeSegment.display_name}</div>
                <div className="text-sm text-gray-500">{activeSegment.description}</div>
              </div>
            </div>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
