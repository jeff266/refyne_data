/**
 * Screen 5: Activation Success
 *
 * Shows confirmation that taxonomy has been activated with next steps.
 */

'use client';

import { Check } from 'lucide-react';
import { C, F } from '@/lib/design-tokens';
import type { Pack, ReadFieldValue } from '../hooks/useTaxonomyWizard';

interface Screen5Props {
  harmonyId: string;
  sourceFieldLabel: string;
  targetFieldLabel: string;
  valueSource: 'pack' | 'field' | 'blank';
  selectedPack: Pack | null;
  packEntriesCount: number;
  readFieldValues: ReadFieldValue[];
  onClose: () => void;
  onNavigateToNormalize: () => void;
  onNavigateToHarmony: () => void;
}

export function Screen5Activated({
  harmonyId,
  sourceFieldLabel,
  targetFieldLabel,
  valueSource,
  selectedPack,
  packEntriesCount,
  readFieldValues,
  onClose,
  onNavigateToNormalize,
  onNavigateToHarmony,
}: Screen5Props) {
  return (
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
            <strong>Pack:</strong> {selectedPack.name} ({packEntriesCount} mappings)
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
              onClick={onNavigateToNormalize}
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
            onClick={onNavigateToHarmony}
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
  );
}
