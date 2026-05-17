'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  X,
  AlertTriangle,
  Plus,
  GripVertical,
  Trash2,
  ChevronDown,
  AlertCircle,
  FileQuestion,
  FileCheck,
  Settings2,
  ArrowDown,
  CheckCircle2,
  Info,
  Zap,
  Sliders,
} from 'lucide-react';
import type { CascadeTrigger } from '@/types';
import {
  getFieldsFromPreviousProviders,
  getStepValidationWarnings,
  type ProviderField,
  type ProviderFieldGroup,
  type FieldRequirement,
  type OptimizedCascadeStep,
} from '@/lib/providerFields';
import CascadeTestPanel from './CascadeTestPanel';
import FieldRequirementsEditor from './FieldRequirementsEditor';
import ClayCalibration from './ClayCalibration';
import ProviderLogo from '@/components/ProviderLogo';
import type { CascadeStep as TestCascadeStep } from '@/lib/cascadeTestRunner';
import type { ClayStepConfig } from '@/types/clay';

interface Provider {
  name: string;
  type: string;
  env_key?: string;
  env_keys?: string[];
}

interface CascadeStep {
  providerId: string;
  trigger: CascadeTrigger;
  triggerConfig?: Record<string, any>;
  timeoutMs?: number;
  retryCount?: number;
  clayConfig?: Partial<ClayStepConfig>;
}

interface CascadeEditorModalProps {
  isOpen: boolean;
  segmentName: string;
  segmentId: string;
  initialCascade: string[];
  fallbackEnabled: boolean;
  providers: Record<string, Provider>;
  onSave: (cascade: CascadeStep[], fallbackEnabled: boolean) => void;
  onClose: () => void;
}

const TRIGGER_OPTIONS: { value: CascadeTrigger; label: string; description: string; icon: React.ReactNode }[] = [
  { value: 'always', label: 'Always', description: 'Always run this provider', icon: <ArrowDown className="w-4 h-4" /> },
  { value: 'on_error', label: 'On Error', description: 'Run if previous provider fails', icon: <AlertCircle className="w-4 h-4" /> },
  { value: 'on_empty', label: 'If Empty', description: 'Run if previous returns no results', icon: <FileQuestion className="w-4 h-4" /> },
  { value: 'on_missing_field', label: 'If Missing Field', description: 'Run if specific field is empty', icon: <FileQuestion className="w-4 h-4" /> },
  { value: 'on_field_present', label: 'If Field Present', description: 'Run if specific field has value', icon: <FileCheck className="w-4 h-4" /> },
  { value: 'on_condition', label: 'On Condition', description: 'Run based on custom condition', icon: <Settings2 className="w-4 h-4" /> },
];

