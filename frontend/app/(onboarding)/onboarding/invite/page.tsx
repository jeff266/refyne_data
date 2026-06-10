'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { C, F } from '@/lib/design-tokens';

interface PendingInvite {
  email: string;
  role: 'org:admin' | 'org:member';
}

interface HubSpotSuggestion {
  id: string;
  email: string;
  name: string;
}

export default function InvitePage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [pending, setPending] = useState<PendingInvite[]>([]);
  const [suggestions, setSuggestions] = useState<HubSpotSuggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load HubSpot owner suggestions
  useEffect(() => {
    async function loadSuggestions() {
      try {
        const response = await fetch('/api/onboarding/hubspot-owners');
        if (response.ok) {
          const data = await response.json();
          setSuggestions(data.suggestions || []);
        }
      } catch (err) {
        console.error('Failed to load HubSpot owners:', err);
      } finally {
        setLoadingSuggestions(false);
      }
    }
    loadSuggestions();
  }, []);

  const addInvite = (emailAddr: string, role: 'org:admin' | 'org:member' = 'org:member') => {
    const trimmed = emailAddr.trim().toLowerCase();
    if (!trimmed) return;

    // Basic email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError('Invalid email address');
      return;
    }

    // Check for duplicates
    if (pending.some((inv) => inv.email === trimmed)) {
      setError('Email already added');
      return;
    }

    setPending([...pending, { email: trimmed, role }]);
    setEmail('');
    setError(null);
  };

  const removeInvite = (emailAddr: string) => {
    setPending(pending.filter((inv) => inv.email !== emailAddr));
  };

  const updateRole = (emailAddr: string, role: 'org:admin' | 'org:member') => {
    setPending(pending.map((inv) => (inv.email === emailAddr ? { ...inv, role } : inv)));
  };

  const handleSendInvites = async () => {
    if (pending.length === 0) {
      await handleSkip();
      return;
    }

    setSending(true);
    setError(null);

    try {
      const response = await fetch('/api/onboarding/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invites: pending }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send invitations');
      }

      // Update progress
      await fetch('/api/onboarding/progress', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invited_team_at: new Date().toISOString() }),
      });

      // Show success and advance
      if (data.failed && data.failed.length > 0) {
        setError(`Sent ${data.sent} invitations. ${data.failed.length} failed.`);
        // Remove successful ones from pending
        const failedEmails = data.failed.map((f: any) => f.email);
        setPending(pending.filter((inv) => failedEmails.includes(inv.email)));
        setSending(false);
      } else {
        // All successful, advance immediately
        router.push('/onboarding/complete');
      }
    } catch (err) {
      console.error('Failed to send invitations:', err);
      setError(err instanceof Error ? err.message : 'Failed to send invitations');
      setSending(false);
    }
  };

  const handleSkip = async () => {
    try {
      await fetch('/api/onboarding/progress', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invited_team_at: null }),
      });
      router.push('/onboarding/complete');
    } catch (err) {
      console.error('Failed to skip:', err);
      setError('Failed to continue. Please try again.');
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
      <div style={{ width: '100%', maxWidth: 640 }}>
        {/* Progress indicator */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <span
            style={{
              fontSize: 12,
              fontFamily: F.sans,
              color: C.text3,
              fontWeight: 500,
            }}
          >
            Step 6 of 6
          </span>
        </div>

        {/* Heading */}
        <h1
          style={{
            fontSize: 32,
            fontFamily: 'Lora, serif',
            fontWeight: 600,
            color: C.text,
            marginBottom: 12,
            textAlign: 'center',
          }}
        >
          Invite your team
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
          Add colleagues who manage your HubSpot data.
        </p>

        {/* Email input */}
        <div style={{ marginBottom: 24 }}>
          <label
            style={{
              display: 'block',
              fontSize: 13,
              fontFamily: F.sans,
              color: C.text,
              marginBottom: 8,
              fontWeight: 500,
            }}
          >
            Email address
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addInvite(email);
                }
              }}
              placeholder="colleague@company.com"
              style={{
                flex: 1,
                padding: '10px 12px',
                fontSize: 14,
                fontFamily: F.sans,
                background: C.surface,
                border: `1px solid ${C.border2}`,
                color: C.text,
                outline: 'none',
              }}
            />
            <button
              onClick={() => addInvite(email)}
              disabled={!email.trim()}
              style={{
                padding: '10px 20px',
                fontSize: 14,
                fontWeight: 600,
                fontFamily: F.sans,
                background: email.trim() ? C.indigo : C.surface,
                color: C.text,
                border: 'none',
                cursor: email.trim() ? 'pointer' : 'not-allowed',
                opacity: email.trim() ? 1 : 0.5,
              }}
            >
              Add
            </button>
          </div>
          {error && (
            <div
              style={{
                marginTop: 8,
                fontSize: 12,
                color: C.amber,
                fontFamily: F.sans,
              }}
            >
              {error}
            </div>
          )}
        </div>

        {/* HubSpot suggestions */}
        {!loadingSuggestions && suggestions.length > 0 && (
          <div style={{ marginBottom: 32 }}>
            <div
              style={{
                fontSize: 12,
                fontFamily: F.sans,
                color: C.text3,
                marginBottom: 12,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              HubSpot users you can invite:
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {suggestions.slice(0, 5).map((suggestion) => (
                <div
                  key={suggestion.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 12px',
                    background: C.surface,
                    border: `1px solid ${C.border2}`,
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: 13,
                        color: C.text,
                        fontFamily: F.sans,
                        fontWeight: 500,
                      }}
                    >
                      {suggestion.name}
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: C.text2,
                        fontFamily: F.sans,
                      }}
                    >
                      {suggestion.email}
                    </div>
                  </div>
                  <button
                    onClick={() => addInvite(suggestion.email)}
                    disabled={pending.some((inv) => inv.email === suggestion.email.toLowerCase())}
                    style={{
                      padding: '6px 14px',
                      fontSize: 12,
                      fontWeight: 600,
                      fontFamily: F.sans,
                      background: pending.some((inv) => inv.email === suggestion.email.toLowerCase())
                        ? C.surface
                        : C.indigoDim,
                      color: C.text,
                      border: `1px solid ${C.border2}`,
                      cursor: pending.some((inv) => inv.email === suggestion.email.toLowerCase())
                        ? 'not-allowed'
                        : 'pointer',
                      opacity: pending.some((inv) => inv.email === suggestion.email.toLowerCase())
                        ? 0.5
                        : 1,
                    }}
                  >
                    {pending.some((inv) => inv.email === suggestion.email.toLowerCase())
                      ? 'Added'
                      : '+ Invite'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Pending invites */}
        {pending.length > 0 && (
          <div style={{ marginBottom: 32 }}>
            <div
              style={{
                fontSize: 12,
                fontFamily: F.sans,
                color: C.text3,
                marginBottom: 12,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              Pending invitations ({pending.length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {pending.map((invite) => (
                <div
                  key={invite.email}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '12px',
                    background: C.surface,
                    border: `1px solid ${C.border2}`,
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        fontSize: 13,
                        color: C.text,
                        fontFamily: F.sans,
                        fontWeight: 500,
                      }}
                    >
                      {invite.email}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <input
                        type="radio"
                        name={`role-${invite.email}`}
                        checked={invite.role === 'org:admin'}
                        onChange={() => updateRole(invite.email, 'org:admin')}
                        style={{ cursor: 'pointer' }}
                      />
                      <span
                        style={{
                          fontSize: 12,
                          color: C.text,
                          fontFamily: F.sans,
                        }}
                      >
                        Admin
                      </span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <input
                        type="radio"
                        name={`role-${invite.email}`}
                        checked={invite.role === 'org:member'}
                        onChange={() => updateRole(invite.email, 'org:member')}
                        style={{ cursor: 'pointer' }}
                      />
                      <span
                        style={{
                          fontSize: 12,
                          color: C.text,
                          fontFamily: F.sans,
                        }}
                      >
                        Member
                      </span>
                    </label>
                    <button
                      onClick={() => removeInvite(invite.email)}
                      style={{
                        padding: '4px 10px',
                        fontSize: 12,
                        fontFamily: F.sans,
                        background: 'transparent',
                        color: C.text2,
                        border: `1px solid ${C.border2}`,
                        cursor: 'pointer',
                      }}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Navigation */}
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center' }}>
          <button
            onClick={() => router.back()}
            disabled={sending}
            style={{
              padding: '12px 24px',
              fontSize: 14,
              fontWeight: 500,
              fontFamily: F.sans,
              color: C.text,
              background: 'transparent',
              border: `1px solid ${C.border2}`,
              cursor: sending ? 'not-allowed' : 'pointer',
              opacity: sending ? 0.5 : 1,
            }}
          >
            ← Back
          </button>

          <button
            onClick={handleSkip}
            disabled={sending}
            style={{
              fontSize: 13,
              fontFamily: F.sans,
              color: C.text2,
              background: 'transparent',
              border: 'none',
              cursor: sending ? 'not-allowed' : 'pointer',
              textDecoration: 'underline',
              opacity: sending ? 0.5 : 1,
            }}
          >
            Skip for now
          </button>

          <button
            onClick={handleSendInvites}
            disabled={sending}
            style={{
              padding: '12px 32px',
              fontSize: 14,
              fontWeight: 600,
              fontFamily: F.sans,
              color: C.text,
              background: C.indigo,
              border: 'none',
              cursor: sending ? 'not-allowed' : 'pointer',
              opacity: sending ? 0.4 : 1,
            }}
          >
            {sending
              ? 'Sending invitations...'
              : pending.length > 0
              ? `Send ${pending.length} ${pending.length === 1 ? 'invitation' : 'invitations'} →`
              : 'Continue →'}
          </button>
        </div>
      </div>
    </div>
  );
}
