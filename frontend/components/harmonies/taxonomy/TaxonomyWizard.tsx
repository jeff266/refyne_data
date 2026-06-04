/** Taxonomy Wizard - Orchestrates five-screen wizard for activating taxonomy packs */
'use client';

import { useTaxonomyWizard } from './hooks/useTaxonomyWizard';
import { WizardShell } from './components/WizardShell';
import { Screen1ClassificationType } from './screens/Screen1ClassificationType';
import { Screen2FieldMapping } from './screens/Screen2FieldMapping';
import { Screen2p5TransformType } from './screens/Screen2p5TransformType';
import { Screen2p75FormatFunction } from './screens/Screen2p75FormatFunction';
import { Screen3ValueSource } from './screens/Screen3ValueSource';
import { Screen4ReviewMappings } from './screens/Screen4ReviewMappings';
import { Screen5Activated } from './screens/Screen5Activated';

interface TaxonomyWizardProps {
  onClose: () => void;
}

export function TaxonomyWizard({ onClose }: TaxonomyWizardProps) {
  const w = useTaxonomyWizard();
  const setFieldPair = (setName: (n: string) => void, setLabel: (l: string) => void) =>
    (name: string, label: string) => { setName(name); setLabel(label); };

  return (
    <WizardShell
      currentStep={w.currentStep}
      canProceed={w.canProceed()}
      activating={w.activating}
      onBack={w.handleBack}
      onNext={w.handleNext}
      onClose={onClose}
    >
      {w.currentStep === 1 && (
        <Screen1ClassificationType classificationType={w.classificationType} onSelect={w.setClassificationType} />
      )}
      {w.currentStep === 2 && (
        <Screen2FieldMapping
          sourceField={w.sourceField}
          sourceFieldLabel={w.sourceFieldLabel}
          targetField={w.targetField}
          targetFieldLabel={w.targetFieldLabel}
          createNewField={w.createNewField}
          writePolicy={w.writePolicy}
          onSourceChange={setFieldPair(w.setSourceField, w.setSourceFieldLabel)}
          onTargetChange={setFieldPair(w.setTargetField, w.setTargetFieldLabel)}
          onCreateNewFieldChange={w.setCreateNewField}
          onTargetFieldChange={w.setTargetField}
          onWritePolicyChange={w.setWritePolicy}
        />
      )}
      {w.currentStep === 2.5 && (
        <Screen2p5TransformType transformType={w.transformType} onSelect={w.setTransformType} />
      )}
      {w.currentStep === 2.75 && (
        <Screen2p75FormatFunction selectedFormatFunction={w.selectedFormatFunction} onSelect={w.setSelectedFormatFunction} />
      )}
      {w.currentStep === 3 && (
        <Screen3ValueSource
          valueSource={w.valueSource}
          packs={w.packs}
          selectedPack={w.selectedPack}
          loadingPacks={w.loadingPacks}
          readFromField={w.readFromField}
          readFromFieldLabel={w.readFromFieldLabel}
          onValueSourceChange={w.setValueSource}
          onPackSelect={w.setSelectedPack}
          onReadFromFieldChange={setFieldPair(w.setReadFromField, w.setReadFromFieldLabel)}
        />
      )}
      {w.currentStep === 4 && (
        <Screen4ReviewMappings
          valueSource={w.valueSource}
          selectedPackName={w.selectedPack?.name}
          packEntries={w.packEntries}
          groupedEntries={w.groupedEntries}
          readFromFieldLabel={w.readFromFieldLabel}
          readFieldValues={w.readFieldValues}
          readFieldMetadata={w.readFieldMetadata}
          showSuspects={w.showSuspects}
          renamingIndex={w.renamingIndex}
          onToggleSelection={w.toggleValueSelection}
          onRename={w.renameValueAtIndex}
          onShowSuspectsToggle={() => w.setShowSuspects(!w.showSuspects)}
          onSelectAll={() => w.setReadFieldValues(vals => vals.map(v => ({ ...v, isSelected: true })))}
          onDeselectAll={() => w.setReadFieldValues(vals => vals.map(v => ({ ...v, isSelected: false })))}
          onRenamingIndexChange={w.setRenamingIndex}
        />
      )}
      {w.currentStep === 5 && (
        <Screen5Activated
          harmonyId={w.harmonyId}
          sourceFieldLabel={w.sourceFieldLabel}
          targetFieldLabel={w.targetFieldLabel}
          valueSource={w.valueSource}
          selectedPack={w.selectedPack}
          packEntriesCount={w.packEntries.length}
          readFieldValues={w.readFieldValues}
          onClose={onClose}
          onNavigateToNormalize={() => { w.router.push('/normalize'); onClose(); }}
          onNavigateToHarmony={() => w.router.push(`/harmonies/${w.harmonyId}`)}
        />
      )}
    </WizardShell>
  );
}