const getTriggerStyle = (trigger: CascadeTrigger): { bg: string; text: string; border: string } => {
  const styles: Record<CascadeTrigger, { bg: string; text: string; border: string }> = {
    always: { bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-300' },
    on_error: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-300' },
    on_empty: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-300' },
    on_missing_field: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-300' },
    on_field_present: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-300' },
    on_condition: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-300' },
  };
  return styles[trigger] || styles.always;
};

// Convert simple cascade array to CascadeStep array
const cascadeToSteps = (cascade: string[]): CascadeStep[] => {
  return cascade.map((providerId, index) => ({
    providerId,
    trigger: index === 0 ? 'always' : 'on_error',
    triggerConfig: {},
    timeoutMs: 30000,
    retryCount: 1,
  }));
};

// Check if cascade has changed
const hasChanges = (original: CascadeStep[], current: CascadeStep[], originalFallback: boolean, currentFallback: boolean): boolean => {
  if (originalFallback !== currentFallback) return true;
  if (original.length !== current.length) return true;
  return original.some((step, index) => {
    const currentStep = current[index];
    return (
      step.providerId !== currentStep.providerId ||
      step.trigger !== currentStep.trigger ||
      JSON.stringify(step.triggerConfig) !== JSON.stringify(currentStep.triggerConfig)
    );
  });
};

type ModalTab = 'fields' | 'configure' | 'test';

export default function CascadeEditorModal({
  isOpen,
  segmentName,
  segmentId,
  initialCascade,
  fallbackEnabled: initialFallbackEnabled,
  providers,
  onSave,
  onClose,
}: CascadeEditorModalProps) {
  const [cascade, setCascade] = useState<CascadeStep[]>(() => cascadeToSteps(initialCascade));
  const [fallbackEnabled, setFallbackEnabled] = useState(initialFallbackEnabled);
  const [showUnsavedWarning, setShowUnsavedWarning] = useState(false);
  const [expandedStep, setExpandedStep] = useState<number | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<ModalTab>('fields');
  const [fieldRequirements, setFieldRequirements] = useState<FieldRequirement[]>([]);
  const [clayWebhookUrl, setClayWebhookUrl] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('clay_webhook_url') || '';
    }
    return '';
  });

  // Check if Clay is in the cascade
  const hasClayInCascade = cascade.some(step => step.providerId === 'clay');
  const clayStepIndex = cascade.findIndex(step => step.providerId === 'clay');
  const clayStep = clayStepIndex >= 0 ? cascade[clayStepIndex] : null;

  // Save Clay webhook URL to localStorage
  const handleClayWebhookUrlChange = (url: string) => {
    setClayWebhookUrl(url);
    if (typeof window !== 'undefined') {
      localStorage.setItem('clay_webhook_url', url);
    }
  };

  // Update Clay config for the Clay step
  const handleClayConfigChange = (config: Partial<ClayStepConfig>) => {
    if (clayStepIndex >= 0) {
      const newCascade = [...cascade];
      newCascade[clayStepIndex] = {
        ...newCascade[clayStepIndex],
        clayConfig: config,
      };
      setCascade(newCascade);
    }
  };

  const originalCascade = cascadeToSteps(initialCascade);
  const isDirty = hasChanges(originalCascade, cascade, initialFallbackEnabled, fallbackEnabled);

  // Convert cascade to format expected by test runner
  const testRunnerCascade: TestCascadeStep[] = useMemo(() => {
    return cascade.map(step => ({
      providerId: step.providerId,
      trigger: step.trigger,
      triggerConfig: step.triggerConfig,
      timeoutMs: step.timeoutMs,
      retryCount: step.retryCount,
    }));
  }, [cascade]);

  // Reset state when modal opens with new data
  useEffect(() => {
    if (isOpen) {
      setCascade(cascadeToSteps(initialCascade));
      setFallbackEnabled(initialFallbackEnabled);
      setShowUnsavedWarning(false);
      setExpandedStep(null);
      setActiveTab('fields');
      setFieldRequirements([]);
    }
  }, [isOpen, initialCascade, initialFallbackEnabled]);

  // Handle applying generated cascade from field requirements
  const handleApplyGeneratedCascade = useCallback((optimizedCascade: OptimizedCascadeStep[]) => {
    const newCascade: CascadeStep[] = optimizedCascade.map((step, index) => ({
      providerId: step.providerId,
      trigger: step.trigger === 'always' ? 'always' : 'on_missing_field',
      triggerConfig: step.triggerField ? { field: step.triggerField } : {},
      timeoutMs: 30000,
      retryCount: 1,
    }));
    setCascade(newCascade);
    setFallbackEnabled(true);
    setActiveTab('configure');
  }, []);

  const handleClose = useCallback(() => {
    if (isDirty) {
      setShowUnsavedWarning(true);
    } else {
      onClose();
    }
  }, [isDirty, onClose]);

  const handleConfirmClose = () => {
    setShowUnsavedWarning(false);
    onClose();
  };

  const handleSave = () => {
    onSave(cascade, fallbackEnabled);
    onClose();
  };

  const handleAddProvider = () => {
    const availableProviders = Object.keys(providers).filter(
      (id) => !cascade.some((step) => step.providerId === id)
    );

    if (availableProviders.length > 0) {
      setCascade([
        ...cascade,
        {
          providerId: availableProviders[0],
          trigger: cascade.length === 0 ? 'always' : 'on_error',
          triggerConfig: {},
          timeoutMs: 30000,
          retryCount: 1,
        },
      ]);
      setExpandedStep(cascade.length);
    }
  };

  const handleRemoveProvider = (index: number) => {
    const newCascade = cascade.filter((_, i) => i !== index);
    // Ensure first step is always "always" trigger
    if (newCascade.length > 0 && newCascade[0].trigger !== 'always') {
      newCascade[0] = { ...newCascade[0], trigger: 'always' };
    }
    setCascade(newCascade);
    setExpandedStep(null);
  };

  const handleUpdateStep = (index: number, updates: Partial<CascadeStep>) => {
    setCascade(cascade.map((step, i) => (i === index ? { ...step, ...updates } : step)));
  };

  const handleMoveStep = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= cascade.length) return;

    const newCascade = [...cascade];
    const [movedItem] = newCascade.splice(fromIndex, 1);
    newCascade.splice(toIndex, 0, movedItem);

    // Ensure first step is always "always" trigger
    if (newCascade.length > 0 && newCascade[0].trigger !== 'always') {
      newCascade[0] = { ...newCascade[0], trigger: 'always' };
    }

    setCascade(newCascade);
    setExpandedStep(toIndex);
  };

  const availableProviders = Object.keys(providers).filter(
    (id) => !cascade.some((step) => step.providerId === id)
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl mx-4 max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white">
          <div>
            <h2 className="text-lg font-medium text-black">Configure Cascade</h2>
            <p className="text-sm text-gray-500 mt-0.5">{segmentName}</p>
          </div>
          <div className="flex items-center gap-2">
            {isDirty && (
              <span className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded-full">
                Unsaved changes
              </span>
            )}
            <button
              onClick={handleClose}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 px-6 bg-white">
          <button
            onClick={() => setActiveTab('fields')}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'fields'
                ? 'border-black text-black'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            Fields
            {fieldRequirements.length > 0 && (
              <span className="px-1.5 py-0.5 bg-green-100 text-green-600 text-xs rounded-full">
                {fieldRequirements.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('configure')}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'configure'
                ? 'border-black text-black'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Sliders className="w-4 h-4" />
            Configure
            {cascade.length > 0 && (
              <span className="px-1.5 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">
                {cascade.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('test')}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'test'
                ? 'border-black text-black'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Zap className="w-4 h-4" />
            Test
          </button>
        </div>

        {/* Content - Fields Tab */}
        {activeTab === 'fields' && (
          <div className="flex-1 overflow-y-auto p-6">
            <FieldRequirementsEditor
              requirements={fieldRequirements}
              onChange={setFieldRequirements}
              onCascadeGenerated={handleApplyGeneratedCascade}
            />
          </div>
        )}

        {/* Content - Configure Tab */}
        {activeTab === 'configure' && (
        <div className="flex-1 overflow-y-auto p-6">
          {/* Explanation */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6 border border-gray-200">
            <p className="text-sm text-gray-600">
              Configure the provider cascade for this segment. Providers are called in order, with each subsequent provider triggered based on the specified condition.
            </p>
          </div>

          {/* Cascade Steps */}
          <div className="space-y-3">
            {cascade.map((step, index) => {
              const provider = providers[step.providerId];
              if (!provider) return null;

              const isFirst = index === 0;
              const isExpanded = expandedStep === index;
              const style = getTriggerStyle(step.trigger);
              const warnings = getStepValidationWarnings(
                step.trigger,
                step.triggerConfig || {},
                cascade.map(s => s.providerId),
                index
              );
              const hasWarnings = warnings.length > 0;

              return (
                <div key={`${step.providerId}-${index}`}>
                  {/* Trigger indicator between steps */}
                  {!isFirst && (
                    <div className="flex items-center justify-center py-2">
                      <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium ${style.bg} ${style.text} border ${style.border}`}>
                        {TRIGGER_OPTIONS.find((t) => t.value === step.trigger)?.icon}
                        <span>{TRIGGER_OPTIONS.find((t) => t.value === step.trigger)?.label}</span>
                      </div>
                    </div>
                  )}

                  {/* Step card */}
                  <div
                    className={`border rounded-xl transition-all ${
                      hasWarnings
                        ? 'border-amber-300 bg-amber-50/50'
                        : isExpanded
                        ? 'border-black shadow-sm'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    {/* Step header */}
                    <div className="flex items-center gap-3 p-4">
                      {/* Drag handle */}
                      <button
                        className="flex-shrink-0 p-1 text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setDraggedIndex(index);
                        }}
                        title="Drag to reorder"
                      >
                        <GripVertical size={16} />
                      </button>

                      {/* Provider logo */}
                      <div className="flex-shrink-0">
                        <ProviderLogo providerId={step.providerId} size={28} />
                      </div>

                      {/* Provider info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-black">{provider.name}</span>
                          {step.providerId === 'clay' && (
                            <div className="flex items-center gap-1 px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded text-xs">
                              <Zap className="w-3 h-3" />
                              <span>Async</span>
                            </div>
                          )}
                          {hasWarnings && (
                            <div className="flex items-center gap-1 px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded text-xs">
                              <AlertTriangle className="w-3 h-3" />
                              <span>Config issue</span>
                            </div>
                          )}
                        </div>
                        <div className="text-xs text-gray-500">
                          {provider.type}
                          {step.providerId === 'clay' && step.clayConfig?.calibration && (
                            <span className="ml-2 text-orange-600">
                              timeout: {Math.round((step.clayConfig.calibration.recommendedTimeoutMs || 30000) / 1000)}s
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Move buttons */}
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleMoveStep(index, index - 1)}
                          disabled={isFirst}
                          className={`p-1.5 rounded transition-colors ${
                            isFirst
                              ? 'text-gray-300 cursor-not-allowed'
                              : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                          }`}
                          title="Move up"
                        >
                          <ChevronDown className="w-4 h-4 rotate-180" />
                        </button>
                        <button
                          onClick={() => handleMoveStep(index, index + 1)}
                          disabled={index === cascade.length - 1}
                          className={`p-1.5 rounded transition-colors ${
                            index === cascade.length - 1
                              ? 'text-gray-300 cursor-not-allowed'
                              : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                          }`}
                          title="Move down"
                        >
                          <ChevronDown className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Expand button */}
                      <button
                        onClick={() => setExpandedStep(isExpanded ? null : index)}
                        className="flex-shrink-0 p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
                      >
                        <ChevronDown className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                      </button>

                      {/* Delete button */}
                      <button
                        onClick={() => handleRemoveProvider(index)}
                        className="flex-shrink-0 p-2 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors"
                        title="Remove provider"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>

                    {/* Expanded options */}
                    {isExpanded && (
                      <div className="px-4 pb-4 pt-2 border-t border-gray-100 space-y-4">
                        {/* Validation warnings */}
                        {hasWarnings && (
                          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                            <div className="flex items-start gap-2">
                              <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                              <div className="flex-1">
                                <div className="text-sm font-medium text-amber-800">Configuration Issue</div>
                                <ul className="mt-1 text-xs text-amber-700 space-y-0.5">
                                  {warnings.map((warning, idx) => (
                                    <li key={idx}>{warning}</li>
                                  ))}
                                </ul>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Provider selector */}
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1.5">
                            Provider
                          </label>
                          <select
                            value={step.providerId}
                            onChange={(e) => handleUpdateStep(index, { providerId: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent bg-white"
                          >
                            <option value={step.providerId}>{provider.name}</option>
                            {availableProviders.map((id) => (
                              <option key={id} value={id}>
                                {providers[id].name}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Trigger selector (not for first step) */}
                        {!isFirst && (
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1.5">
                              Trigger Condition
                            </label>
                            <div className="grid grid-cols-2 gap-2">
                              {TRIGGER_OPTIONS.filter((t) => t.value !== 'always').map((trigger) => {
                                const isSelected = step.trigger === trigger.value;
                                const triggerStyle = getTriggerStyle(trigger.value);
                                return (
                                  <button
                                    key={trigger.value}
                                    onClick={() => handleUpdateStep(index, { trigger: trigger.value })}
                                    className={`flex items-start gap-2 p-3 rounded-lg border text-left transition-all ${
                                      isSelected
                                        ? `${triggerStyle.bg} ${triggerStyle.border} ${triggerStyle.text}`
                                        : 'border-gray-200 hover:border-gray-300'
                                    }`}
                                  >
                                    <span className={isSelected ? triggerStyle.text : 'text-gray-400'}>
                                      {trigger.icon}
                                    </span>
                                    <div className="flex-1 min-w-0">
                                      <div className={`text-sm font-medium ${isSelected ? triggerStyle.text : 'text-gray-700'}`}>
                                        {trigger.label}
                                      </div>
                                      <div className={`text-xs ${isSelected ? triggerStyle.text : 'text-gray-500'} opacity-80`}>
                                        {trigger.description}
                                      </div>
                                    </div>
                                    {isSelected && (
                                      <CheckCircle2 className={`w-4 h-4 ${triggerStyle.text}`} />
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Field configuration for field-based triggers */}
                        {(step.trigger === 'on_missing_field' || step.trigger === 'on_field_present') && (
                          <FieldNameSelector
                            cascadeProviderIds={cascade.map(s => s.providerId)}
                            currentIndex={index}
                            selectedField={step.triggerConfig?.field || ''}
                            onFieldChange={(field) =>
                              handleUpdateStep(index, {
                                triggerConfig: { ...step.triggerConfig, field },
                              })
                            }
                          />
                        )}

                        {/* Timeout and retry settings */}
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1.5">
                              Timeout (ms)
                            </label>
                            <input
                              type="number"
                              value={step.timeoutMs || 30000}
                              onChange={(e) =>
                                handleUpdateStep(index, { timeoutMs: parseInt(e.target.value) || 30000 })
                              }
                              min={1000}
                              max={120000}
                              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1.5">
                              Retry Count
                            </label>
                            <input
                              type="number"
                              value={step.retryCount || 1}
                              onChange={(e) =>
                                handleUpdateStep(index, { retryCount: parseInt(e.target.value) || 1 })
                              }
                              min={0}
                              max={5}
                              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Add provider button */}
          {availableProviders.length > 0 && (
            <button
              onClick={handleAddProvider}
              className="w-full mt-4 py-3 border-2 border-dashed border-gray-300 rounded-xl text-sm font-medium text-gray-500 hover:border-black hover:text-black transition-colors flex items-center justify-center gap-2"
            >
              <Plus size={16} />
              Add Provider to Cascade
            </button>
          )}

          {/* Empty state */}
          {cascade.length === 0 && (
            <div className="text-center py-8">
              <div className="text-gray-400 mb-4">
                <Settings2 className="w-12 h-12 mx-auto" />
              </div>
              <p className="text-gray-500 mb-4">No providers configured for this cascade.</p>
              <button
                onClick={handleAddProvider}
                className="px-4 py-2 bg-black text-white rounded-full text-sm font-medium hover:bg-gray-800 transition-colors"
              >
                Add First Provider
              </button>
            </div>
          )}

          {/* Fallback toggle */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-black">Enable Fallback Mode</div>
                <div className="text-xs text-gray-500 mt-0.5">
                  Continue to next provider if current one fails or returns empty
                </div>
              </div>
              <button
                onClick={() => setFallbackEnabled(!fallbackEnabled)}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  fallbackEnabled ? 'bg-black' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    fallbackEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>
        )}

        {/* Content - Test Tab */}
        {activeTab === 'test' && (
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Clay Calibration - show if Clay is in cascade */}
            {hasClayInCascade && (
              <div className="border-2 border-orange-200 rounded-xl overflow-hidden">
                <div className="bg-orange-50 px-4 py-3 border-b border-orange-200">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 bg-orange-500 rounded-md flex items-center justify-center">
                      <Zap size={14} className="text-white" />
                    </div>
                    <h3 className="font-medium text-orange-900">Clay Configuration</h3>
                    <span className="ml-auto text-xs text-orange-600 bg-orange-100 px-2 py-0.5 rounded">
                      Async Provider
                    </span>
                  </div>
                  <p className="text-sm text-orange-700 mt-1">
                    Clay requires calibration to determine optimal timeout settings.
                  </p>
                </div>
                <div className="p-4 bg-white">
                  {/* Clay Webhook URL */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Clay Webhook URL
                    </label>
                    <input
                      type="text"
                      value={clayWebhookUrl}
                      onChange={(e) => handleClayWebhookUrlChange(e.target.value)}
                      placeholder="https://api.clay.com/v1/webhooks/..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Your Clay table's webhook trigger URL
                    </p>
                  </div>
                  <ClayCalibration
                    webhookUrl={clayWebhookUrl}
                    config={clayStep?.clayConfig}
                    onConfigChange={handleClayConfigChange}
                    sampleRecords={[
                      { company_name: 'Test Company 1', domain: 'test1.com' },
                      { company_name: 'Test Company 2', domain: 'test2.com' },
                      { company_name: 'Test Company 3', domain: 'test3.com' },
                    ]}
                  />
                </div>
              </div>
            )}

            {/* Regular cascade test panel */}
            <CascadeTestPanel cascade={testRunnerCascade} />
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50">
          <div className="text-xs text-gray-500">
            {cascade.length} provider{cascade.length !== 1 ? 's' : ''} in cascade
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleClose}
              className="px-4 py-2.5 border border-gray-300 rounded-full text-sm font-medium hover:bg-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!isDirty}
              className={`px-4 py-2.5 rounded-full text-sm font-medium transition-colors ${
                isDirty
                  ? 'bg-black text-white hover:bg-gray-800'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              Save Changes
            </button>
          </div>
        </div>
      </div>

      {/* Unsaved changes warning modal */}
      {showUnsavedWarning && (
        <div className="absolute inset-0 z-10 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30" onClick={() => setShowUnsavedWarning(false)} />
          <div className="relative bg-white rounded-xl shadow-2xl p-6 max-w-sm mx-4">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-medium text-black">Unsaved Changes</h3>
                <p className="text-sm text-gray-500 mt-1">
                  You have unsaved changes. Are you sure you want to close without saving?
                </p>
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={() => setShowUnsavedWarning(false)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
                  >
                    Keep Editing
                  </button>
                  <button
                    onClick={handleConfirmClose}
                    className="flex-1 px-3 py-2 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600 transition-colors"
                  >
                    Discard
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * FieldNameSelector Component
 * Dropdown for selecting a field name from available fields from previous providers
 */
interface FieldNameSelectorProps {
  cascadeProviderIds: string[];
  currentIndex: number;
  selectedField: string;
  onFieldChange: (field: string) => void;
}

function FieldNameSelector({
  cascadeProviderIds,
  currentIndex,
  selectedField,
  onFieldChange,
}: FieldNameSelectorProps) {
  const [showGrouped, setShowGrouped] = useState(true);

  const fieldGroups = useMemo(() => {
    return getFieldsFromPreviousProviders(cascadeProviderIds, currentIndex);
  }, [cascadeProviderIds, currentIndex]);

  const allFields = useMemo(() => {
    const seenKeys = new Set<string>();
    const fields: ProviderField[] = [];
    for (const group of fieldGroups) {
      for (const field of group.fields) {
        if (!seenKeys.has(field.key)) {
          seenKeys.add(field.key);
          fields.push(field);
        }
      }
    }
    return fields.sort((a, b) => a.label.localeCompare(b.label));
  }, [fieldGroups]);

  // Find the selected field for displaying helper text
  const selectedFieldInfo = useMemo(() => {
    for (const group of fieldGroups) {
      const found = group.fields.find(f => f.key === selectedField);
      if (found) {
        return { field: found, provider: group.providerLabel };
      }
    }
    return null;
  }, [fieldGroups, selectedField]);

  // Check if selected field is invalid (not in available fields)
  const isInvalidField = selectedField && !allFields.some(f => f.key === selectedField);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="block text-xs font-medium text-gray-500">
          Field Name
        </label>
        <button
          type="button"
          onClick={() => setShowGrouped(!showGrouped)}
          className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
        >
          {showGrouped ? 'Show all' : 'Group by provider'}
        </button>
      </div>

      <select
        value={selectedField}
        onChange={(e) => onFieldChange(e.target.value)}
        className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent bg-white ${
          isInvalidField ? 'border-red-300 bg-red-50' : 'border-gray-200'
        }`}
      >
        <option value="">Select a field...</option>
        {showGrouped ? (
          // Grouped by provider
          fieldGroups.map((group) => (
            <optgroup key={group.provider} label={group.providerLabel}>
              {group.fields.map((field) => (
                <option key={`${group.provider}-${field.key}`} value={field.key}>
                  {field.label} ({field.key})
                </option>
              ))}
            </optgroup>
          ))
        ) : (
          // All fields sorted alphabetically
          allFields.map((field) => (
            <option key={field.key} value={field.key}>
              {field.label} ({field.key})
            </option>
          ))
        )}
      </select>

      {/* Helper text showing field description */}
      {selectedFieldInfo && (
        <div className="flex items-start gap-2 text-xs text-gray-500 bg-gray-50 rounded-lg p-2">
          <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-gray-400" />
          <div>
            <span className="font-medium">{selectedFieldInfo.field.label}</span>
            {selectedFieldInfo.field.description && (
              <span className="text-gray-400"> - {selectedFieldInfo.field.description}</span>
            )}
            <div className="text-gray-400 mt-0.5">
              Source: {selectedFieldInfo.provider}
            </div>
          </div>
        </div>
      )}

      {/* Warning for invalid field */}
      {isInvalidField && (
        <div className="flex items-start gap-2 text-xs text-red-600 bg-red-50 rounded-lg p-2">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
          <div>
            Field "{selectedField}" is not available from previous steps. Please select a valid field.
          </div>
        </div>
      )}
    </div>
  );
}
