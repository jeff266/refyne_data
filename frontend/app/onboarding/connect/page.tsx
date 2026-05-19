'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { C, F } from '@/lib/design-tokens';
import { PrimaryBtn } from '@/components/refyne';
import { Check } from 'lucide-react';

export default function OnboardingConnectPage() {
  const router = useRouter();
  const [hasConnection, setHasConnection] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkConnection();
  }, []);

  async function checkConnection() {
    try {
      const res = await fetch('/api/hubspot/connections');
      if (res.ok) {
        const data = await res.json();
        setHasConnection(data.connections && data.connections.length > 0);
      }
    } catch (error) {
      console.error('Failed to check connection:', error);
    } finally {
      setLoading(false);
    }
  }

  function handleConnect() {
    window.location.href = '/api/hubspot/connect';
  }

  function handleSkip() {
    router.push('/dashboard');
  }

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

      {/* Progress */}
      <div style={{ marginBottom: 40, textAlign: 'center' }}>
        <div style={{ fontSize: 13, color: C.text3, marginBottom: 12 }}>
          Step 2 of 2
        </div>
        <div style={{ width: 300, height: 6, background: C.bg2, borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ width: '100%', height: '100%', background: C.indigo }} />
        </div>
      </div>

      {/* Card */}
      <div style={{
        background: C.sidebar,
        border: `1px solid ${C.border}`,
        borderRadius: 12,
        padding: 48,
        maxWidth: 500,
        width: '100%',
        textAlign: 'center',
      }}>
        <h1 style={{ fontSize: 28, fontWeight: 600, marginBottom: 32 }}>
          Connect your HubSpot
        </h1>

        {/* HubSpot Logo Placeholder */}
        <div style={{
          width: 80,
          height: 80,
          background: C.indigoDim,
          border: `1px solid ${C.indigoBrd}`,
          borderRadius: 16,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 32px',
          fontSize: 32,
        }}>
          🔗
        </div>

        {/* Connect Button */}
        <PrimaryBtn
          onClick={handleConnect}
          style={{
            width: '100%',
            padding: '16px 24px',
            fontSize: 16,
            marginBottom: 24,
          }}
        >
          Connect HubSpot →
        </PrimaryBtn>

        {/* Benefits */}
        <div style={{
          background: C.bg,
          border: `1px solid ${C.border}`,
          borderRadius: 8,
          padding: 20,
          textAlign: 'left',
        }}>
          {[
            'Read-only scan — nothing changes in your CRM until you approve it',
            'Takes 2–4 minutes for most portals',
            "You'll see your compliance score right after",
          ].map((benefit, i) => (
            <div key={i} style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 12,
              marginBottom: i < 2 ? 16 : 0,
            }}>
              <Check size={20} style={{ color: C.green, flexShrink: 0, marginTop: 2 }} />
              <span style={{ fontSize: 14, color: C.text2 }}>{benefit}</span>
            </div>
          ))}
        </div>

        {/* Skip Link */}
        {hasConnection && (
          <div style={{ marginTop: 24 }}>
            <button
              onClick={handleSkip}
              style={{
                background: 'none',
                border: 'none',
                color: C.text3,
                fontSize: 13,
                cursor: 'pointer',
                textDecoration: 'underline',
                fontFamily: F.sans,
              }}
            >
              Already have a connection? Skip to dashboard →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
