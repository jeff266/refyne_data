'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  Check,
  Loader2,
  X,
  Plus,
  GripVertical,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { C, F } from '@/lib/design-tokens';
import { Card, GhostBtn, PrimaryBtn } from '@/components/refyne';
import type { ClusterWithRecords } from '@/lib/dedup/cluster-types';
import type { HubSpotCompany } from '@/lib/dedup/select-master';
import { autoSelectFields } from '@/lib/dedup/select-master';
import { MergeHistory } from '@/components/dedup/MergeHistory';
import { useRole } from '@/hooks/useRole';
import { AdminOnlyNotice } from '@/components/auth/AdminOnlyNotice';
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

const COMPANY_FIELD_LABELS: Record<string, string> = {
  name: 'Company Name',
  domain: 'Domain',
  phone: 'Phone',
  industry: 'Industry',
  city: 'City',
  state: 'State',
  country: 'Country',
  address: 'Address',
  linkedin_company_page: 'LinkedIn',
  lifecyclestage: 'Lifecycle Stage',
  type: 'Company Type',
};

const CONTACT_FIELD_LABELS: Record<string, string> = {
  firstname: 'First Name',
  lastname: 'Last Name',
  email: 'Email',
  phone: 'Phone',
  mobilephone: 'Mobile Phone',
  company: 'Company',
  jobtitle: 'Job Title',
  city: 'City',
  state: 'State',
  country: 'Country',
  lifecyclestage: 'Lifecycle Stage',
};

const DEFAULT_COMPANY_FIELDS = [
  'name',
  'domain',
  'phone',
  'industry',
  'city',
  'state',
  'country',
  'address',
  'linkedin_company_page',
  'lifecyclestage',
  'type',
];

const DEFAULT_CONTACT_FIELDS = [
  'firstname',
  'lastname',
  'email',
  'phone',
  'mobilephone',
  'company',
  'jobtitle',
  'city',
  'state',
  'country',
  'lifecyclestage',
];

// Animation state machine
type MergeAnimationState =
  | 'idle' // default, no merge in progress
  | 'merging' // API call in flight, buttons disabled
  | 'collapsing' // non-master columns exiting
  | 'absorbing' // master column pulsing
  | 'highlighting' // rescued fields glowing
  | 'complete'; // toast visible, about to navigate

interface HubSpotProperty {
  name: string;
  label: string;
  type: string;
  hubspotDefined: boolean;
}

// Calculate which fields will be rescued (master empty, non-master has value)
function calculateRescuedFields(
  masterRecord: HubSpotCompany,
  nonMasterRecords: HubSpotCompany[],
  objectType: 'company' | 'contact' | 'deal'
): { count: number; fieldKeys: string[] } {
  const rescued: string[] = [];

  const fieldsToCheck =
    objectType === 'contact'
      ? ['phone', 'mobilephone', 'email', 'company', 'jobtitle', 'city', 'state', 'country']
      : [
          'phone',
          'linkedin_company_page',
          'website',
          'industry',
          'city',
          'state',
          'country',
          'address',
          'type',
        ];

  fieldsToCheck.forEach((field) => {
    const masterVal = masterRecord.properties[field];
    const masterEmpty = masterVal === null || masterVal === '' || masterVal === undefined;

    if (masterEmpty) {
      const anyNonMasterHasValue = nonMasterRecords.some((rec) => {
        const val = rec.properties[field];
        return val !== null && val !== '' && val !== undefined;
      });
      if (anyNonMasterHasValue) rescued.push(field);
    }
  });

  return { count: rescued.length, fieldKeys: rescued };
}

// Map rule types to human-readable text
function getRuleDisplayText(
  fieldKey: string,
  survivorshipReasons: Record<string, { rule: string; source?: string; value?: any; method?: string }> | undefined
): string {
  if (!survivorshipReasons || !survivorshipReasons[fieldKey]) {
    return '';
  }

  const { rule, source, value, method } = survivorshipReasons[fieldKey];

  switch (rule) {
    case 'most_recent':
      return 'Most recent';
    case 'source_preference':
      if (source) {
        // Capitalize and format source name
        const formattedSource = source
          .split('_')
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');
        return `Source: ${formattedSource}`;
      }
      return 'Source preference';
    case 'never_downgrade':
      return 'Never downgrade';
    case 'prefer_nonempty':
      return 'Filled empty';
    case 'specific_value':
      if (value) {
        return `Priority: ${value}`;
      }
      return 'Priority value';
    case 'rollup':
      if (method) {
        const methodLabels: Record<string, string> = {
          max: 'Highest value',
          min: 'Lowest value',
          sum: 'Summed',
          average: 'Averaged',
        };
        return methodLabels[method] ?? 'Rollup';
      }
      return 'Rollup';
    case 'manual':
      return 'Manual';
    case 'default_master':
      return ''; // Don't show anything for default master selection
    default:
      return '';
  }
}

