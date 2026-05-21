'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { C, F } from '@/lib/design-tokens';
import { PrimaryBtn, CustomDropdown } from '@/components/refyne';
import type { CustomDropdownOption } from '@/components/refyne';
import { EnrichLoadingState } from '@/components/enrich/EnrichLoadingState';
import { addToast } from '@/components/ui/toast';

interface FieldGap {
  field: string;
  missing: number;
  coverage: number; // 0-100 percentage
}

interface GapAnalysis {
  total_companies: number;
  field_gaps: FieldGap[];
  scanned_at: string;
  from_cache?: boolean;
}

interface HarmonyPreview {
  field_key: string;
  field_label: string;
  harmony: {
    id: string;
    name: string;
    approach: string;
    will_apply: boolean;
    reason: string;
    example_input: string | null;
    example_output: string | null;
  } | null;
}

interface PreviewFieldResult {
  field_key: string;
  field_label: string;
  before: string | null;
  after: string | null;
  would_write: boolean;
  harmony_applied: boolean;
  harmony_name: string | null;
  provider: string | null;
}

interface PreviewCompanyResult {
  hubspot_company_id: string;
  company_name: string;
  fields: PreviewFieldResult[];
}

interface PreviewResults {
  preview_id: string;
  status: 'completed';
  records_processed: number;
  duration_seconds: number;
  results: PreviewCompanyResult[];
  summary: {
    fields_would_fill: number;
    fields_skipped: number;
    fields_not_found: number;
    harmonies_applied: number;
    no_domain: number;
    already_complete: number;
  };
}

interface HubSpotList {
  listId: string;
  name: string;
}

const ENRICHABLE_FIELDS = [
  { key: 'industry', label: 'Industry' },
  { key: 'numberofemployees', label: 'Employee count' },
  { key: 'linkedin_company_page', label: 'LinkedIn URL' },
  { key: 'phone', label: 'Phone' },
  { key: 'domain', label: 'Domain' },
  { key: 'annualrevenue', label: 'Revenue' },
];

const PROVIDER_REGISTRY = [
  { key: 'apollo', label: 'Apollo' },
  { key: 'zoominfo', label: 'ZoomInfo' },
  { key: 'cognism', label: 'Cognism' },
  { key: 'clearbit', label: 'Clearbit' },
  { key: 'refyne', label: 'Refyne Data' },
];

interface LifecycleStage {
  value: string;
  label: string;
  count: number;
}

interface Owner {
  id: string;
  name: string;
  email: string | null;
}

interface ProgressState {
  tested: number;
  matched: number;
  total: number;
}

interface BenchmarkRecommendation {
  best_provider: string;
  top_industries: Array<{ industry: string; count: number }>;
  combined_waterfall_coverage: number;
  apollo_coverage?: number;
  refyne_coverage?: number;
  message: string;
}

