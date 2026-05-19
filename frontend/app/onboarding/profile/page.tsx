'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { C, F } from '@/lib/design-tokens';
import { PrimaryBtn } from '@/components/refyne';

type Role = 'revops' | 'sales' | 'marketing' | 'agency';
type CompanySize = 'under_5k' | '5k_to_50k' | 'over_50k';

export default function OnboardingProfilePage() {
  const router = useRouter();
  const { userId } = useAuth();
  const [role, setRole] = useState<Role | null>(null);
  const [companySize, setCompanySize] = useState<CompanySize | null>(null);
  const [companyName, setCompanyName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Pre-fill company name from email domain
    if (userId) {
      // TODO: Fetch user email and extract domain
      // For now, leave blank
    }
  }, [userId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!role || !companySize || !companyName.trim()) {
      setError('Please complete all fields');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/onboarding/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role,
          companySize,
          companyName: companyName.trim(),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create organization');
      }

      const data = await res.json();
      router.push(data.redirectTo);
    } catch (err: any) {
      console.error('Failed to submit profile:', err);
      setError(err.message || 'Failed to create organization');
      setLoading(false);
    }
  }

  const canContinue = role && companySize && companyName.trim().length > 0;

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
          Step 1 of 2
        </div>
        <div style={{ width: 300, height: 6, background: C.surface, borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ width: '50%', height: '100%', background: C.indigo }} />
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
      }}>
        <h1 style={{ fontSize: 28, fontWeight: 600, marginBottom: 8 }}>
          Tell us about yourself
        </h1>
        <p style={{ fontSize: 14, color: C.text2, marginBottom: 32 }}>
          This helps us personalize your experience.
        </p>

        <form onSubmit={handleSubmit}>
          {/* Role */}
          <div style={{ marginBottom: 32 }}>
            <label style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 12 }}>
              What's your role?
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {[
                { value: 'revops', label: 'RevOps / Operations' },
                { value: 'sales', label: 'Sales' },
                { value: 'marketing', label: 'Marketing' },
                { value: 'agency', label: 'Agency / Consultant' },
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setRole(option.value as Role)}
                  style={{
                    padding: '12px 16px',
                    background: role === option.value ? C.indigoDim : C.bg,
                    border: `1px solid ${role === option.value ? C.indigoBrd : C.border}`,
                    borderRadius: 8,
                    color: role === option.value ? C.indigoLt : C.text,
                    fontSize: 14,
                    fontWeight: 500,
                    cursor: 'pointer',
                    fontFamily: F.sans,
                    textAlign: 'center',
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Company Size */}
          <div style={{ marginBottom: 32 }}>
            <label style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 12 }}>
              How large is your HubSpot?
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { value: 'under_5k', label: 'Under 5,000 companies' },
                { value: '5k_to_50k', label: '5,000 – 50,000 companies' },
                { value: 'over_50k', label: 'More than 50,000 companies' },
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setCompanySize(option.value as CompanySize)}
                  style={{
                    padding: '12px 16px',
                    background: companySize === option.value ? C.indigoDim : C.bg,
                    border: `1px solid ${companySize === option.value ? C.indigoBrd : C.border}`,
                    borderRadius: 8,
                    color: companySize === option.value ? C.indigoLt : C.text,
                    fontSize: 14,
                    fontWeight: 500,
                    cursor: 'pointer',
                    fontFamily: F.sans,
                    textAlign: 'left',
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Company Name */}
          <div style={{ marginBottom: 32 }}>
            <label style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 12 }}>
              {role === 'agency' ? "First client's name" : 'Your company'}
            </label>
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Refyne Data"
              style={{
                width: '100%',
                padding: '12px 16px',
                background: C.bg,
                border: `1px solid ${C.border}`,
                borderRadius: 8,
                fontSize: 14,
                color: C.text,
                fontFamily: F.sans,
              }}
            />
            {role === 'agency' && (
              <div style={{ fontSize: 12, color: C.text3, marginTop: 8 }}>
                You can add more clients later from the workspace switcher.
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <div style={{
              padding: '12px 16px',
              background: C.redDim,
              border: `1px solid ${C.redBrd}`,
              borderRadius: 8,
              color: C.redLt,
              fontSize: 14,
              marginBottom: 24,
            }}>
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={!canContinue || loading}
            style={{
              width: '100%',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 5,
              padding: '6px 14px',
              background: !canContinue || loading
                ? C.text3
                : `linear-gradient(to bottom, ${C.indigo}, ${C.indigoDk})`,
              color: '#fff',
              borderRadius: 7,
              fontSize: 12,
              fontWeight: 500,
              fontFamily: F.sans,
              boxShadow: !canContinue || loading
                ? 'none'
                : '0 0 0 1px rgba(99,102,241,0.3), 0 1px 3px rgba(0,0,0,0.4)',
              letterSpacing: '-0.01em',
              border: 'none',
              cursor: !canContinue || loading ? 'not-allowed' : 'pointer',
              opacity: !canContinue || loading ? 0.6 : 1,
            }}
          >
            {loading ? 'Creating workspace...' : 'Continue →'}
          </button>
        </form>
      </div>

      {/* Subtext */}
      <div style={{ marginTop: 24, fontSize: 13, color: C.text3, textAlign: 'center' }}>
        See your HubSpot data quality score in 3 minutes
      </div>
    </div>
  );
}
