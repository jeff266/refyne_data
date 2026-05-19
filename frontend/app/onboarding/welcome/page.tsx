'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { C, F } from '@/lib/design-tokens';
import { PrimaryBtn } from '@/components/refyne';
import { Check } from 'lucide-react';

interface WelcomeData {
  inviterName: string;
  workspaceName: string;
  role: string;
  score: number | null;
  duplicatesPending: number;
}

export default function OnboardingWelcomePage() {
  const router = useRouter();
  const [data, setData] = useState<WelcomeData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWelcomeData();
  }, []);

  async function fetchWelcomeData() {
    try {
      const res = await fetch('/api/onboarding/welcome-data');
      if (res.ok) {
        const welcomeData = await res.json();
        setData(welcomeData);
      }
    } catch (error) {
      console.error('Failed to fetch welcome data:', error);
    } finally {
      setLoading(false);
    }
  }

  function getLandingPage() {
    switch (data?.role) {
      case 'org:admin':
        return '/dashboard';
      case 'org:operator':
        return '/enrich';
      case 'org:viewer':
        return '/dashboard';
      default:
        return '/dashboard';
    }
  }

  function getRoleAccess() {
    switch (data?.role) {
      case 'org:admin':
        return [
          'Full access — dedup, normalize, enrich, settings',
        ];
      case 'org:operator':
        return [
          'Prospect and enrich companies',
          'Push records to HubSpot (per workspace policy)',
        ];
      case 'org:viewer':
        return [
          'View compliance dashboard and reports',
        ];
      default:
        return [];
    }
  }

  function getRoleLabel() {
    switch (data?.role) {
      case 'org:admin':
        return 'Admin';
      case 'org:operator':
        return 'Operator';
      case 'org:viewer':
        return 'Viewer';
      default:
        return 'Member';
    }
  }

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        background: C.bg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: F.sans,
        color: C.text,
      }}>
        Loading...
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{
        minHeight: '100vh',
        background: C.bg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: F.sans,
        color: C.text,
      }}>
        Failed to load welcome data
      </div>
    );
  }

  const roleAccess = getRoleAccess();
  const roleLabel = getRoleLabel();

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

      {/* Card */}
      <div style={{
        background: C.sidebar,
        border: `1px solid ${C.border}`,
        borderRadius: 12,
        padding: 48,
        maxWidth: 500,
        width: '100%',
      }}>
        {/* Workspace Logo/Initial */}
        <div style={{
          width: 80,
          height: 80,
          background: C.indigoDim,
          border: `1px solid ${C.indigoBrd}`,
          borderRadius: 16,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 24px',
          fontSize: 32,
          fontWeight: 600,
          color: C.indigoLt,
        }}>
          {data.workspaceName.charAt(0).toUpperCase()}
        </div>

        <h1 style={{ fontSize: 28, fontWeight: 600, marginBottom: 12, textAlign: 'center' }}>
          Welcome to {data.workspaceName}
        </h1>

        <p style={{ fontSize: 14, color: C.text2, marginBottom: 32, textAlign: 'center' }}>
          {data.inviterName} added you as {roleLabel}.
        </p>

        {/* Access Permissions */}
        <div style={{
          background: C.bg,
          border: `1px solid ${C.border}`,
          borderRadius: 8,
          padding: 20,
          marginBottom: 24,
        }}>
          <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 16 }}>
            Your access:
          </div>
          {roleAccess.map((access, i) => (
            <div key={i} style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 12,
              marginBottom: i < roleAccess.length - 1 ? 12 : 0,
            }}>
              <Check size={18} style={{ color: C.green, flexShrink: 0, marginTop: 2 }} />
              <span style={{ fontSize: 14, color: C.text2 }}>{access}</span>
            </div>
          ))}
        </div>

        {/* CRM Health */}
        {data.score !== null && (
          <div style={{
            background: C.bg,
            border: `1px solid ${C.border}`,
            borderRadius: 8,
            padding: 20,
            marginBottom: 24,
          }}>
            <div style={{ fontSize: 14, color: C.text3, marginBottom: 4 }}>
              Current CRM health:
            </div>
            <div style={{ fontSize: 32, fontWeight: 600, color: C.indigo, marginBottom: 8 }}>
              {data.score}/100
            </div>
            {data.duplicatesPending > 0 && (
              <div style={{ fontSize: 13, color: C.text2 }}>
                {data.duplicatesPending} duplicates pending review
              </div>
            )}
          </div>
        )}

        {/* Enter Workspace */}
        <PrimaryBtn onClick={() => router.push(getLandingPage())}>
          Enter workspace →
        </PrimaryBtn>
      </div>
    </div>
  );
}
