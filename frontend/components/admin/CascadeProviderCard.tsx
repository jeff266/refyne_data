'use client';

import { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  GripVertical,
  Trash2,
  ChevronDown,
  ChevronUp,
  Clock,
  RefreshCw,
  Settings2,
  AlertCircle,
} from 'lucide-react';
import TriggerSelector from './TriggerSelector';
import FieldSelector from './FieldSelector';
import type { CascadeTrigger } from '@/types';
import { PROVIDER_META } from '@/lib/providers';

export interface CascadeProviderData {
  id: string;
  providerId: string;
  trigger: CascadeTrigger;
  triggerConfig: Record<string, any>;
  fields: string[];
  timeoutMs: number;
  retryCount: number;
}

interface CascadeProviderCardProps {
  provider: CascadeProviderData;
  order: number;
  isFirst: boolean;
  isLast: boolean;
  isDragging: boolean;
  availableFields: string[];
  onUpdate: (updates: Partial<CascadeProviderData>) => void;
  onRemove: () => void;
}

export default function CascadeProviderCard({
  provider,
  order,
  isFirst,
  isLast,
  isDragging,
  availableFields,
  onUpdate,
  onRemove,
}: CascadeProviderCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: provider.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const providerMeta = PROVIDER_META[provider.providerId];
  const Icon = providerMeta?.icon;

  const handleDelete = () => {
    if (confirmDelete) {
      onRemove();
    } else {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
    }
  };

  const handleTriggerChange = (trigger: CascadeTrigger, triggerConfig: Record<string, any>) => {
    onUpdate({ trigger, triggerConfig });
  };

  const handleFieldsChange = (fields: string[]) => {
    onUpdate({ fields });
  };

  const handleTimeoutChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    if (!isNaN(value) && value >= 0) {
      onUpdate({ timeoutMs: value });
    }
  };

  const handleRetryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    if (!isNaN(value) && value >= 0 && value <= 5) {
      onUpdate({ retryCount: value });
    }
  };

  const getTriggerLabel = (trigger: CascadeTrigger): string => {
    const labels: Record<CascadeTrigger, string> = {
      always: 'Always',
      on_error: 'On Error',
      on_empty: 'On Empty',
      on_missing_field: 'On Missing Field',
      on_field_present: 'On Field Present',
      on_condition: 'On Condition',
    };
    return labels[trigger];
  };

  const getTriggerColor = (trigger: CascadeTrigger): string => {
    const colors: Record<CascadeTrigger, string> = {
      always: 'bg-green-50 text-green-700 border-green-200',
      on_error: 'bg-red-50 text-red-700 border-red-200',
      on_empty: 'bg-yellow-50 text-yellow-700 border-yellow-200',
      on_missing_field: 'bg-blue-50 text-blue-700 border-blue-200',
      on_field_present: 'bg-purple-50 text-purple-700 border-purple-200',
      on_condition: 'bg-orange-50 text-orange-700 border-orange-200',
    };
    return colors[trigger];
  };

  return (
    <div className="relative">
      {/* Connector Line (not for first item) */}
      {!isFirst && (
        <div className="absolute left-[23px] -top-3 w-px h-3 bg-mplc-gray-300" />
      )}

      {/* Arrow Connector */}
      {!isFirst && (
        <div className="absolute left-[19px] -top-1.5 flex items-center justify-center">
          <div className="w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[6px] border-t-mplc-gray-300" />
        </div>
      )}

      <div
        ref={setNodeRef}
        style={style}
        className={`bg-mplc-white rounded-xl border transition-all ${
          isDragging
            ? 'border-mplc-gray-400 shadow-lg opacity-50'
            : 'border-mplc-gray-200 hover:border-mplc-gray-300'
        }`}
      >
        {/* Main Row */}
        <div className="p-4 flex items-center gap-3">
          {/* Drag Handle */}
          <button
            {...attributes}
            {...listeners}
            className="flex-shrink-0 w-8 h-8 flex items-center justify-center text-mplc-gray-400 hover:text-mplc-gray-600 cursor-grab active:cursor-grabbing rounded hover:bg-mplc-gray-100 transition-colors"
            aria-label="Drag to reorder"
          >
            <GripVertical size={18} />
          </button>

          {/* Order Badge */}
          <div className="flex-shrink-0 w-8 h-8 bg-mplc-black rounded-lg flex items-center justify-center">
            <span className="text-sm font-bold text-mplc-white">{order}</span>
          </div>

          {/* Provider Info */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {/* Provider Icon */}
            <div className="flex-shrink-0 w-10 h-10 bg-mplc-gray-100 rounded-lg flex items-center justify-center">
              {Icon ? (
                <Icon className="w-5 h-5 text-mplc-gray-600" />
              ) : (
                <Settings2 className="w-5 h-5 text-mplc-gray-400" />
              )}
            </div>

            {/* Provider Name & Type */}
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-mplc-black truncate">
                {providerMeta?.name || provider.providerId}
              </div>
              <div className="text-xs text-mplc-gray-500">
                {provider.fields.length} field{provider.fields.length !== 1 ? 's' : ''} selected
              </div>
            </div>
          </div>

          {/* Trigger Badge */}
          <span
            className={`flex-shrink-0 px-2.5 py-1 text-xs font-medium rounded-full border ${getTriggerColor(
              provider.trigger
            )}`}
          >
            {getTriggerLabel(provider.trigger)}
          </span>

          {/* Timeout Badge */}
          <div className="flex-shrink-0 flex items-center gap-1 px-2 py-1 bg-mplc-gray-100 rounded-full">
            <Clock size={12} className="text-mplc-gray-500" />
            <span className="text-xs text-mplc-gray-600">{provider.timeoutMs}ms</span>
          </div>

          {/* Expand/Collapse */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex-shrink-0 p-2 text-mplc-gray-400 hover:text-mplc-gray-600 rounded-lg hover:bg-mplc-gray-100 transition-colors"
          >
            {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>

          {/* Delete Button */}
          <button
            onClick={handleDelete}
            className={`flex-shrink-0 p-2 rounded-lg transition-colors ${
              confirmDelete
                ? 'bg-red-500 text-mplc-white'
                : 'text-mplc-gray-400 hover:text-red-500 hover:bg-red-50'
            }`}
            title={confirmDelete ? 'Click again to confirm' : 'Remove provider'}
          >
            <Trash2 size={18} />
          </button>
        </div>

        {/* Expanded Details */}
        {isExpanded && (
          <div className="px-4 pb-4 pt-2 border-t border-mplc-gray-100 space-y-4">
            {/* First Provider Notice */}
            {isFirst && provider.trigger !== 'always' && (
              <div className="flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
                <AlertCircle size={16} />
                <span>First provider should typically use "Always" trigger</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 ml-12">
              {/* Trigger Configuration */}
              <div className="col-span-2">
                <TriggerSelector
                  trigger={provider.trigger}
                  triggerConfig={provider.triggerConfig}
                  availableFields={availableFields}
                  onChange={handleTriggerChange}
                />
              </div>

              {/* Field Selection */}
              <div className="col-span-2">
                <FieldSelector
                  availableFields={availableFields}
                  selectedFields={provider.fields}
                  onChange={handleFieldsChange}
                  maxHeight="160px"
                />
              </div>

              {/* Timeout */}
              <div>
                <label className="block text-xs font-medium text-mplc-gray-500 mb-1.5">
                  Timeout (ms)
                </label>
                <div className="flex items-center gap-2">
                  <Clock size={14} className="text-mplc-gray-400" />
                  <input
                    type="number"
                    value={provider.timeoutMs}
                    onChange={handleTimeoutChange}
                    min={0}
                    max={60000}
                    step={100}
                    className="flex-1 px-3 py-2 border border-mplc-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-mplc-black focus:border-transparent"
                  />
                </div>
                <p className="mt-1 text-xs text-mplc-gray-400">
                  Max time to wait for response (0-60000ms)
                </p>
              </div>

              {/* Retry Count */}
              <div>
                <label className="block text-xs font-medium text-mplc-gray-500 mb-1.5">
                  Retry Count
                </label>
                <div className="flex items-center gap-2">
                  <RefreshCw size={14} className="text-mplc-gray-400" />
                  <input
                    type="number"
                    value={provider.retryCount}
                    onChange={handleRetryChange}
                    min={0}
                    max={5}
                    className="flex-1 px-3 py-2 border border-mplc-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-mplc-black focus:border-transparent"
                  />
                </div>
                <p className="mt-1 text-xs text-mplc-gray-400">
                  Number of retry attempts on failure (0-5)
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Connector Line (not for last item) */}
      {!isLast && (
        <div className="absolute left-[23px] -bottom-3 w-px h-3 bg-mplc-gray-300" />
      )}
    </div>
  );
}
