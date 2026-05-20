'use client';

import { useState, useEffect } from 'react';
import { Lock, Check } from 'lucide-react';
import { C } from '@/lib/design-tokens';
import { Tooltip } from '@/components/refyne';
import { useAuth } from '@clerk/nextjs';

interface LockedProviderChipProps {
  provider: string;
  providerLabel: string;
  currentPath?: string;
}

export function LockedProviderChip({
  provider,
  providerLabel,
  currentPath,
}: LockedProviderChipProps) {
  const { orgRole } = useAuth();
  const [requestSent, setRequestSent] = useState(false);
  const [sending, setSending] = useState(false);

  const isAdmin = orgRole === 'org:admin';
  const sessionKey = `provider-request-sent-${provider}`;

  // Check if request was already sent in this session
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const sent = sessionStorage.getItem(sessionKey);
      if (sent) {
        setRequestSent(true);
      }
    }
  }, [sessionKey]);

  const handleAdminConnect = () => {
    const returnUrl = encodeURIComponent(currentPath || window.location.pathname);
    window.location.href = `/connections?provider=${provider}&return=${returnUrl}`;
  };

  const handleOperatorRequest = async () => {
    if (requestSent || sending) return;

    setSending(true);

    try {
      const res = await fetch('/api/notifications/provider-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider }),
      });

      if (res.ok) {
        setRequestSent(true);
        sessionStorage.setItem(sessionKey, 'true');
      } else {
        console.error('Failed to send provider request');
      }
    } catch (error) {
      console.error('Failed to send provider request:', error);
    } finally {
      setSending(false);
    }
  };

  const tooltipText = isAdmin
    ? `${providerLabel} is not connected.`
    : `${providerLabel} is not connected. Ask an admin to connect it.`;

  return (
    <Tooltip content={tooltipText}>
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 12px',
          background: C.surface,
          border: `1px dashed ${C.border}`,
          borderRadius: 6,
          color: C.text3,
        }}
      >
        <Lock size={12} />
        <span style={{ fontSize: 12, fontWeight: 500 }}>{providerLabel}</span>

        {isAdmin ? (
          <button
            onClick={handleAdminConnect}
            style={{
              marginLeft: 4,
              padding: '2px 8px',
              fontSize: 11,
              fontWeight: 500,
              color: C.indigo,
              background: C.indigoDim,
              border: `1px solid ${C.indigoBrd}`,
              borderRadius: 4,
              cursor: 'pointer',
            }}
          >
            Connect {providerLabel} →
          </button>
        ) : requestSent ? (
          <span
            style={{
              marginLeft: 4,
              padding: '2px 8px',
              fontSize: 11,
              fontWeight: 500,
              color: C.green,
              background: C.greenDim,
              border: `1px solid ${C.greenBrd}`,
              borderRadius: 4,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <Check size={10} />
            Request sent
          </span>
        ) : (
          <button
            onClick={handleOperatorRequest}
            disabled={sending}
            style={{
              marginLeft: 4,
              padding: '2px 8px',
              fontSize: 11,
              fontWeight: 500,
              color: sending ? C.text3 : C.indigo,
              background: sending ? C.border : C.indigoDim,
              border: `1px solid ${sending ? C.border : C.indigoBrd}`,
              borderRadius: 4,
              cursor: sending ? 'not-allowed' : 'pointer',
            }}
          >
            {sending ? 'Sending...' : 'Request access'}
          </button>
        )}
      </div>
    </Tooltip>
  );
}
