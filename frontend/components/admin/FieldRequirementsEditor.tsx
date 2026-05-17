'use client';

import { useState, useMemo, useEffect } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Plus, X, Check, AlertCircle, DollarSign, Zap, Save, FolderOpen, Trash2, ChevronDown } from 'lucide-react';
import {
  FieldRequirement,
  getAllOutputFields,
  getProvidersForField,
  buildOptimizedCascade,
  calculateCascadeCost,
  OptimizedCascadeStep,
  PROVIDER_COSTS,
  FieldTemplate,
  getFieldTemplates,
  saveFieldTemplate,
  deleteFieldTemplate,
  DEFAULT_TEMPLATES,
} from '@/lib/providerFields';

interface FieldRequirementsEditorProps {
  requirements: FieldRequirement[];
  onChange: (requirements: FieldRequirement[]) => void;
  onCascadeGenerated: (cascade: OptimizedCascadeStep[]) => void;
}

// Draggable field item
function DraggableField({
  field,
  onRemove,
}: {
  field: FieldRequirement;
  onRemove: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: field.fieldKey });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const providers = getProvidersForField(field.fieldKey);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 px-3 py-2 bg-white border rounded-lg group ${
        isDragging ? 'opacity-50 shadow-lg' : 'border-gray-200'
      }`}
    >
      <button
        {...attributes}
        {...listeners}
        className="flex-shrink-0 text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing"
      >
        <GripVertical size={14} />
      </button>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-gray-900 truncate">
          {field.fieldLabel}
        </div>
        <div className="text-xs text-gray-500">
          {providers.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(', ')}
        </div>
      </div>
      <button
        onClick={onRemove}
        className="flex-shrink-0 p-1 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <X size={14} />
      </button>
    </div>
  );
}

// Field column (Must Have or Nice to Have)
function FieldColumn({
  title,
  priority,
  fields,
  onRemove,
  color,
}: {
  title: string;
  priority: 'must_have' | 'nice_to_have';
  fields: FieldRequirement[];
  onRemove: (fieldKey: string) => void;
  color: string;
}) {
  return (
    <div className="flex-1 min-w-0">
      <div className={`flex items-center gap-2 mb-3 pb-2 border-b ${color}`}>
        {priority === 'must_have' ? (
          <Check size={16} className="text-green-600" />
        ) : (
          <Zap size={16} className="text-blue-500" />
        )}
        <h4 className="font-medium text-gray-900">{title}</h4>
        <span className="ml-auto text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
          {fields.length}
        </span>
      </div>
      <div
        className={`min-h-[200px] p-2 rounded-lg border-2 border-dashed ${
          priority === 'must_have'
            ? 'bg-green-50/50 border-green-200'
            : 'bg-blue-50/50 border-blue-200'
        }`}
      >
        <SortableContext
          items={fields.map(f => f.fieldKey)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2">
            {fields.map(field => (
              <DraggableField
                key={field.fieldKey}
                field={field}
                onRemove={() => onRemove(field.fieldKey)}
              />
            ))}
            {fields.length === 0 && (
              <div className="text-center py-8 text-sm text-gray-400">
                Drag fields here
              </div>
            )}
          </div>
        </SortableContext>
      </div>
    </div>
  );
}

export default function FieldRequirementsEditor({
  requirements,
  onChange,
  onCascadeGenerated,
}: FieldRequirementsEditorProps) {
  const [mode, setMode] = useState<'strict' | 'complete'>('strict');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showFieldPicker, setShowFieldPicker] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [templates, setTemplates] = useState<FieldTemplate[]>([]);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateDesc, setNewTemplateDesc] = useState('');

  // Load templates on mount
  useEffect(() => {
    setTemplates(getFieldTemplates());
  }, []);

  const loadTemplate = (template: FieldTemplate) => {
    onChange(template.requirements);
    setShowTemplates(false);
  };

  const handleSaveTemplate = () => {
    if (!newTemplateName.trim() || requirements.length === 0) return;

    const saved = saveFieldTemplate({
      name: newTemplateName.trim(),
      description: newTemplateDesc.trim(),
      requirements,
    });

    setTemplates(getFieldTemplates());
    setNewTemplateName('');
    setNewTemplateDesc('');
    setShowSaveTemplate(false);
  };

  const handleDeleteTemplate = (templateId: string) => {
    if (deleteFieldTemplate(templateId)) {
      setTemplates(getFieldTemplates());
    }
  };

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const allFields = useMemo(() => getAllOutputFields(), []);
  const availableFields = useMemo(() => {
    const usedKeys = new Set(requirements.map(r => r.fieldKey));
    return allFields.filter(f => !usedKeys.has(f.key));
  }, [allFields, requirements]);

  const mustHaves = requirements.filter(r => r.priority === 'must_have');
  const niceToHaves = requirements.filter(r => r.priority === 'nice_to_have');

  // Generate optimized cascade
  const optimizedCascade = useMemo(() => {
    return buildOptimizedCascade(requirements, mode);
  }, [requirements, mode]);

  const costEstimate = useMemo(() => {
    return calculateCascadeCost(optimizedCascade);
  }, [optimizedCascade]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const activeField = requirements.find(r => r.fieldKey === active.id);
    if (!activeField) return;

    // Determine target column based on where it was dropped
    const overField = requirements.find(r => r.fieldKey === over.id);
    if (overField && overField.priority !== activeField.priority) {
      // Move to different column
      const newRequirements = requirements.map(r =>
        r.fieldKey === active.id ? { ...r, priority: overField.priority } : r
      );
      onChange(newRequirements);
    }
  };

  const addField = (fieldKey: string, priority: 'must_have' | 'nice_to_have') => {
    const field = allFields.find(f => f.key === fieldKey);
    if (!field) return;

    onChange([
      ...requirements,
      { fieldKey: field.key, fieldLabel: field.label, priority },
    ]);
    setShowFieldPicker(false);
  };

  const removeField = (fieldKey: string) => {
    onChange(requirements.filter(r => r.fieldKey !== fieldKey));
  };

  const moveField = (fieldKey: string, newPriority: 'must_have' | 'nice_to_have') => {
    onChange(
      requirements.map(r =>
        r.fieldKey === fieldKey ? { ...r, priority: newPriority } : r
      )
    );
  };

  const activeField = activeId
    ? requirements.find(r => r.fieldKey === activeId)
    : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-gray-900">Field Requirements</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Define what fields you need - cascade auto-optimizes for cost
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Template dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowTemplates(!showTemplates)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-300 rounded-full hover:bg-gray-50 transition-colors"
            >
              <FolderOpen size={14} />
              Templates
              <ChevronDown size={12} />
            </button>
            {showTemplates && (
              <div className="absolute right-0 mt-1 w-72 bg-white rounded-xl shadow-lg border border-gray-200 z-50 overflow-hidden">
                <div className="p-2 border-b border-gray-100">
                  <div className="text-xs font-medium text-gray-500 px-2">Load a Template</div>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {templates.map(template => {
                    const isBuiltIn = DEFAULT_TEMPLATES.some(t => t.id === template.id);
                    return (
                      <div
                        key={template.id}
                        className="flex items-center justify-between px-3 py-2 hover:bg-gray-50 group"
                      >
                        <button
                          onClick={() => loadTemplate(template)}
                          className="flex-1 text-left"
                        >
                          <div className="text-sm font-medium text-gray-900">{template.name}</div>
                          <div className="text-xs text-gray-500">{template.description}</div>
                          <div className="text-xs text-gray-400 mt-0.5">
                            {template.requirements.length} fields
                            {isBuiltIn && <span className="ml-2 text-blue-500">Built-in</span>}
                          </div>
                        </button>
                        {!isBuiltIn && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteTemplate(template.id);
                            }}
                            className="p-1 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="p-2 border-t border-gray-100 bg-gray-50">
                  <button
                    onClick={() => {
                      setShowTemplates(false);
                      setShowSaveTemplate(true);
                    }}
                    disabled={requirements.length === 0}
                    className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <Save size={12} />
                    Save Current as Template
                  </button>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={() => setShowFieldPicker(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-black text-white rounded-full hover:bg-gray-800 transition-colors"
          >
            <Plus size={14} />
            Add Field
          </button>
        </div>
      </div>

      {/* Save Template Modal */}
      {showSaveTemplate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full mx-4 overflow-hidden">
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <h3 className="font-medium">Save as Template</h3>
              <button onClick={() => setShowSaveTemplate(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Template Name</label>
                <input
                  type="text"
                  value={newTemplateName}
                  onChange={(e) => setNewTemplateName(e.target.value)}
                  placeholder="e.g., Enterprise Prospecting"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <input
                  type="text"
                  value={newTemplateDesc}
                  onChange={(e) => setNewTemplateDesc(e.target.value)}
                  placeholder="Brief description..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black"
                />
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-xs font-medium text-gray-500 mb-2">Fields to save:</div>
                <div className="flex flex-wrap gap-1">
                  {requirements.map(r => (
                    <span
                      key={r.fieldKey}
                      className={`px-2 py-0.5 text-xs rounded ${
                        r.priority === 'must_have'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}
                    >
                      {r.fieldLabel}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <div className="px-4 py-3 border-t bg-gray-50 flex justify-end gap-2">
              <button
                onClick={() => setShowSaveTemplate(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveTemplate}
                disabled={!newTemplateName.trim()}
                className="px-4 py-2 text-sm font-medium bg-black text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Save Template
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Field Picker Modal */}
      {showFieldPicker && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[80vh] overflow-hidden">
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <h3 className="font-medium">Add Field</h3>
              <button onClick={() => setShowFieldPicker(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <div className="p-4 overflow-auto max-h-[60vh]">
              <div className="space-y-1">
                {availableFields.map(field => {
                  const providers = getProvidersForField(field.key);
                  return (
                    <div
                      key={field.key}
                      className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg border border-transparent hover:border-gray-200"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900">{field.label}</div>
                        <div className="text-xs text-gray-500">
                          {providers.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(', ')}
                        </div>
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        <button
                          onClick={() => addField(field.key, 'must_have')}
                          className="px-2.5 py-1.5 text-xs font-medium bg-green-100 text-green-700 rounded-full hover:bg-green-200 transition-colors"
                        >
                          + Must Have
                        </button>
                        <button
                          onClick={() => addField(field.key, 'nice_to_have')}
                          className="px-2.5 py-1.5 text-xs font-medium bg-blue-100 text-blue-700 rounded-full hover:bg-blue-200 transition-colors"
                        >
                          + Nice to Have
                        </button>
                      </div>
                    </div>
                  );
                })}
                {availableFields.length === 0 && (
                  <div className="text-center py-8 text-sm text-gray-500">
                    All fields have been added
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Two-column layout */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-2 gap-4">
          <FieldColumn
            title="Must Have"
            priority="must_have"
            fields={mustHaves}
            onRemove={removeField}
            color="border-green-200"
          />
          <FieldColumn
            title="Nice to Have"
            priority="nice_to_have"
            fields={niceToHaves}
            onRemove={removeField}
            color="border-blue-200"
          />
        </div>

        <DragOverlay>
          {activeField ? (
            <div className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded-lg shadow-lg">
              <GripVertical size={14} className="text-gray-400" />
              <span className="text-sm font-medium">{activeField.fieldLabel}</span>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Mode Toggle */}
      <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
        <span className="text-sm font-medium text-gray-700">Cascade Mode:</span>
        <div className="flex gap-2">
          <button
            onClick={() => setMode('strict')}
            className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
              mode === 'strict'
                ? 'bg-black text-white'
                : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            Strict (Must Haves Only)
          </button>
          <button
            onClick={() => setMode('complete')}
            className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
              mode === 'complete'
                ? 'bg-black text-white'
                : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            Complete (All Fields)
          </button>
        </div>
      </div>

      {/* Optimized Cascade Preview */}
      {requirements.length > 0 && (
        <div className="border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap size={16} className="text-amber-500" />
              <h4 className="font-medium text-gray-900">Auto-Generated Cascade</h4>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="text-gray-500">Est. cost:</span>
              <span className="font-medium text-green-600">
                ${costEstimate.minCost.toFixed(3)} - ${costEstimate.maxCost.toFixed(3)}
              </span>
              <span className="text-gray-400">per record</span>
            </div>
          </div>
          <div className="p-4">
            {optimizedCascade.length > 0 ? (
              <div className="space-y-3">
                {optimizedCascade.map((step, index) => (
                  <div
                    key={step.providerId}
                    className="flex items-start gap-3 p-3 bg-white border border-gray-100 rounded-lg"
                  >
                    <div className="flex-shrink-0 w-6 h-6 bg-black text-white rounded-full flex items-center justify-center text-xs font-medium">
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">{step.providerName}</span>
                        <span className="text-xs text-gray-500">
                          ${step.costPerRecord.toFixed(3)}/record
                        </span>
                        {step.trigger === 'on_missing_field' && (
                          <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full">
                            if missing: {step.triggerField}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {step.mustHavesCovered.map(field => (
                          <span
                            key={field}
                            className="px-1.5 py-0.5 bg-green-100 text-green-700 text-xs rounded"
                          >
                            {field}
                          </span>
                        ))}
                        {step.niceToHavesCovered.map(field => (
                          <span
                            key={field}
                            className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-xs rounded"
                          >
                            {field}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="text-xs text-gray-400">
                      +${step.costPerRecord.toFixed(3)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-sm text-gray-500">
                <AlertCircle size={24} className="mx-auto mb-2 text-gray-400" />
                No providers can fulfill the requested fields
              </div>
            )}
          </div>
          {optimizedCascade.length > 0 && (
            <div className="px-4 py-3 bg-gray-50 border-t flex justify-end">
              <button
                onClick={() => onCascadeGenerated(optimizedCascade)}
                className="px-4 py-2 bg-black text-white text-sm font-medium rounded-full hover:bg-gray-800 transition-colors"
              >
                Apply This Cascade
              </button>
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {requirements.length === 0 && (
        <div className="text-center py-8 border-2 border-dashed border-gray-200 rounded-xl">
          <DollarSign size={32} className="mx-auto mb-2 text-gray-300" />
          <p className="text-sm text-gray-500">
            Add fields to auto-generate a cost-optimized cascade
          </p>
          <button
            onClick={() => setShowFieldPicker(true)}
            className="mt-3 px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-full hover:bg-gray-50"
          >
            Add Your First Field
          </button>
        </div>
      )}
    </div>
  );
}
