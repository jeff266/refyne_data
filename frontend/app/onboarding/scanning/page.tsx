'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { C, F } from '@/lib/design-tokens';

interface ScanEvent {
  id: string;
  eventType: string;
  message: string;
  count?: number;
  createdAt: string;
}

export default function OnboardingScanningPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [events, setEvents] = useState<ScanEvent[]>([]);
  const [progress, setProgress] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const [runId, setRunId] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState('Your HubSpot');
  const [startTime] = useState(Date.now());

  useEffect(() => {
    // Get runId from URL or trigger scan
    const urlRunId = searchParams?.get('runId');

    if (urlRunId) {
      setRunId(urlRunId);
    } else {
      triggerScan();
    }
  }, []);

  useEffect(() => {
    if (!runId) return;

    // Poll for scan progress
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/onboarding/scan-progress?runId=${runId}`);
        if (res.ok) {
          const data = await res.json();
          setEvents(data.events || []);
          setCompleted(data.completed || false);
          setScore(data.score ?? null);

          // Calculate progress based on event types
          const eventCount = (data.events || []).length;
          const progressPercent = Math.min(95, (eventCount / 10) * 100);
          setProgress(progressPercent);

          if (data.completed) {
            setProgress(100);
            clearInterval(interval);
            setTimeout(() => {
              router.push('/onboarding/score');
            }, 1500);
          }
        }
      } catch (error) {
        console.error('Failed to fetch scan progress:', error);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [runId]);

  async function triggerScan() {
    try {
      const res = await fetch('/api/onboarding/scan-trigger', {
        method: 'POST',
      });

      if (res.ok) {
        const data = await res.json();
        setRunId(data.runId);
      } else {
        console.error('Failed to trigger scan');
        // Fallback: redirect to dashboard
        setTimeout(() => router.push('/dashboard'), 3000);
      }
    } catch (error) {
      console.error('Failed to trigger scan:', error);
      setTimeout(() => router.push('/dashboard'), 3000);
    }
  }

  const elapsedMinutes = Math.floor((Date.now() - startTime) / 60000);
  const showSlowMessage = elapsedMinutes >= 5;

  return (
    <div style={{
      minHeight: '100vh',
      background: C.bg,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: F.sans,
      color: C.text,
      padding: 24,
    }}>
      {/* Logo */}
      <div style={{
        position: 'absolute',
        top: 32,
        left: 32,
        fontSize: 20,
        fontWeight: 600,
        color: C.indigo,
      }}>
        Refyne
      </div>

      {/* Content */}
      <div style={{
        maxWidth: 600,
        width: '100%',
      }}>
        <h1 style={{ fontSize: 28, fontWeight: 600, marginBottom: 32, textAlign: 'center' }}>
          Analyzing {companyName}'s HubSpot data...
        </h1>

        {/* Progress Bar */}
        <div style={{
          width: '100%',
          height: 8,
          background: C.bg2,
          borderRadius: 4,
          overflow: 'hidden',
          marginBottom: 48,
        }}>
          <div style={{
            width: `${progress}%`,
            height: '100%',
            background: C.indigo,
            transition: 'width 0.5s ease-out',
          }} />
        </div>

        {/* Discovery Feed */}
        <div style={{
          background: C.sidebar,
          border: `1px solid ${C.border}`,
          borderRadius: 12,
          padding: 24,
          minHeight: 300,
          maxHeight: 500,
          overflow: 'auto',
        }}>
          {events.length === 0 ? (
            <div style={{ textAlign: 'center', color: C.text3, fontSize: 14, paddingTop: 60 }}>
              Starting scan...
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {events.map((event, index) => (
                <div
                  key={event.id}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 12,
                    animation: 'fadeIn 0.3s ease-out',
                    opacity: 1,
                  }}
                >
                  <span style={{ fontSize: 18, flexShrink: 0 }}>
                    {event.eventType === 'completed' ? '✓' :
                     event.eventType === 'duplicate_found' || event.eventType === 'harmony_checked' ? '⚡' :
                     event.eventType === 'score_calculated' ? '🎯' : '✓'}
                  </span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, color: C.text }}>{event.message}</div>
                    {event.count !== undefined && (
                      <div style={{ fontSize: 12, color: C.text3, marginTop: 4 }}>
                        {event.count.toLocaleString()} {event.count === 1 ? 'record' : 'records'}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {showSlowMessage && !completed && (
            <div style={{
              marginTop: 24,
              padding: 16,
              background: C.bg,
              border: `1px solid ${C.border}`,
              borderRadius: 8,
              fontSize: 13,
              color: C.text2,
              textAlign: 'center',
            }}>
              Still working — larger portals take a bit longer
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
