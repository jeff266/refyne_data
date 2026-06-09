'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { C, F } from '@/lib/design-tokens';

export default function InvitePage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleContinue = async () => {
    setIsSubmitting(true);

    try {
      // Mark step as visited
      await fetch('/api/onboarding/progress', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invited_team_at: new Date().toISOString(),
        }),
      });

      router.push('/onboarding/complete');
    } catch (error) {
      console.error('Failed to save progress:', error);
      alert('Failed to save progress. Please try again.');
      setIsSubmitting(false);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 'calc(100vh - 64px)',
        padding: 32,
      }}
    >
      <div style={{ width: '100%', maxWidth: 540 }}>
        {/* Progress indicator */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <span style={{ fontSize: 12, fontFamily: "'Jost', system-ui, sans-serif", color: 'rgba(249,248,245,0.5)', fontWeight: 500 }}>
            Step 6 of 6
          </span>
        </div>

        {/* Heading */}
        <h1
          style={{
            fontSize: 32,
            fontFamily: 'Lora, serif',
            fontWeight: 600,
            color: '#F9F8F5',
            marginBottom: 12,
            textAlign: 'center',
          }}
        >
          Invite your team
        </h1>
        <p
          style={{
            fontSize: 15,
            fontFamily: "'Jost', system-ui, sans-serif",
            color: 'rgba(249,248,245,0.7)',
            textAlign: 'center',
            marginBottom: 48,
            lineHeight: 1.6,
          }}
        >
          Add colleagues who manage your HubSpot data.
        </p>

        {/* Info card */}
        <div
          style={{
            padding: 32,
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            textAlign: 'center',
            marginBottom: 48,
          }}
        >
          <div style={{ fontSize: 14, fontFamily: "'Jost', system-ui, sans-serif", color: 'rgba(249,248,245,0.7)', marginBottom: 8, lineHeight: 1.6 }}>
            You can invite your team from Settings → Team after setup.
          </div>
        </div>

        {/* Navigation */}
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
          <button
            onClick={() => router.back()}
            disabled={isSubmitting}
            style={{
              padding: '12px 24px',
              fontSize: 14,
              fontWeight: 500,
              fontFamily: "'Jost', system-ui, sans-serif",
              color: '#F9F8F5',
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.2)',
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              opacity: isSubmitting ? 0.5 : 1,
            }}
          >
            ← Back
          </button>

          <button
            onClick={handleContinue}
            disabled={isSubmitting}
            style={{
              padding: '12px 32px',
              fontSize: 14,
              fontWeight: 600,
              fontFamily: "'Jost', system-ui, sans-serif",
              color: '#F9F8F5',
              background: '#2E6BA8',
              border: 'none',
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              opacity: isSubmitting ? 0.4 : 1,
            }}
          >
            {isSubmitting ? 'Continuing...' : 'Continue →'}
          </button>
        </div>
      </div>
    </div>
  );
}