export default function EnrichPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [showAnimatedLoading, setShowAnimatedLoading] = useState(false);
  const [gapAnalysis, setGapAnalysis] = useState<GapAnalysis | null>(null);
  const [running, setRunning] = useState(false);
  const [loadingState, setLoadingState] = useState<'initial' | 'streaming' | 'complete'>('initial');
  const [fromCache, setFromCache] = useState(false);
  const [scannedCount, setScannedCount] = useState(0);
  const [lastScannedAt, setLastScannedAt] = useState<string | null>(null);

  // Configuration state
  const [companyScope, setCompanyScope] = useState<'all' | 'list' | 'segment' | 'csv'>('all');
  const [selectedList, setSelectedList] = useState<string>('');
  const [hubspotLists, setHubspotLists] = useState<HubSpotList[]>([]);
  const [listPermissionError, setListPermissionError] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvText, setCsvText] = useState<string>('');
  const [lifecycleStage, setLifecycleStage] = useState<string>('');
  const [ownerId, setOwnerId] = useState<string>('');
  const [selectedIndustries, setSelectedIndustries] = useState<string[]>([]);
  const [selectedFields, setSelectedFields] = useState<string[]>(['industry', 'numberofemployees']);
  const [selectedProviders, setSelectedProviders] = useState<string[]>(['apollo']);
  const [writePolicy, setWritePolicy] = useState<'fill_empty' | 'overwrite'>('fill_empty');
  const [connectedProviders, setConnectedProviders] = useState<string[]>([]);
  const [harmonyPreviews, setHarmonyPreviews] = useState<HarmonyPreview[]>([]);
  const [loadingHarmonies, setLoadingHarmonies] = useState(false);

  // Subsegment filter data
  const [lifecycleStages, setLifecycleStages] = useState<LifecycleStage[]>([]);
  const [owners, setOwners] = useState<Owner[]>([]);
  const [industries, setIndustries] = useState<string[]>([]);
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [sampleNames, setSampleNames] = useState<string[]>([]);
  const [loadingPreview, setLoadingPreview] = useState(false);

  // Test mode state
  const [testMode, setTestMode] = useState(false);
  const [testRecordLimit, setTestRecordLimit] = useState(10);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Preview state
  const [previewResults, setPreviewResults] = useState<PreviewResults | null>(null);
  const [showingPreview, setShowingPreview] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Benchmark state
  const [benchmarking, setBenchmarking] = useState(false);
  const [benchmarkResults, setBenchmarkResults] = useState<BenchmarkRecommendation | null>(null);
  const [benchmarkProgress, setBenchmarkProgress] = useState<Record<string, ProgressState>>({});
  const [benchmarkSampleSize, setBenchmarkSampleSize] = useState<number>(0);
  const [benchmarkTotalMissing, setBenchmarkTotalMissing] = useState<number>(0);

  // Fetch gap analysis on mount using streaming
  useEffect(() => {
    const es = new EventSource('/api/enrich/gaps/stream');

    es.onmessage = (event) => {
      const msg = JSON.parse(event.data);

      if (msg.type === 'complete' && msg.from_cache) {
        // Instant load from cache - skip animation entirely
        setGapAnalysis(msg.data);
        setLastScannedAt(msg.data.scanned_at);
        setFromCache(true);
        setLoadingState('complete');
        setShowAnimatedLoading(true); // Still trigger to show data
        setLoading(false);
        es.close();
        return;
      }

      if (msg.type === 'progress') {
        // Update counts live as pages come in
        setScannedCount(msg.processed);

        if (msg.processed > 0 && msg.fields.length > 0) {
          // Show gap analysis panel immediately with partial data
          setGapAnalysis({
            total_companies: msg.processed,
            field_gaps: msg.fields,
            scanned_at: new Date().toISOString(),
          });

          if (loadingState === 'initial') {
            setLoadingState('streaming');
            setShowAnimatedLoading(true);
            setLoading(false);
          }
        }
      }

      if (msg.type === 'complete' && !msg.from_cache) {
        setGapAnalysis(msg.data);
        setLastScannedAt(msg.data.scanned_at);
        setLoadingState('complete');
        setFromCache(false);
        es.close();
      }

      if (msg.type === 'error') {
        console.error('Gap stream error:', msg.error);
        setLoading(false);
        es.close();
      }
    };

    es.onerror = () => {
      console.error('EventSource connection error');
      es.close();
      // Fallback to regular fetch
      fetchGapsNonStreaming();
    };

    return () => es.close();
  }, []);

  // Fallback non-streaming fetch
  async function fetchGapsNonStreaming() {
    try {
      const res = await fetch('/api/enrich/gaps');
      if (res.ok) {
        const data = await res.json();
        setGapAnalysis(data);
        setShowAnimatedLoading(true);
        setLoading(false);
      }
    } catch (error) {
      console.error('Failed to fetch gap analysis:', error);
      setLoading(false);
    }
  }

  // Fetch other data on mount
  useEffect(() => {
    async function fetchConnections() {
      try {
        const res = await fetch('/api/providers/connections');
        if (res.ok) {
          const data = await res.json();
          const providerKeys = data.connections.map((c: any) => c.provider);
          setConnectedProviders(providerKeys);
        }
      } catch (error) {
        console.error('Failed to fetch provider connections:', error);
      }
    }

    async function fetchHubSpotLists() {
      try {
        const res = await fetch('/api/hubspot/lists');
        if (res.ok) {
          const data = await res.json();
          setHubspotLists(data.lists || []);
        } else if (res.status === 403) {
          setListPermissionError(true);
        }
      } catch (error) {
        console.error('Failed to fetch HubSpot lists:', error);
        setListPermissionError(true);
      }
    }

    async function fetchLifecycleStages() {
      try {
        const res = await fetch('/api/hubspot/lifecycle-stages');
        if (res.ok) {
          const data = await res.json();
          setLifecycleStages(data.stages || []);
        }
      } catch (error) {
        console.error('Failed to fetch lifecycle stages:', error);
      }
    }

    async function fetchOwners() {
      try {
        const res = await fetch('/api/hubspot/owners');
        if (res.ok) {
          const data = await res.json();
          setOwners(data.owners || []);
        }
      } catch (error) {
        console.error('Failed to fetch owners:', error);
      }
    }

    async function fetchIndustries() {
      try {
        const res = await fetch('/api/harmonies/industry/reference');
        if (res.ok) {
          const data = await res.json();
          setIndustries(data.industries || []);
        }
      } catch (error) {
        console.error('Failed to fetch industries:', error);
        setIndustries(['Healthcare', 'Software', 'Education', 'Manufacturing', 'Retail']);
      }
    }

    fetchConnections();
    fetchHubSpotLists();
    fetchLifecycleStages();
    fetchOwners();
    fetchIndustries();
  }, []);

  // Fetch harmony preview when selected fields change
  useEffect(() => {
    async function fetchHarmonyPreview() {
      if (selectedFields.length === 0) {
        setHarmonyPreviews([]);
        return;
      }

      setLoadingHarmonies(true);
      try {
        const res = await fetch(`/api/enrich/harmony-preview?fields=${selectedFields.join(',')}`);
        if (res.ok) {
          const data = await res.json();
          setHarmonyPreviews(data.fields || []);
        }
      } catch (error) {
        console.error('Failed to fetch harmony preview:', error);
      } finally {
        setLoadingHarmonies(false);
      }
    }

    fetchHarmonyPreview();
  }, [selectedFields]);

  // Fetch preview count when segment filters change (debounced)
  useEffect(() => {
    if (companyScope !== 'segment' || selectedFields.length === 0) {
      setPreviewCount(null);
      setSampleNames([]);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setLoadingPreview(true);
      try {
        const res = await fetch('/api/enrich/preview-count', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            source: 'segment',
            segment: {
              lifecycle_stage: lifecycleStage || undefined,
              owner_id: ownerId || undefined,
              industries: selectedIndustries.length > 0 ? selectedIndustries : undefined,
            },
            fields: selectedFields,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          setPreviewCount(data.count);
          setSampleNames(data.sample_names || []);
        }
      } catch (error) {
        console.error('Failed to fetch preview count:', error);
      } finally {
        setLoadingPreview(false);
      }
    }, 400);

    return () => clearTimeout(timeoutId);
  }, [companyScope, lifecycleStage, ownerId, selectedIndustries, selectedFields]);

  // Helper function to format time ago
  function formatTimeAgo(isoDate: string): string {
    const mins = Math.floor((Date.now() - new Date(isoDate).getTime()) / 60000);
    if (mins < 60) return `${mins} minutes ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} hours ago`;
    return `${Math.floor(hours / 24)} days ago`;
  }

  // Refresh gap analysis
  async function refreshGapAnalysis() {
    // Clear cache and restart stream
    setLoading(true);
    setShowAnimatedLoading(false);
    setLoadingState('initial');
    setFromCache(false);
    setScannedCount(0);

    // For now, reload to restart the EventSource connection
    window.location.reload();
  }

  // Handle CSV file upload
  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      setCsvFile(file);
      // Read file contents
      const reader = new FileReader();
      reader.onload = (evt) => {
        const text = evt.target?.result as string;
        setCsvText(text);
      };
      reader.readAsText(file);
    }
  }

  // Run enrichment or preview
  async function handleRunEnrichment() {
    if (selectedFields.length === 0) {
      alert('Please select at least one field to enrich');
      return;
    }
    if (selectedProviders.length === 0) {
      alert('Please select at least one provider');
      return;
    }

    // Test mode triggers preview instead of full run
    if (testMode) {
      await runPreview();
      return;
    }

    // Show confirmation modal for large runs
    const estimatedCount = companyScope === 'segment' ? (previewCount || 0) : gapAnalysis?.total_companies || 0;
    if (estimatedCount > 100) {
      setShowConfirmModal(true);
      return;
    }

    await executeEnrichment();
  }

  // Run preview on sample records
  async function runPreview() {
    setPreviewLoading(true);
    setShowingPreview(false);
    setPreviewResults(null);

    try {
      // Build source config
      let source: any = { type: companyScope };

      if (companyScope === 'list') {
        source.list_id = selectedList;
      } else if (companyScope === 'segment') {
        const filters: any = { missing_fields: selectedFields };
        if (lifecycleStage) filters.lifecyclestage = lifecycleStage;
        if (ownerId) filters.hubspot_owner_id = ownerId;
        if (selectedIndustries.length > 0) filters.industry = selectedIndustries;
        source.filters = filters;
      } else if (companyScope === 'csv') {
        source.domains = csvText.split('\n').filter(d => d.trim());
      } else {
        source.type = 'all';
        source.filters = { missing_fields: selectedFields };
      }

      const response = await fetch('/api/enrich/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fields: selectedFields,
          providers: selectedProviders,
          write_policy: writePolicy,
          record_limit: testRecordLimit,
          source,
        }),
      });

      const data = await response.json();

      // Debug logging
      console.log('[Preview] Response data:', {
        records_processed: data.records_processed,
        results_count: data.results?.length || 0,
        summary: data.summary,
        has_error: !!data.error
      });

      // Check for error in response (even if status is 200)
      if (data.error) {
        alert(data.error);
        // Still show results if available
        if (data.results) {
          setPreviewResults(data);
          setShowingPreview(true);
        }
        return;
      }

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate preview');
      }

      setPreviewResults(data);
      setShowingPreview(true);
    } catch (error) {
      console.error('Preview error:', error);
      alert(`Failed to generate preview: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setPreviewLoading(false);
    }
  }

  // Apply preview results to HubSpot
  async function applyPreviewResults() {
    if (!previewResults) return;

    setRunning(true);
    try {
      const response = await fetch('/api/enrich/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          preview_id: previewResults.preview_id,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to apply changes');
      }

      const data = await response.json();
      addToast('success', `Applied changes to ${data.applied} companies.`);

      // Reset to gap analysis view
      setShowingPreview(false);
      setPreviewResults(null);
      setTestMode(false);
    } catch (error) {
      console.error('Apply error:', error);
      alert(`Failed to apply changes: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setRunning(false);
    }
  }

  // Run full enrichment on all matching companies
  async function runFullEnrichment() {
    await executeEnrichment();
  }

  // Start over from preview
  function startOver() {
    setShowingPreview(false);
    setPreviewResults(null);
  }

  async function executeEnrichment() {
    setRunning(true);
    try {
      // Determine source type and config
      let source_type: 'hubspot_filter' | 'hubspot_list' | 'csv_domains';
      let source_config: any = {};

      if (companyScope === 'list') {
        source_type = 'hubspot_list';
        source_config = { listId: selectedList };
      } else if (companyScope === 'csv') {
        source_type = 'csv_domains';
        source_config = { domains: csvText.split('\n').filter(d => d.trim()) };
      } else {
        source_type = 'hubspot_filter';
        if (companyScope === 'segment') {
          // Apply segment filters
          const filters: any = { missing_fields: selectedFields };
          if (lifecycleStage) {
            filters.lifecyclestage = lifecycleStage;
          }
          if (ownerId) {
            filters.hubspot_owner_id = ownerId;
          }
          if (selectedIndustries.length > 0) {
            filters.industry = selectedIndustries;
          }
          source_config = { filters };
        } else {
          // "All companies with missing fields"
          source_config = { filters: { missing_fields: selectedFields } };
        }
      }

      // Build field_configs in v2 format
      const field_configs = selectedFields.map((field_key, index) => ({
        field_key,
        field_type: 'text',
        aggregation_strategy: 'waterfall',
        apply_harmony: true,
        steps: selectedProviders.map((provider, providerIndex) => ({
          order: providerIndex + 1,
          provider,
          policy: writePolicy === 'fill_empty' ? 'overwrite_if_blank_or_ours' : 'always_overwrite',
        })),
      }));

      // Build arrangement payload (no test mode)
      const arrangementPayload: any = {
        name: `Enrich missing fields - ${new Date().toLocaleDateString()}`,
        description: `Fill gaps in ${selectedFields.join(', ')} using ${selectedProviders.join(', ')}`,
        source_type,
        source_config,
        field_configs,
        output_destination: 'hubspot',
        output_config: { object_type: 'companies' },
      };

      const response = await fetch('/api/arrangements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(arrangementPayload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create enrichment arrangement');
      }

      const data = await response.json();
      const arrangementId = data.arrangement?.id || data.arrangement_id;

      if (!arrangementId) {
        throw new Error('No arrangement ID returned');
      }

      // Show success toast with link to view details
      addToast(
        'success',
        'Enrichment started. Refyne is processing your records.',
        {
          text: 'View details',
          href: `/arrangements/${arrangementId}`,
        }
      );

      // Redirect to arrangements list with highlight
      router.push(`/arrangements?highlight=${arrangementId}`);
    } catch (error) {
      console.error('Failed to create enrichment:', error);
      alert(`Failed to create enrichment: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setRunning(false);
    }
  }

  // Handle field row click in gap analysis
  function handleFieldClick(fieldKey: string) {
    if (selectedFields.includes(fieldKey)) {
      setSelectedFields(prev => prev.filter(f => f !== fieldKey));
    } else {
      setSelectedFields(prev => [...prev, fieldKey]);
    }
  }

  // Run benchmark
  async function runBenchmark() {
    if (selectedFields.length === 0) {
      alert('Please select at least one field to benchmark');
      return;
    }

    setBenchmarking(true);
    setBenchmarkProgress({});
    setBenchmarkResults(null);
    setBenchmarkSampleSize(0);
    setBenchmarkTotalMissing(0);

    const fields = selectedFields.join(',');
    const es = new EventSource(`/api/enrich/benchmark/stream?fields=${fields}`);

    es.onmessage = (event) => {
      const msg = JSON.parse(event.data);

      if (msg.type === 'sample_ready') {
        // Show sample size and distribution
        setBenchmarkSampleSize(msg.sample_size);
        setBenchmarkTotalMissing(msg.total_companies);
        console.log('Testing', msg.sample_size, 'companies from', msg.total_companies, 'missing');
      }

      if (msg.type === 'provider_start') {
        setBenchmarkProgress(prev => ({
          ...prev,
          [msg.provider]: { tested: 0, matched: 0, total: 0 }
        }));
      }

      if (msg.type === 'progress') {
        setBenchmarkProgress(prev => ({
          ...prev,
          [msg.provider]: {
            tested: msg.tested,
            matched: msg.matched,
            total: msg.total
          }
        }));
      }

      if (msg.type === 'provider_complete') {
        // Provider finished
      }

      if (msg.type === 'provider_skip') {
        // Provider skipped
        setBenchmarkProgress(prev => {
          const newProgress = { ...prev };
          delete newProgress[msg.provider];
          return newProgress;
        });
      }

      if (msg.type === 'complete') {
        setBenchmarkResults(msg.recommendation);
        setBenchmarking(false);
        es.close();
      }

      if (msg.type === 'error') {
        console.error('Benchmark error:', msg.error);
        alert(`Benchmark failed: ${msg.error}`);
        setBenchmarking(false);
        es.close();
      }
    };

    es.onerror = () => {
      console.error('EventSource connection error');
      alert('Benchmark connection failed');
      setBenchmarking(false);
      es.close();
    };
  }

  // Configure enrichment from benchmark results
  function applyBenchmarkConfig() {
    if (!benchmarkResults) return;

    // Set providers based on recommendation
    if (benchmarkResults.best_provider === 'refyne') {
      setSelectedProviders(['refyne', 'apollo']);
    } else {
      setSelectedProviders(['apollo', 'refyne']);
    }

    // Close benchmark modal
    setBenchmarkResults(null);
    setBenchmarking(false);

    // Scroll to provider section
    addToast('success', 'Waterfall configured based on benchmark results');
  }

  if (loading) {
    // If we have gap analysis data, show animated loading state
    if (showAnimatedLoading && gapAnalysis) {
      return (
        <EnrichLoadingState
          onComplete={() => setLoading(false)}
          finalCount={gapAnalysis.total_companies}
          finalFieldGaps={gapAnalysis.field_gaps}
        />
      );
    }

    // Otherwise show simple loading state
    return (
      <div style={{ padding: 24, maxWidth: 1400, margin: '0 auto', fontFamily: F.sans }}>
        <div style={{ padding: 40, textAlign: 'center', color: C.text3 }}>
          <p>Scanning your HubSpot companies...</p>
        </div>
      </div>
    );
  }

  if (!gapAnalysis) {
    return (
      <div style={{ padding: 24, maxWidth: 1400, margin: '0 auto', fontFamily: F.sans }}>
        <div style={{ padding: 40, textAlign: 'center', color: C.red }}>
          <p>Failed to load gap analysis. Please refresh the page.</p>
        </div>
      </div>
    );
  }

  const maxMissing = gapAnalysis.field_gaps.reduce((sum, g) => Math.max(sum, g.missing), 0);

  return (
    <div style={{ padding: 24, maxWidth: 1400, margin: '0 auto', fontFamily: F.sans }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 4, color: C.text }}>
          Enrich
        </h1>
        <p style={{ color: C.text2, fontSize: 14 }}>
          Fill gaps in your existing HubSpot company records
        </p>
      </div>

      {/* Two-panel layout */}
      <div style={{ display: 'flex', gap: 24 }}>
        {/* Left panel - Configuration */}
        <div style={{ width: 320, flexShrink: 0 }}>
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.text3, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 20 }}>
              Configure enrichment
            </div>

            {/* Source selection */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: C.text, marginBottom: 8 }}>
                Source
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                  <input
                    type="radio"
                    checked={companyScope === 'all'}
                    onChange={() => setCompanyScope('all')}
                    style={{ cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: 12, color: C.text2 }}>
                    All companies ({maxMissing.toLocaleString()})
                  </span>
                </label>

                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                    <input
                      type="radio"
                      checked={companyScope === 'list'}
                      onChange={() => setCompanyScope('list')}
                      style={{ cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: 12, color: C.text2 }}>HubSpot list</span>
                  </label>
                  {companyScope === 'list' && (
                    <div style={{ marginLeft: 22, marginTop: 8 }}>
                      {listPermissionError ? (
                        <input
                          type="text"
                          placeholder="Enter list ID..."
                          value={selectedList}
                          onChange={(e) => setSelectedList(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '6px 8px',
                            background: C.bg,
                            border: `1px solid ${C.border}`,
                            color: C.text,
                            fontSize: 12,
                            borderRadius: 4,
                          }}
                        />
                      ) : (
                        <CustomDropdown
                          value={selectedList}
                          onChange={setSelectedList}
                          options={hubspotLists.map(list => ({
                            value: list.listId,
                            label: list.name,
                          }))}
                          placeholder="Select a list..."
                        />
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                    <input
                      type="radio"
                      checked={companyScope === 'segment'}
                      onChange={() => setCompanyScope('segment')}
                      style={{ cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: 12, color: C.text2 }}>Segment filter</span>
                  </label>
                  {companyScope === 'segment' && (
                    <div style={{ marginLeft: 22, marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <CustomDropdown
                        value={lifecycleStage}
                        onChange={setLifecycleStage}
                        options={lifecycleStages.map(stage => ({
                          value: stage.value,
                          label: stage.label,
                          count: stage.count > 0 ? stage.count : undefined,
                        }))}
                        placeholder="Lifecycle..."
                      />

                      <CustomDropdown
                        value={ownerId}
                        onChange={setOwnerId}
                        options={owners.map(owner => ({
                          value: owner.id,
                          label: owner.name,
                        }))}
                        placeholder="Owner..."
                      />

                      <select
                        multiple
                        value={selectedIndustries}
                        onChange={(e) => {
                          const selected = Array.from(e.target.selectedOptions, option => option.value);
                          setSelectedIndustries(selected);
                        }}
                        style={{
                          width: '100%',
                          padding: '6px 8px',
                          background: C.bg,
                          border: `1px solid ${C.border}`,
                          color: C.text,
                          fontSize: 11,
                          minHeight: 60,
                          borderRadius: 4,
                        }}
                      >
                        {industries.map(industry => (
                          <option key={industry} value={industry}>
                            {industry}
                          </option>
                        ))}
                      </select>

                      {loadingPreview ? (
                        <div style={{ fontSize: 11, color: C.text3 }}>Calculating...</div>
                      ) : previewCount !== null && (
                        <div style={{ fontSize: 11, color: C.text2 }}>
                          {previewCount.toLocaleString()} matches
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                    <input
                      type="radio"
                      checked={companyScope === 'csv'}
                      onChange={() => setCompanyScope('csv')}
                      style={{ cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: 12, color: C.text2 }}>CSV import</span>
                  </label>
                  {companyScope === 'csv' && (
                    <div style={{ marginLeft: 22, marginTop: 8 }}>
                      <label
                        style={{
                          display: 'block',
                          padding: 16,
                          background: C.bg,
                          border: `2px dashed ${C.border}`,
                          borderRadius: 4,
                          textAlign: 'center',
                          cursor: 'pointer',
                          marginBottom: 8,
                        }}
                      >
                        <input
                          type="file"
                          accept=".csv"
                          onChange={handleFileUpload}
                          style={{ display: 'none' }}
                        />
                        <div style={{ fontSize: 11, color: C.text3 }}>
                          {csvFile ? csvFile.name : 'Upload CSV'}
                        </div>
                      </label>
                      <textarea
                        placeholder="Or paste domains..."
                        value={csvText}
                        onChange={(e) => setCsvText(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '6px 8px',
                          background: C.bg,
                          border: `1px solid ${C.border}`,
                          color: C.text,
                          fontSize: 11,
                          fontFamily: F.mono,
                          minHeight: 60,
                          borderRadius: 4,
                          resize: 'vertical',
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Fields to fill */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: C.text, marginBottom: 8 }}>
                Fields to fill
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {ENRICHABLE_FIELDS.map(field => (
                  <label key={field.key} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={selectedFields.includes(field.key)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedFields(prev => [...prev, field.key]);
                        } else {
                          setSelectedFields(prev => prev.filter(f => f !== field.key));
                        }
                      }}
                      style={{ cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: 12, color: C.text2 }}>{field.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Harmonies section */}
            {selectedFields.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: C.text, marginBottom: 8 }}>
                  Harmonies
                </div>
                <div style={{
                  padding: 12,
                  background: C.bg,
                  border: `1px solid ${C.border}`,
                  borderRadius: 4,
                  maxHeight: 180,
                  overflowY: 'auto',
                }}>
                  {loadingHarmonies ? (
                    <div style={{ padding: 8, textAlign: 'center', color: C.text3, fontSize: 11 }}>
                      Loading harmonies...
                    </div>
                  ) : (() => {
                    const activeHarmonies = harmonyPreviews.filter(p => p.harmony && p.harmony.will_apply);

                    if (activeHarmonies.length === 0) {
                      return (
                        <div style={{ padding: 8 }}>
                          <div style={{ fontSize: 11, color: C.text2, marginBottom: 8 }}>
                            No harmonies configured for selected fields.
                          </div>
                          <div style={{ fontSize: 10, color: C.text3, marginBottom: 12 }}>
                            Industry normalization would improve data quality.
                          </div>
                          <a
                            href="/harmonies"
                            style={{
                              display: 'inline-block',
                              padding: '6px 10px',
                              background: 'transparent',
                              border: `1px solid ${C.border}`,
                              borderRadius: 4,
                              color: C.indigo,
                              fontSize: 11,
                              textDecoration: 'none',
                            }}
                          >
                            Browse harmony library →
                          </a>
                        </div>
                      );
                    }

                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {activeHarmonies.map((preview) => {
                          const harmony = preview.harmony!;
                          return (
                            <div key={preview.field_key} style={{ fontSize: 11 }}>
                              <a
                                href={`/harmonies/${harmony.id}`}
                                style={{ color: '#2E6BA8', textDecoration: 'none', fontWeight: 500 }}
                              >
                                {harmony.name}
                              </a>
                              <div style={{ color: C.text3, fontSize: 10, marginTop: 2 }}>
                                → {preview.field_label}
                              </div>
                              {harmony.example_input && harmony.example_output && (
                                <div style={{ color: C.text3, fontSize: 10, marginTop: 2 }}>
                                  Example: "{harmony.example_input}" → "{harmony.example_output}"
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}

            {/* Provider selection */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: C.text }}>
                  Provider
                </div>
                <button
                  onClick={runBenchmark}
                  disabled={benchmarking || selectedFields.length === 0}
                  style={{
                    padding: '4px 8px',
                    background: 'transparent',
                    border: `1px solid ${C.border}`,
                    borderRadius: 4,
                    color: benchmarking || selectedFields.length === 0 ? C.text3 : C.indigo,
                    fontSize: 10,
                    cursor: benchmarking || selectedFields.length === 0 ? 'not-allowed' : 'pointer',
                    fontWeight: 500,
                  }}
                >
                  {benchmarking ? 'Benchmarking...' : 'Benchmark'}
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {PROVIDER_REGISTRY.filter(p => connectedProviders.includes(p.key)).map(provider => (
                  <label key={provider.key} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={selectedProviders.includes(provider.key)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedProviders(prev => [...prev, provider.key]);
                        } else {
                          setSelectedProviders(prev => prev.filter(p => p !== provider.key));
                        }
                      }}
                      style={{ cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: 12, color: C.text2 }}>{provider.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Write policy */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: C.text, marginBottom: 8 }}>
                Write policy
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                  <input
                    type="radio"
                    checked={writePolicy === 'fill_empty'}
                    onChange={() => setWritePolicy('fill_empty')}
                    style={{ cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: 12, color: C.text2 }}>Fill empty only</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                  <input
                    type="radio"
                    checked={writePolicy === 'overwrite'}
                    onChange={() => setWritePolicy('overwrite')}
                    style={{ cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: 12, color: C.text2 }}>Overwrite all</span>
                </label>
              </div>
            </div>

            {/* Test mode */}
            <div style={{ marginBottom: 20, paddingTop: 16, borderTop: `1px solid ${C.border}` }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={testMode}
                  onChange={(e) => setTestMode(e.target.checked)}
                  style={{ cursor: 'pointer' }}
                />
                <span style={{ fontSize: 12, color: C.text2 }}>Test mode:</span>
                <input
                  type="number"
                  value={testRecordLimit}
                  onChange={(e) => setTestRecordLimit(Math.max(1, parseInt(e.target.value) || 10))}
                  disabled={!testMode}
                  style={{
                    width: 50,
                    padding: '4px 6px',
                    background: testMode ? C.bg : C.hover,
                    border: `1px solid ${C.border}`,
                    color: testMode ? C.text : C.text3,
                    fontSize: 11,
                    borderRadius: 4,
                  }}
                />
                <span style={{ fontSize: 12, color: C.text2 }}>records</span>
              </label>
            </div>

            {/* Run button */}
            <PrimaryBtn onClick={handleRunEnrichment} disabled={running || previewLoading}>
              {running
                ? 'Creating...'
                : previewLoading
                ? 'Loading preview...'
                : testMode
                ? `Preview ${testRecordLimit} records`
                : `Enrich all ${(companyScope === 'segment' ? (previewCount || 0) : gapAnalysis?.total_companies || 0).toLocaleString()} companies →`}
            </PrimaryBtn>
          </div>
        </div>

        {/* Right panel - Gap Analysis or Preview Results */}
        <div style={{ flex: 1 }}>
          {/* Benchmark Progress */}
          {benchmarking && (
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: 24, marginBottom: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Running benchmark...</div>

              {benchmarkSampleSize > 0 && (
                <div style={{ fontSize: 12, color: C.text2, marginBottom: 16 }}>
                  Testing {benchmarkSampleSize} companies (from {benchmarkTotalMissing.toLocaleString()} with gaps)
                </div>
              )}

              {Object.entries(benchmarkProgress).map(([provider, progress]) => {
                const percentage = progress.total > 0 ? (progress.tested / progress.total) * 100 : 0;
                const matchRate = progress.tested > 0 ? (progress.matched / progress.tested) * 100 : 0;

                return (
                  <div key={provider} style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 13, marginBottom: 4, color: C.text }}>
                      {provider === 'apollo' ? 'Apollo' : 'Refyne Data'}
                      {provider === 'refyne' && <span style={{ color: C.text3, fontSize: 11 }}> (batching 10 at a time)</span>}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ flex: 1, height: 8, background: C.bg, borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{
                          width: `${percentage}%`,
                          height: '100%',
                          background: C.green,
                          transition: 'width 0.3s ease'
                        }} />
                      </div>
                      <div style={{ fontSize: 11, color: C.text3, minWidth: 140 }}>
                        {progress.tested}/{progress.total} · matched: {progress.matched} ({Math.round(matchRate)}%)
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Benchmark Results */}
          {benchmarkResults && !benchmarking && (
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: 24, marginBottom: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Benchmark Results</div>

              {/* Match rate scorecard */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
                {benchmarkResults.apollo_coverage !== undefined && (
                  <div style={{ padding: 16, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 6 }}>
                    <div style={{ fontSize: 11, color: C.text3, marginBottom: 4 }}>Apollo</div>
                    <div style={{ fontSize: 24, fontWeight: 600, color: C.text }}>
                      {Math.round(benchmarkResults.apollo_coverage * 100)}%
                    </div>
                    <div style={{ fontSize: 10, color: C.text3 }}>match rate</div>
                  </div>
                )}
                <div style={{ padding: 16, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 6 }}>
                  <div style={{ fontSize: 11, color: C.text3, marginBottom: 4 }}>Refyne Data</div>
                  <div style={{ fontSize: 24, fontWeight: 600, color: C.text }}>
                    {Math.round(benchmarkResults.refyne_coverage! * 100)}%
                  </div>
                  <div style={{ fontSize: 10, color: C.text3 }}>match rate</div>
                </div>
              </div>

              {/* Extrapolation */}
              <div style={{ padding: 16, background: C.indigoDim, border: `1px solid ${C.indigoBrd}`, borderRadius: 6, marginBottom: 16 }}>
                <div style={{ fontSize: 12, color: C.text2, marginBottom: 8 }}>
                  <strong>Waterfall Coverage</strong>
                </div>
                <div style={{ fontSize: 20, fontWeight: 600, color: C.text, marginBottom: 8 }}>
                  {Math.round(benchmarkResults.combined_waterfall_coverage * 100)}%
                </div>
                <div style={{ fontSize: 11, color: C.text2 }}>
                  {benchmarkResults.message}
                </div>
              </div>

              {/* Top industries */}
              {benchmarkResults.top_industries.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: C.text3, textTransform: 'uppercase', marginBottom: 8 }}>
                    Sample Distribution
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {benchmarkResults.top_industries.map(({ industry, count }) => (
                      <div key={industry} style={{
                        padding: '4px 8px',
                        background: C.bg,
                        border: `1px solid ${C.border}`,
                        borderRadius: 4,
                        fontSize: 10,
                        color: C.text2
                      }}>
                        {industry} ({count})
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: 12 }}>
                <button
                  onClick={applyBenchmarkConfig}
                  style={{
                    padding: '10px 16px',
                    background: C.indigo,
                    border: 'none',
                    borderRadius: 6,
                    color: 'white',
                    fontSize: 13,
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                >
                  Run enrichment with {benchmarkResults.best_provider === 'refyne' ? 'Refyne → Apollo' : 'Apollo → Refyne'} waterfall
                </button>
                <button
                  onClick={() => setBenchmarkResults(null)}
                  style={{
                    padding: '10px 16px',
                    background: 'transparent',
                    border: `1px solid ${C.border}`,
                    borderRadius: 6,
                    color: C.text2,
                    fontSize: 13,
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          )}

          {previewLoading ? (
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: 24 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.text3, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 16 }}>
                Generating preview
              </div>
              <div style={{ padding: 40, textAlign: 'center', color: C.text3 }}>
                <p>Loading preview results...</p>
              </div>
            </div>
          ) : showingPreview && previewResults ? (
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: 24 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.text3, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 16 }}>
                Preview results
              </div>

              {/* Summary stats */}
              <div style={{ fontSize: 14, color: C.text2, marginBottom: 20 }}>
                {previewResults.records_processed} records · {previewResults.summary.fields_would_fill} fields would be filled
                {previewResults.summary.harmonies_applied > 0 && (
                  <span> · {previewResults.summary.harmonies_applied} normalized by harmony</span>
                )}
                {' · '}
                {Math.round(previewResults.duration_seconds)}s
              </div>

              {/* Always show table */}
              {previewResults.results && previewResults.results.length > 0 ? (
                <div style={{ maxHeight: 500, overflowY: 'auto', marginBottom: 20, border: `1px solid ${C.border}`, borderRadius: 4 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead style={{ position: 'sticky', top: 0, background: C.surface, zIndex: 1 }}>
                      <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                        <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: C.text3, textTransform: 'uppercase' }}>
                          Company
                        </th>
                        <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: C.text3, textTransform: 'uppercase' }}>
                          Field
                        </th>
                        <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: C.text3, textTransform: 'uppercase' }}>
                          Current Value
                        </th>
                        <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: C.text3, textTransform: 'uppercase' }}>
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewResults.results.flatMap(company =>
                      company.fields.map(field => {
                        // Determine status and styling
                        let status = '';
                        let statusColor: string = C.text3;

                        if (field.would_write) {
                          if (field.harmony_applied) {
                            status = 'Normalized ✦';
                            statusColor = '#6366F1'; // indigo
                          } else {
                            status = 'Filled';
                            statusColor = '#22C55E'; // green
                          }
                        } else if (field.before && field.before.trim() !== '') {
                          status = 'Already set';
                          statusColor = C.text3;
                        } else if (!field.after) {
                          // Check if company has domain
                          const companyHasDomain = company.fields.some(f => f.field_key === 'domain' && f.before);
                          if (!companyHasDomain && previewResults.summary.no_domain > 0) {
                            status = 'No domain';
                            statusColor = '#F59E0B'; // amber
                          } else {
                            status = 'Not found in Apollo';
                            statusColor = '#F59E0B'; // amber
                          }
                        } else {
                          status = 'Skipped';
                          statusColor = C.text3;
                        }

                        return (
                          <tr key={`${company.hubspot_company_id}-${field.field_key}`} style={{ borderBottom: `1px solid ${C.border}` }}>
                            <td style={{ padding: '8px 12px', color: C.text }}>{company.company_name}</td>
                            <td style={{ padding: '8px 12px', color: C.text2 }}>{field.field_label}</td>
                            <td style={{ padding: '8px 12px', color: C.text3 }}>
                              {field.before || <span style={{ fontStyle: 'italic', color: C.text3 }}>(empty)</span>}
                            </td>
                            <td style={{ padding: '8px 12px', color: statusColor, fontWeight: 500 }}>
                              {status}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
              ) : (
                <div style={{
                  padding: 40,
                  textAlign: 'center',
                  border: `1px solid ${C.border}`,
                  borderRadius: 4,
                  marginBottom: 20,
                  color: C.text3
                }}>
                  <div style={{ marginBottom: 8, fontSize: 13 }}>No company data returned</div>
                  <div style={{ fontSize: 11 }}>
                    The preview API returned no results. This may indicate an issue with the data source or Apollo connection.
                  </div>
                </div>
              )}

              {/* Warning if all failed */}
              {previewResults.summary.fields_would_fill === 0 && (
                <div style={{
                  background: C.amberDim,
                  border: `1px solid ${C.amberBrd}`,
                  borderRadius: 6,
                  padding: 16,
                  marginBottom: 20,
                  fontSize: 13,
                  color: C.text
                }}>
                  <strong>Apollo returned no data</strong> for these {previewResults.records_processed} companies.
                  {previewResults.summary.no_domain > 0 && (
                    <div style={{ marginTop: 8, color: C.text2 }}>
                      {previewResults.summary.no_domain} companies have no domain in HubSpot and cannot be enriched.
                    </div>
                  )}
                </div>
              )}

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: 12 }}>
                {previewResults.summary.fields_would_fill > 0 && (
                  <>
                    <PrimaryBtn onClick={applyPreviewResults}>
                      Apply to these {previewResults.records_processed} records
                    </PrimaryBtn>
                    <PrimaryBtn onClick={runFullEnrichment}>
                      Run on all {(companyScope === 'segment' ? (previewCount || 0) : gapAnalysis?.total_companies || 0).toLocaleString()} companies →
                    </PrimaryBtn>
                  </>
                )}
                <button
                  onClick={startOver}
                  style={{
                    padding: '10px 16px',
                    background: 'transparent',
                    border: `1px solid ${C.border}`,
                    borderRadius: 6,
                    color: C.text2,
                    fontSize: 13,
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                >
                  {previewResults.summary.fields_would_fill > 0 ? 'Start over' : 'Try different sample →'}
                </button>
              </div>
            </div>
          ) : (
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.text3, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Data gaps in your HubSpot
                  {loadingState === 'streaming' && (
                    <span style={{ marginLeft: 12, fontSize: 11, color: C.amber, fontWeight: 400 }}>
                      Scanning... {scannedCount.toLocaleString()} companies
                    </span>
                  )}
                  {fromCache && lastScannedAt && (
                    <span style={{ marginLeft: 12, fontSize: 11, color: C.text3, fontWeight: 400 }}>
                      Last scanned {formatTimeAgo(lastScannedAt)}
                    </span>
                  )}
                </div>
                {loadingState === 'complete' && (
                  <button
                    onClick={refreshGapAnalysis}
                    style={{
                      padding: '4px 12px',
                      background: 'transparent',
                      border: `1px solid ${C.border}`,
                      color: C.text3,
                      cursor: 'pointer',
                      fontSize: 11,
                      borderRadius: 4,
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = C.text; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = C.text3; }}
                  >
                    Refresh
                  </button>
                )}
              </div>

              <div style={{ fontSize: 20, fontWeight: 600, color: C.text, marginBottom: 20 }}>
                {gapAnalysis.total_companies.toLocaleString()} companies scanned
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                    <th style={{ padding: '8px 0', textAlign: 'left', fontSize: 11, fontWeight: 600, color: C.text3, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Field
                    </th>
                    <th style={{ padding: '8px 0', textAlign: 'right', fontSize: 11, fontWeight: 600, color: C.text3, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Missing
                    </th>
                    <th style={{ padding: '8px 0', textAlign: 'left', fontSize: 11, fontWeight: 600, color: C.text3, textTransform: 'uppercase', letterSpacing: '0.05em', paddingLeft: 16 }}>
                      Coverage
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {gapAnalysis.field_gaps.map((gap) => {
                    const isSelected = selectedFields.includes(gap.field);
                    return (
                      <tr
                        key={gap.field}
                        onClick={() => handleFieldClick(gap.field)}
                        style={{
                          borderBottom: `1px solid ${C.border}`,
                          cursor: 'pointer',
                          background: isSelected ? C.hover : 'transparent',
                        }}
                      >
                        <td style={{ padding: '12px 8px', fontSize: 14, color: C.text }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}}
                              style={{ cursor: 'pointer' }}
                            />
                            {ENRICHABLE_FIELDS.find(f => f.key === gap.field)?.label || gap.field}
                          </div>
                        </td>
                        <td style={{ padding: '12px 8px', textAlign: 'right', fontSize: 14, fontFamily: F.mono, color: C.text2 }}>
                          {gap.missing.toLocaleString()}
                        </td>
                        <td style={{ padding: '12px 8px', paddingLeft: 16 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ flex: 1, height: 6, background: C.hover, borderRadius: 3, overflow: 'hidden' }}>
                              <div
                                style={{
                                  height: '100%',
                                  width: `${gap.coverage}%`,
                                  background: gap.coverage >= 80 ? C.green : gap.coverage >= 50 ? C.amber : C.red,
                                  borderRadius: 3,
                                }}
                              />
                            </div>
                            <span style={{ fontSize: 12, fontFamily: F.mono, color: C.text3, minWidth: 40 }}>
                              {gap.coverage}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Confirmation modal */}
      {showConfirmModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setShowConfirmModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: C.surface,
              border: `1px solid ${C.border}`,
              padding: 32,
              maxWidth: 480,
              width: '90%',
              borderRadius: 8,
            }}
          >
            <div style={{ fontSize: 18, fontWeight: 600, color: C.text, marginBottom: 20 }}>
              Confirm enrichment run
            </div>
            <div style={{ fontSize: 14, color: C.text2, marginBottom: 16 }}>
              <div style={{ marginBottom: 12 }}>
                Enriching{' '}
                <strong style={{ color: C.text }}>
                  {(companyScope === 'segment' ? (previewCount || 0) : (gapAnalysis?.total_companies || 0)).toLocaleString()}
                </strong>{' '}
                companies
              </div>
              <div style={{ fontSize: 12, color: C.text3, marginBottom: 8 }}>
                <strong style={{ color: C.text2 }}>Fields:</strong> {selectedFields.map(f => ENRICHABLE_FIELDS.find(ef => ef.key === f)?.label || f).join(', ')}
              </div>
              <div style={{ fontSize: 12, color: C.text3, marginBottom: 8 }}>
                <strong style={{ color: C.text2 }}>Provider:</strong> {selectedProviders.join(', ')}
              </div>
              <div style={{ fontSize: 12, color: C.text3, marginBottom: 8 }}>
                <strong style={{ color: C.text2 }}>Policy:</strong> {writePolicy === 'fill_empty' ? 'Fill empty only' : 'Overwrite'}
              </div>
              {harmonyPreviews.some(p => p.harmony?.will_apply) && (
                <div style={{ fontSize: 12, color: C.text3 }}>
                  <strong style={{ color: C.text2 }}>Harmonies:</strong> {harmonyPreviews.filter(p => p.harmony?.will_apply).map(p => p.harmony!.name).join(', ')} will run
                </div>
              )}
            </div>
            <div style={{ fontSize: 13, color: C.text2, marginBottom: 20, padding: 12, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 4 }}>
              This will make changes to your HubSpot records.
              Changes can be reviewed in the arrangement history.
            </div>
            <div style={{ fontSize: 12, color: C.text3, marginBottom: 20 }}>
              Not sure?{' '}
              <button
                onClick={() => {
                  setShowConfirmModal(false);
                  setTestMode(true);
                  setTestRecordLimit(10);
                }}
                style={{ background: 'none', border: 'none', color: '#2E6BA8', cursor: 'pointer', textDecoration: 'underline', fontSize: 12 }}
              >
                Run a test on 10 records first
              </button>
            </div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowConfirmModal(false)}
                style={{
                  padding: '8px 16px',
                  background: C.hover,
                  border: `1px solid ${C.border}`,
                  color: C.text2,
                  cursor: 'pointer',
                  fontSize: 13,
                  borderRadius: 4,
                }}
              >
                Cancel
              </button>
              <PrimaryBtn
                onClick={() => {
                  setShowConfirmModal(false);
                  executeEnrichment();
                }}
              >
                Enrich {(companyScope === 'segment' ? (previewCount || 0) : (gapAnalysis?.total_companies || 0)).toLocaleString()} companies →
              </PrimaryBtn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
