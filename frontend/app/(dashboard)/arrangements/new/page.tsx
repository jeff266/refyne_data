'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { ChevronLeft, ChevronRight, Check, Sparkles } from 'lucide-react';
import { C, F } from '@/lib/design-tokens';
import { PrimaryBtn } from '@/components/refyne';
import { addToast } from '@/components/ui/toast';
import { RehearsalAISummary } from './RehearsalAISummary';
import { ArrangementWaterfallBuilder, FieldConfig, ProviderConnection } from '@/components/arrangements/ArrangementWaterfallBuilder';
import { ManageFieldsSlideOver } from '@/components/arrangements/ManageFieldsSlideOver';

type Step = 1 | 2 | 3 | 4 | 5;

interface ArrangementConfig {
  name: string;
  description: string;
  source_type: string;
  source_config: Record<string, unknown>;
  enrichment_steps: Array<{
    provider: string;
    fields: string[];
    order: number;
  }>;
  field_configs: FieldConfig[]; // v2: field-level waterfall
  output_destination: string;
  output_config: Record<string, unknown>;
}

export default function NewArrangementPage() {
  const router = useRouter();
  const { orgRole } = useAuth();
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [config, setConfig] = useState<Partial<ArrangementConfig>>({
    name: '',
    description: '',
    source_type: 'hubspot_list',
    source_config: {},
    enrichment_steps: [],
    field_configs: [],
    output_destination: 'hubspot',
    output_config: {},
  });
  const [rehearsalResults, setRehearsalResults] = useState<any>(null);
  const [readyToRun, setReadyToRun] = useState<boolean>(true);
  const [providers, setProviders] = useState<ProviderConnection[]>([
    { provider: 'refyne', connected: true, hasError: false }, // Always available
  ]);
  const [showManageFields, setShowManageFields] = useState(false);

  // Redirect viewers - they cannot create arrangements
  useEffect(() => {
    if (orgRole === 'org:viewer') {
      addToast('error', 'You need operator or admin access to create arrangements');
      router.push('/arrangements');
    }
  }, [orgRole, router]);

  // Load provider connections
  useEffect(() => {
    loadProviders();
  }, []);

  const loadProviders = async () => {
    try {
      const res = await fetch('/api/providers/connections');
      if (res.ok) {
        const { connections } = await res.json();
        setProviders([
          { provider: 'refyne', connected: true, hasError: false },
          ...connections.map((c: any) => ({
            provider: c.provider,
            connected: c.status === 'active',
            hasError: c.status === 'error',
          })),
        ]);
      }
    } catch (error) {
      console.error('Failed to load providers:', error);
      // Keep Refyne Data as fallback
    }
  };

  const handleNext = () => {
    if (currentStep < 5) {
      setCurrentStep((currentStep + 1) as Step);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((currentStep - 1) as Step);
    }
  };

  const handleRunRehearsal = async (mode: 'demo' | 'live') => {
    try {
      // First, create the arrangement
      const createResponse = await fetch('/api/arrangements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });

      if (!createResponse.ok) throw new Error('Failed to create arrangement');
      const { arrangement } = await createResponse.json();

      // Then run rehearsal
      const rehearseResponse = await fetch(`/api/arrangements/${arrangement.id}/rehearse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, sampleSize: 10 }),
      });

      if (!rehearseResponse.ok) throw new Error('Failed to start rehearsal');
      const data = await rehearseResponse.json();

      addToast('success', `${mode === 'demo' ? 'Demo' : 'Live'} rehearsal started`);
      setRehearsalResults(data);
      handleNext();
    } catch (error) {
      console.error('Failed to run rehearsal:', error);
      addToast('error', 'Failed to start rehearsal');
    }
  };

  const handleSave = async () => {
    try {
      const response = await fetch('/api/arrangements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });

      if (!response.ok) throw new Error('Failed to create arrangement');

      const { arrangement } = await response.json();

      addToast('success', 'Arrangement created successfully');
      router.push(`/arrangements/${arrangement.id}`);
    } catch (error) {
      console.error('Failed to create arrangement:', error);
      addToast('error', 'Failed to create arrangement');
    }
  };

  return (
    <div style={{ padding: 32, maxWidth: 800, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <button
          onClick={() => router.push('/arrangements')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 12px',
            background: 'transparent',
            border: 'none',
            color: C.text2,
            fontSize: 14,
            cursor: 'pointer',
            marginBottom: 16,
          }}
        >
          <ChevronLeft size={16} />
          Back to arrangements
        </button>
        <h1 style={{ fontSize: 24, fontWeight: 600, color: C.text, marginBottom: 4 }}>
          New Arrangement
        </h1>
        <p style={{ fontSize: 14, color: C.text3 }}>
          Build a waterfall · Rehearse · Run with confidence
        </p>
      </div>

      {/* Progress Steps */}
      <div style={{
        display: 'flex',
        gap: 8,
        marginBottom: 32,
      }}>
        {[1, 2, 3, 4, 5].map((step) => (
          <div
            key={step}
            style={{
              flex: 1,
              height: 4,
              background: step <= currentStep ? C.indigo : C.border,
              borderRadius: 2,
            }}
          />
        ))}
      </div>

      {/* Step Content */}
      <div style={{
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: 8,
        padding: 32,
        minHeight: 400,
      }}>
        {/* Step 1: Name & Description */}
        {currentStep === 1 && (
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 600, color: C.text, marginBottom: 24 }}>
              Step 1: Name Your Arrangement
            </h2>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 14, color: C.text2, marginBottom: 8 }}>
                Name
              </label>
              <input
                type="text"
                value={config.name}
                onChange={(e) => setConfig({ ...config, name: e.target.value })}
                placeholder="e.g., Enrich New Companies"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  background: C.bg,
                  border: `1px solid ${C.border}`,
                  borderRadius: 6,
                  color: C.text,
                  fontSize: 14,
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 14, color: C.text2, marginBottom: 8 }}>
                Description (optional)
              </label>
              <textarea
                value={config.description}
                onChange={(e) => setConfig({ ...config, description: e.target.value })}
                placeholder="Describe what this arrangement does..."
                rows={3}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  background: C.bg,
                  border: `1px solid ${C.border}`,
                  borderRadius: 6,
                  color: C.text,
                  fontSize: 14,
                  resize: 'vertical',
                }}
              />
            </div>
          </div>
        )}

        {/* Step 2: Select Source */}
        {currentStep === 2 && (
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 600, color: C.text, marginBottom: 24 }}>
              Step 2: Select Data Source
            </h2>
            <div style={{ display: 'grid', gap: 12 }}>
              {['hubspot_list', 'hubspot_filter', 'csv_upload', 'manual'].map((type) => (
                <button
                  key={type}
                  onClick={() => setConfig({ ...config, source_type: type, source_config: {} })}
                  style={{
                    padding: 16,
                    background: config.source_type === type ? C.indigoDim : C.bg,
                    border: `1px solid ${config.source_type === type ? C.indigoBrd : C.border}`,
                    borderRadius: 6,
                    color: C.text,
                    fontSize: 14,
                    textAlign: 'left',
                    cursor: 'pointer',
                  }}
                >
                  {type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 3: Configure Enrichment (v2 waterfall builder) */}
        {currentStep === 3 && (
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 600, color: C.text, marginBottom: 8 }}>
              Step 3: Build Your Waterfall
            </h2>
            <p style={{ fontSize: 14, color: C.text3, marginBottom: 24 }}>
              Configure field-level provider chains. Each field gets its own waterfall.
            </p>

            <ArrangementWaterfallBuilder
              value={config.field_configs || []}
              onChange={(fieldConfigs) => setConfig({ ...config, field_configs: fieldConfigs })}
              providers={providers}
              onManageFields={() => setShowManageFields(true)}
            />
          </div>
        )}

        {/* Step 4: Rehearsal */}
        {currentStep === 4 && (
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 600, color: C.text, marginBottom: 24 }}>
              Step 4: Test Your Arrangement
            </h2>
            <p style={{ fontSize: 14, color: C.text2, marginBottom: 24 }}>
              Run a rehearsal to test your arrangement on sample data before running it on all records.
            </p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={() => handleRunRehearsal('demo')}
                style={{
                  flex: 1,
                  padding: 16,
                  background: C.hover,
                  border: `1px solid ${C.border}`,
                  borderRadius: 6,
                  color: C.text,
                  fontSize: 14,
                  cursor: 'pointer',
                }}
              >
                Demo Rehearsal (Free)
              </button>
              <button
                onClick={() => handleRunRehearsal('live')}
                style={{
                  flex: 1,
                  padding: 16,
                  background: C.indigoDim,
                  border: `1px solid ${C.indigoBrd}`,
                  borderRadius: 6,
                  color: C.text,
                  fontSize: 14,
                  cursor: 'pointer',
                }}
              >
                Live Rehearsal (Uses Credits)
              </button>
            </div>
            {rehearsalResults && (
              <>
                <div style={{
                  marginTop: 24,
                  padding: 16,
                  background: C.greenDim,
                  border: `1px solid ${C.greenBrd}`,
                  borderRadius: 6,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <Sparkles size={16} color={C.green} />
                    <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>
                      Rehearsal Complete
                    </span>
                  </div>
                  <p style={{ fontSize: 13, color: C.text2 }}>
                    Successfully tested on {rehearsalResults.sampleSize} records.
                    Estimated credits per run: {rehearsalResults.estimatedCredits}
                  </p>
                </div>
                {rehearsalResults.runId && (
                  <RehearsalAISummary
                    runId={rehearsalResults.runId}
                    onReadyStateChange={setReadyToRun}
                  />
                )}
              </>
            )}
          </div>
        )}

        {/* Step 5: Review & Save */}
        {currentStep === 5 && (
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 600, color: C.text, marginBottom: 24 }}>
              Step 5: Review & Save
            </h2>
            <div style={{ display: 'grid', gap: 16 }}>
              <div>
                <label style={{ fontSize: 12, color: C.text3, textTransform: 'uppercase' }}>
                  Name
                </label>
                <p style={{ fontSize: 14, color: C.text }}>{config.name}</p>
              </div>
              <div>
                <label style={{ fontSize: 12, color: C.text3, textTransform: 'uppercase' }}>
                  Source
                </label>
                <p style={{ fontSize: 14, color: C.text }}>
                  {config.source_type?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </p>
              </div>
              <div>
                <label style={{ fontSize: 12, color: C.text3, textTransform: 'uppercase' }}>
                  Enrichment Steps
                </label>
                <p style={{ fontSize: 14, color: C.text }}>
                  {config.enrichment_steps?.length || 0} step(s) configured
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        marginTop: 24,
      }}>
        <button
          onClick={handleBack}
          disabled={currentStep === 1}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '10px 20px',
            background: C.hover,
            border: `1px solid ${C.border}`,
            borderRadius: 6,
            color: currentStep === 1 ? C.text3 : C.text,
            fontSize: 14,
            cursor: currentStep === 1 ? 'not-allowed' : 'pointer',
          }}
        >
          <ChevronLeft size={16} />
          Back
        </button>

        {currentStep < 5 ? (
          <div style={{ position: 'relative' }}>
            <div
              style={{
                opacity: currentStep === 4 && !readyToRun ? 0.5 : 1,
                cursor: currentStep === 4 && !readyToRun ? 'not-allowed' : 'pointer',
                background: currentStep === 4 && readyToRun ? C.green : C.indigo,
                pointerEvents: currentStep === 4 && !readyToRun ? 'none' : 'auto',
                borderRadius: 6,
                display: 'inline-block',
              }}
            >
              <PrimaryBtn onClick={handleNext}>
                Next
                <ChevronRight size={16} />
              </PrimaryBtn>
            </div>
            {currentStep === 4 && !readyToRun && (
              <div
                style={{
                  position: 'absolute',
                  bottom: '100%',
                  right: 0,
                  marginBottom: 8,
                  padding: '6px 10px',
                  background: C.surface,
                  border: `1px solid ${C.border}`,
                  borderRadius: 6,
                  fontSize: 11,
                  color: C.text3,
                  whiteSpace: 'nowrap',
                }}
              >
                Review AI recommendations before proceeding
              </div>
            )}
          </div>
        ) : (
          <PrimaryBtn onClick={handleSave}>
            <Check size={16} />
            Save Arrangement
          </PrimaryBtn>
        )}
      </div>

      {/* Manage Fields Slide-Over */}
      {showManageFields && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setShowManageFields(false)}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.5)',
              zIndex: 9998,
            }}
          />
          <ManageFieldsSlideOver
            open={showManageFields}
            onClose={() => setShowManageFields(false)}
            currentFields={config.field_configs || []}
            onSave={(fields) => {
              setConfig({ ...config, field_configs: fields });
              setShowManageFields(false);
            }}
          />
        </>
      )}
    </div>
  );
}
