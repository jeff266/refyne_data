/**
 * WizardShell Component
 *
 * Provides the modal wrapper, header, progress indicator, and navigation buttons
 * for the taxonomy wizard.
 */

'use client';

import { ReactNode } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { C, F } from '@/lib/design-tokens';
import type { WizardStep } from '../hooks/useTaxonomyWizard';

interface WizardShellProps {
  currentStep: WizardStep;
  canProceed: boolean;
  activating: boolean;
  onBack: () => void;
  onNext: () => void;
  onClose: () => void;
  children: ReactNode;
}

export function WizardShell({
  currentStep,
  canProceed,
  activating,
  onBack,
  onNext,
  onClose,
  children,
}: WizardShellProps) {
  const showFooter = currentStep < 5;
  const isActivateStep = currentStep === 4 || currentStep === 2.75 || currentStep === 3.75;

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
              Step {currentStep >= 3.5 && currentStep < 4 ? 3 : Math.floor(currentStep)} of 5
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
          {children}
        </div>

        {/* Footer */}
        {showFooter && (
          <div style={{
            padding: '20px 32px',
            borderTop: `1px solid ${C.border}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <button
              onClick={onBack}
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
              onClick={onNext}
              disabled={!canProceed || (isActivateStep && activating)}
              style={{
                padding: '10px 20px',
                background: canProceed && !(isActivateStep && activating) ? C.indigo : C.hover,
                border: 'none',
                color: canProceed && !(isActivateStep && activating) ? '#fff' : C.text3,
                fontSize: 14,
                fontWeight: 500,
                cursor: canProceed && !(isActivateStep && activating) ? 'pointer' : 'not-allowed',
                fontFamily: F.sans,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              {isActivateStep ? (activating ? 'Activating...' : 'Activate') : 'Next'}
              {currentStep < 4 && currentStep !== 2.75 && currentStep !== 3.75 && <ChevronRight size={16} />}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
