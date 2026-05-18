'use client';

import { useEffect, useState } from 'react';
import { C, F } from '@/lib/design-tokens';

interface Subscription {
  id: string;
  notification_type: string;
  subscribed: boolean;
  mandatory: boolean;
}

const NOTIFICATION_CONFIG: Record<string, { name: string; description: string }> = {
  always_on_digest: {
    name: 'Always On digest',
    description: 'Nightly compliance summary for your workspace',
  },
  compliance_threshold_alert: {
    name: 'Compliance alerts',
    description: 'When score drops below your configured threshold',
  },
  dedup_pairs_detected: {
    name: 'New duplicate pairs',
    description: 'When new duplicate pairs are detected in your CRM',
  },
  quarantine_submitted: {
    name: 'Quarantine submissions',
    description: 'When a record is submitted for your review',
  },
  quarantine_decided: {
    name: 'Quarantine decisions',
    description: 'When your submitted records are approved or rejected',
  },
  credit_limit_warning: {
    name: 'Credit limit warnings',
    description: 'When you approach your monthly prospecting limit',
  },
  member_joined: {
    name: 'Member activity',
    description: 'When new members join your workspace',
  },
};

export default function NotificationsPage() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSubscriptions();
  }, []);

  async function fetchSubscriptions() {
    try {
      const res = await fetch('/api/notifications/subscriptions');
      if (res.ok) {
        const data = await res.json();
        setSubscriptions(data.subscriptions || []);
      }
    } catch (error) {
      console.error('Failed to fetch subscriptions:', error);
    } finally {
      setLoading(false);
    }
  }

  async function toggleSubscription(type: string, currentValue: boolean) {
    // Optimistic update
    setSubscriptions((prev) =>
      prev.map((sub) =>
        sub.notification_type === type ? { ...sub, subscribed: !currentValue } : sub
      )
    );

    try {
      const res = await fetch(`/api/notifications/subscriptions/${type}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscribed: !currentValue }),
      });

      if (!res.ok) {
        // Revert on error
        setSubscriptions((prev) =>
          prev.map((sub) =>
            sub.notification_type === type ? { ...sub, subscribed: currentValue } : sub
          )
        );
      }
    } catch (error) {
      console.error('Failed to update subscription:', error);
      // Revert on error
      setSubscriptions((prev) =>
        prev.map((sub) =>
          sub.notification_type === type ? { ...sub, subscribed: currentValue } : sub
        )
      );
    }
  }

  if (loading) {
    return (
      <div style={{ padding: 32, maxWidth: 720, fontFamily: F.sans }}>
        <h1 style={{ fontSize: 24, fontWeight: 600, color: C.text, marginBottom: 8 }}>
          Notification preferences
        </h1>
        <p style={{ fontSize: 14, color: C.text2, marginBottom: 32 }}>
          Manage which emails you receive from Refyne.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              style={{
                padding: 20,
                background: C.surface,
                border: `1px solid ${C.border}`,
                borderRadius: 8,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    height: 20,
                    width: 160,
                    background: C.border,
                    borderRadius: 4,
                    marginBottom: 8,
                  }}
                />
                <div
                  style={{
                    height: 16,
                    width: 280,
                    background: C.border,
                    borderRadius: 4,
                  }}
                />
              </div>
              <div
                style={{
                  width: 44,
                  height: 24,
                  background: C.border,
                  borderRadius: 12,
                }}
              />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 32, maxWidth: 720, fontFamily: F.sans }}>
      <h1 style={{ fontSize: 24, fontWeight: 600, color: C.text, marginBottom: 8 }}>
        Notification preferences
      </h1>
      <p style={{ fontSize: 14, color: C.text2, marginBottom: 32 }}>
        Manage which emails you receive from Refyne.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {subscriptions.map((sub) => {
          const config = NOTIFICATION_CONFIG[sub.notification_type];
          if (!config) return null;

          return (
            <div
              key={sub.notification_type}
              style={{
                padding: 20,
                background: C.surface,
                border: `1px solid ${C.border}`,
                borderRadius: 8,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 14, fontWeight: 500, color: C.text }}>{config.name}</span>
                  {sub.mandatory && (
                    <>
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 14 14"
                        fill="none"
                        style={{ opacity: 0.5 }}
                      >
                        <path
                          d="M10.5 6.5V5C10.5 3.067 8.933 1.5 7 1.5C5.067 1.5 3.5 3.067 3.5 5V6.5M7 9V10.5M5 12.5H9C9.828 12.5 10.5 11.828 10.5 11V8C10.5 7.172 9.828 6.5 9 6.5H5C4.172 6.5 3.5 7.172 3.5 8V11C3.5 11.828 4.172 12.5 5 12.5Z"
                          stroke={C.text2}
                          strokeWidth="1.5"
                          strokeLinecap="round"
                        />
                      </svg>
                      <span style={{ fontSize: 12, color: C.text2 }}>Required</span>
                    </>
                  )}
                </div>
                <p style={{ fontSize: 13, color: C.text2 }}>{config.description}</p>
              </div>

              <button
                onClick={() => !sub.mandatory && toggleSubscription(sub.notification_type, sub.subscribed)}
                disabled={sub.mandatory}
                style={{
                  width: 44,
                  height: 24,
                  borderRadius: 12,
                  border: 'none',
                  background: sub.subscribed ? C.indigo : C.border,
                  cursor: sub.mandatory ? 'not-allowed' : 'pointer',
                  opacity: sub.mandatory ? 0.5 : 1,
                  position: 'relative',
                  transition: 'background 0.2s',
                }}
              >
                <div
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    background: 'white',
                    position: 'absolute',
                    top: 2,
                    left: sub.subscribed ? 22 : 2,
                    transition: 'left 0.2s',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                  }}
                />
              </button>
            </div>
          );
        })}
      </div>

      {subscriptions.length === 0 && (
        <div
          style={{
            padding: 40,
            textAlign: 'center',
            background: C.surface,
            border: `1px solid ${C.border}`,
            borderRadius: 8,
          }}
        >
          <p style={{ fontSize: 14, color: C.text2 }}>No notification preferences found.</p>
        </div>
      )}
    </div>
  );
}
