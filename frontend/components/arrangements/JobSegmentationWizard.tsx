/**
 * Job Segmentation Wizard
 *
 * Three-step wizard for configuring and running job title segmentation:
 * 1. Configure: Name, contacts filter, field mapping, write policy
 * 2. Preview: Sample 20 contacts, allow corrections, show breakdown
 * 3. Running → Complete: Progress bar, final stats
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, Check, X } from 'lucide-react';
import { C, F } from '@/lib/design-tokens';
import { addToast } from '@/components/ui/toast';

type WizardStep = 1 | 2 | 3;

interface HubSpotProperty {
  name: string;
  label: string;
  type: string;
}

interface Classification {
  contactId: string;
  name: string;
  jobTitle: string;
  level: string;
  function: string;
}

interface RunStats {
  status: string;
  processed_count: number;
  updated_count: number;
  skipped_count: number;
  error_count: number;
  error_message?: string;
}

const JOB_LEVELS = ['C-Suite', 'VP', 'Director', 'Manager', 'IC', 'Founder', 'Other'];
const JOB_FUNCTIONS = [
  'Clinical/Healthcare',
  'Revenue Operations',
  'Sales',
  'Marketing',
  'Finance',
  'Engineering',
  'Operations',
  'Executive',
  'People/HR',
  'Other',
];

export function JobSegmentationWizard() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<WizardStep>(1);

  // Step 1: Configuration
  const [name, setName] = useState(`Job Segmentation - ${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`);
  const [contactsFilter, setContactsFilter] = useState<'all' | 'missing'>('all');
  const [levelField, setLevelField] = useState('seniority');
  const [functionField, setFunctionField] = useState('refyne_job_function');
  const [writePolicy, setWritePolicy] = useState<'empty_only' | 'always'>('empty_only');
  const [properties, setProperties] = useState<HubSpotProperty[]>([]);
  const [totalContactsCount, setTotalContactsCount] = useState(0);
  const [loadingProperties, setLoadingProperties] = useState(true);

  // Step 2: Preview
  const [previewData, setPreviewData] = useState<Classification[]>([]);
  const [loadingPreview, setLoadingPreview] = useState(false);

  // Step 3: Running
  const [runId, setRunId] = useState<string | null>(null);
  const [runStats, setRunStats] = useState<RunStats | null>(null);
  const [polling, setPolling] = useState(false);

  // Load HubSpot properties on mount
  useEffect(() => {
    loadProperties();
    fetchTotalContacts();
  }, []);

  const loadProperties = async () => {
    try {
      const res = await fetch('/api/hubspot/properties/contacts');
      if (!res.ok) throw new Error('Failed to fetch properties');
      const data = await res.json();
      setProperties(data.properties || []);
    } catch (error) {
      console.error('Failed to load properties:', error);
      addToast('error', 'Failed to load HubSpot properties');
    } finally {
      setLoadingProperties(false);
    }
  };

  const fetchTotalContacts = async () => {
    try {
      // Fetch total count of contacts with job titles
      // For now, using a placeholder - would need a real endpoint
      setTotalContactsCount(2834); // Placeholder
    } catch (error) {
      console.error('Failed to fetch contact count:', error);
    }
  };

  const handlePreview = async () => {
    setLoadingPreview(true);
    try {
      // Fetch 20 random contacts with job titles from HubSpot
      // This would need a real implementation to fetch from HubSpot
      // For now, using the classify endpoint with sample data

      // Placeholder: In real implementation, fetch contacts from HubSpot first
      const sampleTitles = [
        'CEO',
        'Director of Engineering',
        'Sales Manager',
        'BCBA',
        'VP of Marketing',
        'Chief Technology Officer',
        'Revenue Operations Manager',
        'Clinical Supervisor',
        'Founder',
        'Board Certified Behavior Analyst',
        'Software Engineer',
        'Account Executive',
        'Chief Financial Officer',
        'Operations Director',
        'Marketing Coordinator',
        'Program Director',
        'Chief Operating Officer',
        'Therapist',
        'VP of Sales',
        'Clinical Psychologist',
      ];

      // Call classify endpoint
      const res = await fetch('/api/jobs/classify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ titles: sampleTitles }),
      });

      if (!res.ok) throw new Error('Failed to classify titles');
      const data = await res.json();

      // Map to preview format
      const preview: Classification[] = sampleTitles.map((title, i) => {
        const classification = data.classifications[i];
        return {
          contactId: `preview-${i}`,
          name: `Contact ${i + 1}`,
          jobTitle: title,
          level: classification?.level || 'Other',
          function: classification?.function || 'Other',
        };
      });

      setPreviewData(preview);
      setCurrentStep(2);
    } catch (error) {
      console.error('Failed to load preview:', error);
      addToast('error', 'Failed to load preview');
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleCorrection = async (contactId: string, field: 'level' | 'function', value: string) => {
    // Update local state
    setPreviewData((prev) =>
      prev.map((item) =>
        item.contactId === contactId
          ? { ...item, [field]: value }
          : item
      )
    );

    // Save correction to backend
    const item = previewData.find((p) => p.contactId === contactId);
    if (!item) return;

    try {
      await fetch('/api/jobs/classify/correct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawTitle: item.jobTitle,
          level: field === 'level' ? value : item.level,
          function: field === 'function' ? value : item.function,
        }),
      });
    } catch (error) {
      console.error('Failed to save correction:', error);
    }
  };

  const handleApply = async () => {
    try {
      // Start the job segmentation run
      const res = await fetch('/api/jobs/segment/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          levelField,
          functionField,
          dryRun: false,
        }),
      });

      if (!res.ok) throw new Error('Failed to start run');
      const data = await res.json();

      setRunId(data.runId);
      setCurrentStep(3);
      startPolling(data.runId);
    } catch (error) {
      console.error('Failed to start run:', error);
      addToast('error', 'Failed to start job segmentation');
    }
  };

  const startPolling = (id: string) => {
    setPolling(true);
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/jobs/segment/runs/${id}`);
        if (!res.ok) throw new Error('Failed to fetch run status');
        const data = await res.json();

        setRunStats(data.run);

        if (data.run.status === 'completed' || data.run.status === 'failed') {
          clearInterval(interval);
          setPolling(false);
        }
      } catch (error) {
        console.error('Failed to poll run status:', error);
        clearInterval(interval);
        setPolling(false);
      }
    }, 3000);

    // Cleanup on unmount
    return () => clearInterval(interval);
  };

  const calculateBreakdown = () => {
    if (!previewData.length) return { levels: {}, functions: {} };

    const levels: Record<string, number> = {};
    const functions: Record<string, number> = {};

    previewData.forEach((item) => {
      levels[item.level] = (levels[item.level] || 0) + 1;
      functions[item.function] = (functions[item.function] || 0) + 1;
    });

    return { levels, functions };
  };

  const breakdown = calculateBreakdown();
  const classifiedCount = previewData.filter((p) => p.jobTitle).length;
  const skippedCount = previewData.length - classifiedCount;

  return (
    <div style={{ padding: 32, maxWidth: 900, margin: '0 auto' }}>
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
          Job Segmentation
        </h1>
        <p style={{ fontSize: 14, color: C.text3 }}>
          Derive job level and function from contact job titles
        </p>
      </div>

      {/* Progress Steps */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 32 }}>
        {[1, 2, 3].map((step) => (
          <div
            key={step}
            style={{
              flex: 1,
              height: 4,
              background: step <= currentStep ? C.indigo : C.border,
            }}
          />
        ))}
      </div>

      {/* Step Content */}
      <div
        style={{
          background: C.surface,
          border: `1px solid ${C.border}`,
          padding: 32,
          minHeight: 400,
        }}
      >
        {/* Step 1: Configure */}
        {currentStep === 1 && (
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 600, color: C.text, marginBottom: 24 }}>
              Step 1 of 3: Configure
            </h2>

            {/* Name */}
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: 13, color: C.text2, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  background: C.bg,
                  border: `1px solid ${C.border}`,
                  color: C.text,
                  fontSize: 14,
                  fontFamily: F.sans,
                }}
              />
            </div>

            {/* Contacts to Process */}
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: 13, color: C.text2, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Contacts to Process
              </label>
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, cursor: 'pointer' }}>
                  <input
                    type="radio"
                    checked={contactsFilter === 'all'}
                    onChange={() => setContactsFilter('all')}
                    style={{ cursor: 'pointer' }}
                  />
                  <span style={{ color: C.text, fontSize: 14 }}>
                    All contacts ({totalContactsCount.toLocaleString()} contacts)
                  </span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input
                    type="radio"
                    checked={contactsFilter === 'missing'}
                    onChange={() => setContactsFilter('missing')}
                    style={{ cursor: 'pointer' }}
                  />
                  <span style={{ color: C.text, fontSize: 14 }}>
                    Missing job level only
                  </span>
                </label>
              </div>
            </div>

            {/* Output Field Mapping */}
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: 13, color: C.text2, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Output Field Mapping
              </label>
              <p style={{ fontSize: 13, color: C.text3, marginBottom: 12 }}>
                Refyne will write to these HubSpot contact properties. Change to map to any existing property.
              </p>

              {/* Job Level Field */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 13, color: C.text2, marginBottom: 6 }}>
                  Job Level
                </label>
                <select
                  value={levelField}
                  onChange={(e) => setLevelField(e.target.value)}
                  disabled={loadingProperties}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    background: C.bg,
                    border: `1px solid ${C.border}`,
                    color: C.text,
                    fontSize: 14,
                    fontFamily: F.sans,
                    cursor: loadingProperties ? 'wait' : 'pointer',
                  }}
                >
                  <option value="seniority">seniority (recommended - HubSpot native)</option>
                  <option value="refyne_job_level">refyne_job_level (Refyne default)</option>
                  {properties.map((prop) => (
                    <option key={prop.name} value={prop.name}>
                      {prop.label} ({prop.name})
                    </option>
                  ))}
                </select>
              </div>

              {/* Job Function Field */}
              <div>
                <label style={{ display: 'block', fontSize: 13, color: C.text2, marginBottom: 6 }}>
                  Job Function
                </label>
                <select
                  value={functionField}
                  onChange={(e) => setFunctionField(e.target.value)}
                  disabled={loadingProperties}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    background: C.bg,
                    border: `1px solid ${C.border}`,
                    color: C.text,
                    fontSize: 14,
                    fontFamily: F.sans,
                    cursor: loadingProperties ? 'wait' : 'pointer',
                  }}
                >
                  <option value="refyne_job_function">refyne_job_function (Refyne default)</option>
                  {properties.map((prop) => (
                    <option key={prop.name} value={prop.name}>
                      {prop.label} ({prop.name})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Write Policy */}
            <div style={{ marginBottom: 32 }}>
              <label style={{ display: 'block', fontSize: 13, color: C.text2, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Write Policy
              </label>
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, cursor: 'pointer' }}>
                  <input
                    type="radio"
                    checked={writePolicy === 'empty_only'}
                    onChange={() => setWritePolicy('empty_only')}
                    style={{ cursor: 'pointer' }}
                  />
                  <span style={{ color: C.text, fontSize: 14 }}>Only write if empty</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input
                    type="radio"
                    checked={writePolicy === 'always'}
                    onChange={() => setWritePolicy('always')}
                    style={{ cursor: 'pointer' }}
                  />
                  <span style={{ color: C.text, fontSize: 14 }}>Always overwrite</span>
                </label>
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <button
                onClick={() => router.push('/arrangements')}
                style={{
                  padding: '10px 20px',
                  background: 'transparent',
                  border: `1px solid ${C.border}`,
                  color: C.text2,
                  fontSize: 14,
                  cursor: 'pointer',
                  fontFamily: F.sans,
                }}
              >
                Cancel
              </button>
              <button
                onClick={handlePreview}
                disabled={loadingPreview || !name}
                style={{
                  padding: '10px 20px',
                  background: C.indigo,
                  border: 'none',
                  color: '#fff',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: loadingPreview || !name ? 'not-allowed' : 'pointer',
                  opacity: loadingPreview || !name ? 0.5 : 1,
                  fontFamily: F.sans,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                {loadingPreview ? 'Loading...' : 'Preview'}
                {!loadingPreview && <ChevronRight size={16} />}
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Preview */}
        {currentStep === 2 && (
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 600, color: C.text, marginBottom: 24 }}>
              Step 2 of 3: Preview
            </h2>

            {/* Preview Table */}
            <div style={{ marginBottom: 24, overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                    <th style={{ padding: '12px 8px', textAlign: 'left', fontSize: 12, color: C.text3, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Contact
                    </th>
                    <th style={{ padding: '12px 8px', textAlign: 'left', fontSize: 12, color: C.text3, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Job Title
                    </th>
                    <th style={{ padding: '12px 8px', textAlign: 'left', fontSize: 12, color: C.text3, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Level
                    </th>
                    <th style={{ padding: '12px 8px', textAlign: 'left', fontSize: 12, color: C.text3, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Function
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {previewData.map((item) => (
                    <tr key={item.contactId} style={{ borderBottom: `1px solid ${C.border2}` }}>
                      <td style={{ padding: '12px 8px', fontSize: 13, color: C.text }}>{item.name}</td>
                      <td style={{ padding: '12px 8px', fontSize: 13, color: C.text2 }}>{item.jobTitle}</td>
                      <td style={{ padding: '12px 8px' }}>
                        <select
                          value={item.level}
                          onChange={(e) => handleCorrection(item.contactId, 'level', e.target.value)}
                          style={{
                            padding: '6px 8px',
                            background: C.bg,
                            border: `1px solid ${C.border}`,
                            color: C.text,
                            fontSize: 13,
                            fontFamily: F.sans,
                            cursor: 'pointer',
                          }}
                        >
                          {JOB_LEVELS.map((level) => (
                            <option key={level} value={level}>
                              {level}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td style={{ padding: '12px 8px' }}>
                        <select
                          value={item.function}
                          onChange={(e) => handleCorrection(item.contactId, 'function', e.target.value)}
                          style={{
                            padding: '6px 8px',
                            background: C.bg,
                            border: `1px solid ${C.border}`,
                            color: C.text,
                            fontSize: 13,
                            fontFamily: F.sans,
                            cursor: 'pointer',
                          }}
                        >
                          {JOB_FUNCTIONS.map((fn) => (
                            <option key={fn} value={fn}>
                              {fn}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Summary Stats */}
            <div style={{ marginBottom: 24, padding: 16, background: C.bg, border: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 13, color: C.text2, marginBottom: 16 }}>
                {previewData.length} sampled · {classifiedCount} classified · {skippedCount} skipped (no title)
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                {/* Level Breakdown */}
                <div>
                  <div style={{ fontSize: 12, color: C.text3, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Level
                  </div>
                  {Object.entries(breakdown.levels)
                    .sort(([, a], [, b]) => (b as number) - (a as number))
                    .map(([level, count]) => (
                      <div key={level} style={{ fontSize: 13, color: C.text2, marginBottom: 4 }}>
                        {level} <span style={{ color: C.text3 }}>{count}</span>
                      </div>
                    ))}
                </div>

                {/* Function Breakdown */}
                <div>
                  <div style={{ fontSize: 12, color: C.text3, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Function
                  </div>
                  {Object.entries(breakdown.functions)
                    .sort(([, a], [, b]) => (b as number) - (a as number))
                    .map(([fn, count]) => (
                      <div key={fn} style={{ fontSize: 13, color: C.text2, marginBottom: 4 }}>
                        {fn} <span style={{ color: C.text3 }}>{count}</span>
                      </div>
                    ))}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <button
                onClick={() => setCurrentStep(1)}
                style={{
                  padding: '10px 20px',
                  background: 'transparent',
                  border: `1px solid ${C.border}`,
                  color: C.text2,
                  fontSize: 14,
                  cursor: 'pointer',
                  fontFamily: F.sans,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <ChevronLeft size={16} />
                Back
              </button>
              <div style={{ display: 'flex', gap: 12 }}>
                <button
                  onClick={() => router.push('/arrangements')}
                  style={{
                    padding: '10px 20px',
                    background: 'transparent',
                    border: `1px solid ${C.border}`,
                    color: C.text2,
                    fontSize: 14,
                    cursor: 'pointer',
                    fontFamily: F.sans,
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleApply}
                  style={{
                    padding: '10px 20px',
                    background: C.indigo,
                    border: 'none',
                    color: '#fff',
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontFamily: F.sans,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  Apply to all {totalContactsCount.toLocaleString()}
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Running → Complete */}
        {currentStep === 3 && (
          <div>
            {runStats?.status === 'running' || runStats?.status === 'pending' ? (
              <>
                <h2 style={{ fontSize: 18, fontWeight: 600, color: C.text, marginBottom: 24 }}>
                  Processing...
                </h2>

                {/* Progress Bar */}
                <div style={{ marginBottom: 24 }}>
                  <div style={{ background: C.border, height: 8, marginBottom: 8 }}>
                    <div
                      style={{
                        background: '#2E6BA8',
                        height: '100%',
                        width: runStats ? `${(runStats.processed_count / totalContactsCount) * 100}%` : '0%',
                        transition: 'width 0.3s ease',
                      }}
                    />
                  </div>
                  <div style={{ fontSize: 14, color: C.text2 }}>
                    {runStats?.processed_count || 0} / {totalContactsCount.toLocaleString()}
                  </div>
                </div>

                {/* Stats */}
                <div style={{ fontSize: 13, color: C.text2, marginBottom: 24 }}>
                  Classified: {runStats?.updated_count || 0} · Skipped: {runStats?.skipped_count || 0} · Errors: {runStats?.error_count || 0}
                </div>

                <div style={{ fontSize: 13, color: C.text3, marginBottom: 24 }}>
                  Running in background. You can navigate away.
                </div>

                <button
                  onClick={() => router.push('/arrangements')}
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
                  View in History
                </button>
              </>
            ) : runStats?.status === 'completed' ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                  <Check size={24} color={C.green} />
                  <h2 style={{ fontSize: 18, fontWeight: 600, color: C.text }}>
                    Complete
                  </h2>
                </div>

                <div style={{ fontSize: 14, color: C.text2, marginBottom: 24 }}>
                  {runStats.processed_count.toLocaleString()} contacts processed
                </div>

                {/* Final Stats */}
                <div style={{ marginBottom: 24, padding: 16, background: C.bg, border: `1px solid ${C.border}` }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: '12px 16px', alignItems: 'center' }}>
                    <div style={{ fontSize: 13, color: C.text2 }}>Classified</div>
                    <div style={{ fontSize: 13, color: C.text }}>{runStats.updated_count.toLocaleString()}</div>
                    <div style={{ fontSize: 13, color: C.text3 }}>
                      {Math.round((runStats.updated_count / runStats.processed_count) * 100)}%
                    </div>

                    <div style={{ fontSize: 13, color: C.text2 }}>Skipped</div>
                    <div style={{ fontSize: 13, color: C.text }}>{runStats.skipped_count.toLocaleString()}</div>
                    <div style={{ fontSize: 13, color: C.text3 }}>
                      {Math.round((runStats.skipped_count / runStats.processed_count) * 100)}%
                    </div>

                    <div style={{ fontSize: 13, color: C.text2 }}>Errors</div>
                    <div style={{ fontSize: 13, color: C.text }}>{runStats.error_count.toLocaleString()}</div>
                    <div style={{ fontSize: 13, color: C.text3 }}>
                      {Math.round((runStats.error_count / runStats.processed_count) * 100)}%
                    </div>
                  </div>
                </div>

                <div style={{ fontSize: 13, color: C.text3, marginBottom: 24 }}>
                  Writing to: {levelField} · {functionField}
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 12 }}>
                  <button
                    onClick={() => {
                      setCurrentStep(1);
                      setRunId(null);
                      setRunStats(null);
                    }}
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
                    Run Again
                  </button>
                  <button
                    onClick={() => {
                      // Get portal ID from somewhere - for now placeholder
                      window.open('https://app.hubspot.com/contacts/49169539/contacts/list/view/all/', '_blank');
                    }}
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
                    View in HubSpot
                  </button>
                  <button
                    onClick={() => router.push('/arrangements')}
                    style={{
                      padding: '10px 20px',
                      background: C.indigo,
                      border: 'none',
                      color: '#fff',
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: 'pointer',
                      fontFamily: F.sans,
                    }}
                  >
                    Done
                  </button>
                </div>
              </>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                  <X size={24} color={C.red} />
                  <h2 style={{ fontSize: 18, fontWeight: 600, color: C.text }}>
                    Failed
                  </h2>
                </div>

                <div style={{ fontSize: 14, color: C.text2, marginBottom: 24 }}>
                  {runStats?.error_message || 'An error occurred during processing'}
                </div>

                <button
                  onClick={() => router.push('/arrangements')}
                  style={{
                    padding: '10px 20px',
                    background: C.indigo,
                    border: 'none',
                    color: '#fff',
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontFamily: F.sans,
                  }}
                >
                  Back to Arrangements
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
