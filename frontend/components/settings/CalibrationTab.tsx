'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { C } from '@/lib/design-tokens';
import { Card, PrimaryBtn, GhostBtn } from '@/components/refyne';
import { addToast } from '@/components/ui/toast';
import { Sparkles, Target, TrendingUp } from 'lucide-react';
import { ArrangementsOnboardingModal } from '@/components/arrangements/ArrangementsOnboardingModal';

interface ProviderScore {
  provider: string;
  agree_count: number;
  disagree_count: number;
  score: number | null;
  last_calibrated_at: string | null;
}

interface CalibrationSession {
  id: string;
  field_key: string;
  field_type: string;
  providers: string[];
  sample_size: number;
  credits_used: number | null;
  status: string;
  created_at: string;
  completed_at: string | null;
}

const CALIBRATABLE_FIELDS = [
  { key: 'industry', label: 'Industry', type: 'categorical' },
  { key: 'employee_count', label: 'Employee Count', type: 'numeric' },
  { key: 'annual_revenue', label: 'Annual Revenue', type: 'numeric' },
  { key: 'linkedin_url', label: 'LinkedIn URL', type: 'url' },
  { key: 'phone', label: 'Phone', type: 'text' },
];

const AGGREGATION_STRATEGIES = [
  { value: 'waterfall', label: 'Waterfall (first found)', description: 'Use first provider that returns a value' },
  { value: 'max', label: 'Max', description: 'Highest value across all providers' },
  { value: 'min', label: 'Min', description: 'Lowest value across all providers' },
  { value: 'average', label: 'Average', description: 'Arithmetic mean of all values' },
  { value: 'cluster_average', label: 'Cluster Average', description: 'Mean after dropping outliers (1 SD from median)' },
];

