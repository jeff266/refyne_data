/**
 * Taxonomy Wizard
 *
 * Five-screen wizard for activating taxonomy packs:
 * 1. What are you classifying? (Industry/Sub-industry/Market segment/Custom)
 * 2. Field mapping (source → target with write policy)
 * 3. Choose canonical values (pack/existing field/blank)
 * 4. Review mappings (canonical values + input mappings table)
 * 5. Activated confirmation
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, Check, X } from 'lucide-react';
import { C, F } from '@/lib/design-tokens';
import { HubSpotPropertyPicker } from './HubSpotPropertyPicker';
import { FormatFunctionPicker } from './FormatFunctionPicker';
import { addToast } from '@/components/ui/toast';

type WizardStep = 1 | 2 | 2.5 | 2.75 | 3 | 4 | 5;
type ClassificationType = 'industry' | 'sub-industry' | 'market-segment' | 'custom';
type TransformType = 'format' | 'lookup' | null;

interface Pack {
  id: string;
  name: string;
  description: string;
  industry_scope: string[];
  entryCount: number;
}

interface PackEntry {
  id: string;
  input_value: string;
  canonical_value: string;
  naics_code: string;
}

export function TaxonomyWizard({ onClose }: { onClose: () => void }) {
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

  // NEW: Field read flow state
  const [readFieldValues, setReadFieldValues] = useState<Array<{
    value: string;
    count: number;
    isSuspect: boolean;
    isSelected: boolean;
  }>>([]);
  const [readFieldMetadata, setReadFieldMetadata] = useState<{
    totalRecords: number;
    blankCount: number;
    uniqueValueCount: number;
  } | null>(null);
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
          // No auto-select for market segment
          break;
        case 'custom':
          // No auto-select for custom
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
            org_id: 'default', // TODO: Get from context
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

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return classificationType !== null;
      case 2:
        return sourceField && targetField && (!createNewField || targetField);
      case 2.5:
        return transformType !== null;
      case 2.75:
        return selectedFormatFunction !== null;
      case 3:
        return valueSource === 'blank' || (valueSource === 'pack' && selectedPack) || (valueSource === 'field' && readFromField);
      case 4:
        if (valueSource === 'pack') {
          return packEntries.length > 0;
        } else if (valueSource === 'field') {
          return readFieldValues.filter(v => v.isSelected).length > 0;
        } else {
          return true;  // blank
        }
      default:
        return true;
    }
  };

  const groupedEntries = packEntries.reduce((acc, entry) => {
    if (!acc[entry.canonical_value]) {
      acc[entry.canonical_value] = [];
    }
    acc[entry.canonical_value].push(entry);
    return acc;
  }, {} as Record<string, PackEntry[]>);

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.6)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      fontFamily: F.sans,
    }}>
      <div style={{
        background: C.bg,
        width: '90%',
        maxWidth: 800,
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        border: `1px solid ${C.border}`,
      }}>
        {/* Header */}
        <div style={{
          padding: '24px 32px',
          borderBottom: `1px solid ${C.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 600, color: C.text, marginBottom: 4 }}>
              Add Taxonomy Classification
            </h2>
            <div style={{ fontSize: 13, color: C.text3 }}>
              Step {Math.floor(currentStep)} of 5
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: C.text3,
              cursor: 'pointer',
              padding: 4,
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '32px',
        }}>
          {/* Screen 1: Classification Type */}
          {currentStep === 1 && (
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: C.text, marginBottom: 24 }}>
                What field are you classifying?
              </h3>

              {[
                { value: 'industry' as const, label: 'Industry', desc: 'Normalize the main industry field' },
                { value: 'sub-industry' as const, label: 'Sub-industry', desc: 'Add a second tier of classification' },
                { value: 'market-segment' as const, label: 'Market segment', desc: 'Route accounts to the right segment' },
                { value: 'custom' as const, label: 'Custom field', desc: "I'll define my own" },
              ].map((option) => (
                <div
                  key={option.value}
                  onClick={() => setClassificationType(option.value)}
                  style={{
                    padding: '16px 20px',
                    marginBottom: 12,
                    background: classificationType === option.value ? C.indigoDim : C.surface,
                    border: `1px solid ${classificationType === option.value ? C.indigo : C.border}`,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                  }}
                >
                  <div style={{
                    width: 16,
                    height: 16,
                    borderRadius: '50%',
                    border: `2px solid ${classificationType === option.value ? C.indigo : C.border}`,
                    background: classificationType === option.value ? C.indigo : 'transparent',
                  }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 500, color: C.text, marginBottom: 4 }}>
                      {option.label}
                    </div>
                    <div style={{ fontSize: 12, color: C.text3 }}>
                      {option.desc}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Screen 2: Field Mapping */}
          {currentStep === 2 && (
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: C.text, marginBottom: 24 }}>
                Where should classified values be written?
              </h3>

              <div style={{ marginBottom: 24 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: C.text2, marginBottom: 8 }}>
                  SOURCE FIELD (read from)
                </label>
                <HubSpotPropertyPicker
                  objectType="company"
                  value={sourceField}
                  onChange={(name, label) => {
                    setSourceField(name);
                    setSourceFieldLabel(label);
                  }}
                  placeholder="Select source field..."
                />
              </div>

              <div style={{ marginBottom: 24 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: C.text2, marginBottom: 8 }}>
                  TARGET FIELD (write to)
                </label>

                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, cursor: 'pointer' }}>
                    <input
                      type="radio"
                      checked={!createNewField}
                      onChange={() => setCreateNewField(false)}
                      style={{ cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: 13, color: C.text }}>Use an existing field</span>
                  </label>
                  {!createNewField && (
                    <HubSpotPropertyPicker
                      objectType="company"
                      value={targetField}
                      onChange={(name, label) => {
                        setTargetField(name);
                        setTargetFieldLabel(label);
                      }}
                      placeholder="Select target field..."
                    />
                  )}
                </div>

                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input
                    type="radio"
                    checked={createNewField}
                    onChange={() => setCreateNewField(true)}
                    style={{ cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: 13, color: C.text }}>Let Refyne create a new field</span>
                </label>
                {createNewField && (
                  <div style={{ marginTop: 12, padding: 12, background: C.surface, border: `1px solid ${C.border}` }}>
                    <input
                      type="text"
                      value={targetField}
                      onChange={(e) => setTargetField(e.target.value)}
                      placeholder="refyne_sub_industry"
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        background: C.bg,
                        border: `1px solid ${C.border}`,
                        color: C.text,
                        fontSize: 13,
                        fontFamily: F.mono,
                        outline: 'none',
                      }}
                    />
                    <div style={{ fontSize: 11, color: C.text3, marginTop: 8 }}>
                      Will be created in your HubSpot on first normalize run
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: C.text2, marginBottom: 8 }}>
                  WRITE POLICY
                </label>
                <div style={{ display: 'flex', gap: 12 }}>
                  {[
                    { value: 'fill_empty' as const, label: 'Fill empty only' },
                    { value: 'always_overwrite' as const, label: 'Always overwrite' },
                  ].map((policy) => (
                    <label key={policy.value} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                      <input
                        type="radio"
                        checked={writePolicy === policy.value}
                        onChange={() => setWritePolicy(policy.value)}
                        style={{ cursor: 'pointer' }}
                      />
                      <span style={{ fontSize: 13, color: C.text }}>{policy.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Screen 2.5: Transform Type Selection */}
          {currentStep === 2.5 && (
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: C.text, marginBottom: 24 }}>
                How should this harmony transform values?
              </h3>

              {[
                {
                  value: 'format' as const,
                  label: 'Format function',
                  desc: 'Apply a built-in transformation rule',
                  bestFor: 'Best for: phone numbers, emails, URLs, names',
                },
                {
                  value: 'lookup' as const,
                  label: 'Lookup table',
                  desc: 'Map input values to canonical values',
                  bestFor: 'Best for: industry, country, sub-industry',
                },
              ].map((option) => (
                <div
                  key={option.value}
                  onClick={() => setTransformType(option.value)}
                  style={{
                    padding: '16px 20px',
                    marginBottom: 12,
                    background: transformType === option.value ? C.indigoDim : C.surface,
                    border: `1px solid ${transformType === option.value ? C.indigo : C.border}`,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                  }}
                >
                  <div style={{
                    width: 16,
                    height: 16,
                    borderRadius: '50%',
                    border: `2px solid ${transformType === option.value ? C.indigo : C.border}`,
                    background: transformType === option.value ? C.indigo : 'transparent',
                  }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 500, color: C.text, marginBottom: 4 }}>
                      {option.label}
                    </div>
                    <div style={{ fontSize: 12, color: C.text3, marginBottom: 4 }}>
                      {option.desc}
                    </div>
                    <div style={{ fontSize: 11, color: C.text3, fontStyle: 'italic' }}>
                      {option.bestFor}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Screen 2.75: Format Function Picker */}
          {currentStep === 2.75 && (
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: C.text, marginBottom: 24 }}>
                Select a format function
              </h3>

              <FormatFunctionPicker
                selectedFunction={selectedFormatFunction}
                onSelect={setSelectedFormatFunction}
                objectType="company"
              />
            </div>
          )}

          {/* Screen 3: Choose Canonical Values */}
          {currentStep === 3 && (
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: C.text, marginBottom: 24 }}>
                Define your canonical values
              </h3>

              <div style={{ marginBottom: 32 }}>
                <h4 style={{ fontSize: 13, fontWeight: 600, color: C.text2, marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  START FROM A PACK (RECOMMENDED)
                </h4>

                {loadingPacks ? (
                  <div style={{ padding: 40, textAlign: 'center', color: C.text3 }}>
                    Loading packs...
                  </div>
                ) : (
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gap: 16,
                  }}>
                    {packs.map((pack) => (
                      <div
                        key={pack.id}
                        onClick={() => {
                          setSelectedPack(pack);
                          setValueSource('pack');
                        }}
                        style={{
                          padding: 20,
                          background: C.indigoDim,
                          border: `1px solid ${selectedPack?.id === pack.id ? C.indigo : C.border}`,
                          cursor: 'pointer',
                        }}
                      >
                        <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 8 }}>
                          {pack.name}
                        </div>
                        <div style={{ fontSize: 12, color: C.text3, marginBottom: 12 }}>
                          {pack.entryCount} mappings pre-loaded
                        </div>
                        {selectedPack?.id === pack.id && (
                          <div style={{
                            padding: '6px 12px',
                            background: C.indigo,
                            color: '#fff',
                            fontSize: 12,
                            fontWeight: 500,
                            textAlign: 'center',
                          }}>
                            Selected
                          </div>
                        )}
                        {selectedPack?.id !== pack.id && (
                          <button
                            style={{
                              width: '100%',
                              padding: '6px 12px',
                              background: 'transparent',
                              border: `1px solid ${C.border}`,
                              color: C.text,
                              fontSize: 12,
                              cursor: 'pointer',
                              fontFamily: F.sans,
                            }}
                          >
                            Select
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ marginBottom: 16 }}>
                <h4 style={{ fontSize: 13, fontWeight: 600, color: C.text2, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  OR READ FROM YOUR EXISTING FIELD
                </h4>
                <button
                  onClick={() => setValueSource('field')}
                  style={{
                    width: '100%',
                    padding: '12px 20px',
                    background: valueSource === 'field' ? C.indigoDim : 'transparent',
                    border: `1px solid ${valueSource === 'field' ? C.indigo : C.border}`,
                    color: C.text,
                    fontSize: 13,
                    cursor: 'pointer',
                    fontFamily: F.sans,
                    textAlign: 'left',
                  }}
                >
                  Read from HubSpot field
                </button>
                {valueSource === 'field' && (
                  <div style={{ marginTop: 16 }}>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: C.text2, marginBottom: 8 }}>
                      SELECT FIELD TO READ FROM
                    </label>
                    <HubSpotPropertyPicker
                      objectType="company"
                      value={readFromField}
                      onChange={(name, label) => {
                        setReadFromField(name);
                        setReadFromFieldLabel(label);
                      }}
                      placeholder="Select field with canonical values..."
                    />
                  </div>
                )}
              </div>

              <div>
                <h4 style={{ fontSize: 13, fontWeight: 600, color: C.text2, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  OR START BLANK
                </h4>
                <button
                  onClick={() => setValueSource('blank')}
                  style={{
                    padding: '12px 20px',
                    background: valueSource === 'blank' ? C.indigoDim : 'transparent',
                    border: `1px solid ${C.border}`,
                    color: C.text,
                    fontSize: 13,
                    cursor: 'pointer',
                    fontFamily: F.sans,
                  }}
                >
                  I'll define my own canonical values
                </button>
              </div>
            </div>
          )}

          {/* Screen 3b: Loading Field Values */}
          {loadingFieldValues && (
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: C.text, marginBottom: 24 }}>
                Reading from HubSpot
              </h3>

              <div style={{ marginBottom: 16, fontSize: 13, color: C.text2 }}>
                Reading distinct values from{' '}
                <span style={{ fontWeight: 500, color: C.text }}>{readFromFieldLabel}</span>
                {' '}across companies...
              </div>

              <div style={{
                width: '100%',
                height: 4,
                background: C.border,
                borderRadius: 2,
                overflow: 'hidden',
                marginBottom: 24,
              }}>
                <div style={{
                  width: '70%',
                  height: '100%',
                  background: C.indigo,
                }} />
              </div>

              <div style={{ fontSize: 12, color: C.text3 }}>
                This may take a moment for large datasets...
              </div>
            </div>
          )}

          {/* Screen 4: Review Mappings */}
          {currentStep === 4 && (
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: C.text, marginBottom: 8 }}>
                Review mappings
              </h3>

              {valueSource === 'pack' && (
                <>
                  <div style={{ fontSize: 13, color: C.text3, marginBottom: 24 }}>
                    {selectedPack?.name} pack · {packEntries.length} mappings loaded
                  </div>

                  {/* Canonical Values */}
                  <div style={{ marginBottom: 32 }}>
                    <h4 style={{ fontSize: 13, fontWeight: 600, color: C.text2, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      CANONICAL VALUES (what gets written)
                    </h4>
                    <div style={{
                      background: C.surface,
                      border: `1px solid ${C.border}`,
                      maxHeight: 300,
                      overflowY: 'auto',
                    }}>
                      {Object.entries(groupedEntries).map(([canonical, entries]) => (
                        <div
                          key={canonical}
                          style={{
                            padding: '12px 16px',
                            borderBottom: `1px solid ${C.border}`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                          }}
                        >
                          <div style={{ flex: 1 }}>
                            <span style={{ fontSize: 13, color: C.text, fontWeight: 500 }}>{canonical}</span>
                            <span style={{ fontSize: 12, color: C.text3, marginLeft: 12 }}>
                              {entries.length} mappings
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Input Mappings Preview */}
                  <div>
                    <h4 style={{ fontSize: 13, fontWeight: 600, color: C.text2, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      INPUT MAPPINGS
                    </h4>
                    <div style={{
                      background: C.surface,
                      border: `1px solid ${C.border}`,
                      maxHeight: 200,
                      overflowY: 'auto',
                    }}>
                      {packEntries.slice(0, 10).map((entry) => (
                        <div
                          key={entry.id}
                          style={{
                            padding: '10px 16px',
                            borderBottom: `1px solid ${C.border}`,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 16,
                            fontSize: 12,
                          }}
                        >
                          <span style={{ color: C.text2, flex: 1 }}>{entry.input_value}</span>
                          <span style={{ color: C.text3 }}>→</span>
                          <span style={{ color: C.text, flex: 1 }}>{entry.canonical_value}</span>
                        </div>
                      ))}
                      {packEntries.length > 10 && (
                        <div style={{ padding: '10px 16px', fontSize: 12, color: C.text3, textAlign: 'center' }}>
                          + {packEntries.length - 10} more
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}

              {valueSource === 'field' && readFieldValues.length > 0 && (
                <div>
                  {/* Header */}
                  <h3 style={{ fontSize: 16, fontWeight: 600, color: C.text, marginBottom: 8 }}>
                    Review your canonical values
                  </h3>
                  <div style={{ fontSize: 13, color: C.text2, marginBottom: 24 }}>
                    Found {readFieldMetadata?.uniqueValueCount} distinct values in{' '}
                    <span style={{ fontWeight: 500, color: C.text }}>{readFromFieldLabel}</span>
                    {' '}across {readFieldMetadata?.totalRecords} companies
                  </div>

                  {/* Blank count info */}
                  {readFieldMetadata && readFieldMetadata.blankCount > 0 && (
                    <div style={{ fontSize: 12, color: C.text3, marginBottom: 16 }}>
                      {readFieldMetadata.blankCount} companies have no value
                    </div>
                  )}

                  {/* Instructions */}
                  <div style={{ fontSize: 13, color: C.text2, marginBottom: 16 }}>
                    Select the values you want to keep as canonical. Deselect any that are duplicates, typos, or garbage.
                  </div>

                  {/* Controls */}
                  <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
                    <button
                      onClick={() => {
                        setReadFieldValues(vals => vals.map(v => ({ ...v, isSelected: true })));
                      }}
                      style={{
                        padding: '6px 12px',
                        fontSize: 12,
                        cursor: 'pointer',
                        background: C.surface,
                        border: `1px solid ${C.border}`,
                        color: C.text,
                        fontFamily: F.sans,
                      }}
                    >
                      Select all
                    </button>
                    <button
                      onClick={() => {
                        setReadFieldValues(vals => vals.map(v => ({ ...v, isSelected: false })));
                      }}
                      style={{
                        padding: '6px 12px',
                        fontSize: 12,
                        cursor: 'pointer',
                        background: C.surface,
                        border: `1px solid ${C.border}`,
                        color: C.text,
                        fontFamily: F.sans,
                      }}
                    >
                      Deselect all
                    </button>
                    <button
                      onClick={() => setShowSuspects(!showSuspects)}
                      style={{
                        padding: '6px 12px',
                        fontSize: 12,
                        cursor: 'pointer',
                        background: C.surface,
                        border: `1px solid ${C.border}`,
                        color: C.text,
                        fontFamily: F.sans,
                      }}
                    >
                      {showSuspects ? 'Hide' : 'Show'} suspects ({readFieldValues.filter(v => v.isSuspect).length})
                    </button>
                  </div>

                  {/* Value list - non-suspects */}
                  <div style={{ maxHeight: 400, overflowY: 'auto', marginBottom: 24, border: `1px solid ${C.border}` }}>
                    {readFieldValues.filter(v => !v.isSuspect).map((item, idx) => {
                      const actualIdx = readFieldValues.findIndex(v => v === item);
                      const maxCount = readFieldValues[0]?.count || 1;
                      const percentage = Math.round((item.count / maxCount) * 100);

                      return (
                        <div
                          key={actualIdx}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            padding: '8px 12px',
                            borderBottom: `1px solid ${C.border}`,
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={item.isSelected}
                            onChange={() => toggleValueSelection(actualIdx)}
                            style={{ marginRight: 12 }}
                          />

                          {renamingIndex === actualIdx ? (
                            <div style={{ flex: 1, display: 'flex', gap: 8 }}>
                              <input
                                type="text"
                                defaultValue={item.value}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    renameValueAtIndex(actualIdx, e.currentTarget.value);
                                    setRenamingIndex(null);
                                  } else if (e.key === 'Escape') {
                                    setRenamingIndex(null);
                                  }
                                }}
                                style={{
                                  flex: 1,
                                  padding: '4px 8px',
                                  fontSize: 13,
                                  background: C.surface,
                                  border: `1px solid ${C.border}`,
                                  color: C.text,
                                  fontFamily: F.sans,
                                }}
                                autoFocus
                              />
                              <button
                                onClick={() => {
                                  const input = document.querySelector('input[type="text"]:focus') as HTMLInputElement;
                                  if (input) {
                                    renameValueAtIndex(actualIdx, input.value);
                                  }
                                  setRenamingIndex(null);
                                }}
                                style={{ padding: '4px 8px', fontSize: 11 }}
                              >
                                Save
                              </button>
                              <button
                                onClick={() => setRenamingIndex(null)}
                                style={{ padding: '4px 8px', fontSize: 11 }}
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <div style={{ flex: 1, fontSize: 13, color: item.isSelected ? C.text : C.text3 }}>
                              {item.value}
                            </div>
                          )}

                          <div style={{ fontSize: 12, color: C.text3, marginRight: 12, width: 40, textAlign: 'right' }}>
                            {item.count}
                          </div>

                          <div style={{ width: 120, height: 8, background: C.border, borderRadius: 2, marginRight: 12 }}>
                            <div
                              style={{
                                width: `${percentage}%`,
                                height: '100%',
                                background: '#2E6BA8',
                                borderRadius: 2,
                              }}
                            />
                          </div>

                          <div style={{ fontSize: 11, color: C.text3, width: 40, textAlign: 'right' }}>
                            {percentage}%
                          </div>

                          {!renamingIndex && (
                            <button
                              onClick={() => setRenamingIndex(actualIdx)}
                              style={{
                                marginLeft: 12,
                                fontSize: 11,
                                padding: '4px 8px',
                                background: 'transparent',
                                border: `1px solid ${C.border}`,
                                color: C.text,
                                cursor: 'pointer',
                                fontFamily: F.sans,
                              }}
                            >
                              rename
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Suspect section */}
                  {showSuspects && readFieldValues.some(v => v.isSuspect) && (
                    <>
                      <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 16, marginBottom: 8 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: C.text3, marginBottom: 12 }}>
                          SUSPECTS (low frequency, possible typos)
                        </div>
                      </div>
                      <div style={{ maxHeight: 200, overflowY: 'auto', border: `1px solid ${C.border}` }}>
                        {readFieldValues.filter(v => v.isSuspect).map((item) => {
                          const actualIdx = readFieldValues.findIndex(v => v === item);
                          const maxCount = readFieldValues[0]?.count || 1;
                          const percentage = Math.round((item.count / maxCount) * 100);

                          return (
                            <div
                              key={actualIdx}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                padding: '8px 12px',
                                borderBottom: `1px solid ${C.border}`,
                                opacity: 0.6,
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={item.isSelected}
                                onChange={() => toggleValueSelection(actualIdx)}
                                style={{ marginRight: 12 }}
                              />
                              <div style={{ flex: 1, fontSize: 13, color: C.text3 }}>
                                {item.value}
                              </div>
                              <div style={{ fontSize: 12, color: C.text3, marginRight: 12, width: 40, textAlign: 'right' }}>
                                {item.count}
                              </div>
                              <div style={{ width: 120, height: 8, background: C.border, borderRadius: 2, marginRight: 12 }}>
                                <div
                                  style={{
                                    width: `${percentage}%`,
                                    height: '100%',
                                    background: '#2E6BA8',
                                    borderRadius: 2,
                                  }}
                                />
                              </div>
                              <div style={{ fontSize: 11, color: C.text3, width: 40, textAlign: 'right' }}>
                                {percentage}%
                              </div>
                              <div style={{ width: 65, marginLeft: 12 }} /> {/* Spacer for rename button */}
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              )}

              {valueSource === 'blank' && (
                <>
                  <div style={{ fontSize: 13, color: C.text3, marginBottom: 24 }}>
                    Starting with blank canonical values
                  </div>

                  <div style={{
                    background: C.surface,
                    border: `1px solid ${C.border}`,
                    padding: '24px',
                    textAlign: 'center',
                  }}>
                    <div style={{ fontSize: 13, color: C.text2, marginBottom: 8 }}>
                      No pre-loaded canonical values
                    </div>
                    <div style={{ fontSize: 12, color: C.text3 }}>
                      Refyne will suggest mappings as it encounters new values during normalization
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Screen 5: Activated */}
          {currentStep === 5 && (
            <div style={{ textAlign: 'center', paddingTop: 40 }}>
              <div style={{
                width: 64,
                height: 64,
                borderRadius: '50%',
                background: C.greenDim,
                border: `1px solid ${C.greenBrd}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 24px',
              }}>
                <Check size={32} color={C.green} strokeWidth={2.5} />
              </div>

              <h3 style={{ fontSize: 18, fontWeight: 600, color: C.text, marginBottom: 24 }}>
                Taxonomy classifier active
              </h3>

              <div style={{ fontSize: 13, color: C.text2, marginBottom: 32, maxWidth: 400, margin: '0 auto 32px' }}>
                <div style={{ marginBottom: 8 }}>
                  <strong>Harmony:</strong> {harmonyId}
                </div>
                <div style={{ marginBottom: 8 }}>
                  <strong>Source field:</strong> {sourceFieldLabel}
                </div>
                <div style={{ marginBottom: 8 }}>
                  <strong>Target field:</strong> {targetFieldLabel}
                </div>
                {selectedPack && (
                  <div style={{ marginBottom: 8 }}>
                    <strong>Pack:</strong> {selectedPack.name} ({packEntries.length} mappings)
                  </div>
                )}
              </div>

              {valueSource === 'pack' && (
                <>
                  <div style={{ marginBottom: 24, fontSize: 13, color: C.text3 }}>
                    <h4 style={{ fontSize: 13, fontWeight: 600, color: C.text2, marginBottom: 12 }}>
                      NEXT STEPS
                    </h4>
                    <div style={{ marginBottom: 8 }}>
                      1. Run normalize to classify existing companies
                    </div>
                    <div>
                      2. Refyne will scan for unmapped values and suggest new mappings automatically
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                    <button
                      onClick={() => {
                        router.push('/normalize');
                        onClose();
                      }}
                      style={{
                        padding: '10px 20px',
                        background: C.indigo,
                        border: 'none',
                        color: '#fff',
                        fontSize: 14,
                        fontWeight: 500,
                        cursor: 'pointer',
                        fontFamily: F.sans,
                      }}
                    >
                      Run normalize now
                    </button>
                    <button
                      onClick={onClose}
                      style={{
                        padding: '10px 20px',
                        background: 'transparent',
                        border: `1px solid ${C.border}`,
                        color: C.text,
                        fontSize: 14,
                        cursor: 'pointer',
                        fontFamily: F.sans,
                      }}
                    >
                      Done
                    </button>
                  </div>
                </>
              )}

              {valueSource === 'field' && (
                <>
                  <div style={{ marginBottom: 8 }}>
                    <span style={{ color: C.text3 }}>Canonicals:</span>{' '}
                    <span style={{ color: C.text }}>
                      {readFieldValues.filter(v => v.isSelected).length} values from your HubSpot field
                    </span>
                  </div>
                  <div style={{ marginBottom: 24 }}>
                    <span style={{ color: C.text3 }}>Mappings:</span>{' '}
                    <span style={{ color: C.text }}>0 (Refyne is scanning now)</span>
                  </div>

                  <div style={{
                    padding: 24,
                    background: C.surface,
                    border: `1px solid ${C.border}`,
                    marginBottom: 24,
                  }}>
                    <h4 style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 12 }}>
                      WHAT HAPPENS NEXT
                    </h4>
                    <div style={{ fontSize: 13, color: C.text2, lineHeight: 1.6 }}>
                      Refyne is scanning your HubSpot data for values that should map to your canonical list.
                      This takes 1-2 minutes for most portals.
                      <div style={{ marginTop: 12 }}>
                        Check the harmony detail page for suggestions.
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => router.push(`/harmonies/${harmonyId}`)}
                    style={{
                      padding: '10px 20px',
                      fontSize: 14,
                      cursor: 'pointer',
                      background: C.indigo,
                      border: 'none',
                      color: '#fff',
                      fontFamily: F.sans,
                    }}
                  >
                    View harmony + suggestions
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {currentStep < 5 && (
          <div style={{
            padding: '20px 32px',
            borderTop: `1px solid ${C.border}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <button
              onClick={() => {
                if (currentStep > 1) {
                  // Handle backward navigation with skip logic
                  let prevStep: WizardStep;
                  if (currentStep === 2.75) {
                    prevStep = 2.5;
                  } else if (currentStep === 2.5) {
                    prevStep = 2;
                  } else if (currentStep === 3 && transformType === 'format') {
                    prevStep = 2.75;
                  } else if (currentStep === 3 && transformType === 'lookup') {
                    prevStep = 2.5;
                  } else if (currentStep === 4) {
                    prevStep = 3;
                  } else if (currentStep === 5 && transformType === 'format') {
                    prevStep = 2.75;
                  } else if (currentStep === 5 && transformType === 'lookup') {
                    prevStep = 4;
                  } else {
                    prevStep = (currentStep - 1) as WizardStep;
                  }
                  setCurrentStep(prevStep);
                }
              }}
              disabled={currentStep === 1}
              style={{
                padding: '10px 20px',
                background: 'transparent',
                border: `1px solid ${C.border}`,
                color: currentStep === 1 ? C.text3 : C.text,
                fontSize: 14,
                cursor: currentStep === 1 ? 'not-allowed' : 'pointer',
                fontFamily: F.sans,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <ChevronLeft size={16} />
              Back
            </button>

            <button
              onClick={async () => {
                // Handle next navigation with skip logic
                if (currentStep === 2) {
                  setCurrentStep(2.5);
                } else if (currentStep === 2.5) {
                  if (transformType === 'format') {
                    setCurrentStep(2.75);
                  } else if (transformType === 'lookup') {
                    setCurrentStep(3);
                  }
                } else if (currentStep === 2.75) {
                  // Format function flow: skip to activation
                  handleActivate();
                } else if (currentStep === 3 && valueSource === 'field' && readFromField) {
                  // Intercept Screen 3 → Screen 4 transition for field flow
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

                    // Initialize with all non-suspects selected
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

                    setCurrentStep(4 as WizardStep);
                  } catch (error) {
                    console.error('Failed to read field values:', error);
                    addToast('error', 'Failed to read field values from HubSpot');
                  } finally {
                    setLoadingFieldValues(false);
                  }
                  return;
                } else if (currentStep === 3) {
                  setCurrentStep(4);
                } else if (currentStep === 4) {
                  handleActivate();
                } else if (canProceed()) {
                  setCurrentStep((currentStep + 1) as WizardStep);
                }
              }}
              disabled={!canProceed() || ((currentStep === 4 || currentStep === 2.75) && activating)}
              style={{
                padding: '10px 20px',
                background: canProceed() && !((currentStep === 4 || currentStep === 2.75) && activating) ? C.indigo : C.hover,
                border: 'none',
                color: canProceed() && !((currentStep === 4 || currentStep === 2.75) && activating) ? '#fff' : C.text3,
                fontSize: 14,
                fontWeight: 500,
                cursor: canProceed() && !((currentStep === 4 || currentStep === 2.75) && activating) ? 'pointer' : 'not-allowed',
                fontFamily: F.sans,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              {(currentStep === 4 || currentStep === 2.75) ? (activating ? 'Activating...' : 'Activate') : 'Next'}
              {currentStep < 4 && currentStep !== 2.75 && <ChevronRight size={16} />}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
