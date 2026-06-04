/**
 * useTaxonomyWizard Hook
 *
 * Contains all state management, API calls, and business logic for the Taxonomy Wizard.
 * Returns state and handlers for wizard orchestration.
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { addToast } from '@/components/ui/toast';

export type WizardStep = 1 | 2 | 2.5 | 2.75 | 3 | 3.5 | 3.75 | 4 | 5;
export type ClassificationType = 'industry' | 'sub-industry' | 'market-segment' | 'custom';
export type TransformType = 'format' | 'lookup' | null;

export interface Pack {
  id: string;
  name: string;
  description: string;
  industry_scope: string[];
  entryCount: number;
}

export interface PackEntry {
  id: string;
  input_value: string;
  canonical_value: string;
  naics_code: string;
}

export interface ReadFieldValue {
  value: string;
  count: number;
  isSuspect: boolean;
  isSelected: boolean;
}

export interface ReadFieldMetadata {
  totalRecords: number;
  blankCount: number;
  uniqueValueCount: number;
}

export interface TaxonomyWizardState {
  // State
  currentStep: WizardStep;
  classificationType: ClassificationType;
  sourceField: string;
  sourceFieldLabel: string;
  targetField: string;
  targetFieldLabel: string;
  createNewField: boolean;
  writePolicy: 'fill_empty' | 'always_overwrite';
  transformType: TransformType;
  selectedFormatFunction: string | null;
  valueSource: 'pack' | 'field' | 'blank';
  packs: Pack[];
  selectedPack: Pack | null;
  loadingPacks: boolean;
  readFromField: string;
  readFromFieldLabel: string;
  readFieldValues: ReadFieldValue[];
  readFieldMetadata: ReadFieldMetadata | null;
  loadingFieldValues: boolean;
  showSuspects: boolean;
  renamingIndex: number | null;
  packEntries: PackEntry[];
  loadingEntries: boolean;
  harmonyId: string;
  activating: boolean;
  groupedEntries: Record<string, PackEntry[]>;

  // Setters
  setClassificationType: (type: ClassificationType) => void;
  setSourceField: (field: string) => void;
  setSourceFieldLabel: (label: string) => void;
  setTargetField: (field: string) => void;
  setTargetFieldLabel: (label: string) => void;
  setCreateNewField: (value: boolean) => void;
  setWritePolicy: (policy: 'fill_empty' | 'always_overwrite') => void;
  setTransformType: (type: TransformType) => void;
  setSelectedFormatFunction: (fn: string | null) => void;
  setValueSource: (source: 'pack' | 'field' | 'blank') => void;
  setSelectedPack: (pack: Pack | null) => void;
  setReadFromField: (field: string) => void;
  setReadFromFieldLabel: (label: string) => void;
  setShowSuspects: (show: boolean) => void;
  setRenamingIndex: (index: number | null) => void;
  setReadFieldValues: (values: ReadFieldValue[] | ((prev: ReadFieldValue[]) => ReadFieldValue[])) => void;

  // Handlers
  canProceed: () => boolean;
  handleNext: () => Promise<void>;
  handleBack: () => void;
  handleActivate: () => Promise<void>;
  toggleValueSelection: (index: number) => void;
  renameValueAtIndex: (index: number, newValue: string) => void;

  // Router
  router: ReturnType<typeof useRouter>;
}

export function useTaxonomyWizard(): TaxonomyWizardState {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<WizardStep>(1);

  // Step 1: Classification type
  const [classificationType, setClassificationType] = useState<ClassificationType>('sub-industry');

  // Step 2: Field mapping
  const [sourceField, setSourceField] = useState('');
  const [sourceFieldLabel, setSourceFieldLabel] = useState('');
  const [targetField, setTargetField] = useState('');
  const [targetFieldLabel, setTargetFieldLabel] = useState('');
  const [createNewField, setCreateNewField] = useState(false);
  const [writePolicy, setWritePolicy] = useState<'fill_empty' | 'always_overwrite'>('fill_empty');

  // Step 2.5: Transform type selection
  const [transformType, setTransformType] = useState<TransformType>(null);

  // Step 2.75: Format function selection
  const [selectedFormatFunction, setSelectedFormatFunction] = useState<string | null>(null);

  // Step 3: Choose canonical values
  const [valueSource, setValueSource] = useState<'pack' | 'field' | 'blank'>('pack');
  const [packs, setPacks] = useState<Pack[]>([]);
  const [selectedPack, setSelectedPack] = useState<Pack | null>(null);
  const [loadingPacks, setLoadingPacks] = useState(false);
  const [readFromField, setReadFromField] = useState('');
  const [readFromFieldLabel, setReadFromFieldLabel] = useState('');

  // Field read flow state
  const [readFieldValues, setReadFieldValues] = useState<ReadFieldValue[]>([]);
  const [readFieldMetadata, setReadFieldMetadata] = useState<ReadFieldMetadata | null>(null);
  const [loadingFieldValues, setLoadingFieldValues] = useState(false);
  const [showSuspects, setShowSuspects] = useState(false);
  const [renamingIndex, setRenamingIndex] = useState<number | null>(null);

  // Step 4: Review mappings
  const [packEntries, setPackEntries] = useState<PackEntry[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(false);

  // Step 5: Activation
  const [harmonyId, setHarmonyId] = useState('');
  const [activating, setActivating] = useState(false);

  // Auto-select source field based on classification type
  useEffect(() => {
    if (currentStep === 2) {
      switch (classificationType) {
        case 'industry':
          setSourceField('industry');
          setSourceFieldLabel('Industry');
          break;
        case 'sub-industry':
          setSourceField('industry');
          setSourceFieldLabel('Industry');
          break;
        case 'market-segment':
        case 'custom':
          // No auto-select
          break;
      }
    }
  }, [classificationType, currentStep]);

  // Load packs when reaching step 3
  useEffect(() => {
    if (currentStep === 3 && valueSource === 'pack' && packs.length === 0) {
      loadPacks();
    }
  }, [currentStep, valueSource]);

  // Load pack entries when pack selected
  useEffect(() => {
    if (selectedPack) {
      loadPackEntries(selectedPack.id);
    }
  }, [selectedPack]);

  const loadPacks = async () => {
    setLoadingPacks(true);
    try {
      const res = await fetch('/api/taxonomy/packs');
      if (!res.ok) throw new Error('Failed to fetch packs');
      const data = await res.json();
      setPacks(data.packs || []);
    } catch (error) {
      console.error('Failed to load packs:', error);
      addToast('error', 'Failed to load taxonomy packs');
    } finally {
      setLoadingPacks(false);
    }
  };

  const loadPackEntries = async (packId: string) => {
    setLoadingEntries(true);
    try {
      const res = await fetch(`/api/taxonomy/packs/${packId}/entries`);
      if (!res.ok) throw new Error('Failed to fetch pack entries');
      const data = await res.json();
      setPackEntries(data.entries || []);
    } catch (error) {
      console.error('Failed to load pack entries:', error);
      addToast('error', 'Failed to load pack mappings');
    } finally {
      setLoadingEntries(false);
    }
  };

  const toggleValueSelection = (index: number) => {
    setReadFieldValues(vals =>
      vals.map((v, i) => (i === index ? { ...v, isSelected: !v.isSelected } : v))
    );
  };

  const renameValueAtIndex = (index: number, newValue: string) => {
    setReadFieldValues(vals =>
      vals.map((v, i) => (i === index ? { ...v, value: newValue } : v))
    );
  };

  const handleActivate = async () => {
    setActivating(true);
    try {
      const generatedHarmonyId = `taxonomy-${targetField}`;

      // Branch 1: Format function activation
      if (transformType === 'format') {
        const res = await fetch('/api/taxonomy/activate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: targetFieldLabel || targetField,
            description: `Format function: ${selectedFormatFunction}`,
            field: targetField,
            object_type: 'company',
            transform_type: 'format',
            transform_function: selectedFormatFunction,
            org_id: 'default',
            is_preset: false,
            write_policy: writePolicy,
          }),
        });

        if (!res.ok) throw new Error('Failed to activate format function');

        const data = await res.json();
        setHarmonyId(data.harmonyId);
        setCurrentStep(5 as WizardStep);
        addToast('success', 'Format function activated successfully');
      }
      // Branch 2: Pack activation
      else if (valueSource === 'pack') {
        const res = await fetch('/api/taxonomy/activate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            packId: selectedPack?.id,
            harmonyId: generatedHarmonyId,
            targetField,
            targetFieldLabel,
            writePolicy,
          }),
        });

        if (!res.ok) throw new Error('Failed to activate pack');

        const data = await res.json();
        setHarmonyId(data.harmonyId);
        setCurrentStep(5 as WizardStep);
        addToast('success', 'Taxonomy activated successfully');
      }
      // Branch 3: Field activation
      else if (valueSource === 'field') {
        const selectedValues = readFieldValues
          .filter(v => v.isSelected)
          .map(v => v.value);

        const res = await fetch('/api/taxonomy/activate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            canonicalValues: selectedValues,
            harmonyId: generatedHarmonyId,
            targetField,
            targetFieldLabel,
            writePolicy,
            objectType: 'company',
          }),
        });

        if (!res.ok) throw new Error('Activation failed');

        const data = await res.json();
        setHarmonyId(data.harmonyId);
        setCurrentStep(5 as WizardStep);
      }
    } catch (error) {
      console.error('Failed to activate:', error);
      addToast('error', 'Failed to activate taxonomy pack');
    } finally {
      setActivating(false);
    }
  };

  const canProceed = (): boolean => {
    switch (currentStep) {
      case 1:
        return classificationType !== null;
      case 2:
        return !!(sourceField && targetField && (!createNewField || targetField));
      case 2.5:
        return transformType !== null;
      case 2.75:
        return selectedFormatFunction !== null;
      case 3:
        return valueSource === 'blank' || (valueSource === 'pack' && !!selectedPack) || (valueSource === 'field' && !!readFromField);
      case 3.5:
        // Loading screen - can't proceed manually (handled by API call)
        return false;
      case 3.75:
        // Review canonicals - must have at least one selected
        return readFieldValues.filter(v => v.isSelected).length > 0;
      case 4:
        if (valueSource === 'pack') {
          return packEntries.length > 0;
        } else if (valueSource === 'field') {
          return readFieldValues.filter(v => v.isSelected).length > 0;
        } else {
          return true;
        }
      default:
        return true;
    }
  };

  const handleNext = async () => {
    if (currentStep === 2) {
      setCurrentStep(2.5);
    } else if (currentStep === 2.5) {
      if (transformType === 'format') {
        setCurrentStep(2.75);
      } else if (transformType === 'lookup') {
        setCurrentStep(3);
      }
    } else if (currentStep === 2.75) {
      handleActivate();
    } else if (currentStep === 3 && valueSource === 'field' && readFromField) {
      // Show loading screen
      setCurrentStep(3.5 as WizardStep);
      setLoadingFieldValues(true);

      try {
        const res = await fetch('/api/taxonomy/read-field-values', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            hubspotProperty: readFromField,
            objectType: 'company',
          }),
        });

        if (!res.ok) throw new Error('Failed to read field values');

        const data = await res.json();

        setReadFieldValues(
          data.values.map((v: any) => ({
            ...v,
            isSelected: !v.isSuspect,
          }))
        );
        setReadFieldMetadata({
          totalRecords: data.totalRecords,
          blankCount: data.blankCount,
          uniqueValueCount: data.uniqueValueCount,
        });

        // Navigate to review screen
        setCurrentStep(3.75 as WizardStep);
      } catch (error) {
        console.error('Failed to read field values:', error);
        addToast('error', 'Failed to read field values from HubSpot');
        // Go back to value source screen on error
        setCurrentStep(3);
      } finally {
        setLoadingFieldValues(false);
      }
      return;
    } else if (currentStep === 3) {
      setCurrentStep(4);
    } else if (currentStep === 3.75) {
      // From review canonicals, go to step 4 (but skip it and go straight to activation)
      handleActivate();
    } else if (currentStep === 4) {
      handleActivate();
    } else if (canProceed()) {
      setCurrentStep((currentStep + 1) as WizardStep);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      let prevStep: WizardStep;
      if (currentStep === 2.75) {
        prevStep = 2.5;
      } else if (currentStep === 2.5) {
        prevStep = 2;
      } else if (currentStep === 3 && transformType === 'format') {
        prevStep = 2.75;
      } else if (currentStep === 3 && transformType === 'lookup') {
        prevStep = 2.5;
      } else if (currentStep === 3.5) {
        // From loading screen, go back to value source
        prevStep = 3;
      } else if (currentStep === 3.75) {
        // From review canonicals, go back to value source (skip loading screen)
        prevStep = 3;
      } else if (currentStep === 4) {
        prevStep = 3;
      } else if (currentStep === 5 && transformType === 'format') {
        prevStep = 2.75;
      } else if (currentStep === 5 && transformType === 'lookup' && valueSource === 'field') {
        // From activation screen, go back to review canonicals if using field source
        prevStep = 3.75;
      } else if (currentStep === 5 && transformType === 'lookup') {
        prevStep = 4;
      } else {
        prevStep = (currentStep - 1) as WizardStep;
      }
      setCurrentStep(prevStep);
    }
  };

  const groupedEntries = packEntries.reduce((acc, entry) => {
    if (!acc[entry.canonical_value]) {
      acc[entry.canonical_value] = [];
    }
    acc[entry.canonical_value].push(entry);
    return acc;
  }, {} as Record<string, PackEntry[]>);

  return {
    // State
    currentStep,
    classificationType,
    sourceField,
    sourceFieldLabel,
    targetField,
    targetFieldLabel,
    createNewField,
    writePolicy,
    transformType,
    selectedFormatFunction,
    valueSource,
    packs,
    selectedPack,
    loadingPacks,
    readFromField,
    readFromFieldLabel,
    readFieldValues,
    readFieldMetadata,
    loadingFieldValues,
    showSuspects,
    renamingIndex,
    packEntries,
    loadingEntries,
    harmonyId,
    activating,
    groupedEntries,

    // Setters
    setClassificationType,
    setSourceField,
    setSourceFieldLabel,
    setTargetField,
    setTargetFieldLabel,
    setCreateNewField,
    setWritePolicy,
    setTransformType,
    setSelectedFormatFunction,
    setValueSource,
    setSelectedPack,
    setReadFromField,
    setReadFromFieldLabel,
    setShowSuspects,
    setRenamingIndex,
    setReadFieldValues,

    // Handlers
    canProceed,
    handleNext,
    handleBack,
    handleActivate,
    toggleValueSelection,
    renameValueAtIndex,

    // Router
    router,
  };
}