export function CalibrationTab() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [numericDefaultStrategy, setNumericDefaultStrategy] = useState('waterfall');
  const [providerScores, setProviderScores] = useState<Record<string, ProviderScore[]>>({});
  const [sessions, setSessions] = useState<CalibrationSession[]>([]);
  const [savingDefaults, setSavingDefaults] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    // Check if onboarding modal should be shown
    if (searchParams.get('onboarding') === 'true') {
      setShowOnboarding(true);
    }
    loadCalibrationData();
  }, [searchParams]);

  const loadCalibrationData = async () => {
    setLoading(true);
    try {
      // Load arrangement settings (numeric defaults)
      const settingsRes = await fetch('/api/arrangements/settings');
      if (settingsRes.ok) {
        const { settings } = await settingsRes.json();
        if (settings) {
          setNumericDefaultStrategy(settings.numeric_default_strategy || 'waterfall');
        }
      }

      // Load provider calibration scores
      const scoresRes = await fetch('/api/arrangements/calibration/scores');
      if (scoresRes.ok) {
        const { scores } = await scoresRes.json();
        // Group scores by field_key
        const grouped = scores.reduce((acc: Record<string, ProviderScore[]>, score: ProviderScore & { field_key: string }) => {
          if (!acc[score.field_key]) acc[score.field_key] = [];
          acc[score.field_key].push(score);
          return acc;
        }, {});
        setProviderScores(grouped);
      }

      // Load calibration sessions
      const sessionsRes = await fetch('/api/arrangements/calibration/sessions');
      if (sessionsRes.ok) {
        const { sessions: sessionList } = await sessionsRes.json();
        setSessions(sessionList || []);
      }
    } catch (error) {
      console.error('Failed to load calibration data:', error);
      addToast('error', 'Failed to load calibration data');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveDefaults = async () => {
    setSavingDefaults(true);
    try {
      const res = await fetch('/api/arrangements/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          numeric_default_strategy: numericDefaultStrategy,
        }),
      });

      if (!res.ok) throw new Error('Failed to save');

      addToast('success', 'Numeric defaults saved');
    } catch (error) {
      console.error('Failed to save defaults:', error);
      addToast('error', 'Failed to save defaults');
    } finally {
      setSavingDefaults(false);
    }
  };

  const handleRunCalibration = (fieldKey: string, fieldType: string) => {
    // This will open a modal - implement in next phase
    addToast('info', 'Calibration modal coming soon');
  };

  const handleOnboardingComplete = () => {
    setShowOnboarding(false);
    router.push('/arrangements/new');
  };

  const handleOnboardingSkip = () => {
    setShowOnboarding(false);
    router.push('/arrangements/new');
  };

  if (loading) {
    return (
      <div style={{ padding: 20, color: C.text2 }}>
        Loading calibration settings...
      </div>
    );
  }

  return (
    <>
      {showOnboarding && (
        <ArrangementsOnboardingModal
          onComplete={handleOnboardingComplete}
          onSkip={handleOnboardingSkip}
        />
      )}

      <div style={{ display: 'grid', gap: 24 }}>
      {/* Intro */}
      <Card style={{ padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'start', gap: 12 }}>
          <div style={{ color: C.indigo, marginTop: 2 }}>
            <Target size={20} />
          </div>
          <div style={{ flex: 1 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 6 }}>
              Calibrate your provider confidence
            </h3>
            <p style={{ fontSize: 13, color: C.text2, lineHeight: 1.5 }}>
              Calibration tests providers against your actual HubSpot data to recommend the best
              waterfall order for each field. Run calibration once per field, or re-run when
              provider accuracy changes.
            </p>
          </div>
        </div>
      </Card>

      {/* Numeric Defaults */}
      <div>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 12 }}>
          Numeric Field Defaults
        </h3>
        <Card style={{ padding: 20 }}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 13, color: C.text2, marginBottom: 8, display: 'block' }}>
              When multiple providers return different numbers (e.g., employee count), use:
            </label>
            <select
              value={numericDefaultStrategy}
              onChange={(e) => setNumericDefaultStrategy(e.target.value)}
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
              {AGGREGATION_STRATEGIES.map((strategy) => (
                <option key={strategy.value} value={strategy.value}>
                  {strategy.label} — {strategy.description}
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <PrimaryBtn onClick={handleSaveDefaults} disabled={savingDefaults}>
              {savingDefaults ? 'Saving...' : 'Save defaults'}
            </PrimaryBtn>
          </div>
        </Card>
      </div>

      {/* Provider Calibration Cards */}
      <div>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 12 }}>
          Field Calibration
        </h3>
        <div style={{ display: 'grid', gap: 12 }}>
          {CALIBRATABLE_FIELDS.map((field) => {
            const scores = providerScores[field.key] || [];
            const hasCalibration = scores.length > 0;
            const sortedScores = [...scores].sort((a, b) => {
              if (a.score === null) return 1;
              if (b.score === null) return -1;
              return b.score - a.score;
            });

            return (
              <Card key={field.key} style={{ padding: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 16 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <h4 style={{ fontSize: 14, fontWeight: 600, color: C.text }}>
                        {field.label}
                      </h4>
                      <span
                        style={{
                          fontSize: 11,
                          padding: '2px 8px',
                          background: C.hover,
                          color: C.text3,
                          borderRadius: 4,
                        }}
                      >
                        {field.type}
                      </span>
                    </div>
                    {hasCalibration ? (
                      <p style={{ fontSize: 12, color: C.text3 }}>
                        Last calibrated:{' '}
                        {new Date(sortedScores[0].last_calibrated_at || '').toLocaleDateString()}
                      </p>
                    ) : (
                      <p style={{ fontSize: 12, color: C.amber }}>Not calibrated</p>
                    )}
                  </div>
                  <GhostBtn onClick={() => handleRunCalibration(field.key, field.type)}>
                    <Sparkles size={14} />
                    {hasCalibration ? 'Re-calibrate' : 'Calibrate now'}
                  </GhostBtn>
                </div>

                {hasCalibration && (
                  <div style={{ display: 'grid', gap: 8 }}>
                    {sortedScores.map((score, index) => {
                      const confidence = score.score !== null ? Math.round(score.score * 100) : 0;
                      const total = score.agree_count + score.disagree_count;

                      return (
                        <div
                          key={score.provider}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12,
                            padding: 12,
                            background: index === 0 ? C.greenDim : C.bg,
                            border: `1px solid ${index === 0 ? C.greenBrd : C.border}`,
                            borderRadius: 6,
                          }}
                        >
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                              <span style={{ fontSize: 13, fontWeight: 500, color: C.text }}>
                                {score.provider.charAt(0).toUpperCase() + score.provider.slice(1)}
                              </span>
                              {index === 0 && (
                                <span
                                  style={{
                                    fontSize: 10,
                                    padding: '2px 6px',
                                    background: C.green,
                                    color: 'white',
                                    borderRadius: 3,
                                    fontWeight: 600,
                                  }}
                                >
                                  RECOMMENDED
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: 12, color: C.text3 }}>
                              {confidence}% confidence · {score.agree_count} agree, {score.disagree_count} disagree
                            </div>
                          </div>
                          <div style={{ width: 120 }}>
                            <div
                              style={{
                                height: 6,
                                background: C.border,
                                borderRadius: 3,
                                overflow: 'hidden',
                              }}
                            >
                              <div
                                style={{
                                  height: '100%',
                                  width: `${confidence}%`,
                                  background: index === 0 ? C.green : C.indigo,
                                  transition: 'width 0.3s',
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </div>

      {/* Calibration History */}
      {sessions.length > 0 && (
        <div>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 12 }}>
            Calibration History
          </h3>
          <Card style={{ padding: 0, overflow: 'hidden' }}>
            <table style={{ width: '100%', fontSize: 13 }}>
              <thead>
                <tr style={{ background: C.hover, borderBottom: `1px solid ${C.border}` }}>
                  <th style={{ padding: 12, textAlign: 'left', color: C.text3, fontWeight: 500 }}>
                    Field
                  </th>
                  <th style={{ padding: 12, textAlign: 'left', color: C.text3, fontWeight: 500 }}>
                    Providers
                  </th>
                  <th style={{ padding: 12, textAlign: 'left', color: C.text3, fontWeight: 500 }}>
                    Date
                  </th>
                  <th style={{ padding: 12, textAlign: 'left', color: C.text3, fontWeight: 500 }}>
                    Credits
                  </th>
                  <th style={{ padding: 12, textAlign: 'left', color: C.text3, fontWeight: 500 }}>
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {sessions.slice(0, 10).map((session) => (
                  <tr key={session.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                    <td style={{ padding: 12, color: C.text }}>
                      {session.field_key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </td>
                    <td style={{ padding: 12, color: C.text2 }}>
                      {session.providers.join(', ')}
                    </td>
                    <td style={{ padding: 12, color: C.text2 }}>
                      {new Date(session.created_at).toLocaleDateString()}
                    </td>
                    <td style={{ padding: 12, color: C.text2 }}>
                      {session.credits_used || '—'}
                    </td>
                    <td style={{ padding: 12 }}>
                      <span
                        style={{
                          fontSize: 11,
                          padding: '2px 8px',
                          background:
                            session.status === 'completed'
                              ? C.greenDim
                              : session.status === 'failed'
                              ? C.redDim
                              : C.hover,
                          color:
                            session.status === 'completed'
                              ? C.green
                              : session.status === 'failed'
                              ? C.red
                              : C.text3,
                          borderRadius: 4,
                          fontWeight: 500,
                        }}
                      >
                        {session.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      )}
      </div>
    </>
  );
}
