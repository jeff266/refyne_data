'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { C, F } from '@/lib/design-tokens';

export default function ConnectPage() {
  const router = useRouter();
  const [isConnected, setIsConnected] = useState(false);
  const [connectionInfo, setConnectionInfo] = useState<{ name: string; portalId: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkConnection();
  }, []);

  const checkConnection = async () => {
    try {
      const response = await fetch('/api/connections');
      if (response.ok) {
        const data = await response.json();
        const hubspotConn = data.connections?.find((c: any) => c.provider === 'hubspot' && c.status === 'connected');
        if (hubspotConn) {
          setIsConnected(true);
          setConnectionInfo({
            name: hubspotConn.name || `Portal ${hubspotConn.portal_id}`,
            portalId: hubspotConn.portal_id,
          });

          // Update onboarding progress
          await fetch('/api/onboarding/progress', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              connected_hubspot: true,
            }),
          });
        }
      }
    } catch (error) {
      console.error('Failed to check connection:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConnect = () => {
    // Redirect to HubSpot OAuth with return_to parameter
    window.location.href = '/api/hubspot/connect?return_to=/onboarding/connect';
  };

  const handleContinue = () => {
    router.push('/onboarding/first-run');
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
            Step 3 of 5
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
          Connect your HubSpot portal
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
          Refyne needs read and write access to your HubSpot CRM.
        </p>

        {isLoading ? (
          <div style={{ textAlign: 'center', padding: 48, fontFamily: "'Jost', system-ui, sans-serif", color: 'rgba(249,248,245,0.6)' }}>
            Checking connection...
          </div>
        ) : isConnected && connectionInfo ? (
          /* Success state */
          <div>
            <div
              style={{
                padding: 32,
                background: 'rgba(34,197,94,0.15)',
                border: '1px solid rgba(34,197,94,0.3)',
                textAlign: 'center',
                marginBottom: 48,
              }}
            >
              <div
                style={{
                  fontSize: 48,
                  marginBottom: 16,
                  color: '#22C55E',
                }}
              >
                ✓
              </div>
              <div
                style={{
                  fontSize: 16,
                  fontFamily: "'Jost', system-ui, sans-serif",
                  fontWeight: 600,
                  color: '#F9F8F5',
                  marginBottom: 8,
                }}
              >
                HubSpot connected
              </div>
              <div style={{ fontSize: 13, fontFamily: "'Jost', system-ui, sans-serif", color: 'rgba(249,248,245,0.7)' }}>
                {connectionInfo.name} ({connectionInfo.portalId})
              </div>
            </div>

            {/* Navigation */}
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
              <button
                onClick={() => router.back()}
                style={{
                  padding: '12px 24px',
                  fontSize: 14,
                  fontWeight: 500,
                  fontFamily: "'Jost', system-ui, sans-serif",
                  color: '#F9F8F5',
                  background: 'transparent',
                  border: '1px solid rgba(255,255,255,0.2)',
                  cursor: 'pointer',
                }}
              >
                ← Back
              </button>

              <button
                onClick={handleContinue}
                style={{
                  padding: '12px 32px',
                  fontSize: 14,
                  fontWeight: 600,
                  fontFamily: "'Jost', system-ui, sans-serif",
                  color: '#F9F8F5',
                  background: '#2E6BA8',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                Continue →
              </button>
            </div>
          </div>
        ) : (
          /* Not connected state */
          <div>
            <div
              style={{
                padding: 24,
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                marginBottom: 24,
              }}
            >
              <button
                onClick={handleConnect}
                style={{
                  width: '100%',
                  padding: '14px 24px',
                  fontSize: 14,
                  fontWeight: 600,
                  fontFamily: "'Jost', system-ui, sans-serif",
                  color: '#fff',
                  background: '#FF7A59',
                  border: 'none',
                  cursor: 'pointer',
                  marginBottom: 16,
                }}
              >
                Connect HubSpot
              </button>

              <div style={{ fontSize: 13, fontFamily: "'Jost', system-ui, sans-serif", fontWeight: 600, color: '#F9F8F5', marginBottom: 12 }}>
                Refyne needs access to:
              </div>
              <ul style={{ fontSize: 12, fontFamily: "'Jost', system-ui, sans-serif", color: 'rgba(249,248,245,0.7)', lineHeight: 2, paddingLeft: 20 }}>
                <li>Read and write company records</li>
                <li>Read and write contact records</li>
                <li>Access property definitions</li>
              </ul>
            </div>

            {/* Navigation */}
            <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
              <button
                onClick={() => router.back()}
                style={{
                  padding: '12px 24px',
                  fontSize: 14,
                  fontWeight: 500,
                  fontFamily: "'Jost', system-ui, sans-serif",
                  color: '#F9F8F5',
                  background: 'transparent',
                  border: '1px solid rgba(255,255,255,0.2)',
                  cursor: 'pointer',
                }}
              >
                ← Back
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
