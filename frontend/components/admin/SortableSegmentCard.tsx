'use client';

import { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Trash2, ChevronDown, ChevronUp, Eye, EyeOff, Settings2 } from 'lucide-react';
import CascadePreview from './CascadePreview';
import ProviderLogo from '@/components/ProviderLogo';

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

interface SortableSegmentCardProps {
  segment: Segment;
  providers: Record<string, Provider>;
  onUpdate: (segmentId: string, updates: Partial<Segment>) => void;
  onDelete: (segmentId: string) => void;
  onConfigureCascade: (segmentId: string) => void;
  isDragging: boolean;
}

export default function SortableSegmentCard({
  segment,
  providers,
  onUpdate,
  onDelete,
  onConfigureCascade,
  isDragging,
}: SortableSegmentCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(segment.display_name);
  const [editDescription, setEditDescription] = useState(segment.description);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: segment.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const primaryProvider = segment.providers.cascade[0];
  const providerInfo = primaryProvider ? providers[primaryProvider] : null;

  const handleSaveEdit = () => {
    onUpdate(segment.id, {
      display_name: editName,
      description: editDescription,
    });
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditName(segment.display_name);
    setEditDescription(segment.description);
    setIsEditing(false);
  };

  const handleToggleVisibility = () => {
    onUpdate(segment.id, { visible: !segment.visible });
  };

  const handleDelete = () => {
    if (confirmDelete) {
      onDelete(segment.id);
    } else {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
    }
  };

  const handleConfigureCascade = () => {
    onConfigureCascade(segment.id);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-white rounded-xl border transition-all ${
        isDragging
          ? 'border-gray-300 shadow-lg opacity-50'
          : 'border-gray-200 hover:border-gray-300'
      }`}
    >
      {/* Main Row */}
      <div className="p-4 flex items-center gap-4">
        {/* Drag Handle */}
        <button
          {...attributes}
          {...listeners}
          className="flex-shrink-0 w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing rounded hover:bg-gray-100 transition-colors"
          aria-label="Drag to reorder"
        >
          <GripVertical size={18} />
        </button>

        {/* Order Badge */}
        <div className="flex-shrink-0 w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
          <span className="text-sm font-medium text-gray-600">{segment.order}</span>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <div className="space-y-2">
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                placeholder="Segment name"
              />
              <input
                type="text"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                placeholder="Description"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleSaveEdit}
                  className="px-3 py-1 bg-black text-white text-xs rounded-full hover:bg-gray-800 transition-colors"
                >
                  Save
                </button>
                <button
                  onClick={handleCancelEdit}
                  className="px-3 py-1 border border-gray-300 text-xs rounded-full hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div
              onClick={() => setIsEditing(true)}
              className="cursor-pointer"
            >
              <div className="font-medium text-black">{segment.display_name}</div>
              <div className="text-sm text-gray-500 truncate">{segment.description}</div>
            </div>
          )}
        </div>

        {/* Provider Badge */}
        {providerInfo && primaryProvider && (
          <div className="flex-shrink-0 px-2 py-1 bg-black text-white text-xs font-medium rounded-full flex items-center gap-2">
            <ProviderLogo providerId={primaryProvider} size={16} />
            {providerInfo.name}
          </div>
        )}

        {/* Visibility Toggle */}
        <button
          onClick={handleToggleVisibility}
          className={`flex-shrink-0 p-2 rounded-lg transition-colors ${
            segment.visible
              ? 'text-gray-600 hover:bg-gray-100'
              : 'text-gray-400 hover:bg-gray-100'
          }`}
          title={segment.visible ? 'Hide segment' : 'Show segment'}
        >
          {segment.visible ? <Eye size={18} /> : <EyeOff size={18} />}
        </button>

        {/* Expand/Collapse */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex-shrink-0 p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
        >
          {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>

        {/* Delete Button */}
        <button
          onClick={handleDelete}
          className={`flex-shrink-0 p-2 rounded-lg transition-colors ${
            confirmDelete
              ? 'bg-red-500 text-white'
              : 'text-gray-400 hover:text-red-500 hover:bg-red-50'
          }`}
          title={confirmDelete ? 'Click again to confirm' : 'Delete segment'}
        >
          <Trash2 size={18} />
        </button>
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="px-4 pb-4 pt-2 border-t border-gray-100">
          <div className="ml-12 space-y-4">
            {/* Provider Cascade */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-medium text-gray-500">
                  Provider Cascade
                </label>
                <button
                  onClick={handleConfigureCascade}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-full hover:bg-gray-50 hover:border-gray-300 transition-colors"
                >
                  <Settings2 size={12} />
                  Configure Cascade
                </button>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                <CascadePreview
                  cascade={segment.providers.cascade}
                  providers={providers}
                  fallbackEnabled={segment.providers.fallback_enabled}
                  compact
                />
                {segment.providers.fallback_enabled && (
                  <div className="mt-2 pt-2 border-t border-gray-200">
                    <span className="text-[10px] text-gray-500 uppercase tracking-wider">
                      Fallback mode enabled
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Segment Info */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Segment ID
                </label>
                <div className="px-3 py-2 bg-gray-50 rounded-lg text-sm text-gray-600 font-mono">
                  {segment.id}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Input Fields
                </label>
                <div className="px-3 py-2 bg-gray-50 rounded-lg text-sm text-gray-600">
                  {segment.input_fields.length} field(s) configured
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
