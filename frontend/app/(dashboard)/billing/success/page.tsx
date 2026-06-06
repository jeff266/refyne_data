'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { C } from '@/lib/design-tokens';

const STEEL = '#2E6BA8';
const HEADING_FONT = "'Lora', Georgia, serif";
const BODY_FONT = "'Jost', system-ui, sans-serif";

type State = 'polling' | 'success' | 'timeout';

const PLAN_LABELS: Record<string, string> = {
  starter: 'Starter',
  growth: 'Growth',
  scale: 'Scale',
};

export default function BillingSuccessPage() {
  const router = useRouter();
  const [state, setState] = useState<State>('polling');
  const [tier, setTier] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let stopped = false;

    async function checkStatus() {
      try {
        const res = await fetch('/api/billing/status');
        if (!res.ok) return;
        const data = await res.json();
        if (data.subscription_tier && data.subscription_tier !== 'trial') {
          if (!stopped) {
            setTier(data.subscription_tier);
            setState('success');
            clearInterval(intervalRef.current!);
            clearTimeout(timeoutRef.current!);
          }
        }
      } catch {
        // silent - keep polling
      }
    }

    // Poll every 3 seconds
    intervalRef.current = setInterval(checkStatus, 3000);
    checkStatus(); // immediate first check

    // Timeout after 15 seconds
    timeoutRef.current = setTimeout(() => {
      if (!stopped) {
        clearInterval(intervalRef.current!);
        setState(prev => prev === 'polling' ? 'timeout' : prev);
      }
    }, 15000);

    return () => {
      stopped = true;
      clearInterval(intervalRef.current!);
      clearTimeout(timeoutRef.current!);
    };
  }, []);

  return (
    <div
      style={{
        minHeight: '60vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: BODY_FONT,
        padding: 40,
      }}
    >
      <div style={{ textAlign: 'center', maxWidth: 400 }}>
        {state === 'polling' && (
          <>
            {/* Spinner */}
            <div
              style={{
                width: 48,
                height: 48,
                border: `3px solid ${C.border2}`,
                borderTop: `3px solid ${STEEL}`,
                borderRadius: '50%',
                margin: '0 auto 24px',
                animation: 'spin 1s linear infinite',
              }}
              className="preview-spinner"
            />
            <h1 style={{ fontFamily: HEADING_FONT, fontSize: 26, fontWeight: 600, color: C.text, marginBottom: 12 }}>
              Activating your plan...
            </h1>
            <p style={{ fontSize: 14, color: C.text2, lineHeight: 1.6 }}>
              Your plan is activating - this may take a few seconds.
            </p>
          </>
        )}

        {state === 'success' && (
          <>
            {/* Checkmark */}
            <svg
              width="52"
              height="52"
              viewBox="0 0 52 52"
              fill="none"
              style={{ display: 'block', margin: '0 auto 24px' }}
            >
              <circle cx="26" cy="26" r="25" stroke={STEEL} strokeWidth="2" />
              <path
                d="M16 26L22 32L36 18"
                stroke={STEEL}
                strokeWidth="2.5"
                strokeLinecap="square"
                strokeLinejoin="miter"
              />
            </svg>
            <h1 style={{ fontFamily: HEADING_FONT, fontSize: 28, fontWeight: 600, color: C.text, marginBottom: 12 }}>
              You're all set.
            </h1>
            <p style={{ fontSize: 14, color: C.text2, marginBottom: 28, lineHeight: 1.6 }}>
              Your {tier ? PLAN_LABELS[tier] ?? tier : 'new'} plan is now active.
            </p>
            <button
              onClick={() => router.push('/dashboard')}
              style={{
                padding: '10px 28px',
                background: STEEL,
                color: '#fff',
                border: 'none',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: BODY_FONT,
                borderRadius: 0,
              }}
            >
              Go to dashboard
            </button>
          </>
        )}

        {state === 'timeout' && (
          <>
            <h1 style={{ fontFamily: HEADING_FONT, fontSize: 26, fontWeight: 600, color: C.text, marginBottom: 12 }}>
              You're all set.
            </h1>
            <p style={{ fontSize: 14, color: C.text2, marginBottom: 8, lineHeight: 1.6 }}>
              Check your email for confirmation.
            </p>
            <p style={{ fontSize: 13, color: C.text3, marginBottom: 28 }}>
              Your plan may take a moment to activate.
            </p>
            <button
              onClick={() => router.push('/dashboard')}
              style={{
                padding: '10px 28px',
                background: STEEL,
                color: '#fff',
                border: 'none',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: BODY_FONT,
                borderRadius: 0,
              }}
            >
              Go to dashboard
            </button>
          </>
        )}
      </div>
    </div>
  );
}
