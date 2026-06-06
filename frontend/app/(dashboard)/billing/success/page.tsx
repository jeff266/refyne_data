'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { C, F } from '@/lib/design-tokens';

export default function BillingSuccessPage() {
  const router = useRouter();
  const [tier, setTier] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    let pollCount = 0;
    const maxPolls = 5; // 5 polls * 3 seconds = 15 seconds timeout

    const pollStatus = async () => {
      try {
        const res = await fetch('/api/billing/status');
        if (res.ok) {
          const data = await res.json();

          // Check if subscription has been activated
          if (data.subscription_tier && data.subscription_tier !== 'trial') {
            setTier(data.subscription_tier);
            setLoading(false);
            return true; // Stop polling
          }
        }
      } catch (error) {
        console.error('Failed to fetch billing status:', error);
      }

      pollCount++;
      if (pollCount >= maxPolls) {
        setTimedOut(true);
        setLoading(false);
        return true; // Stop polling
      }

      return false; // Continue polling
    };

    // Initial poll
    pollStatus().then((shouldStop) => {
      if (shouldStop) return;

      // Continue polling every 3 seconds
      const interval = setInterval(async () => {
        const shouldStop = await pollStatus();
        if (shouldStop) {
          clearInterval(interval);
        }
      }, 3000);

      return () => clearInterval(interval);
    });
  }, []);

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 32,
    }}>
      <div style={{ textAlign: 'center', maxWidth: 500 }}>
        {loading ? (
          <>
            {/* Loading state */}
            <div style={{
              width: 80,
              height: 80,
              margin: '0 auto 32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <div style={{
                width: 40,
                height: 40,
                border: `4px solid ${C.border}`,
                borderTopColor: C.steelBlue,
                animation: 'spin 1s linear infinite',
              }} />
            </div>
            <p style={{ fontSize: 16, color: C.text2 }}>
              Your plan is activating - this may take a few seconds.
            </p>
          </>
        ) : timedOut ? (
          <>
            {/* Timeout fallback */}
            <svg
              width="80"
              height="80"
              viewBox="0 0 80 80"
              fill="none"
              style={{ margin: '0 auto 32px' }}
            >
              <circle cx="40" cy="40" r="38" stroke={C.steelBlue} strokeWidth="4" />
              <path
                d="M25 40 L35 50 L55 30"
                stroke={C.steelBlue}
                strokeWidth="4"
                strokeLinecap="square"
                fill="none"
              />
            </svg>
            <h1 style={{
              fontSize: 36,
              fontFamily: F.heading,
              color: C.navy,
              marginBottom: 16,
            }}>
              You're all set.
            </h1>
            <p style={{ fontSize: 16, color: C.text2, marginBottom: 32 }}>
              Check your email for confirmation.
            </p>
            <button
              onClick={() => router.push('/dashboard')}
              style={{
                padding: '12px 32px',
                background: C.steelBlue,
                color: '#fff',
                border: 'none',
                fontSize: 16,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Go to dashboard
            </button>
          </>
        ) : (
          <>
            {/* Success state */}
            <svg
              width="80"
              height="80"
              viewBox="0 0 80 80"
              fill="none"
              style={{ margin: '0 auto 32px' }}
            >
              <circle cx="40" cy="40" r="38" stroke={C.steelBlue} strokeWidth="4" />
              <path
                d="M25 40 L35 50 L55 30"
                stroke={C.steelBlue}
                strokeWidth="4"
                strokeLinecap="square"
                fill="none"
              />
            </svg>
            <h1 style={{
              fontSize: 36,
              fontFamily: F.heading,
              color: C.navy,
              marginBottom: 16,
            }}>
              You're all set.
            </h1>
            <p style={{ fontSize: 16, color: C.text2, marginBottom: 32 }}>
              Your <span style={{ textTransform: 'capitalize', fontWeight: 600 }}>{tier}</span> plan is now active.
            </p>
            <button
              onClick={() => router.push('/dashboard')}
              style={{
                padding: '12px 32px',
                background: C.steelBlue,
                color: '#fff',
                border: 'none',
                fontSize: 16,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Go to dashboard
            </button>
          </>
        )}
      </div>

      {/* CSS for spin animation */}
      <style jsx>{`
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}
