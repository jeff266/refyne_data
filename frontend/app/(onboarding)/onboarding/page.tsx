'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { C, F } from '@/lib/design-tokens';
import { useAuth } from '@clerk/nextjs';

export default function WelcomePage() {
  const router = useRouter();
  const { orgId } = useAuth();
  const [workspaceName, setWorkspaceName] = useState('');
  const [userName, setUserName] = useState('');
  const [userRole, setUserRole] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pre-fill workspace name from Clerk org on mount
  useEffect(() => {
    async function fetchOrgName() {
      // Fetch from Clerk if available
      // For now, use a default
      setWorkspaceName('My Workspace');
    }
    fetchOrgName();
  }, []);

  const handleSubmit = async () => {
    setError(null);

    if (!workspaceName.trim()) {
      setError('Please enter a workspace name');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/onboarding/progress', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace_name: workspaceName,
          user_role: userRole || null,
          welcome_completed_at: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save progress');
      }

      router.push('/onboarding/use-case');
    } catch (err: any) {
      console.error('Failed to save welcome step:', err);
      setError('Failed to save. Please try again.');
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
        background: C.bg,
      }}
    >
      <div style={{ width: '100%', maxWidth: 480 }}>
        {/* Heading */}
        <h1
          style={{
            fontSize: 36,
            fontFamily: 'Lora, serif',
            fontWeight: 600,
            color: C.text,
            marginBottom: 12,
            textAlign: 'center',
          }}
        >
          Welcome to Refyne
        </h1>
        <p
          style={{
            fontSize: 15,
            fontFamily: F.sans,
            color: C.text2,
            textAlign: 'center',
            marginBottom: 48,
            lineHeight: 1.6,
          }}
        >
          Let's get your HubSpot data working for you. This takes about 5 minutes.
        </p>

        {/* Workspace name */}
        <div style={{ marginBottom: 24 }}>
          <label
            style={{
              display: 'block',
              fontSize: 13,
              fontFamily: F.sans,
              fontWeight: 600,
              color: C.text,
              marginBottom: 8,
            }}
          >
            What should we call your workspace?
          </label>
          <input
            type="text"
            value={workspaceName}
            onChange={(e) => setWorkspaceName(e.target.value)}
            placeholder="e.g., Acme Corp"
            style={{
              width: '100%',
              padding: '12px 16px',
              fontSize: 14,
              fontFamily: F.sans,
              color: C.text,
              background: C.surface,
              border: `1px solid ${C.border2}`,
              outline: 'none',
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = C.indigo)}
            onBlur={(e) => (e.currentTarget.style.borderColor = C.border2)}
          />
          <p style={{ fontSize: 11, fontFamily: F.sans, color: C.text3, marginTop: 6 }}>
            You can change this later in settings.
          </p>
        </div>

        {/* Two-column layout */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 48 }}>
          {/* Your name */}
          <div>
            <label
              style={{
                display: 'block',
                fontSize: 13,
                fontFamily: F.sans,
                fontWeight: 600,
                color: C.text,
                marginBottom: 8,
              }}
            >
              Your name
            </label>
            <input
              type="text"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder="Jane Doe"
              style={{
                width: '100%',
                padding: '12px 16px',
                fontSize: 14,
                fontFamily: F.sans,
                color: C.text,
                background: C.surface,
                border: `1px solid ${C.border2}`,
                outline: 'none',
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = C.indigo)}
              onBlur={(e) => (e.currentTarget.style.borderColor = C.border2)}
            />
          </div>

          {/* Role title */}
          <div>
            <label
              style={{
                display: 'block',
                fontSize: 13,
                fontFamily: F.sans,
                fontWeight: 600,
                color: C.text,
                marginBottom: 8,
              }}
            >
              Role title (optional)
            </label>
            <input
              type="text"
              value={userRole}
              onChange={(e) => setUserRole(e.target.value)}
              placeholder="e.g., Head of RevOps"
              style={{
                width: '100%',
                padding: '12px 16px',
                fontSize: 14,
                fontFamily: F.sans,
                color: C.text,
                background: C.surface,
                border: `1px solid ${C.border2}`,
                outline: 'none',
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = C.indigo)}
              onBlur={(e) => (e.currentTarget.style.borderColor = C.border2)}
            />
          </div>
        </div>

        {/* Get started button */}
        <button
          onClick={handleSubmit}
          disabled={isSubmitting || !workspaceName.trim()}
          style={{
            width: '100%',
            padding: '14px 24px',
            fontSize: 14,
            fontWeight: 600,
            fontFamily: F.sans,
            color: C.text,
            background: C.indigo,
            border: 'none',
            cursor: isSubmitting || !workspaceName.trim() ? 'not-allowed' : 'pointer',
            opacity: isSubmitting || !workspaceName.trim() ? 0.4 : 1,
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            if (!isSubmitting && workspaceName.trim()) {
              e.currentTarget.style.background = C.indigoDk;
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = C.indigo;
          }}
        >
          {isSubmitting ? 'Saving...' : 'Get started →'}
        </button>

        {/* Error message */}
        {error && (
          <p
            style={{
              marginTop: 12,
              fontSize: 13,
              fontFamily: F.sans,
              color: C.amber,
              textAlign: 'center',
            }}
          >
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