// Sortable field row component for drag-to-reorder
function SortableFieldRow({
  field,
  fieldLabel,
  visibleRecords,
  masterId,
  propertyLabels,
  fieldSelections,
  mergeState,
  rescuedFieldKeys,
  survivorshipReasons,
  onFieldSelectionChange,
  onRemoveField,
}: {
  field: string;
  fieldLabel: string;
  visibleRecords: HubSpotCompany[];
  masterId: string | null;
  propertyLabels: Record<string, string>;
  fieldSelections: Record<string, string>;
  mergeState: MergeAnimationState;
  rescuedFieldKeys: string[];
  survivorshipReasons?: Record<string, { rule: string; source?: string }>;
  onFieldSelectionChange: (field: string, recordId: string) => void;
  onRemoveField: (field: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: field,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const isRescuedField =
    (mergeState === 'highlighting' || mergeState === 'complete') && rescuedFieldKeys.includes(field);

  const isDefaultField =
    DEFAULT_COMPANY_FIELDS.includes(field) || DEFAULT_CONTACT_FIELDS.includes(field);

  return (
    <tr
      ref={setNodeRef}
      className={isRescuedField ? 'field-rescued' : ''}
      style={{ borderBottom: `0.5px solid ${C.border}`, ...style }}
    >
      <td
        style={{
          padding: '12px 16px',
          fontWeight: 500,
          color: C.text2,
          position: 'sticky',
          left: 0,
          background: C.surface,
          zIndex: 1,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            {...attributes}
            {...listeners}
            style={{
              cursor: mergeState === 'idle' ? 'grab' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              color: C.text3,
              opacity: mergeState === 'idle' ? 0.5 : 0.2,
            }}
          >
            <GripVertical size={14} />
          </div>
          <span>{fieldLabel}</span>
          {!isDefaultField && mergeState === 'idle' && (
            <button
              onClick={() => onRemoveField(field)}
              title="Remove field"
              style={{
                padding: 2,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: C.text3,
                opacity: 0.5,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = '1';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = '0.5';
              }}
            >
              <X size={10} />
            </button>
          )}
        </div>
      </td>
      {visibleRecords.map((record) => {
        const value = record.properties[field];
        const isSelected = fieldSelections[field] === record.id;
        const isMaster = record.id === masterId;
        const isNonMaster = !isMaster;
        const shouldAnimateExit =
          mergeState === 'collapsing' ||
          mergeState === 'absorbing' ||
          mergeState === 'highlighting' ||
          mergeState === 'complete';

        // Get human-readable label for enum values
        const displayValue = value ? propertyLabels[`${field}:${value}`] || value : '(empty)';

        return (
          <td
            key={record.id}
            className={isNonMaster && shouldAnimateExit ? 'merge-exit' : ''}
            style={{
              padding: '12px 16px',
              background: isMaster ? C.indigoDim : 'transparent',
            }}
          >
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                cursor: mergeState === 'idle' ? 'pointer' : 'not-allowed',
              }}
            >
              <input
                type="radio"
                name={`field_${field}`}
                checked={isSelected}
                disabled={mergeState !== 'idle'}
                onChange={() => onFieldSelectionChange(field, record.id)}
                style={{ cursor: mergeState === 'idle' ? 'pointer' : 'not-allowed' }}
              />
              <span
                className={isMaster && isRescuedField ? 'master-value' : ''}
                style={{
                  color: value ? C.text : C.text3,
                  fontStyle: value ? 'normal' : 'italic',
                }}
              >
                {displayValue}
              </span>
            </label>
          </td>
        );
      })}
      {/* Why column */}
      <td
        style={{
          padding: '12px 16px',
          fontSize: 11,
          color: C.text3,
          fontStyle: 'italic',
        }}
      >
        {getRuleDisplayText(field, survivorshipReasons)}
      </td>
    </tr>
  );
}

// Field picker component with search and grouping
function FieldPicker({
  availableProperties,
  onAddField,
  disabled,
}: {
  availableProperties: HubSpotProperty[];
  onAddField: (fieldName: string) => void;
  disabled: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filtered = availableProperties.filter(
    (f) =>
      f.label.toLowerCase().includes(search.toLowerCase()) ||
      f.name.toLowerCase().includes(search.toLowerCase())
  );

  const standardFields = filtered.filter((f) => f.hubspotDefined);
  const customFields = filtered.filter((f) => !f.hubspotDefined);

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        style={{
          padding: '6px 12px',
          fontSize: 12,
          color: disabled ? C.text3 : C.indigo,
          background: 'transparent',
          border: `0.5px dashed ${disabled ? C.border : C.indigo}`,
          borderRadius: 0,
          cursor: disabled ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          opacity: disabled ? 0.5 : 1,
        }}
      >
        <Plus size={12} />
        Add field
      </button>

      {isOpen && (
        <>
          {/* Backdrop to close on outside click */}
          <div
            onClick={() => setIsOpen(false)}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 99,
            }}
          />

          <div
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              marginTop: 4,
              background: C.surface,
              border: `0.5px solid ${C.border}`,
              borderRadius: 0,
              width: 320,
              maxHeight: 400,
              overflow: 'auto',
              zIndex: 100,
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            }}
          >
            {/* Search input */}
            <input
              type="text"
              placeholder="Search fields..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
              style={{
                width: '100%',
                padding: '8px 12px',
                fontSize: 12,
                background: C.bg,
                border: 'none',
                borderBottom: `0.5px solid ${C.border}`,
                outline: 'none',
                color: C.text,
              }}
            />

            {/* Field list */}
            <div style={{ padding: '4px 0' }}>
              {filtered.length === 0 ? (
                <div
                  style={{ padding: '12px', fontSize: 12, color: C.text3, textAlign: 'center' }}
                >
                  No fields found
                </div>
              ) : (
                <>
                  {/* Standard fields section */}
                  {standardFields.length > 0 && (
                    <>
                      <div
                        style={{
                          padding: '8px 12px',
                          fontSize: 10,
                          color: C.text3,
                          fontWeight: 600,
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                          borderBottom: `0.5px solid ${C.border}`,
                        }}
                      >
                        ─── Standard fields ───────────────────
                      </div>
                      {standardFields.map((field) => (
                        <button
                          key={field.name}
                          onClick={() => {
                            onAddField(field.name);
                            setIsOpen(false);
                            setSearch('');
                          }}
                          style={{
                            width: '100%',
                            padding: '8px 12px',
                            fontSize: 12,
                            color: C.text,
                            background: 'transparent',
                            border: 'none',
                            textAlign: 'left',
                            cursor: 'pointer',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = C.hover;
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'transparent';
                          }}
                        >
                          <span>{field.label}</span>
                          <span style={{ fontSize: 10, color: C.text3, fontFamily: F.mono }}>
                            {field.type}
                          </span>
                        </button>
                      ))}
                    </>
                  )}

                  {/* Custom fields section */}
                  {customFields.length > 0 && (
                    <>
                      <div
                        style={{
                          padding: '8px 12px',
                          fontSize: 10,
                          color: C.text3,
                          fontWeight: 600,
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                          borderBottom: `0.5px solid ${C.border}`,
                          marginTop: standardFields.length > 0 ? 8 : 0,
                        }}
                      >
                        ─── Custom fields ─────────────────────
                      </div>
                      {customFields.map((field) => (
                        <button
                          key={field.name}
                          onClick={() => {
                            onAddField(field.name);
                            setIsOpen(false);
                            setSearch('');
                          }}
                          style={{
                            width: '100%',
                            padding: '8px 12px',
                            fontSize: 12,
                            color: C.text,
                            background: 'transparent',
                            border: 'none',
                            textAlign: 'left',
                            cursor: 'pointer',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = C.hover;
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'transparent';
                          }}
                        >
                          <span>{field.label}</span>
                          <span style={{ fontSize: 10, color: C.text3, fontFamily: F.mono }}>
                            {field.type}
                          </span>
                        </button>
                      ))}
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function ClusterReviewPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAdmin } = useRole();
  const [data, setData] = useState<ClusterWithRecords | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [propertyLabels, setPropertyLabels] = useState<Record<string, string>>({});

  // Cluster navigation state
  const [clusterIds, setClusterIds] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(-1);
  const [totalClusters, setTotalClusters] = useState<number>(0);
  const [navObjectType, setNavObjectType] = useState<'company' | 'contact' | 'deal'>('company');

  // Selection state
  const [masterId, setMasterId] = useState<string | null>(null);
  const [fieldSelections, setFieldSelections] = useState<Record<string, string>>({});

  // Field configuration state
  const [fieldsToDisplay, setFieldsToDisplay] = useState<string[]>([]);
  const [availableProperties, setAvailableProperties] = useState<HubSpotProperty[]>([]);
  const [loadingFields, setLoadingFields] = useState(true);

  // Action state
  const [rejecting, setRejecting] = useState(false);
  const [skipping, setSkipping] = useState(false);
  const [excludingRecordId, setExcludingRecordId] = useState<string | null>(null);
  const [excludedRecords, setExcludedRecords] = useState<Set<string>>(new Set());
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Animation state
  const [mergeState, setMergeState] = useState<MergeAnimationState>('idle');
  const [rescuedFieldKeys, setRescuedFieldKeys] = useState<string[]>([]);
  const [mergeToastData, setMergeToastData] = useState<{
    masterName: string;
    recordsConsolidated: number;
    fieldsRescued: number;
  } | null>(null);

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Load cluster navigation list from sessionStorage or fetch from API
  useEffect(() => {
    const loadClusterList = async () => {
      try {
        // First, try to get from sessionStorage
        const stored = sessionStorage.getItem('dedupClusterIds');
        const storedObjectType = sessionStorage.getItem('dedupObjectType');

        if (stored && storedObjectType) {
          const ids = JSON.parse(stored);
          setClusterIds(ids);
          setTotalClusters(ids.length);
          setNavObjectType(storedObjectType as 'company' | 'contact' | 'deal');

          const index = ids.indexOf(params.id);
          setCurrentIndex(index);
          return;
        }

        // If not in sessionStorage, fetch from API
        const urlObjectType = searchParams?.get('objectType') || 'company';
        setNavObjectType(urlObjectType as 'company' | 'contact' | 'deal');

        const res = await fetch(`/api/dedup/clusters?status=pending&objectType=${urlObjectType}`);
        if (res.ok) {
          const data = await res.json();
          const ids = data.clusters.map((c: any) => c.id);
          setClusterIds(ids);
          setTotalClusters(data.total || ids.length);

          const index = ids.indexOf(params.id);
          setCurrentIndex(index);

          // Store in sessionStorage for future navigation
          sessionStorage.setItem('dedupClusterIds', JSON.stringify(ids));
          sessionStorage.setItem('dedupObjectType', urlObjectType);
        }
      } catch (err) {
        console.error('Failed to load cluster list:', err);
      }
    };

    loadClusterList();
  }, [params.id, searchParams]);

  // Load dedup display fields from API
  useEffect(() => {
    async function loadDedupFields() {
      try {
        const res = await fetch('/api/org/dedup-fields');

        if (res.ok) {
          const data = await res.json();
          setFieldsToDisplay(data.fields || []);
        }
      } catch (err) {
        console.error('Failed to load dedup fields:', err);
        setFieldsToDisplay([]);
      } finally {
        setLoadingFields(false);
      }
    }

    loadDedupFields();
  }, []);

  // Save fields to API when changed
  const saveFieldsToAPI = async (fields: string[]) => {
    try {
      await fetch('/api/org/dedup-fields', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ fields }),
      });
    } catch (err) {
      console.error('Failed to save dedup fields:', err);
    }
  };

  // Handle field reordering
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setFieldsToDisplay((items) => {
        const oldIndex = items.indexOf(active.id as string);
        const newIndex = items.indexOf(over.id as string);
        const newOrder = arrayMove(items, oldIndex, newIndex);
        saveFieldsToAPI(newOrder);
        return newOrder;
      });
    }
  };

  // Navigation handlers
  const handlePrevious = () => {
    if (currentIndex > 0 && clusterIds.length > 0) {
      const prevId = clusterIds[currentIndex - 1];
      router.push(`/dedup/clusters/${prevId}?objectType=${navObjectType}`);
    }
  };

  const handleNext = () => {
    if (currentIndex < clusterIds.length - 1 && clusterIds.length > 0) {
      const nextId = clusterIds[currentIndex + 1];
      router.push(`/dedup/clusters/${nextId}?objectType=${navObjectType}`);
    }
  };

  const navigateAfterAction = () => {
    // Remove current cluster from the list since it's now resolved
    const updatedClusterIds = clusterIds.filter(id => id !== params.id);

    // Update sessionStorage with the new list
    if (updatedClusterIds.length > 0) {
      sessionStorage.setItem('dedupClusterIds', JSON.stringify(updatedClusterIds));
      setClusterIds(updatedClusterIds);
      setTotalClusters(updatedClusterIds.length);
    } else {
      // Clear sessionStorage if no clusters left
      sessionStorage.removeItem('dedupClusterIds');
      sessionStorage.removeItem('dedupObjectType');
    }

    // Navigate to the next cluster (which is now at the same index)
    if (currentIndex < updatedClusterIds.length && updatedClusterIds.length > 0) {
      const nextId = updatedClusterIds[currentIndex];
      router.push(`/dedup/clusters/${nextId}?objectType=${navObjectType}`);
    } else {
      // If no more clusters, return to queue
      const url = navObjectType === 'contact' ? '/dedup?object=contact' : '/dedup';
      router.push(url);
    }
  };

  // Handle adding a field
  const handleAddField = (fieldName: string) => {
    const newFields = [...fieldsToDisplay, fieldName];
    setFieldsToDisplay(newFields);
    saveFieldsToAPI(newFields);
  };

  // Handle removing a field
  const handleRemoveField = (fieldName: string) => {
    const newFields = fieldsToDisplay.filter((f) => f !== fieldName);
    setFieldsToDisplay(newFields);
    saveFieldsToAPI(newFields);
  };

  // Fetch cluster data
  useEffect(() => {
    const fetchCluster = async () => {
      try {
        const res = await fetch(`/api/dedup/clusters/${params.id}`);

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Failed to fetch cluster');
        }

        const clusterData = await res.json();
        setData(clusterData);

        // Determine object type and use appropriate defaults
        const objectType = clusterData.cluster.objectType || 'company';
        const defaultFields =
          objectType === 'contact' ? DEFAULT_CONTACT_FIELDS : DEFAULT_COMPANY_FIELDS;

        // If no fields configured, use defaults
        if (fieldsToDisplay.length === 0) {
          setFieldsToDisplay(defaultFields);
        }

        // Auto-select master and fields
        setMasterId(clusterData.suggestedMasterId);

        const master = clusterData.records.find(
          (r: HubSpotCompany) => r.id === clusterData.suggestedMasterId
        );
        const others = clusterData.records.filter(
          (r: HubSpotCompany) => r.id !== clusterData.suggestedMasterId
        );

        if (master) {
          const fieldsForSelection = fieldsToDisplay.length > 0 ? fieldsToDisplay : defaultFields;
          const autoSelections = autoSelectFields(fieldsForSelection, master, others);
          setFieldSelections(autoSelections);
        }

        // Fetch HubSpot property definitions based on object type
        try {
          const hubspotObjectType = objectType === 'contact' ? 'contacts' : 'companies';
          const propsRes = await fetch(`/api/hubspot/properties/${hubspotObjectType}`);
          if (propsRes.ok) {
            const propsData = await propsRes.json();
            const labelMap: Record<string, string> = {};

            // Store all properties for field picker
            const allProps: HubSpotProperty[] = propsData.properties.map((prop: any) => ({
              name: prop.name,
              label: prop.label || prop.name,
              type: prop.type,
              hubspotDefined: prop.hubspotDefined || false,
            }));

            setAvailableProperties(allProps);

            // Extract enum labels
            propsData.properties.forEach((prop: any) => {
              if (prop.options && Array.isArray(prop.options)) {
                prop.options.forEach((opt: any) => {
                  labelMap[`${prop.name}:${opt.value}`] = opt.label;
                });
              }
            });

            setPropertyLabels(labelMap);
          }
        } catch (err) {
          console.error('Failed to fetch property definitions:', err);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch cluster');
      } finally {
        setLoading(false);
      }
    };

    fetchCluster();
  }, [params.id, fieldsToDisplay]);

  // Handle merge with animation
  const handleMerge = async () => {
    if (!masterId || !data) return;

    const masterRecord = data.records.find((r) => r.id === masterId);
    const nonMasterRecords = data.records.filter(
      (r) => r.id !== masterId && !excludedRecords.has(r.id)
    );

    if (!masterRecord) return;

    // Calculate rescued fields before merge
    const { count: rescuedCount, fieldKeys } = calculateRescuedFields(
      masterRecord,
      nonMasterRecords,
      data.cluster.objectType || 'company'
    );
    setRescuedFieldKeys(fieldKeys);

    // Check for reduced motion preference
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    setMergeState('merging');

    try {
      const res = await fetch(`/api/dedup/clusters/${params.id}/merge`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          masterId,
          fieldSelections,
          absorb: false,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to merge cluster');
      }

      // Prepare toast data
      const recordsConsolidated = data.cluster.recordIds.length - excludedRecords.size;

      // Get display name based on object type
      const objectType = data.cluster.objectType || 'company';
      const getRecordDisplayName = (record: HubSpotCompany) => {
        if (objectType === 'contact') {
          const firstname = record.properties.firstname || '';
          const lastname = record.properties.lastname || '';
          const fullName = `${firstname} ${lastname}`.trim();
          return fullName || record.properties.email || `Contact ${record.id}`;
        }
        return record.properties.name || `Company ${record.id}`;
      };

      setMergeToastData({
        masterName: getRecordDisplayName(masterRecord),
        recordsConsolidated,
        fieldsRescued: rescuedCount,
      });

      if (prefersReducedMotion) {
        setMergeState('complete');
        setTimeout(() => {
          router.push(
            `/dedup?merged=true&rescued=${rescuedCount}&name=${encodeURIComponent(
              getRecordDisplayName(masterRecord)
            )}`
          );
        }, 800);
        return;
      }

      // Start animation sequence
      setMergeState('collapsing');

      setTimeout(() => setMergeState('absorbing'), 300);
      setTimeout(() => setMergeState('highlighting'), 500);
      setTimeout(() => {
        setMergeState('complete');
      }, 600);

      setTimeout(() => {
        // Show merge banner on queue page or navigate to next cluster
        if (currentIndex < clusterIds.length - 1 && clusterIds.length > 0) {
          navigateAfterAction();
        } else {
          router.push(
            `/dedup?merged=true&rescued=${rescuedCount}&name=${encodeURIComponent(
              getRecordDisplayName(masterRecord)
            )}`
          );
        }
      }, 1400);
    } catch (err) {
      setMergeState('idle');
      setError(err instanceof Error ? err.message : 'Failed to merge cluster');
      setToastMessage('Merge failed. Please try again.');
      setTimeout(() => setToastMessage(null), 5000);
    }
  };

  // Handle reject
  const handleReject = async () => {
    setRejecting(true);
    try {
      const res = await fetch(`/api/dedup/clusters/${params.id}/reject`, {
        method: 'POST',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to reject cluster');
      }

      navigateAfterAction();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reject cluster');
    } finally {
      setRejecting(false);
    }
  };

  // Handle skip
  const handleSkip = async () => {
    setSkipping(true);
    try {
      const res = await fetch(`/api/dedup/clusters/${params.id}/skip`, {
        method: 'POST',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to skip cluster');
      }

      router.push('/dedup');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to skip cluster');
    } finally {
      setSkipping(false);
    }
  };

  // Handle exclude record
  const handleExcludeRecord = async (recordId: string, recordName: string) => {
    setExcludingRecordId(recordId);
    try {
      const res = await fetch(`/api/dedup/clusters/${params.id}/exclude-record`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ recordId }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to exclude record');
      }

      const result = await res.json();

      setExcludedRecords((prev) => {
        const next = new Set(prev);
        next.add(recordId);
        return next;
      });

      setToastMessage(`${recordName} excluded from this merge`);
      setTimeout(() => setToastMessage(null), 5000);

      if (result.clusterRejected) {
        setTimeout(() => {
          router.push('/dedup');
        }, 2000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to exclude record');
    } finally {
      setExcludingRecordId(null);
    }
  };

  if (loading || loadingFields) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 400,
        }}
      >
        <Loader2 size={32} color={C.indigo} className="animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ padding: 40 }}>
        <div style={{ fontSize: 14, color: C.red, marginBottom: 16 }}>
          {error || 'Cluster not found'}
        </div>
        <GhostBtn onClick={() => router.push('/dedup')}>Back to queue</GhostBtn>
      </div>
    );
  }

  const { cluster, records } = data;
  const visibleRecords = records.filter((r) => !excludedRecords.has(r.id));
  const objectType = cluster.objectType || 'company';
  const FIELD_LABELS = objectType === 'contact' ? CONTACT_FIELD_LABELS : COMPANY_FIELD_LABELS;
  const recordTypeLabel = objectType === 'contact' ? 'contact' : 'company';
  const recordTypeLabelPlural = objectType === 'contact' ? 'contacts' : 'companies';

  // Available fields for picker (not already displayed)
  const availableFieldsForPicker = availableProperties.filter(
    (p) => !fieldsToDisplay.includes(p.name)
  );

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', padding: 24 }}>
      <style>{`
        @keyframes mergeExit {
          0%   { transform: translateX(0) scale(1); opacity: 1; }
          70%  { transform: translateX(32px) scale(0.95); opacity: 0.2; }
          100% { transform: translateX(48px) scale(0.88); opacity: 0; }
        }

        @keyframes mergeAbsorb {
          0%   { box-shadow: 0 0 0 0 rgba(46, 204, 138, 0); border-color: rgba(255, 255, 255, 0.08); }
          40%  { box-shadow: 0 0 0 6px rgba(46, 204, 138, 0.18); border-color: rgba(46, 204, 138, 0.6); }
          100% { box-shadow: 0 0 0 0 rgba(46, 204, 138, 0); border-color: rgba(255, 255, 255, 0.08); }
        }

        @keyframes fieldRescued {
          0%   { background: transparent; }
          20%  { background: rgba(46, 204, 138, 0.10); }
          60%  { background: rgba(46, 204, 138, 0.08); }
          100% { background: transparent; }
        }

        @keyframes rescuedValue {
          0%   { color: ${C.text}; }
          20%  { color: #2ecc8a; font-weight: 600; }
          100% { color: ${C.text}; }
        }

        @keyframes toastSlideUp {
          from { transform: translateY(48px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }

        .merge-exit { animation: mergeExit 400ms ease-in forwards; }
        .merge-absorb { animation: mergeAbsorb 400ms ease-out forwards; }
        .field-rescued { animation: fieldRescued 1200ms ease-out forwards; }
        .field-rescued .master-value { animation: rescuedValue 1200ms ease-out forwards; }
        .toast-slide-up { animation: toastSlideUp 200ms ease-out forwards; }
      `}</style>

      {/* Header */}
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <GhostBtn onClick={() => {
          const url = navObjectType === 'contact' ? '/dedup?object=contact' : '/dedup';
          router.push(url);
        }}>
          <ArrowLeft size={14} style={{ marginRight: 4 }} />
          Back to queue
        </GhostBtn>

        {/* Navigation buttons */}
        {clusterIds.length > 0 && currentIndex >= 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              onClick={handlePrevious}
              disabled={currentIndex === 0}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 12px',
                fontSize: 13,
                fontWeight: 500,
                color: currentIndex === 0 ? C.text3 : C.text,
                background: 'transparent',
                border: `1px solid ${currentIndex === 0 ? C.border : C.border2}`,
                borderRadius: 0,
                cursor: currentIndex === 0 ? 'not-allowed' : 'pointer',
                opacity: currentIndex === 0 ? 0.5 : 1,
                transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => {
                if (currentIndex !== 0) {
                  e.currentTarget.style.background = C.hover;
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              <ChevronLeft size={14} />
              Previous
            </button>

            <span style={{ fontSize: 13, color: C.text3, fontFamily: F.mono }}>
              {currentIndex + 1} of {totalClusters}
            </span>

            <button
              onClick={handleNext}
              disabled={currentIndex === clusterIds.length - 1}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 12px',
                fontSize: 13,
                fontWeight: 500,
                color: currentIndex === clusterIds.length - 1 ? C.text3 : C.text,
                background: 'transparent',
                border: `1px solid ${currentIndex === clusterIds.length - 1 ? C.border : C.border2}`,
                borderRadius: 0,
                cursor: currentIndex === clusterIds.length - 1 ? 'not-allowed' : 'pointer',
                opacity: currentIndex === clusterIds.length - 1 ? 0.5 : 1,
                transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => {
                if (currentIndex !== clusterIds.length - 1) {
                  e.currentTarget.style.background = C.hover;
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              Next
              <ChevronRight size={14} />
            </button>
          </div>
        )}
      </div>

      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 600, color: C.text, marginBottom: 8 }}>
          Review Cluster
        </h1>
        <p style={{ fontSize: 14, color: C.text3 }}>
          {cluster.recordIds.length} duplicate {recordTypeLabelPlural}
        </p>
      </div>

      {/* V2 Warning: Inactive Owner */}
      {visibleRecords.some((r: any) => r.properties?.hubspot_owner_id) && (
        <div
          style={{
            marginBottom: 16,
            padding: 12,
            background: '#FEF3C7',
            border: '1px solid #FCD34D',
            fontSize: 13,
            color: '#92400E',
          }}
        >
          <strong>⚠️ Inactive Owner Warning:</strong> One or more records may have inactive owners.
          The merge operation will handle this based on your{' '}
          <a href="/settings/policies/dedup" style={{ color: '#92400E', textDecoration: 'underline' }}>
            dedup config
          </a>.
        </div>
      )}

      {/* V2 Warning: Parent/Child Relationship */}
      {visibleRecords.some((r: any) => r.properties?.hs_parent_company_id) && (
        <div
          style={{
            marginBottom: 16,
            padding: 12,
            background: '#DBEAFE',
            border: '1px solid #93C5FD',
            fontSize: 13,
            color: '#1E40AF',
          }}
        >
          <strong>ℹ️ Parent/Child Detected:</strong> One or more records have parent company relationships.
          {` `}If parent/child awareness is enabled in your{' '}
          <a href="/settings/policies/dedup" style={{ color: '#1E40AF', textDecoration: 'underline' }}>
            dedup config
          </a>, records without parents will be preferred as survivors.
        </div>
      )}

      {cluster.status === 'merged' && (
        <div style={{ marginBottom: 32 }}>
          <MergeHistory clusterId={params.id} />
        </div>
      )}

      {error && mergeState === 'idle' && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: 12,
            marginBottom: 16,
            background: `${C.red}15`,
            border: `0.5px solid ${C.red}30`,
            borderRadius: 0,
            color: C.red,
            fontSize: 13,
          }}
        >
          {error}
          <button
            onClick={() => setError(null)}
            style={{
              marginLeft: 'auto',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: C.red,
            }}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Master selector */}
      <Card style={{ marginBottom: 16, padding: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: C.text, marginBottom: 12 }}>
          Master Record
        </div>
        <select
          value={masterId || ''}
          onChange={(e) => setMasterId(e.target.value)}
          disabled={mergeState !== 'idle'}
          style={{
            padding: '8px 12px',
            fontSize: 13,
            color: C.text,
            background: C.surface,
            border: `0.5px solid ${C.border}`,
            borderRadius: 0,
            cursor: mergeState !== 'idle' ? 'not-allowed' : 'pointer',
            outline: 'none',
            width: '100%',
            opacity: mergeState !== 'idle' ? 0.6 : 1,
          }}
        >
          {visibleRecords.map((record) => {
            const displayName =
              objectType === 'contact'
                ? (() => {
                    const firstname = record.properties.firstname || '';
                    const lastname = record.properties.lastname || '';
                    const fullName = `${firstname} ${lastname}`.trim();
                    return fullName || record.properties.email || record.id;
                  })()
                : record.properties.name || record.id;

            return (
              <option key={record.id} value={record.id}>
                {displayName} (ID: {record.id})
              </option>
            );
          })}
        </select>
      </Card>

      {/* Field comparison table */}
      <Card style={{ marginBottom: 16, padding: 0, overflow: 'auto' }}>
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: 12,
          }}
        >
          <thead>
            <tr style={{ borderBottom: `0.5px solid ${C.border}` }}>
              <th
                style={{
                  textAlign: 'left',
                  padding: '12px 16px',
                  fontWeight: 500,
                  color: C.text3,
                  fontSize: 11,
                  position: 'sticky',
                  left: 0,
                  background: C.surface,
                  zIndex: 1,
                }}
              >
                Field
              </th>
              {visibleRecords.map((record) => {
                const isMaster = record.id === masterId;
                const isNonMaster = !isMaster;
                const shouldAnimate =
                  mergeState === 'collapsing' ||
                  mergeState === 'absorbing' ||
                  mergeState === 'highlighting' ||
                  mergeState === 'complete';

                return (
                  <th
                    key={record.id}
                    className={
                      isNonMaster && shouldAnimate
                        ? 'merge-exit'
                        : isMaster && mergeState === 'absorbing'
                        ? 'merge-absorb'
                        : ''
                    }
                    style={{
                      textAlign: 'left',
                      padding: '12px 16px',
                      fontWeight: 500,
                      color: C.text3,
                      fontSize: 11,
                      background: isMaster ? C.indigoDim : 'transparent',
                      border: isMaster ? `0.5px solid ${C.border}` : 'none',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8,
                      }}
                    >
                      <div>
                        {(() => {
                          if (objectType === 'contact') {
                            const firstname = record.properties.firstname || '';
                            const lastname = record.properties.lastname || '';
                            const fullName = `${firstname} ${lastname}`.trim();
                            return fullName || record.properties.email || record.id;
                          }
                          return record.properties.name || record.id;
                        })()}
                        {isMaster && (
                          <span
                            style={{
                              marginLeft: 8,
                              fontSize: 10,
                              fontWeight: 600,
                              color: C.indigo,
                              textTransform: 'uppercase',
                            }}
                          >
                            Master
                          </span>
                        )}
                      </div>
                      {!isMaster && (
                        <button
                          onClick={() => {
                            const displayName =
                              objectType === 'contact'
                                ? (() => {
                                    const firstname = record.properties.firstname || '';
                                    const lastname = record.properties.lastname || '';
                                    const fullName = `${firstname} ${lastname}`.trim();
                                    return fullName || record.properties.email || record.id;
                                  })()
                                : record.properties.name || record.id;
                            handleExcludeRecord(record.id, displayName);
                          }}
                          disabled={excludingRecordId === record.id || mergeState !== 'idle'}
                          title={`Mark this record as not a duplicate. It will remain in HubSpot as a separate ${recordTypeLabel}.`}
                          style={{
                            padding: '4px 8px',
                            fontSize: 10,
                            fontWeight: 500,
                            color:
                              excludingRecordId === record.id || mergeState !== 'idle'
                                ? C.text3
                                : C.red,
                            background: 'transparent',
                            border: `0.5px solid ${
                              excludingRecordId === record.id || mergeState !== 'idle'
                                ? C.border
                                : C.red
                            }`,
                            borderRadius: 0,
                            cursor:
                              excludingRecordId === record.id || mergeState !== 'idle'
                                ? 'not-allowed'
                                : 'pointer',
                            opacity:
                              excludingRecordId === record.id || mergeState !== 'idle' ? 0.5 : 1,
                            whiteSpace: 'nowrap',
                          }}
                          onMouseEnter={(e) => {
                            if (excludingRecordId !== record.id && mergeState === 'idle') {
                              e.currentTarget.style.background = C.redDim;
                            }
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'transparent';
                          }}
                        >
                          {excludingRecordId === record.id ? 'Excluding...' : 'Not a duplicate'}
                        </button>
                      )}
                    </div>
                  </th>
                );
              })}
              {/* Why column header */}
              <th
                style={{
                  textAlign: 'left',
                  padding: '12px 16px',
                  fontWeight: 500,
                  color: C.text3,
                  fontSize: 11,
                }}
              >
                Why
              </th>
            </tr>
          </thead>
          <tbody>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext items={fieldsToDisplay} strategy={verticalListSortingStrategy}>
                {fieldsToDisplay.map((field) => (
                  <SortableFieldRow
                    key={field}
                    field={field}
                    fieldLabel={FIELD_LABELS[field] || field}
                    visibleRecords={visibleRecords}
                    masterId={masterId}
                    propertyLabels={propertyLabels}
                    fieldSelections={fieldSelections}
                    mergeState={mergeState}
                    rescuedFieldKeys={rescuedFieldKeys}
                    survivorshipReasons={data?.survivorshipReasons}
                    onFieldSelectionChange={(field, recordId) =>
                      setFieldSelections((prev) => ({ ...prev, [field]: recordId }))
                    }
                    onRemoveField={handleRemoveField}
                  />
                ))}
              </SortableContext>
            </DndContext>

            {/* Add field row */}
            <tr style={{ borderBottom: `0.5px solid ${C.border}` }}>
              <td colSpan={visibleRecords.length + 1} style={{ padding: '12px 16px' }}>
                <FieldPicker
                  availableProperties={availableFieldsForPicker}
                  onAddField={handleAddField}
                  disabled={mergeState !== 'idle'}
                />
              </td>
            </tr>
          </tbody>
        </table>
      </Card>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', alignItems: 'center' }}>
        <GhostBtn onClick={handleSkip} disabled={skipping || mergeState !== 'idle' || rejecting}>
          {skipping ? 'Skipping...' : 'Back to queue'}
        </GhostBtn>
        <GhostBtn onClick={handleReject} disabled={rejecting || mergeState !== 'idle' || skipping}>
          {rejecting ? 'Rejecting...' : 'Not duplicates'}
        </GhostBtn>
        {isAdmin ? (
          <PrimaryBtn
            onClick={handleMerge}
            disabled={!masterId || mergeState !== 'idle' || rejecting || skipping}
          >
            {mergeState === 'merging' ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Loader2 size={12} className="animate-spin" />
                Merging...
              </span>
            ) : (
              'Merge cluster'
            )}
          </PrimaryBtn>
        ) : (
          <AdminOnlyNotice action="merge records" />
        )}
      </div>

      {/* Merge success toast */}
      {mergeState === 'complete' && mergeToastData && (
        <div
          className="toast-slide-up"
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            padding: '12px 16px',
            background: '#162944',
            border: '0.5px solid rgba(46, 204, 138, 0.5)',
            borderRadius: 0,
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            zIndex: 1000,
            minWidth: 380,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <Check size={16} color="#2ecc8a" style={{ marginTop: 2, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, color: '#2ecc8a', fontWeight: 500, marginBottom: 4 }}>
                Merged into {mergeToastData.masterName}
              </div>
              <div style={{ fontSize: 12, color: 'rgba(249, 248, 245, 0.65)' }}>
                {mergeToastData.recordsConsolidated} records consolidated
              </div>
              {mergeToastData.fieldsRescued > 0 && (
                <div style={{ fontSize: 12, color: 'rgba(249, 248, 245, 0.65)' }}>
                  {mergeToastData.fieldsRescued} fields rescued from duplicates
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Error toast */}
      {toastMessage && mergeState === 'idle' && (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            padding: '12px 16px',
            background: C.surface,
            border: `0.5px solid ${C.border}`,
            borderRadius: 0,
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            zIndex: 1000,
            minWidth: 300,
          }}
        >
          <Check size={16} color={C.green} />
          <span style={{ fontSize: 13, color: C.text, flex: 1 }}>{toastMessage}</span>
          <button
            onClick={() => setToastMessage(null)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: C.text3,
              padding: 4,
            }}
          >
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
