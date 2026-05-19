'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, Check, Sparkles } from 'lucide-react';
import { C, F } from '@/lib/design-tokens';
import { PrimaryBtn } from '@/components/refyne';
import { addToast } from '@/components/ui/toast';

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
  output_destination: string;
  output_config: Record<string, unknown>;
}

export default function NewArrangementPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [config, setConfig] = useState<Partial<ArrangementConfig>>({
    name: '',
    description: '',
    source_type: 'hubspot_list',
    source_config: {},
    enrichment_steps: [],
    output_destination: 'hubspot',
    output_config: {},
  });
  const [rehearsalResults, setRehearsalResults] = useState<any>(null);

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

      addToast('success', 'Arrangement created successfully');
      router.push('/arrangements');
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
        <h1 style={{ fontSize: 24, fontWeight: 600, color: C.text }}>
          New Arrangement
        </h1>
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

        {/* Step 3: Configure Enrichment */}
        {currentStep === 3 && (
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 600, color: C.text, marginBottom: 24 }}>
              Step 3: Configure Enrichment
            </h2>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 14, color: C.text2, marginBottom: 8 }}>
                Provider
              </label>
              <select
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  background: C.bg,
                  border: `1px solid ${C.border}`,
                  borderRadius: 6,
                  color: C.text,
                  fontSize: 14,
                }}
              >
                <option value="apollo">Apollo</option>
                <option value="zoominfo">ZoomInfo</option>
                <option value="clearbit">Clearbit</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 14, color: C.text2, marginBottom: 8 }}>
                Fields to Enrich
              </label>
              <div style={{ display: 'grid', gap: 8 }}>
                {['domain', 'employee_count', 'industry', 'revenue', 'phone'].map((field) => (
                  <label
                    key={field}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: 12,
                      background: C.bg,
                      border: `1px solid ${C.border}`,
                      borderRadius: 6,
                      cursor: 'pointer',
                    }}
                  >
                    <input type="checkbox" />
                    <span style={{ fontSize: 14, color: C.text }}>
                      {field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </span>
                  </label>
                ))}
              </div>
            </div>
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
          <PrimaryBtn onClick={handleNext}>
            Next
            <ChevronRight size={16} />
          </PrimaryBtn>
        ) : (
          <PrimaryBtn onClick={handleSave}>
            <Check size={16} />
            Save Arrangement
          </PrimaryBtn>
        )}
      </div>
    </div>
  );
}
