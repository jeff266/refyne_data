'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { C, F } from '@/lib/design-tokens';
import { useRole } from '@/hooks/useRole';
// import { normalizeCompanyName } from '@/lib/names/normalizer'; // REMOVED: server-only import causes client-side crash
import { SearchableCountrySelect } from '@/components/SearchableCountrySelect';

// Force dynamic rendering for useSearchParams()
export const dynamic = 'force-dynamic';

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

type StepId =
  | 'mode'
  | 'phone'
  | 'company'
  | 'url'
  | 'country'
  | 'state'
  | 'industry'
  | 'employee_count'
  | 'linkedin'
  | 'dedup'
  | 'summary';

interface SampleData {
  names: string[];
  phones: string[];
  urls: string[];
  countries: string[];
  states: string[];
  industries: string[];
  employee_counts: string[];
  linkedin_urls: string[];
  has_phones: boolean;
  has_urls: boolean;
  has_countries: boolean;
  has_states: boolean;
  has_industries: boolean;
  has_employee_counts: boolean;
  has_linkedin_urls: boolean;
}

interface CalibrationAnswers {
  normalization_mode: 'implicit' | 'explicit';
  phone: {
    format: 'e164_international' | 'national' | 'e164_compact' | 'e164_formatted' | 'e164_dashes' | 'e164_spaces';
    default_country_code: string;
  };
  company_name: {
    casing: 'title' | 'upper' | 'preserve';
    suffix_treatment: 'expand' | 'abbreviate' | 'remove' | 'preserve';
  };
  url: {
    format: 'canonical_no_www' | 'canonical_www' | 'domain_only';
    strip_paths: boolean;
  };
  country: {
    format: 'full_name' | 'iso2' | 'iso3';
  };
  state: {
    format: 'full_name' | 'abbreviation';
  };
  industry?: {
    normalize: boolean;
    target: 'hubspot_standard' | null;
  };
  employee_count?: {
    format: 'range' | 'exact' | 'preserve';
  };
  linkedin?: {
    normalize: boolean;
  };
}

// ─────────────────────────────────────────────────────────────
// Reusable Components
// ─────────────────────────────────────────────────────────────

interface OptionCardProps {
  selected: boolean;
  onClick: () => void;
  title: string;
  description: string;
  badge?: string;
  example?: string;
}

