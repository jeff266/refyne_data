'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Check, Loader2, Sparkles, PlayCircle, Zap } from 'lucide-react';
import { C, Button, Select } from '@/lib/refyne';
import { toast } from 'sonner';

// Types
interface Arrangement {
  id: string;
  name: string;
  provider: string;
  write_policy: string;
  fields: string[];
  source_query: string;
  created_at: string;
}

interface ArrangementRun {
  id: string;
  arrangement_id: string;
  status: 'running' | 'completed' | 'failed';
  is_test: boolean;
  test_record_count?: number;
  total_records: number;
  records_processed: number;
  started_at: string;
  completed_at?: string;
}

interface ProgressRecord {
  id: string;
  run_id: string;
  company_name: string;
  company_domain: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  fields_filled: Record<string, { before: string | null; after: string | null; normalized: boolean; skipped: boolean; skip_reason?: string }>;
  created_at: string;
}

interface TestResult {
  company_name: string;
  company_domain: string;
  field_name: string;
  before_value: string | null;
  after_value: string | null;
  normalized: boolean;
  skipped: boolean;
  skip_reason?: string;
}

interface HarmonyPreview {
  id: string;
  name: string;
  description: string;
  field: string;
}

type Tab = 'live' | 'history' | 'config';

export default function ArrangementDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [arrangement, setArrangement] = useState<Arrangement | null>(null);
  const [currentRun, setCurrentRun] = useState<ArrangementRun | null>(null);
  const [progressRecords, setProgressRecords] = useState<ProgressRecord[]>([]);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [harmonies, setHarmonies] = useState<HarmonyPreview[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>('live');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const feedListRef = useRef<HTMLDivElement>(null);
  const testCompleteRef = useRef<HTMLDivElement>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const elapsedTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch arrangement data
  const fetchArrangement = async () => {
    try {
      const response = await fetch(`/api/arrangements/${params.id}`);
      if (!response.ok) throw new Error('Failed to fetch arrangement');
      const data = await response.json();
      setArrangement(data);

      // Fetch harmonies for this arrangement
      await fetchHarmonies();

      // Check if there's a current run
      await fetchRunStatus();
    } catch (error) {
      console.error('Error fetching arrangement:', error);
      toast.error('Failed to load arrangement details');
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch current run status
  const fetchRunStatus = async () => {
    try {
      const response = await fetch(`/api/arrangements/${params.id}/runs?limit=1`);
      if (!response.ok) return;

      const data = await response.json();
      if (data.runs && data.runs.length > 0) {
        const run = data.runs[0];
        setCurrentRun(run);

        // If run is active, start polling
        if (run.status === 'running') {
          startPolling();

          // Calculate elapsed time
          const startedAt = new Date(run.started_at);
          const now = new Date();
          const elapsed = Math.floor((now.getTime() - startedAt.getTime()) / 1000);
          setElapsedSeconds(elapsed);

          // Start elapsed timer
          startElapsedTimer();
        }

        // Fetch progress records for this run
        await fetchProgressRecords(run.id);

        // If test run is complete, fetch test results
        if (run.status === 'completed' && run.is_test) {
          await fetchTestResults(run.id);
        }
      }
    } catch (error) {
      console.error('Error fetching run status:', error);
    }
  };

  // Fetch progress records
  const fetchProgressRecords = async (runId: string) => {
    try {
      const response = await fetch(`/api/arrangements/${params.id}/runs/${runId}/progress`);
      if (!response.ok) return;

      const data = await response.json();
      setProgressRecords(data.records || []);
    } catch (error) {
      console.error('Error fetching progress records:', error);
    }
  };

  // Fetch test results
  const fetchTestResults = async (runId: string) => {
    try {
      const response = await fetch(`/api/arrangements/${params.id}/runs/${runId}/results`);
      if (!response.ok) return;

      const data = await response.json();
      setTestResults(data.results || []);

      // Scroll to test complete section
      setTimeout(() => {
        testCompleteRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 500);
    } catch (error) {
      console.error('Error fetching test results:', error);
    }
  };

  // Fetch harmonies
  const fetchHarmonies = async () => {
    try {
      const response = await fetch(`/api/arrangements/${params.id}/harmonies`);
      if (!response.ok) return;

      const data = await response.json();
      setHarmonies(data.harmonies || []);
    } catch (error) {
      console.error('Error fetching harmonies:', error);
    }
  };

  // Start polling for updates
  const startPolling = () => {
    if (pollIntervalRef.current) return;

    pollIntervalRef.current = setInterval(async () => {
      await fetchRunStatus();
    }, 3000); // Poll every 3 seconds
  };

  // Stop polling
  const stopPolling = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  };

  // Start elapsed timer
  const startElapsedTimer = () => {
    if (elapsedTimerRef.current) return;

    elapsedTimerRef.current = setInterval(() => {
      setElapsedSeconds(prev => prev + 1);
    }, 1000);
  };

  // Stop elapsed timer
  const stopElapsedTimer = () => {
    if (elapsedTimerRef.current) {
      clearInterval(elapsedTimerRef.current);
      elapsedTimerRef.current = null;
    }
  };

  // Handle run full enrichment
  const handleRunFull = async () => {
    try {
      const response = await fetch(`/api/arrangements/${params.id}/runs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_test: false })
      });

      if (!response.ok) throw new Error('Failed to start full enrichment');

      const data = await response.json();
      setCurrentRun(data.run);
      setProgressRecords([]);
      setTestResults([]);
      setElapsedSeconds(0);

      toast.success('Full enrichment started');
      startPolling();
      startElapsedTimer();
    } catch (error) {
      console.error('Error starting full enrichment:', error);
      toast.error('Failed to start full enrichment');
    }
  };

  // Effects
  useEffect(() => {
    fetchArrangement();

    return () => {
      stopPolling();
      stopElapsedTimer();
    };
  }, [params.id]);

  useEffect(() => {
    if (currentRun?.status === 'completed' || currentRun?.status === 'failed') {
      stopPolling();
      stopElapsedTimer();
    }
  }, [currentRun?.status]);

  // Helper functions
  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'running': return C.indigo[500];
      case 'completed': return C.green[500];
      case 'failed': return C.red[500];
      default: return C.gray[400];
    }
  };

  const formatDuration = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const getProviderName = (provider: string): string => {
    const providerMap: Record<string, string> = {
      'apollo': 'Apollo',
      'clearbit': 'Clearbit',
      'zoominfo': 'ZoomInfo',
      'lusha': 'Lusha'
    };
    return providerMap[provider] || provider;
  };

  const getFieldsList = (): string => {
    if (!arrangement?.fields) return '';
    return arrangement.fields.map(f => {
      const parts = f.split('.');
      return parts[parts.length - 1].replace(/_/g, ' ');
    }).join(', ');
  };

  // Calculate field fill counts
  const fieldFillCounts = () => {
    if (!arrangement?.fields || progressRecords.length === 0) {
      return arrangement?.fields.map(f => ({ field: f, filled: 0, normalized: 0 })) || [];
    }

    return arrangement.fields.map(field => {
      let filled = 0;
      let normalized = 0;

      progressRecords.forEach(record => {
        if (record.status === 'completed' && record.fields_filled[field]) {
          const fieldData = record.fields_filled[field];
          if (fieldData.after && !fieldData.skipped) {
            filled++;
            if (fieldData.normalized) {
              normalized++;
            }
          }
        }
      });

      return { field, filled, normalized };
    });
  };

  const fieldCounts = fieldFillCounts();
  const completedRecords = progressRecords.filter(r => r.status === 'completed').length;
  const processingRecords = progressRecords.filter(r => r.status === 'processing');
  const pendingRecords = progressRecords.filter(r => r.status === 'pending');

  const totalNormalized = fieldCounts.reduce((sum, fc) => sum + fc.normalized, 0);

  // Get company initials
  const getInitials = (name: string): string => {
    const words = name.split(' ').filter(w => w.length > 0);
    if (words.length === 0) return '??';
    if (words.length === 1) return words[0].substring(0, 2).toUpperCase();
    return (words[0][0] + words[1][0]).toUpperCase();
  };

  if (isLoading) {
    return (
      <div style={{ padding: '40px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <Loader2 size={24} style={{ animation: 'spin 1s linear infinite', color: C.gray[400] }} />
      </div>
    );
  }

  if (!arrangement) {
    return (
      <div style={{ padding: '40px' }}>
        <p style={{ color: C.text.secondary }}>Arrangement not found</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* Header */}
      <div style={{ padding: '16px 0 12px', borderBottom: `0.5px solid ${C.border.tertiary}`, marginBottom: '20px' }}>
        <div
          onClick={() => router.push('/arrangements')}
          style={{
            fontSize: '12px',
            color: C.text.secondary,
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            marginBottom: '10px',
            cursor: 'pointer'
          }}
          onMouseEnter={(e) => e.currentTarget.style.color = C.text.primary}
          onMouseLeave={(e) => e.currentTarget.style.color = C.text.secondary}
        >
          <ArrowLeft size={12} /> Back to arrangements
        </div>
        <div style={{ fontSize: '18px', fontWeight: '500', color: C.text.primary }}>{arrangement.name}</div>
        <div style={{ fontSize: '13px', color: C.text.secondary, marginTop: '3px' }}>
          {getProviderName(arrangement.provider)} · {arrangement.write_policy} ·
          {currentRun?.is_test && ` Test run: ${currentRun.test_record_count} records · `}
          {currentRun?.started_at && ` Started ${new Date(currentRun.started_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: `0.5px solid ${C.border.tertiary}`, marginBottom: '16px' }}>
        <div
          onClick={() => setActiveTab('live')}
          style={{
            padding: '8px 14px',
            fontSize: '13px',
            cursor: 'pointer',
            color: activeTab === 'live' ? C.text.primary : C.text.secondary,
            borderBottom: `2px solid ${activeTab === 'live' ? C.indigo[500] : 'transparent'}`,
            marginBottom: '-1px'
          }}
        >
          Live run
        </div>
        <div
          onClick={() => setActiveTab('history')}
          style={{
            padding: '8px 14px',
            fontSize: '13px',
            cursor: 'pointer',
            color: activeTab === 'history' ? C.text.primary : C.text.secondary,
            borderBottom: `2px solid ${activeTab === 'history' ? C.indigo[500] : 'transparent'}`,
            marginBottom: '-1px'
          }}
        >
          Run history
        </div>
        <div
          onClick={() => setActiveTab('config')}
          style={{
            padding: '8px 14px',
            fontSize: '13px',
            cursor: 'pointer',
            color: activeTab === 'config' ? C.text.primary : C.text.secondary,
            borderBottom: `2px solid ${activeTab === 'config' ? C.indigo[500] : 'transparent'}`,
            marginBottom: '-1px'
          }}
        >
          Configuration
        </div>
      </div>

      {/* Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '20px' }}>

        {/* LEFT: Live feed */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Status banner */}
          {currentRun && (
            <div style={{
              padding: '14px 16px',
              background: C.surface.secondary,
              border: `0.5px solid ${C.border.tertiary}`,
              borderLeft: `3px solid ${getStatusColor(currentRun.status)}`,
              borderRadius: C.radius.md,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: getStatusColor(currentRun.status),
                  flexShrink: 0,
                  animation: currentRun.status === 'running' ? 'pulse 1.2s ease-in-out infinite' : 'none'
                }} />
                <div>
                  <div style={{ fontSize: '13px', fontWeight: '500', color: C.text.primary }}>
                    {currentRun.status === 'running' && 'Processing records...'}
                    {currentRun.status === 'completed' && (currentRun.is_test ? 'Test run complete' : 'Enrichment complete')}
                    {currentRun.status === 'failed' && 'Run failed'}
                  </div>
                  <div style={{ fontSize: '12px', color: C.text.secondary, marginTop: '2px' }}>
                    {currentRun.status === 'running' && `Querying ${getProviderName(arrangement.provider)}${harmonies.length > 0 ? ` · Applying ${harmonies[0].name}` : ''}`}
                    {currentRun.status === 'completed' && `${currentRun.total_records} records processed · Ready to review results`}
                  </div>
                </div>
              </div>
              <div style={{ fontSize: '12px', color: C.text.tertiary }}>
                {formatDuration(elapsedSeconds)}
              </div>
            </div>
          )}

          {/* Progress bar */}
          {currentRun && (
            <div style={{ background: C.surface.secondary, border: `0.5px solid ${C.border.tertiary}`, borderRadius: C.radius.md, padding: '14px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <span style={{ fontSize: '13px', color: C.text.secondary }}>Records processed</span>
                <span style={{ fontSize: '13px', fontWeight: '500', color: C.text.primary }}>
                  {currentRun.records_processed} of {currentRun.total_records}
                </span>
              </div>
              <div style={{ height: '4px', background: C.border.tertiary, borderRadius: '2px', overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  background: currentRun.status === 'completed' ? C.green[500] : C.indigo[500],
                  borderRadius: '2px',
                  transition: 'width 0.4s ease',
                  width: `${(currentRun.records_processed / currentRun.total_records) * 100}%`
                }} />
              </div>
            </div>
          )}

          {/* Field fill counters */}
          {currentRun && fieldCounts.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(3, fieldCounts.length + 1)}, 1fr)`, gap: '8px' }}>
              {fieldCounts.map((fc, idx) => {
                const fieldName = fc.field.split('.').pop()?.replace(/_/g, ' ') || fc.field;
                return (
                  <div key={idx} style={{ background: C.surface.secondary, border: `0.5px solid ${C.border.tertiary}`, borderRadius: C.radius.md, padding: '10px 12px' }}>
                    <div style={{ fontSize: '11px', color: C.text.tertiary, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
                      {fieldName} filled
                    </div>
                    <div style={{ fontSize: '20px', fontWeight: '500', color: C.green[500] }}>
                      {fc.filled}
                    </div>
                    <div style={{ fontSize: '11px', color: C.text.tertiary, marginTop: '2px' }}>
                      of {completedRecords} processed
                    </div>
                  </div>
                );
              })}
              {totalNormalized > 0 && (
                <div style={{ background: C.surface.secondary, border: `0.5px solid ${C.border.tertiary}`, borderRadius: C.radius.md, padding: '10px 12px' }}>
                  <div style={{ fontSize: '11px', color: C.text.tertiary, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
                    Normalized
                  </div>
                  <div style={{ fontSize: '20px', fontWeight: '500', color: C.indigo[500] }}>
                    {totalNormalized}
                  </div>
                  <div style={{ fontSize: '11px', color: C.text.tertiary, marginTop: '2px' }}>
                    by harmony
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Live record feed */}
          {progressRecords.length > 0 && (
            <div>
              <div style={{ fontSize: '11px', color: C.text.tertiary, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
                Record feed
              </div>
              <div ref={feedListRef} style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '320px', overflowY: 'auto' }}>
                {progressRecords.map((record) => {
                  const isProcessing = record.status === 'processing';
                  const isComplete = record.status === 'completed';
                  const isPending = record.status === 'pending';

                  return (
                    <div
                      key={record.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '8px 10px',
                        background: isProcessing ? 'rgba(55,138,221,0.05)' : C.surface.secondary,
                        border: `0.5px solid ${isProcessing ? 'rgba(55,138,221,0.4)' : isComplete ? 'rgba(46,204,138,0.3)' : C.border.tertiary}`,
                        borderRadius: C.radius.md,
                        opacity: isPending ? 0.4 : 1
                      }}
                    >
                      <div style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: C.radius.md,
                        background: C.surface.primary,
                        border: `0.5px solid ${C.border.tertiary}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '10px',
                        fontWeight: '600',
                        color: isPending ? C.text.tertiary : C.text.secondary,
                        flexShrink: 0
                      }}>
                        {getInitials(record.company_name)}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontSize: '12px',
                          fontWeight: '500',
                          color: isPending ? C.text.secondary : C.text.primary,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}>
                          {record.company_name}
                        </div>
                        <div style={{ display: 'flex', gap: '4px', marginTop: '3px', flexWrap: 'wrap' }}>
                          {isPending ? (
                            <span style={{ fontSize: '11px', color: C.text.tertiary }}>Waiting...</span>
                          ) : (
                            Object.keys(record.fields_filled).map((fieldKey) => {
                              const fieldData = record.fields_filled[fieldKey];
                              const fieldName = fieldKey.split('.').pop()?.replace(/_/g, ' ') || fieldKey;

                              if (fieldData.skipped) {
                                return (
                                  <span
                                    key={fieldKey}
                                    style={{
                                      fontSize: '10px',
                                      padding: '1px 6px',
                                      borderRadius: C.radius.md,
                                      background: C.surface.primary,
                                      color: C.text.tertiary,
                                      border: `0.5px solid ${C.border.tertiary}`
                                    }}
                                  >
                                    {fieldName} — {fieldData.skip_reason || 'skipped'}
                                  </span>
                                );
                              }

                              if (isProcessing) {
                                return (
                                  <span
                                    key={fieldKey}
                                    style={{
                                      fontSize: '10px',
                                      padding: '1px 6px',
                                      borderRadius: C.radius.md,
                                      background: 'rgba(55,138,221,0.08)',
                                      color: C.indigo[500],
                                      border: `0.5px solid rgba(55,138,221,0.2)`,
                                      animation: 'chipPulse 1s ease-in-out infinite'
                                    }}
                                  >
                                    {fieldName}...
                                  </span>
                                );
                              }

                              if (fieldData.normalized) {
                                return (
                                  <span
                                    key={fieldKey}
                                    style={{
                                      fontSize: '10px',
                                      padding: '1px 6px',
                                      borderRadius: C.radius.md,
                                      background: 'rgba(55,138,221,0.12)',
                                      color: C.indigo[500],
                                      border: `0.5px solid rgba(55,138,221,0.25)`
                                    }}
                                  >
                                    {fieldName} ✦
                                  </span>
                                );
                              }

                              return (
                                <span
                                  key={fieldKey}
                                  style={{
                                    fontSize: '10px',
                                    padding: '1px 6px',
                                    borderRadius: C.radius.md,
                                    background: 'rgba(46,204,138,0.12)',
                                    color: C.green[500],
                                    border: `0.5px solid rgba(46,204,138,0.25)`
                                  }}
                                >
                                  {fieldName}
                                </span>
                              );
                            })
                          )}
                        </div>
                      </div>
                      <div style={{ flexShrink: 0 }}>
                        {isProcessing && <Loader2 size={14} style={{ color: C.indigo[500], animation: 'spin 1s linear infinite' }} />}
                        {isComplete && <Check size={14} style={{ color: C.green[500] }} />}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Test complete panel */}
          {currentRun?.status === 'completed' && currentRun.is_test && testResults.length > 0 && (
            <div
              ref={testCompleteRef}
              style={{
                background: C.surface.secondary,
                border: `0.5px solid rgba(46,204,138,0.3)`,
                borderRadius: C.radius.md,
                padding: '16px',
                marginTop: '4px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                <Sparkles size={18} style={{ color: C.green[500] }} />
                <div>
                  <div style={{ fontSize: '14px', fontWeight: '500', color: C.text.primary }}>Test run complete</div>
                  <div style={{ fontSize: '12px', color: C.text.secondary, marginTop: '1px' }}>
                    {currentRun.total_records} records · {testResults.filter(r => r.after_value && !r.skipped).length} fields filled ·
                    {testResults.filter(r => r.normalized).length} normalized · {formatDuration(elapsedSeconds)}
                  </div>
                </div>
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', marginBottom: '14px' }}>
                <thead>
                  <tr>
                    <th style={{ fontSize: '10px', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.05em', color: C.text.tertiary, padding: '4px 8px', borderBottom: `0.5px solid ${C.border.tertiary}`, textAlign: 'left' }}>Company</th>
                    <th style={{ fontSize: '10px', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.05em', color: C.text.tertiary, padding: '4px 8px', borderBottom: `0.5px solid ${C.border.tertiary}`, textAlign: 'left' }}>Field</th>
                    <th style={{ fontSize: '10px', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.05em', color: C.text.tertiary, padding: '4px 8px', borderBottom: `0.5px solid ${C.border.tertiary}`, textAlign: 'left' }}>Before</th>
                    <th style={{ fontSize: '10px', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.05em', color: C.text.tertiary, padding: '4px 8px', borderBottom: `0.5px solid ${C.border.tertiary}`, textAlign: 'left' }}>After</th>
                  </tr>
                </thead>
                <tbody>
                  {testResults.slice(0, 10).map((result, idx) => {
                    const fieldName = result.field_name.split('.').pop()?.replace(/_/g, ' ') || result.field_name;
                    return (
                      <tr key={idx}>
                        <td style={{ padding: '7px 8px', borderBottom: idx === testResults.slice(0, 10).length - 1 ? 'none' : `0.5px solid ${C.border.tertiary}`, verticalAlign: 'top' }}>
                          <div style={{ fontWeight: '500', color: C.text.primary, fontSize: '12px' }}>{result.company_name}</div>
                          {result.company_domain && (
                            <div style={{ fontSize: '11px', color: C.text.tertiary }}>{result.company_domain}</div>
                          )}
                        </td>
                        <td style={{ color: C.text.secondary, padding: '7px 8px', borderBottom: idx === testResults.slice(0, 10).length - 1 ? 'none' : `0.5px solid ${C.border.tertiary}`, verticalAlign: 'top' }}>{fieldName}</td>
                        <td style={{ color: C.text.tertiary, fontStyle: 'italic', padding: '7px 8px', borderBottom: idx === testResults.slice(0, 10).length - 1 ? 'none' : `0.5px solid ${C.border.tertiary}`, verticalAlign: 'top' }}>
                          {result.before_value || 'empty'}
                        </td>
                        <td style={{
                          color: result.skipped ? C.text.tertiary : (result.normalized ? C.indigo[500] : C.green[500]),
                          fontWeight: result.skipped ? 'normal' : '500',
                          fontStyle: result.skipped ? 'italic' : 'normal',
                          padding: '7px 8px',
                          borderBottom: idx === testResults.slice(0, 10).length - 1 ? 'none' : `0.5px solid ${C.border.tertiary}`,
                          verticalAlign: 'top'
                        }}>
                          {result.skipped ? (result.skip_reason || 'not found') : result.after_value}
                          {result.normalized && <span style={{ fontSize: '10px', color: C.indigo[500], marginLeft: '3px' }}>✦</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {testResults.some(r => r.normalized) && (
                <div style={{ fontSize: '11px', color: C.text.tertiary, marginBottom: '12px' }}>
                  ✦ Normalized by {harmonies.length > 0 ? harmonies[0].name : 'harmony'}
                </div>
              )}

              <div style={{
                background: 'rgba(46,204,138,0.08)',
                border: `0.5px solid rgba(46,204,138,0.25)`,
                borderRadius: C.radius.md,
                padding: '12px 14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div>
                  <div style={{ fontSize: '12px', color: C.text.secondary }}>Results look good? Run the full enrichment.</div>
                  <div style={{ fontSize: '13px', fontWeight: '500', color: C.green[500] }}>
                    {(currentRun.total_records || 0)} remaining companies
                  </div>
                </div>
                <button
                  onClick={handleRunFull}
                  style={{
                    width: 'auto',
                    padding: '8px 14px',
                    fontSize: '12px',
                    fontWeight: '500',
                    background: C.green[500],
                    color: '#0a1f14',
                    border: 'none',
                    borderRadius: C.radius.md,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontFamily: 'inherit'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#38d99a'}
                  onMouseLeave={(e) => e.currentTarget.style.background = C.green[500]}
                >
                  Run full enrichment <span style={{ fontSize: '14px' }}>↗</span>
                </button>
              </div>
            </div>
          )}

        </div>

        {/* RIGHT: Summary panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

          {/* Run summary */}
          <div style={{ background: C.surface.secondary, border: `0.5px solid ${C.border.tertiary}`, borderRadius: C.radius.md, padding: '14px' }}>
            <div style={{ fontSize: '11px', color: C.text.tertiary, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>
              Run summary
            </div>
            {currentRun && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '5px 0', borderBottom: `0.5px solid ${C.border.tertiary}` }}>
                  <span style={{ fontSize: '12px', color: C.text.secondary }}>Status</span>
                  <span style={{ fontSize: '12px', color: getStatusColor(currentRun.status) }}>
                    ● {currentRun.status.charAt(0).toUpperCase() + currentRun.status.slice(1)}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '5px 0', borderBottom: `0.5px solid ${C.border.tertiary}` }}>
                  <span style={{ fontSize: '12px', color: C.text.secondary }}>Records</span>
                  <span style={{ fontSize: '12px', color: C.text.primary }}>
                    {currentRun.total_records} {currentRun.is_test ? '(test)' : ''}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '5px 0', borderBottom: `0.5px solid ${C.border.tertiary}` }}>
                  <span style={{ fontSize: '12px', color: C.text.secondary }}>Source</span>
                  <span style={{ fontSize: '12px', color: C.text.primary, textAlign: 'right', maxWidth: '160px' }}>
                    {arrangement.source_query}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '5px 0', borderBottom: `0.5px solid ${C.border.tertiary}` }}>
                  <span style={{ fontSize: '12px', color: C.text.secondary }}>Provider</span>
                  <span style={{ fontSize: '12px', color: C.text.primary }}>{getProviderName(arrangement.provider)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '5px 0', borderBottom: `0.5px solid ${C.border.tertiary}` }}>
                  <span style={{ fontSize: '12px', color: C.text.secondary }}>Write policy</span>
                  <span style={{ fontSize: '12px', color: C.text.primary }}>{arrangement.write_policy}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '5px 0', borderBottom: 'none' }}>
                  <span style={{ fontSize: '12px', color: C.text.secondary }}>Started</span>
                  <span style={{ fontSize: '12px', color: C.text.primary }}>
                    {new Date(currentRun.started_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} today
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Harmonies active */}
          {harmonies.length > 0 && (
            <div style={{ background: C.surface.secondary, border: `0.5px solid ${C.border.tertiary}`, borderRadius: C.radius.md, padding: '14px' }}>
              <div style={{ fontSize: '11px', color: C.text.tertiary, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>
                Harmonies active
              </div>
              {harmonies.map((harmony) => (
                <div
                  key={harmony.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '6px 8px',
                    background: 'rgba(55,138,221,0.08)',
                    border: `0.5px solid rgba(55,138,221,0.2)`,
                    borderRadius: C.radius.md,
                    marginBottom: '6px'
                  }}
                >
                  <span style={{ fontSize: '12px', color: C.indigo[500] }}>✦</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '12px', color: C.text.primary }}>{harmony.name}</div>
                    <div style={{ fontSize: '11px', color: C.text.tertiary }}>{harmony.field}</div>
                  </div>
                </div>
              ))}
              {harmonies[0] && (
                <div style={{ fontSize: '11px', color: C.text.tertiary, marginTop: '6px' }}>
                  {harmonies[0].description}
                </div>
              )}
            </div>
          )}

          {/* Fields being filled */}
          <div style={{ background: C.surface.secondary, border: `0.5px solid ${C.border.tertiary}`, borderRadius: C.radius.md, padding: '14px' }}>
            <div style={{ fontSize: '11px', color: C.text.tertiary, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>
              Fields being filled
            </div>
            {fieldCounts.map((fc, idx) => {
              const fieldName = fc.field.split('.').pop()?.replace(/_/g, ' ') || fc.field;
              return (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    padding: '5px 0',
                    borderBottom: idx === fieldCounts.length - 1 ? 'none' : `0.5px solid ${C.border.tertiary}`
                  }}
                >
                  <span style={{ fontSize: '12px', color: C.text.secondary }}>{fieldName}</span>
                  <span style={{ fontSize: '12px', color: C.green[500] }}>
                    {fc.filled > 0 ? `${fc.filled} filled so far` : 'Pending'}
                  </span>
                </div>
              );
            })}
          </div>

        </div>

      </div>

      <style jsx>{`
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
            transform: scale(1);
          }
          50% {
            opacity: 0.5;
            transform: scale(0.7);
          }
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        @keyframes chipPulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.4;
          }
        }
      `}</style>
    </div>
  );
}
