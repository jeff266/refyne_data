'use client';

import { useState, useMemo } from 'react';
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
import {
  Plus,
  ChevronDown,
  ChevronRight,
  Settings,
  Play,
  Workflow,
  ArrowDown,
  Check,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import CascadeProviderCard, { CascadeProviderData } from './CascadeProviderCard';
import { PROVIDER_META, PROVIDER_LIST } from '@/lib/providers';

type FieldPriority = 'first_wins' | 'last_wins' | 'most_complete';

interface CascadeEditorProps {
  providers: CascadeProviderData[];
  fieldPriority: FieldPriority;
  dedupKey: string;
  availableFields: string[];
  onChange: (
    providers: CascadeProviderData[],
    fieldPriority: FieldPriority,
    dedupKey: string
  ) => void;
}

const FIELD_PRIORITY_OPTIONS: { value: FieldPriority; label: string; description: string }[] = [
  {
    value: 'first_wins',
    label: 'First Wins',
    description: 'Use the first non-empty value found for each field',
  },
  {
    value: 'last_wins',
    label: 'Last Wins',
    description: 'Use the last non-empty value found for each field',
  },
  {
    value: 'most_complete',
    label: 'Most Complete',
    description: 'Use the provider with the most complete data',
  },
];

const DEDUP_KEY_OPTIONS = [
  { value: 'domain', label: 'Domain' },
  { value: 'company_name', label: 'Company Name' },
  { value: 'email', label: 'Email' },
  { value: 'linkedin_url', label: 'LinkedIn URL' },
  { value: 'phone', label: 'Phone' },
];

// Generate unique ID for new providers
function generateId(): string {
  return `cascade_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export default function CascadeEditor({
  providers,
  fieldPriority,
  dedupKey,
  availableFields,
  onChange,
}: CascadeEditorProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isAddingProvider, setIsAddingProvider] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [isTestRunning, setIsTestRunning] = useState(false);
  const [testResult, setTestResult] = useState<null | { success: boolean; message: string }>(null);

  // Get providers not yet in the cascade
  const availableProviders = useMemo(() => {
    const usedProviderIds = new Set(providers.map((p) => p.providerId));
    return PROVIDER_LIST.filter((p) => !usedProviderIds.has(p.id));
  }, [providers]);

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
      const oldIndex = providers.findIndex((p) => p.id === active.id);
      const newIndex = providers.findIndex((p) => p.id === over.id);
      const reordered = arrayMove(providers, oldIndex, newIndex);
      onChange(reordered, fieldPriority, dedupKey);
    }
  };

  const handleAddProvider = (providerId: string) => {
    const providerMeta = PROVIDER_META[providerId];
    const newProvider: CascadeProviderData = {
      id: generateId(),
      providerId,
      trigger: providers.length === 0 ? 'always' : 'on_error',
      triggerConfig: {},
      fields: providerMeta?.capabilities
        ? availableFields.slice(0, 5) // Default to first 5 fields
        : [],
      timeoutMs: 5000,
      retryCount: 1,
    };
    onChange([...providers, newProvider], fieldPriority, dedupKey);
    setIsAddingProvider(false);
  };

  const handleUpdateProvider = (id: string, updates: Partial<CascadeProviderData>) => {
    const updated = providers.map((p) => (p.id === id ? { ...p, ...updates } : p));
    onChange(updated, fieldPriority, dedupKey);
  };

  const handleRemoveProvider = (id: string) => {
    const filtered = providers.filter((p) => p.id !== id);
    onChange(filtered, fieldPriority, dedupKey);
  };

  const handleFieldPriorityChange = (newPriority: FieldPriority) => {
    onChange(providers, newPriority, dedupKey);
  };

  const handleDedupKeyChange = (newKey: string) => {
    onChange(providers, fieldPriority, newKey);
  };

  const handleTestCascade = async () => {
    setIsTestRunning(true);
    setTestResult(null);

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Mock result
    setTestResult({
      success: true,
      message: `Cascade validated: ${providers.length} providers configured. Estimated completion time: ${
        providers.reduce((acc, p) => acc + p.timeoutMs, 0) / 1000
      }s max.`,
    });
    setIsTestRunning(false);
  };

  const activeProvider = activeId ? providers.find((p) => p.id === activeId) : null;

  return (
    <div className="space-y-6">
      {/* Global Settings */}
      <div className="card p-4">
        <div className="flex items-center gap-2 mb-4">
          <Settings size={18} className="text-mplc-gray-600" />
          <h3 className="font-semibold text-mplc-black">Global Settings</h3>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Field Priority */}
          <div>
            <label className="block text-xs font-medium text-mplc-gray-500 mb-1.5">
              Field Priority
            </label>
            <select
              value={fieldPriority}
              onChange={(e) => handleFieldPriorityChange(e.target.value as FieldPriority)}
              className="w-full px-3 py-2 border border-mplc-gray-200 rounded-lg text-sm bg-mplc-white focus:outline-none focus:ring-2 focus:ring-mplc-black focus:border-transparent"
            >
              {FIELD_PRIORITY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-mplc-gray-400">
              {FIELD_PRIORITY_OPTIONS.find((o) => o.value === fieldPriority)?.description}
            </p>
          </div>

          {/* Dedup Key */}
          <div>
            <label className="block text-xs font-medium text-mplc-gray-500 mb-1.5">
              Deduplication Key
            </label>
            <select
              value={dedupKey}
              onChange={(e) => handleDedupKeyChange(e.target.value)}
              className="w-full px-3 py-2 border border-mplc-gray-200 rounded-lg text-sm bg-mplc-white focus:outline-none focus:ring-2 focus:ring-mplc-black focus:border-transparent"
            >
              {DEDUP_KEY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-mplc-gray-400">
              Field used to identify duplicate records
            </p>
          </div>
        </div>
      </div>

      {/* Provider Cascade */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Workflow size={18} className="text-mplc-gray-600" />
            <h3 className="font-semibold text-mplc-black">Provider Cascade</h3>
            <span className="px-2 py-0.5 bg-mplc-gray-100 text-mplc-gray-600 text-xs rounded-full">
              {providers.length} provider{providers.length !== 1 ? 's' : ''}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Preview Toggle */}
            <button
              onClick={() => setShowPreview(!showPreview)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors ${
                showPreview
                  ? 'bg-mplc-gray-100 text-mplc-black'
                  : 'text-mplc-gray-600 hover:bg-mplc-gray-50'
              }`}
            >
              {showPreview ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              Preview
            </button>
          </div>
        </div>

        {/* Empty State */}
        {providers.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-mplc-gray-200 rounded-xl">
            <Workflow size={40} className="text-mplc-gray-300 mb-3" />
            <p className="text-mplc-gray-600 font-medium mb-1">No providers in cascade</p>
            <p className="text-sm text-mplc-gray-400 mb-4">
              Add providers to build your enrichment cascade
            </p>
            <button
              onClick={() => setIsAddingProvider(true)}
              className="btn-primary flex items-center gap-2"
            >
              <Plus size={16} />
              Add First Provider
            </button>
          </div>
        )}

        {/* Provider List */}
        {providers.length > 0 && (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={providers.map((p) => p.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-3 mb-4">
                {providers.map((provider, index) => (
                  <CascadeProviderCard
                    key={provider.id}
                    provider={provider}
                    order={index + 1}
                    isFirst={index === 0}
                    isLast={index === providers.length - 1}
                    isDragging={activeId === provider.id}
                    availableFields={availableFields}
                    onUpdate={(updates) => handleUpdateProvider(provider.id, updates)}
                    onRemove={() => handleRemoveProvider(provider.id)}
                  />
                ))}
              </div>
            </SortableContext>

            <DragOverlay>
              {activeProvider ? (
                <div className="bg-mplc-white rounded-xl border border-mplc-gray-300 p-4 shadow-lg opacity-90">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-mplc-black rounded-lg flex items-center justify-center">
                      <span className="text-sm font-bold text-mplc-white">
                        {providers.findIndex((p) => p.id === activeProvider.id) + 1}
                      </span>
                    </div>
                    <div>
                      <div className="font-medium text-mplc-black">
                        {PROVIDER_META[activeProvider.providerId]?.name || activeProvider.providerId}
                      </div>
                      <div className="text-sm text-mplc-gray-500">
                        {activeProvider.fields.length} fields
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        )}

        {/* Add Provider Button */}
        {providers.length > 0 && availableProviders.length > 0 && (
          <div className="relative">
            {/* Connector to Add Button */}
            <div className="absolute left-[23px] top-0 w-px h-4 bg-mplc-gray-300" />
            <div className="absolute left-[19px] top-3 flex items-center justify-center">
              <div className="w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[6px] border-t-mplc-gray-300" />
            </div>

            <div className="pt-6">
              {isAddingProvider ? (
                <div className="border border-mplc-gray-200 rounded-xl p-4 bg-mplc-gray-50">
                  <label className="block text-sm font-medium text-mplc-gray-700 mb-2">
                    Select provider to add:
                  </label>
                  <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                    {availableProviders.map((provider) => {
                      const Icon = provider.icon;
                      return (
                        <button
                          key={provider.id}
                          onClick={() => handleAddProvider(provider.id)}
                          className="flex items-center gap-2 p-3 border border-mplc-gray-200 rounded-lg bg-mplc-white hover:border-mplc-gray-400 hover:shadow-sm transition-all text-left"
                        >
                          <div className="w-8 h-8 bg-mplc-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                            <Icon className="w-4 h-4 text-mplc-gray-600" />
                          </div>
                          <div className="min-w-0">
                            <div className="font-medium text-sm text-mplc-black truncate">
                              {provider.name}
                            </div>
                            <div className="text-xs text-mplc-gray-500 truncate">
                              {provider.description}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  <button
                    onClick={() => setIsAddingProvider(false)}
                    className="mt-3 text-sm text-mplc-gray-500 hover:text-mplc-gray-700"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setIsAddingProvider(true)}
                  className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-mplc-gray-300 rounded-xl text-mplc-gray-600 hover:border-mplc-gray-400 hover:text-mplc-black hover:bg-mplc-gray-50 transition-colors"
                >
                  <Plus size={18} />
                  <span className="font-medium">Add Provider</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Preview Panel */}
      {showPreview && providers.length > 0 && (
        <div className="card p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-mplc-black">Cascade Preview</h3>
            <button
              onClick={handleTestCascade}
              disabled={isTestRunning}
              className="btn-secondary flex items-center gap-2 text-sm"
            >
              {isTestRunning ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Testing...
                </>
              ) : (
                <>
                  <Play size={14} />
                  Test with Sample Data
                </>
              )}
            </button>
          </div>

          {/* Test Result */}
          {testResult && (
            <div
              className={`mb-4 p-3 rounded-lg flex items-start gap-2 ${
                testResult.success
                  ? 'bg-green-50 border border-green-200'
                  : 'bg-red-50 border border-red-200'
              }`}
            >
              {testResult.success ? (
                <Check size={16} className="text-green-600 mt-0.5" />
              ) : (
                <AlertCircle size={16} className="text-red-600 mt-0.5" />
              )}
              <span
                className={`text-sm ${testResult.success ? 'text-green-700' : 'text-red-700'}`}
              >
                {testResult.message}
              </span>
            </div>
          )}

          {/* Flowchart View */}
          <div className="bg-mplc-gray-50 rounded-xl p-6 border border-mplc-gray-200">
            <div className="flex flex-col items-center">
              {/* Start Node */}
              <div className="px-4 py-2 bg-mplc-black text-mplc-white text-sm font-medium rounded-lg">
                Start Enrichment
              </div>

              {providers.map((provider, index) => {
                const meta = PROVIDER_META[provider.providerId];
                const Icon = meta?.icon;
                const isLast = index === providers.length - 1;

                return (
                  <div key={provider.id} className="flex flex-col items-center">
                    {/* Connector Arrow */}
                    <div className="flex flex-col items-center py-2">
                      <div className="w-px h-4 bg-mplc-gray-300" />
                      <ArrowDown size={16} className="text-mplc-gray-400 -my-1" />
                      {provider.trigger !== 'always' && (
                        <div className="mt-1 px-2 py-0.5 bg-mplc-white border border-mplc-gray-200 rounded text-xs text-mplc-gray-600">
                          {provider.trigger.replace('_', ' ')}
                        </div>
                      )}
                    </div>

                    {/* Provider Node */}
                    <div className="flex items-center gap-3 px-4 py-3 bg-mplc-white border border-mplc-gray-200 rounded-xl shadow-sm min-w-[200px]">
                      <div className="w-8 h-8 bg-mplc-gray-100 rounded-lg flex items-center justify-center">
                        {Icon && <Icon className="w-4 h-4 text-mplc-gray-600" />}
                      </div>
                      <div>
                        <div className="font-medium text-sm text-mplc-black">
                          {meta?.name || provider.providerId}
                        </div>
                        <div className="text-xs text-mplc-gray-500">
                          {provider.fields.length} fields | {provider.timeoutMs}ms timeout
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* End Connector */}
              <div className="flex flex-col items-center py-2">
                <div className="w-px h-4 bg-mplc-gray-300" />
                <ArrowDown size={16} className="text-mplc-gray-400 -my-1" />
              </div>

              {/* Merge Node */}
              <div className="px-4 py-2 bg-mplc-gray-200 text-mplc-gray-700 text-sm font-medium rounded-lg">
                Merge Results ({fieldPriority.replace('_', ' ')})
              </div>

              {/* Final Connector */}
              <div className="flex flex-col items-center py-2">
                <div className="w-px h-4 bg-mplc-gray-300" />
                <ArrowDown size={16} className="text-mplc-gray-400 -my-1" />
              </div>

              {/* Output Node */}
              <div className="px-4 py-2 bg-green-600 text-mplc-white text-sm font-medium rounded-lg">
                Enriched Data
              </div>
            </div>
          </div>

          {/* Summary Stats */}
          <div className="mt-4 grid grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-mplc-black">{providers.length}</div>
              <div className="text-xs text-mplc-gray-500">Providers</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-mplc-black">
                {new Set(providers.flatMap((p) => p.fields)).size}
              </div>
              <div className="text-xs text-mplc-gray-500">Unique Fields</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-mplc-black">
                {(providers.reduce((acc, p) => acc + p.timeoutMs, 0) / 1000).toFixed(1)}s
              </div>
              <div className="text-xs text-mplc-gray-500">Max Duration</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-mplc-black">
                {providers.reduce((acc, p) => acc + p.retryCount, 0)}
              </div>
              <div className="text-xs text-mplc-gray-500">Total Retries</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