function OptionCard({ selected, onClick, title, description, badge, example }: OptionCardProps) {
  return (
    <div
      onClick={onClick}
      style={{
        padding: 16,
        border: selected ? `2px solid ${C.indigo}` : `1px solid ${C.border2}`,
        borderLeft: selected ? `4px solid ${C.indigo}` : `1px solid ${C.border2}`,
        background: selected ? C.hover : C.surface,
        cursor: 'pointer',
        marginBottom: 12,
        transition: 'all 0.15s ease',
      }}
      onMouseEnter={(e) => {
        if (!selected) {
          e.currentTarget.style.background = C.hover;
          e.currentTarget.style.borderColor = C.border;
        }
      }}
      onMouseLeave={(e) => {
        if (!selected) {
          e.currentTarget.style.background = C.surface;
          e.currentTarget.style.borderColor = C.border2;
        }
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <div
          style={{
            width: 16,
            height: 16,
            border: `2px solid ${selected ? C.indigo : C.border2}`,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {selected && (
            <div
              style={{
                width: 8,
                height: 8,
                background: C.indigo,
                borderRadius: '50%',
              }}
            />
          )}
        </div>
        <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{title}</span>
        {badge && (
          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              color: C.indigo,
              background: C.indigoDim,
              border: `1px solid ${C.indigoBrd}`,
              padding: '2px 8px',
            }}
          >
            {badge}
          </span>
        )}
      </div>
      <div style={{ fontSize: 12, color: C.text3, marginLeft: 24, lineHeight: 1.5 }}>
        {description}
      </div>
      {example && (
        <div
          style={{
            fontSize: 11,
            fontFamily: F.mono,
            color: C.text2,
            marginLeft: 24,
            marginTop: 6,
            padding: '4px 8px',
            background: C.bg,
            display: 'inline-block',
          }}
        >
          {example}
        </div>
      )}
    </div>
  );
}

interface ProgressDotsProps {
  current: number;
  total: number;
}

function ProgressDots({ current, total }: ProgressDotsProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 32 }}>
      <span style={{ fontSize: 12, color: C.text3, fontWeight: 500 }}>
        Step {current + 1} of {total}
      </span>
      <div style={{ display: 'flex', gap: 4 }}>
        {Array.from({ length: total }).map((_, i) => (
          <div
            key={i}
            style={{
              width: 8,
              height: 8,
              background: i <= current ? C.indigo : C.border2,
            }}
          />
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────

const DEDUP_EXPLAINER_VIDEO_URL = '';

function CalibratePageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isRecalibrate = searchParams.get('mode') === 'recalibrate';
  const { isAdmin } = useRole();

  const [currentStep, setCurrentStep] = useState(0);
  const [steps, setSteps] = useState<StepId[]>([]);
  const [sampleData, setSampleData] = useState<SampleData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitProgress, setSubmitProgress] = useState<
    'configuring' | 'activating' | 'preparing' | 'done'
  >('configuring');
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [answers, setAnswers] = useState<CalibrationAnswers>({
    normalization_mode: 'implicit',
    phone: {
      format: 'e164_international',
      default_country_code: '1',
    },
    company_name: {
      casing: 'title',
      suffix_treatment: 'abbreviate',
    },
    url: {
      format: 'canonical_no_www',
      strip_paths: true,
    },
    country: {
      format: 'iso2',
    },
    state: {
      format: 'abbreviation',
    },
  });

  const [companyNamePreviews, setCompanyNamePreviews] = useState<
    Array<{ before: string; after: string }>
  >([]);

  // Dedup calibration state
  const [dedupStatus, setDedupStatus] = useState<'scanning' | 'ready' | 'none' | 'summary'>('scanning');
  const [dedupSamples, setDedupSamples] = useState<any[]>([]);
  const [currentPairIndex, setCurrentPairIndex] = useState(0);
  const [dedupDecisions, setDedupDecisions] = useState<Map<string, any>>(new Map());

  // Log page mount
  useEffect(() => {
    console.log('[Calibrate Page] ========== PAGE MOUNTED ==========');
    console.log('[Calibrate Page] URL:', window.location.href);
    console.log('[Calibrate Page] Search params:', window.location.search);
    console.log('[Calibrate Page] Hash:', window.location.hash);
    console.log('[Calibrate Page] =================================');
  }, []);

  // Fetch sample data and compute steps on mount
  useEffect(() => {
    async function loadData() {
      try {
        setIsLoading(true);

        // If recalibrate mode, fetch existing settings first
        if (isRecalibrate) {
          const settingsResponse = await fetch('/api/onboarding/calibration-settings');
          if (settingsResponse.ok) {
            const settings = await settingsResponse.json();
            setAnswers(settings);
          }
        }

        // Fetch sample data
        const response = await fetch('/api/onboarding/sample-data');
        if (!response.ok) {
          throw new Error('Failed to fetch sample data');
        }

        const data: SampleData = await response.json();
        setSampleData(data);

        // Compute steps based on has_* flags
        const computedSteps: StepId[] = [
          'mode',
          'phone',
          'company',
          'url',
          'country',
          'state',
        ];

        if (data.has_industries) {
          computedSteps.push('industry');
        }
        if (data.has_employee_counts) {
          computedSteps.push('employee_count');
        }
        if (data.has_linkedin_urls) {
          computedSteps.push('linkedin');
        }

        computedSteps.push('dedup');
        computedSteps.push('summary');
        setSteps(computedSteps);
      } catch (err) {
        console.error('Failed to load sample data:', err);
        setError('Failed to load wizard. Please try again.');
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [isRecalibrate]);

  const handleBack = () => {
    if (currentStep === 0) {
      setShowExitConfirm(true);
    } else {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleContinue = async () => {
    if (currentStep === steps.length - 1) {
      // Final step - submit
      await handleSubmit();
    } else {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setSubmitProgress('configuring');

    try {
      // Simulate progress animation
      setTimeout(() => setSubmitProgress('activating'), 800);
      setTimeout(() => setSubmitProgress('preparing'), 1600);

      const response = await fetch('/api/onboarding/calibration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(answers),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save settings');
      }

      setSubmitProgress('done');

      // Wait for animation to complete
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Redirect to next step in onboarding flow
      router.push('/onboarding/first-run');
    } catch (err) {
      console.error('Failed to submit calibration:', err);
      setError(err instanceof Error ? err.message : 'Failed to save settings');
      setIsSubmitting(false);
    }
  };

  const handleSkip = async () => {
    try {
      // Mark calibration as complete with defaults
      await fetch('/api/onboarding/calibration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(answers), // Use defaults
      });

      router.push('/onboarding/first-run');
    } catch (err) {
      console.error('Failed to skip setup:', err);
    }
  };

  // Live preview for company names (Screen 2)
  // DISABLED: normalizeCompanyName imports server-only code, can't run on client
  useEffect(() => {
    // Skip preview generation - would need API route for this
    setCompanyNamePreviews([]);
    /*
    async function generatePreviews() {
      if (!sampleData || steps[currentStep] !== 'company') {
        setCompanyNamePreviews([]);
        return;
      }

      const namesToPreview = sampleData.names.slice(0, 3);
      const previews = await Promise.all(
        namesToPreview.map(async (name) => {
          const result = await normalizeCompanyName(name, {
            orgId: 'preview',
            suffixTreatment:
              answers.company_name.suffix_treatment === 'preserve'
                ? 'keep'
                : answers.company_name.suffix_treatment === 'remove'
                ? 'remove'
                : 'standardize',
            casingPreference:
              answers.company_name.casing === 'preserve'
                ? 'smart'
                : answers.company_name.casing,
          });
          return { before: name, after: result.output };
        })
      );
      setCompanyNamePreviews(previews);
    }

    generatePreviews();
    */
  }, [sampleData, currentStep, steps, answers.company_name]);

  // Compute current step ID (must be before early returns to avoid hook order issues)
  const currentStepId = steps[currentStep];

  // Fetch dedup samples when dedup step is reached (must be before early returns)
  useEffect(() => {
    if (currentStepId === 'dedup' && isAdmin) {
      fetchDedupSamples();
    }
  }, [currentStepId, isAdmin]);

  if (isLoading) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          fontFamily: F.sans,
          color: C.text3,
        }}
      >
        Loading wizard...
      </div>
    );
  }

  if (error && !isSubmitting) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          fontFamily: F.sans,
          padding: 32,
        }}
      >
        <div style={{ fontSize: 16, color: C.red, marginBottom: 16 }}>{error}</div>
        <button
          onClick={() => window.location.reload()}
          style={{
            padding: '8px 16px',
            background: C.indigo,
            color: '#fff',
            border: 'none',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Try Again
        </button>
      </div>
    );
  }

  async function fetchDedupSamples() {
    try {
      setDedupStatus('scanning');
      const res = await fetch('/api/onboarding/dedup-sample');
      if (res.ok) {
        const data = await res.json();
        if (data.status === 'ready' && data.pairs.length > 0) {
          setDedupSamples(data.pairs);
          setDedupStatus('ready');
        } else if (data.status === 'none' || data.pairs.length === 0) {
          setDedupStatus('none');
        }
      }
    } catch (err) {
      console.error('Failed to fetch dedup samples:', err);
      setDedupStatus('none');
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: C.bg,
        fontFamily: F.sans,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <div style={{ width: '100%', maxWidth: 680 }}>
          {!isSubmitting && (
            <>
              <ProgressDots current={currentStep} total={steps.length} />

              {/* Screen 0: Mode */}
              {currentStepId === 'mode' && (
                <div>
                  <h1 style={{ fontSize: 28, fontFamily: 'Lora, serif', color: C.text, marginBottom: 32, fontWeight: 600 }}>
                    How should Refyne apply normalizations?
                  </h1>

                  <OptionCard
                    selected={answers.normalization_mode === 'implicit'}
                    onClick={() => setAnswers({ ...answers, normalization_mode: 'implicit' })}
                    title="Automatically"
                    description="Normalize records as they sync from HubSpot. Set it once and Refyne handles the rest."
                    badge="Recommended"
                  />

                  <OptionCard
                    selected={answers.normalization_mode === 'explicit'}
                    onClick={() => setAnswers({ ...answers, normalization_mode: 'explicit' })}
                    title="On demand"
                    description="Run normalizations manually when you're ready. Full control over when changes are applied."
                  />

                  {!isRecalibrate && (
                    <div style={{ marginTop: 24, textAlign: 'right' }}>
                      <button
                        onClick={handleSkip}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: C.text3,
                          fontSize: 12,
                          cursor: 'pointer',
                          textDecoration: 'underline',
                        }}
                      >
                        Skip setup
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Screen 1: Phone */}
              {currentStepId === 'phone' && sampleData && (
                <div>
                  <h1 style={{ fontSize: 28, fontFamily: 'Lora, serif', color: C.text, marginBottom: 16, fontWeight: 600 }}>
                    How should phone numbers be stored?
                  </h1>

                  <div style={{ marginBottom: 24 }}>
                    <div style={{ fontSize: 13, color: C.text3, marginBottom: 8 }}>
                      Examples from your HubSpot:
                    </div>
                    {sampleData.phones.slice(0, 5).map((phone, i) => (
                      <div key={i} style={{ fontSize: 12, fontFamily: F.mono, color: C.text2, marginBottom: 4 }}>
                        {phone}
                      </div>
                    ))}
                  </div>

                  <OptionCard
                    selected={answers.phone.format === 'e164_formatted'}
                    onClick={() =>
                      setAnswers({
                        ...answers,
                        phone: { ...answers.phone, format: 'e164_formatted' },
                      })
                    }
                    title="+1 (310) 387-9598"
                    description="International with formatting"
                    example="US: +1 (310) 387-9598 • UK: +44 7700 900123"
                    badge="Recommended"
                  />

                  <OptionCard
                    selected={answers.phone.format === 'e164_dashes'}
                    onClick={() =>
                      setAnswers({
                        ...answers,
                        phone: { ...answers.phone, format: 'e164_dashes' },
                      })
                    }
                    title="+1 310-387-9598"
                    description="International with dashes"
                    example="US: +1 310-387-9598 • UK: +44 7700-900123"
                  />

                  <OptionCard
                    selected={answers.phone.format === 'e164_spaces'}
                    onClick={() =>
                      setAnswers({
                        ...answers,
                        phone: { ...answers.phone, format: 'e164_spaces' },
                      })
                    }
                    title="+1 310 387 9598"
                    description="International with spaces"
                    example="US: +1 310 387 9598 • UK: +44 7700 900123"
                  />

                  <OptionCard
                    selected={answers.phone.format === 'e164_compact'}
                    onClick={() =>
                      setAnswers({
                        ...answers,
                        phone: { ...answers.phone, format: 'e164_compact' },
                      })
                    }
                    title="+13103879598"
                    description="E.164 compact"
                    example="US: +13103879598 • UK: +447700900123"
                  />

                  <OptionCard
                    selected={answers.phone.format === 'national'}
                    onClick={() =>
                      setAnswers({
                        ...answers,
                        phone: { ...answers.phone, format: 'national' },
                      })
                    }
                    title="(310) 387-9598"
                    description="National, no country code"
                    example="US: (310) 387-9598 • UK: 07700 900123 (not recommended for international)"
                  />

                  <div style={{ marginTop: 24, padding: 16, background: C.surface, border: `1px solid ${C.border}` }}>
                    <label style={{ display: 'block', fontSize: 12, color: C.text, marginBottom: 8 }}>
                      Primary country
                    </label>
                    <SearchableCountrySelect
                      value={answers.phone.default_country_code}
                      onChange={(code) =>
                        setAnswers({
                          ...answers,
                          phone: { ...answers.phone, default_country_code: code },
                        })
                      }
                      style={{ fontSize: 13 }}
                    />
                    <div style={{ fontSize: 11, color: C.text3, marginTop: 8, lineHeight: 1.5 }}>
                      Numbers already containing a country code (+44, +966, etc.) are preserved as-is. For numbers without a country code prefix, the default above is applied. If your data contains numbers from multiple countries without prefixes, consider normalizing them in HubSpot before importing.
                    </div>
                  </div>
                </div>
              )}

              {/* Screen 2: Company Names with Live Preview */}
              {currentStepId === 'company' && sampleData && (
                <div>
                  <h1 style={{ fontSize: 28, fontFamily: 'Lora, serif', color: C.text, marginBottom: 16, fontWeight: 600 }}>
                    How should company names be formatted?
                  </h1>

                  <div style={{ marginBottom: 24 }}>
                    <div style={{ fontSize: 13, color: C.text3, marginBottom: 8 }}>
                      Examples from your HubSpot:
                    </div>
                    {sampleData.names.slice(0, 6).map((name, i) => (
                      <div key={i} style={{ fontSize: 12, fontFamily: F.mono, color: C.text2, marginBottom: 4 }}>
                        {name}
                      </div>
                    ))}
                  </div>

                  <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 12 }}>
                    Formatting
                  </div>

                  <OptionCard
                    selected={answers.company_name.casing === 'title'}
                    onClick={() =>
                      setAnswers({
                        ...answers,
                        company_name: { ...answers.company_name, casing: 'title' },
                      })
                    }
                    title="Title Case"
                    description=""
                    example="Acme Corporation"
                    badge="Recommended"
                  />

                  <OptionCard
                    selected={answers.company_name.casing === 'upper'}
                    onClick={() =>
                      setAnswers({
                        ...answers,
                        company_name: { ...answers.company_name, casing: 'upper' },
                      })
                    }
                    title="UPPER CASE"
                    description=""
                    example="ACME CORPORATION"
                  />

                  <OptionCard
                    selected={answers.company_name.casing === 'preserve'}
                    onClick={() =>
                      setAnswers({
                        ...answers,
                        company_name: { ...answers.company_name, casing: 'preserve' },
                      })
                    }
                    title="Leave as-is"
                    description="No changes"
                  />

                  <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 12, marginTop: 24 }}>
                    Corporate suffixes
                  </div>

                  <OptionCard
                    selected={answers.company_name.suffix_treatment === 'abbreviate'}
                    onClick={() =>
                      setAnswers({
                        ...answers,
                        company_name: { ...answers.company_name, suffix_treatment: 'abbreviate' },
                      })
                    }
                    title="Abbreviate"
                    description=""
                    example="Acme Inc"
                    badge="Recommended"
                  />

                  <OptionCard
                    selected={answers.company_name.suffix_treatment === 'expand'}
                    onClick={() =>
                      setAnswers({
                        ...answers,
                        company_name: { ...answers.company_name, suffix_treatment: 'expand' },
                      })
                    }
                    title="Expand"
                    description=""
                    example="Acme Incorporated"
                  />

                  <OptionCard
                    selected={answers.company_name.suffix_treatment === 'remove'}
                    onClick={() =>
                      setAnswers({
                        ...answers,
                        company_name: { ...answers.company_name, suffix_treatment: 'remove' },
                      })
                    }
                    title="Remove"
                    description=""
                    example="Acme"
                  />

                  <OptionCard
                    selected={answers.company_name.suffix_treatment === 'preserve'}
                    onClick={() =>
                      setAnswers({
                        ...answers,
                        company_name: { ...answers.company_name, suffix_treatment: 'preserve' },
                      })
                    }
                    title="Leave as-is"
                    description="No changes"
                  />

                  {/* Live Preview */}
                  <div
                    style={{
                      marginTop: 32,
                      padding: 16,
                      background: C.surface,
                      border: `2px solid ${C.indigoBrd}`,
                    }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 12 }}>
                      LIVE PREVIEW
                    </div>
                    {companyNamePreviews.map((preview, i) => (
                      <div key={i} style={{ marginBottom: 8, fontSize: 12, fontFamily: F.mono }}>
                        <span style={{ color: C.text3 }}>{preview.before}</span>
                        <span style={{ color: C.text3, margin: '0 8px' }}>→</span>
                        <span style={{ color: C.indigo, fontWeight: 600 }}>{preview.after}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Screen 3: URLs */}
              {currentStepId === 'url' && sampleData && (
                <div>
                  <h1 style={{ fontSize: 28, fontFamily: 'Lora, serif', color: C.text, marginBottom: 16, fontWeight: 600 }}>
                    How should website URLs be stored?
                  </h1>

                  <div style={{ marginBottom: 24 }}>
                    <div style={{ fontSize: 13, color: C.text3, marginBottom: 8 }}>
                      Examples from your HubSpot:
                    </div>
                    {sampleData.urls.slice(0, 5).map((url, i) => (
                      <div key={i} style={{ fontSize: 12, fontFamily: F.mono, color: C.text2, marginBottom: 4 }}>
                        {url}
                      </div>
                    ))}
                  </div>

                  <OptionCard
                    selected={answers.url.format === 'canonical_no_www'}
                    onClick={() =>
                      setAnswers({
                        ...answers,
                        url: { ...answers.url, format: 'canonical_no_www' },
                      })
                    }
                    title="Clean canonical"
                    description="Recommended for most teams"
                    example="https://acme.com"
                  />

                  <OptionCard
                    selected={answers.url.format === 'canonical_www'}
                    onClick={() =>
                      setAnswers({
                        ...answers,
                        url: { ...answers.url, format: 'canonical_www' },
                      })
                    }
                    title="With www prefix"
                    description=""
                    example="https://www.acme.com"
                  />

                  <OptionCard
                    selected={answers.url.format === 'domain_only'}
                    onClick={() =>
                      setAnswers({
                        ...answers,
                        url: { ...answers.url, format: 'domain_only' },
                      })
                    }
                    title="Domain only"
                    description="Best for domain matching"
                    example="acme.com"
                  />

                  <div style={{ marginTop: 24, padding: 16, background: C.surface, border: `1px solid ${C.border}` }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={answers.url.strip_paths}
                        onChange={(e) =>
                          setAnswers({
                            ...answers,
                            url: { ...answers.url, strip_paths: e.target.checked },
                          })
                        }
                        style={{ cursor: 'pointer' }}
                      />
                      <span style={{ fontSize: 13, color: C.text }}>Strip URL paths</span>
                    </label>
                    <div style={{ fontSize: 11, color: C.text3, marginTop: 8, marginLeft: 24 }}>
                      acme.com/about → acme.com
                    </div>
                  </div>
                </div>
              )}

              {/* Screen 4: Country */}
              {currentStepId === 'country' && sampleData && (
                <div>
                  <h1 style={{ fontSize: 28, fontFamily: 'Lora, serif', color: C.text, marginBottom: 16, fontWeight: 600 }}>
                    How should countries be stored?
                  </h1>

                  <div style={{ marginBottom: 24 }}>
                    <div style={{ fontSize: 13, color: C.text3, marginBottom: 8 }}>
                      Examples from your HubSpot:
                    </div>
                    {sampleData.countries.slice(0, 5).map((country, i) => (
                      <div key={i} style={{ fontSize: 12, fontFamily: F.mono, color: C.text2, marginBottom: 4 }}>
                        {country}
                      </div>
                    ))}
                  </div>

                  <OptionCard
                    selected={answers.country.format === 'full_name'}
                    onClick={() =>
                      setAnswers({
                        ...answers,
                        country: { format: 'full_name' },
                      })
                    }
                    title="Full name"
                    description=""
                    example="United States"
                  />

                  <OptionCard
                    selected={answers.country.format === 'iso2'}
                    onClick={() =>
                      setAnswers({
                        ...answers,
                        country: { format: 'iso2' },
                      })
                    }
                    title="ISO 2-letter"
                    description=""
                    example="US"
                    badge="Recommended"
                  />

                  <OptionCard
                    selected={answers.country.format === 'iso3'}
                    onClick={() =>
                      setAnswers({
                        ...answers,
                        country: { format: 'iso3' },
                      })
                    }
                    title="ISO 3-letter"
                    description=""
                    example="USA"
                  />
                </div>
              )}

              {/* Screen 5: State */}
              {currentStepId === 'state' && sampleData && (
                <div>
                  <h1 style={{ fontSize: 28, fontFamily: 'Lora, serif', color: C.text, marginBottom: 16, fontWeight: 600 }}>
                    How should states and regions be stored?
                  </h1>

                  <div style={{ marginBottom: 24 }}>
                    <div style={{ fontSize: 13, color: C.text3, marginBottom: 8 }}>
                      Examples from your HubSpot:
                    </div>
                    {sampleData.states.slice(0, 5).map((state, i) => (
                      <div key={i} style={{ fontSize: 12, fontFamily: F.mono, color: C.text2, marginBottom: 4 }}>
                        {state}
                      </div>
                    ))}
                  </div>

                  <OptionCard
                    selected={answers.state.format === 'full_name'}
                    onClick={() =>
                      setAnswers({
                        ...answers,
                        state: { format: 'full_name' },
                      })
                    }
                    title="Full name"
                    description=""
                    example="California"
                  />

                  <OptionCard
                    selected={answers.state.format === 'abbreviation'}
                    onClick={() =>
                      setAnswers({
                        ...answers,
                        state: { format: 'abbreviation' },
                      })
                    }
                    title="Abbreviation"
                    description=""
                    example="CA"
                    badge="Recommended"
                  />
                </div>
              )}

              {/* Screen 6: Industry */}
              {currentStepId === 'industry' && sampleData && (
                <div>
                  <h1 style={{ fontSize: 28, fontFamily: 'Lora, serif', color: C.text, marginBottom: 16, fontWeight: 600 }}>
                    How should industry values be normalized?
                  </h1>

                  <div style={{ marginBottom: 24 }}>
                    <div style={{ fontSize: 13, color: C.text2, marginBottom: 12 }}>
                      We found {sampleData.industries.length} unique industry values in your HubSpot.
                    </div>
                    {sampleData.industries.slice(0, 8).map((industry, i) => (
                      <div key={i} style={{ fontSize: 12, fontFamily: F.mono, color: C.text2, marginBottom: 4 }}>
                        {industry}
                      </div>
                    ))}
                  </div>

                  <OptionCard
                    selected={answers.industry?.normalize === true}
                    onClick={() =>
                      setAnswers({
                        ...answers,
                        industry: { normalize: true, target: 'hubspot_standard' },
                      })
                    }
                    title="Map to HubSpot standard list"
                    description="Normalizes to HubSpot's built-in industry taxonomy. Best for reporting."
                    badge="Recommended"
                  />

                  <OptionCard
                    selected={answers.industry?.normalize === false}
                    onClick={() =>
                      setAnswers({
                        ...answers,
                        industry: { normalize: false, target: null },
                      })
                    }
                    title="Leave as-is"
                    description="Keep existing values unchanged."
                  />
                </div>
              )}

              {/* Screen 7: Employee Count */}
              {currentStepId === 'employee_count' && sampleData && (
                <div>
                  <h1 style={{ fontSize: 28, fontFamily: 'Lora, serif', color: C.text, marginBottom: 16, fontWeight: 600 }}>
                    How should employee counts be stored?
                  </h1>

                  <div style={{ marginBottom: 24 }}>
                    <div style={{ fontSize: 13, color: C.text3, marginBottom: 8 }}>
                      Examples from your HubSpot:
                    </div>
                    {sampleData.employee_counts.slice(0, 5).map((count, i) => (
                      <div key={i} style={{ fontSize: 12, fontFamily: F.mono, color: C.text2, marginBottom: 4 }}>
                        {count}
                      </div>
                    ))}
                  </div>

                  <OptionCard
                    selected={answers.employee_count?.format === 'range'}
                    onClick={() =>
                      setAnswers({
                        ...answers,
                        employee_count: { format: 'range' },
                      })
                    }
                    title="Structured range"
                    description=""
                    example="50-100"
                  />

                  <OptionCard
                    selected={answers.employee_count?.format === 'exact'}
                    onClick={() =>
                      setAnswers({
                        ...answers,
                        employee_count: { format: 'exact' },
                      })
                    }
                    title="Exact number"
                    description="Midpoint of range"
                    example="75"
                  />

                  <OptionCard
                    selected={answers.employee_count?.format === 'preserve'}
                    onClick={() =>
                      setAnswers({
                        ...answers,
                        employee_count: { format: 'preserve' },
                      })
                    }
                    title="Leave as-is"
                    description=""
                  />
                </div>
              )}

              {/* Screen 8: LinkedIn */}
              {currentStepId === 'linkedin' && sampleData && (
                <div>
                  <h1 style={{ fontSize: 28, fontFamily: 'Lora, serif', color: C.text, marginBottom: 16, fontWeight: 600 }}>
                    Normalize LinkedIn URLs?
                  </h1>

                  <div style={{ marginBottom: 24 }}>
                    <div style={{ fontSize: 13, color: C.text3, marginBottom: 8 }}>
                      Examples from your HubSpot:
                    </div>
                    {sampleData.linkedin_urls.slice(0, 5).map((url, i) => (
                      <div key={i} style={{ fontSize: 12, fontFamily: F.mono, color: C.text2, marginBottom: 4 }}>
                        {url}
                      </div>
                    ))}
                  </div>

                  <OptionCard
                    selected={answers.linkedin?.normalize === true}
                    onClick={() =>
                      setAnswers({
                        ...answers,
                        linkedin: { normalize: true },
                      })
                    }
                    title="Yes - normalize to canonical format"
                    description=""
                    example="https://www.linkedin.com/company/acme"
                    badge="Recommended"
                  />

                  <OptionCard
                    selected={answers.linkedin?.normalize === false}
                    onClick={() =>
                      setAnswers({
                        ...answers,
                        linkedin: { normalize: false },
                      })
                    }
                    title="No - leave as-is"
                    description=""
                  />
                </div>
              )}

              {/* Screen 9: Dedup Calibration */}
              {currentStepId === 'dedup' && (
                <div>
                  {!isAdmin ? (
                    <div style={{ textAlign: 'center', padding: 40 }}>
                      <h1 style={{ fontSize: 24, fontFamily: 'Lora, serif', color: C.text, marginBottom: 16, fontWeight: 600 }}>
                        Admin configuration required
                      </h1>
                      <p style={{ fontSize: 14, color: C.text3, marginBottom: 24 }}>
                        Only workspace admins can configure dedup calibration.
                      </p>
                      <button
                        onClick={() => setCurrentStep(currentStep + 1)}
                        style={{
                          padding: '12px 24px',
                          background: C.indigo,
                          color: 'white',
                          border: 'none',
                          fontSize: 14,
                          fontWeight: 500,
                          cursor: 'pointer',
                          fontFamily: F.sans,
                        }}
                      >
                        Continue →
                      </button>
                    </div>
                  ) : dedupStatus === 'scanning' ? (
                    <div style={{ textAlign: 'center', padding: 40 }}>
                      <div style={{ fontSize: 48, marginBottom: 16 }}>
                        <div style={{
                          width: 48,
                          height: 48,
                          border: `4px solid ${C.border}`,
                          borderTopColor: C.indigo,
                          borderRadius: '50%',
                          animation: 'spin 1s linear infinite',
                          margin: '0 auto',
                        }} />
                      </div>
                      <h1 style={{ fontSize: 24, fontFamily: 'Lora, serif', color: C.text, marginBottom: 8, fontWeight: 600 }}>
                        Scanning your HubSpot for potential duplicates
                      </h1>
                      <p style={{ fontSize: 13, color: C.text3, marginBottom: 24 }}>
                        This usually takes 30-60 seconds
                      </p>
                      <button
                        onClick={() => setCurrentStep(currentStep + 1)}
                        style={{
                          padding: '10px 20px',
                          background: 'transparent',
                          color: C.text3,
                          border: `1px solid ${C.border}`,
                          fontSize: 13,
                          cursor: 'pointer',
                          fontFamily: F.sans,
                          marginTop: 24,
                        }}
                      >
                        Skip for now - configure manually later
                      </button>
                    </div>
                  ) : dedupStatus === 'none' ? (
                    <div style={{ textAlign: 'center', padding: 40 }}>
                      <div style={{ fontSize: 48, color: C.green, marginBottom: 16 }}>✓</div>
                      <h1 style={{ fontSize: 24, fontFamily: 'Lora, serif', color: C.text, marginBottom: 8, fontWeight: 600 }}>
                        Your HubSpot looks clean
                      </h1>
                      <p style={{ fontSize: 13, color: C.text3, marginBottom: 24 }}>
                        No obvious duplicates found. Refyne will watch for new ones automatically.
                      </p>
                      <button
                        onClick={() => setCurrentStep(currentStep + 1)}
                        style={{
                          padding: '12px 24px',
                          background: C.indigo,
                          color: 'white',
                          border: 'none',
                          fontSize: 14,
                          fontWeight: 500,
                          cursor: 'pointer',
                          fontFamily: F.sans,
                        }}
                      >
                        Continue →
                      </button>
                    </div>
                  ) : dedupStatus === 'summary' ? (
                    <div>
                      <div style={{ textAlign: 'center', marginBottom: 32 }}>
                        <div style={{ fontSize: 48, color: C.green, marginBottom: 16 }}>✓</div>
                        <h1 style={{ fontSize: 24, fontFamily: 'Lora, serif', color: C.text, marginBottom: 8, fontWeight: 600 }}>
                          Refyne has learned your preferences
                        </h1>
                      </div>

                      <div style={{ marginBottom: 32, padding: 20, background: C.surface, border: `1px solid ${C.border}` }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 8 }}>
                          Calibration complete
                        </div>
                        <div style={{ fontSize: 12, color: C.text3, marginBottom: 16 }}>
                          You reviewed {dedupDecisions.size} pairs
                        </div>
                      </div>

                      {DEDUP_EXPLAINER_VIDEO_URL ? (
                        <div style={{ marginBottom: 32 }}>
                          <video src={DEDUP_EXPLAINER_VIDEO_URL} controls style={{ width: '100%', maxWidth: 640, margin: '0 auto', display: 'block' }} />
                        </div>
                      ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 32 }}>
                          <div style={{ padding: 20, background: C.surface, border: `1px solid ${C.border}`, textAlign: 'center' }}>
                            <div style={{ fontSize: 32, marginBottom: 8 }}>🔍</div>
                            <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 8 }}>Find duplicates</div>
                            <div style={{ fontSize: 12, color: C.text3 }}>
                              Refyne scans nightly for duplicates
                            </div>
                          </div>
                          <div style={{ padding: 20, background: C.surface, border: `1px solid ${C.border}`, textAlign: 'center' }}>
                            <div style={{ fontSize: 32, marginBottom: 8 }}>👁</div>
                            <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 8 }}>Review</div>
                            <div style={{ fontSize: 12, color: C.text3 }}>
                              You approve or Refyne auto-merges
                            </div>
                          </div>
                          <div style={{ padding: 20, background: C.surface, border: `1px solid ${C.border}`, textAlign: 'center' }}>
                            <div style={{ fontSize: 32, marginBottom: 8 }}>✓</div>
                            <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 8 }}>Merge</div>
                            <div style={{ fontSize: 12, color: C.text3 }}>
                              Best values survive. All history kept
                            </div>
                          </div>
                        </div>
                      )}

                      <button
                        onClick={() => setCurrentStep(currentStep + 1)}
                        style={{
                          padding: '12px 24px',
                          background: C.indigo,
                          color: 'white',
                          border: 'none',
                          fontSize: 14,
                          fontWeight: 500,
                          cursor: 'pointer',
                          fontFamily: F.sans,
                        }}
                      >
                        Continue to finish setup →
                      </button>
                    </div>
                  ) : (
                    <div>
                      <h1 style={{ fontSize: 24, fontFamily: 'Lora, serif', color: C.text, marginBottom: 8, fontWeight: 600 }}>
                        Help Refyne learn your preferences
                      </h1>
                      <p style={{ fontSize: 13, color: C.text3, marginBottom: 24 }}>
                        Review a few potential duplicates from your real data. This takes about 2 minutes.
                      </p>

                      {dedupSamples.length > 0 && (
                        <div style={{ marginBottom: 32 }}>
                          <div style={{ fontSize: 12, color: C.text3, marginBottom: 16, textAlign: 'right' }}>
                            {currentPairIndex + 1} / {dedupSamples.length} reviewed
                          </div>

                          {dedupSamples[currentPairIndex] && (
                            <div style={{ border: `1px solid ${C.border}`, background: C.surface }}>
                              <div style={{ padding: 16, borderBottom: `1px solid ${C.border}`, background: C.bg }}>
                                <span style={{ fontSize: 12, fontWeight: 600, color: dedupSamples[currentPairIndex].grade === 'A' ? C.green : C.indigo }}>
                                  Grade {dedupSamples[currentPairIndex].grade}
                                </span>
                                <span style={{ fontSize: 12, color: C.text3, marginLeft: 8 }}>
                                  {Math.round(dedupSamples[currentPairIndex].confidence * 100)}% confidence
                                </span>
                              </div>

                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
                                <div style={{ padding: 20 }}>
                                  <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 12 }}>
                                    {dedupSamples[currentPairIndex].company_a.name}
                                  </div>
                                  <div style={{ fontSize: 12, color: C.text3, marginBottom: 4 }}>
                                    {dedupSamples[currentPairIndex].company_a.domain}
                                  </div>
                                  <div style={{ fontSize: 12, color: C.text3, marginBottom: 4 }}>
                                    {dedupSamples[currentPairIndex].company_a.city && dedupSamples[currentPairIndex].company_a.state
                                      ? `${dedupSamples[currentPairIndex].company_a.city}, ${dedupSamples[currentPairIndex].company_a.state}`
                                      : dedupSamples[currentPairIndex].company_a.city || dedupSamples[currentPairIndex].company_a.state}
                                  </div>
                                </div>

                                <div style={{ padding: 20, borderLeft: `1px solid ${C.border}` }}>
                                  <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 12 }}>
                                    {dedupSamples[currentPairIndex].company_b.name}
                                  </div>
                                  <div style={{ fontSize: 12, color: C.text3, marginBottom: 4 }}>
                                    {dedupSamples[currentPairIndex].company_b.domain}
                                  </div>
                                  <div style={{ fontSize: 12, color: C.text3, marginBottom: 4 }}>
                                    {dedupSamples[currentPairIndex].company_b.city && dedupSamples[currentPairIndex].company_b.state
                                      ? `${dedupSamples[currentPairIndex].company_b.city}, ${dedupSamples[currentPairIndex].company_b.state}`
                                      : dedupSamples[currentPairIndex].company_b.city || dedupSamples[currentPairIndex].company_b.state}
                                  </div>
                                </div>
                              </div>

                              <div style={{ padding: 20, borderTop: `1px solid ${C.border}`, display: 'flex', gap: 12, justifyContent: 'center' }}>
                                <button
                                  onClick={() => {
                                    const newDecisions = new Map(dedupDecisions);
                                    newDecisions.set(dedupSamples[currentPairIndex].pair_id, { verdict: 'not_duplicate' });
                                    setDedupDecisions(newDecisions);
                                    if (currentPairIndex < dedupSamples.length - 1) {
                                      setCurrentPairIndex(currentPairIndex + 1);
                                    } else {
                                      setDedupStatus('summary');
                                    }
                                  }}
                                  style={{
                                    padding: '10px 20px',
                                    background: 'transparent',
                                    color: C.text2,
                                    border: `1px solid ${C.border}`,
                                    fontSize: 13,
                                    cursor: 'pointer',
                                    fontFamily: F.sans,
                                  }}
                                >
                                  Not a duplicate
                                </button>

                                <button
                                  onClick={() => {
                                    const newDecisions = new Map(dedupDecisions);
                                    newDecisions.set(dedupSamples[currentPairIndex].pair_id, { verdict: 'duplicate', survivor_preference: 'auto' });
                                    setDedupDecisions(newDecisions);
                                    if (currentPairIndex < dedupSamples.length - 1) {
                                      setCurrentPairIndex(currentPairIndex + 1);
                                    } else {
                                      setDedupStatus('summary');
                                    }
                                  }}
                                  style={{
                                    padding: '10px 20px',
                                    background: C.indigo,
                                    color: 'white',
                                    border: 'none',
                                    fontSize: 13,
                                    fontWeight: 500,
                                    cursor: 'pointer',
                                    fontFamily: F.sans,
                                  }}
                                >
                                  Duplicate
                                </button>

                                <button
                                  onClick={() => {
                                    const newDecisions = new Map(dedupDecisions);
                                    newDecisions.set(dedupSamples[currentPairIndex].pair_id, { verdict: 'unsure' });
                                    setDedupDecisions(newDecisions);
                                    if (currentPairIndex < dedupSamples.length - 1) {
                                      setCurrentPairIndex(currentPairIndex + 1);
                                    } else {
                                      setDedupStatus('summary');
                                    }
                                  }}
                                  style={{
                                    background: 'transparent',
                                    color: C.text3,
                                    border: 'none',
                                    fontSize: 12,
                                    cursor: 'pointer',
                                    fontFamily: F.sans,
                                    textDecoration: 'underline',
                                  }}
                                >
                                  Skip
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Screen 10: Summary */}
              {currentStepId === 'summary' && (
                <div>
                  <h1 style={{ fontSize: 28, fontFamily: 'Lora, serif', color: C.text, marginBottom: 32, fontWeight: 600 }}>
                    {isRecalibrate ? "Here's what will change" : "Here's what we'll change"}
                  </h1>

                  <div style={{ marginBottom: 32 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 16 }}>
                      Your settings
                    </div>

                    <div style={{ background: C.surface, border: `1px solid ${C.border}`, padding: 16 }}>
                      <div style={{ marginBottom: 12 }}>
                        <span style={{ fontSize: 12, color: C.text3 }}>Mode: </span>
                        <span style={{ fontSize: 12, color: C.text, fontWeight: 500 }}>
                          {answers.normalization_mode === 'implicit' ? 'Automatic' : 'On demand'}
                        </span>
                      </div>
                      <div style={{ marginBottom: 12 }}>
                        <span style={{ fontSize: 12, color: C.text3 }}>Phone: </span>
                        <span style={{ fontSize: 12, color: C.text, fontWeight: 500 }}>
                          {answers.phone.format === 'e164_formatted'
                            ? '+1 (310) 387-9598 (International with formatting)'
                            : answers.phone.format === 'e164_dashes'
                            ? '+1 310-387-9598 (International with dashes)'
                            : answers.phone.format === 'e164_spaces'
                            ? '+1 310 387 9598 (International with spaces)'
                            : answers.phone.format === 'e164_compact'
                            ? '+13103879598 (E.164 compact)'
                            : answers.phone.format === 'national'
                            ? '(310) 387-9598 (National)'
                            : '+1 (310) 387-9598 (International)'}
                        </span>
                      </div>
                      <div style={{ marginBottom: 12 }}>
                        <span style={{ fontSize: 12, color: C.text3 }}>Company names: </span>
                        <span style={{ fontSize: 12, color: C.text, fontWeight: 500 }}>
                          {answers.company_name.casing === 'title'
                            ? 'Title Case'
                            : answers.company_name.casing === 'upper'
                            ? 'UPPER CASE'
                            : 'Preserve'},{' '}
                          {answers.company_name.suffix_treatment === 'abbreviate'
                            ? 'Abbreviate suffixes'
                            : answers.company_name.suffix_treatment === 'expand'
                            ? 'Expand suffixes'
                            : answers.company_name.suffix_treatment === 'remove'
                            ? 'Remove suffixes'
                            : 'Preserve suffixes'}
                        </span>
                      </div>
                      <div style={{ marginBottom: 12 }}>
                        <span style={{ fontSize: 12, color: C.text3 }}>URLs: </span>
                        <span style={{ fontSize: 12, color: C.text, fontWeight: 500 }}>
                          {answers.url.format === 'canonical_no_www'
                            ? 'https://acme.com'
                            : answers.url.format === 'canonical_www'
                            ? 'https://www.acme.com'
                            : 'acme.com'}{' '}
                          {answers.url.strip_paths ? '(strip paths)' : ''}
                        </span>
                      </div>
                      <div style={{ marginBottom: 12 }}>
                        <span style={{ fontSize: 12, color: C.text3 }}>Countries: </span>
                        <span style={{ fontSize: 12, color: C.text, fontWeight: 500 }}>
                          {answers.country.format === 'full_name'
                            ? 'Full name (United States)'
                            : answers.country.format === 'iso2'
                            ? 'ISO 2-letter (US)'
                            : 'ISO 3-letter (USA)'}
                        </span>
                      </div>
                      <div style={{ marginBottom: 12 }}>
                        <span style={{ fontSize: 12, color: C.text3 }}>States: </span>
                        <span style={{ fontSize: 12, color: C.text, fontWeight: 500 }}>
                          {answers.state.format === 'full_name' ? 'Full name (California)' : 'Abbreviation (CA)'}
                        </span>
                      </div>
                      {answers.industry && (
                        <div style={{ marginBottom: 12 }}>
                          <span style={{ fontSize: 12, color: C.text3 }}>Industry: </span>
                          <span style={{ fontSize: 12, color: C.text, fontWeight: 500 }}>
                            {answers.industry.normalize ? 'Map to HubSpot standard' : 'Leave as-is'}
                          </span>
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => setCurrentStep(0)}
                      style={{
                        marginTop: 12,
                        background: 'transparent',
                        border: 'none',
                        color: C.indigo,
                        fontSize: 12,
                        cursor: 'pointer',
                        textDecoration: 'underline',
                      }}
                    >
                      ← Edit settings
                    </button>
                  </div>

                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 16 }}>
                      How your data will look after normalization
                    </div>

                    <div style={{ background: C.surface, border: `1px solid ${C.border}`, padding: 16 }}>
                      <table style={{ width: '100%', fontSize: 11, fontFamily: F.mono }}>
                        <thead>
                          <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                            <th style={{ textAlign: 'left', padding: '8px 0', color: C.text3 }}>Field</th>
                            <th style={{ textAlign: 'left', padding: '8px 0', color: C.text3 }}>Before</th>
                            <th style={{ textAlign: 'left', padding: '8px 0', color: C.text3 }}>After</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sampleData && sampleData.names[0] && (
                            <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                              <td style={{ padding: '8px 0', color: C.text2 }}>Name</td>
                              <td style={{ padding: '8px 0', color: C.text3 }}>{sampleData.names[0]}</td>
                              <td style={{ padding: '8px 0', color: C.indigo, fontWeight: 600 }}>
                                {companyNamePreviews[0]?.after}
                              </td>
                            </tr>
                          )}
                          {sampleData && sampleData.phones[0] && (
                            <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                              <td style={{ padding: '8px 0', color: C.text2 }}>Phone</td>
                              <td style={{ padding: '8px 0', color: C.text3 }}>{sampleData.phones[0]}</td>
                              <td style={{ padding: '8px 0', color: C.indigo, fontWeight: 600 }}>
                                {answers.phone.format === 'e164_formatted'
                                  ? '+1 (310) 387-9598'
                                  : answers.phone.format === 'e164_dashes'
                                  ? '+1 310-387-9598'
                                  : answers.phone.format === 'e164_spaces'
                                  ? '+1 310 387 9598'
                                  : answers.phone.format === 'e164_compact'
                                  ? '+13103879598'
                                  : answers.phone.format === 'national'
                                  ? '(310) 387-9598'
                                  : '+1 (310) 387-9598'}
                              </td>
                            </tr>
                          )}
                          {sampleData && sampleData.urls[0] && (
                            <tr>
                              <td style={{ padding: '8px 0', color: C.text2 }}>URL</td>
                              <td style={{ padding: '8px 0', color: C.text3 }}>{sampleData.urls[0]}</td>
                              <td style={{ padding: '8px 0', color: C.indigo, fontWeight: 600 }}>
                                {answers.url.format === 'canonical_no_www'
                                  ? 'https://acme.com'
                                  : answers.url.format === 'canonical_www'
                                  ? 'https://www.acme.com'
                                  : 'acme.com'}
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Screen 10: Applying */}
          {isSubmitting && (
            <div style={{ textAlign: 'center', paddingTop: 80 }}>
              <h1 style={{ fontSize: 28, fontFamily: 'Lora, serif', color: C.text, marginBottom: 48, fontWeight: 600 }}>
                Setting up your workspace...
              </h1>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 400, margin: '0 auto' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {submitProgress === 'configuring' || submitProgress === 'activating' || submitProgress === 'preparing' || submitProgress === 'done' ? (
                    <div
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: '50%',
                        background: C.green,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <span style={{ color: '#fff', fontSize: 14 }}>✓</span>
                    </div>
                  ) : (
                    <div style={{ width: 20, height: 20, border: `2px solid ${C.border2}`, borderRadius: '50%' }} />
                  )}
                  <span style={{ fontSize: 14, color: submitProgress === 'done' ? C.text : C.text3 }}>
                    Configuring harmony rules
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {submitProgress === 'activating' || submitProgress === 'preparing' || submitProgress === 'done' ? (
                    <div
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: '50%',
                        background: C.green,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <span style={{ color: '#fff', fontSize: 14 }}>✓</span>
                    </div>
                  ) : (
                    <div style={{ width: 20, height: 20, border: `2px solid ${C.border2}`, borderRadius: '50%' }} />
                  )}
                  <span style={{ fontSize: 14, color: submitProgress === 'activating' || submitProgress === 'done' ? C.text : C.text3 }}>
                    Activating normalizations
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {submitProgress === 'preparing' || submitProgress === 'done' ? (
                    <div
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: '50%',
                        background: C.green,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <span style={{ color: '#fff', fontSize: 14 }}>✓</span>
                    </div>
                  ) : (
                    <div style={{ width: 20, height: 20, border: `2px solid ${C.border2}`, borderRadius: '50%' }} />
                  )}
                  <span style={{ fontSize: 14, color: submitProgress === 'preparing' || submitProgress === 'done' ? C.text : C.text3 }}>
                    Preparing your first preview
                  </span>
                </div>
              </div>

              {error && (
                <div style={{ marginTop: 32 }}>
                  <div style={{ fontSize: 14, color: C.red, marginBottom: 16 }}>{error}</div>
                  <button
                    onClick={() => {
                      setError(null);
                      setIsSubmitting(false);
                    }}
                    style={{
                      padding: '8px 16px',
                      background: C.indigo,
                      color: '#fff',
                      border: 'none',
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Try again
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Navigation bar */}
      {!isSubmitting && (
        <div
          style={{
            borderTop: `1px solid ${C.border}`,
            padding: '16px 32px',
            display: 'flex',
            justifyContent: 'space-between',
            background: C.sidebar,
          }}
        >
          <button
            onClick={handleBack}
            style={{
              padding: '8px 16px',
              background: 'transparent',
              border: `1px solid ${C.border2}`,
              color: C.text,
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
              fontFamily: F.sans,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = C.hover)}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            ← Back
          </button>

          <button
            onClick={handleContinue}
            style={{
              padding: '8px 24px',
              background: `linear-gradient(to bottom, ${C.indigo}, ${C.indigoDk})`,
              border: 'none',
              color: '#fff',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: F.sans,
              boxShadow: '0 0 0 1px rgba(99,102,241,0.3), 0 1px 3px rgba(0,0,0,0.4)',
            }}
          >
            {currentStep === steps.length - 1 ? 'Apply these settings →' : 'Continue →'}
          </button>
        </div>
      )}

      {/* Exit confirmation modal */}
      {showExitConfirm && (
        <>
          <div
            onClick={() => setShowExitConfirm(false)}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.6)',
              zIndex: 9998,
            }}
          />
          <div
            style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: 400,
              background: C.surface,
              border: `1px solid ${C.border}`,
              padding: 24,
              zIndex: 9999,
            }}
          >
            <div style={{ fontSize: 16, fontWeight: 600, color: C.text, marginBottom: 12 }}>
              Exit setup?
            </div>
            <div style={{ fontSize: 13, color: C.text3, marginBottom: 24 }}>
              Your progress will not be saved. You can restart the calibration wizard from Settings later.
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowExitConfirm(false)}
                style={{
                  padding: '8px 16px',
                  background: C.surface,
                  border: `1px solid ${C.border2}`,
                  color: C.text,
                  fontSize: 13,
                  fontFamily: F.sans,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => router.push('/onboarding')}
                style={{
                  padding: '8px 16px',
                  background: C.red,
                  border: 'none',
                  color: '#fff',
                  fontSize: 13,
                  fontWeight: 600,
                  fontFamily: F.sans,
                  cursor: 'pointer',
                }}
              >
                Exit
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// Wrap in Suspense to handle useSearchParams()
export default function CalibratePage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            fontFamily: F.sans,
            color: C.text3,
          }}
        >
          Loading wizard...
        </div>
      }
    >
      <CalibratePageInner />
    </Suspense>
  );
}
