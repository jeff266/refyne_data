'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { C, F } from '@/lib/design-tokens';

interface NotificationPrefs {
  subscribed: boolean;
  mandatory: boolean;
}

interface Member {
  userId: string;
  name: string;
  email: string;
  role: string;
  subscriptions: Record<string, NotificationPrefs>;
}

const NOTIFICATION_TYPES = [
  {
    key: 'always_on_digest',
    label: 'Digest',
    tooltip: 'Daily Always On compliance digest',
    mandatory: false,
    defaultSubscribed: false
  },
  {
    key: 'compliance_threshold_alert',
    label: 'Threshold',
    tooltip: 'Alert when compliance score drops below threshold',
    mandatory: true,
    defaultSubscribed: true
  },
  {
    key: 'dedup_pairs_detected',
    label: 'Dedup',
    tooltip: 'Notification when duplicate pairs are detected',
    mandatory: false,
    defaultSubscribed: true
  },
  {
    key: 'enrich_run_complete',
    label: 'Enrich',
    tooltip: 'Notification when an enrichment run finishes',
    mandatory: false,
    defaultSubscribed: true
  },
  {
    key: 'normalize_run_complete',
    label: 'Normalize',
    tooltip: 'Notification when a normalization run finishes',
    mandatory: false,
    defaultSubscribed: true
  },
  {
    key: 'credit_limit_warning',
    label: 'Credits',
    tooltip: 'Warning when approaching credit limit',
    mandatory: false,
    defaultSubscribed: true
  },
  {
    key: 'member_joined',
    label: 'Members',
    tooltip: 'Notification when new members join workspace',
    mandatory: false,
    defaultSubscribed: false
  },
];

export function NotificationsTab() {
  const { orgRole } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNotifications();
  }, []);

  async function fetchNotifications() {
    try {
      const res = await fetch('/api/org/notifications');
      if (res.ok) {
        const data = await res.json();
        // Auto-seed defaults for missing subscriptions
        const membersWithDefaults = (data.members || []).map((member: Member) => ({
          ...member,
          subscriptions: NOTIFICATION_TYPES.reduce((acc, type) => {
            acc[type.key] = member.subscriptions[type.key] || {
              subscribed: type.defaultSubscribed,
              mandatory: type.mandatory,
            };
            return acc;
          }, {} as Record<string, NotificationPrefs>),
        }));
        setMembers(membersWithDefaults);
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setLoading(false);
    }
  }

  async function toggleSubscription(userId: string, type: string, currentValue: boolean, isMandatory: boolean) {
    if (isMandatory) return;

    // Optimistic update
    setMembers((prev) =>
      prev.map((m) =>
        m.userId === userId
          ? {
              ...m,
              subscriptions: {
                ...m.subscriptions,
                [type]: { ...m.subscriptions[type], subscribed: !currentValue },
              },
            }
          : m
      )
    );

    try {
      const res = await fetch(`/api/org/notifications/${userId}/${type}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscribed: !currentValue }),
      });

      if (!res.ok) {
        // Revert on error
        setMembers((prev) =>
          prev.map((m) =>
            m.userId === userId
              ? {
                  ...m,
                  subscriptions: {
                    ...m.subscriptions,
                    [type]: { ...m.subscriptions[type], subscribed: currentValue },
                  },
                }
              : m
          )
        );
      }
    } catch (error) {
      console.error('Failed to update subscription:', error);
      // Revert on error
      setMembers((prev) =>
        prev.map((m) =>
          m.userId === userId
            ? {
                ...m,
                subscriptions: {
                  ...m.subscriptions,
                  [type]: { ...m.subscriptions[type], subscribed: currentValue },
                },
              }
            : m
        )
      );
    }
  }

  // Non-admin access
  if (orgRole !== 'org:admin') {
    return (
      <div
        style={{
          padding: 40,
          textAlign: 'center',
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderRadius: 8,
        }}
      >
        <p style={{ fontSize: 14, color: C.text2, marginBottom: 8 }}>Admin access required</p>
        <p style={{ fontSize: 13, color: C.text2 }}>
          Only workspace admins can manage notification settings for all members.
        </p>
      </div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div>
        <p style={{ fontSize: 13, color: C.text2, marginBottom: 16 }}>
          Manage notification preferences for all workspace members.
        </p>
        <div
          style={{
            background: C.surface,
            border: `1px solid ${C.border}`,
            borderRadius: 8,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '12px 16px',
              background: C.surface,
              borderBottom: `1px solid ${C.border}`,
              display: 'flex',
              gap: 12,
            }}
          >
            <div style={{ width: 200, height: 16, background: C.border, borderRadius: 4 }} />
            {NOTIFICATION_TYPES.map((type) => (
              <div key={type.key} style={{ width: 80, height: 16, background: C.border, borderRadius: 4 }} />
            ))}
          </div>
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              style={{
                padding: '12px 16px',
                borderBottom: `1px solid ${C.border}`,
                display: 'flex',
                gap: 12,
                alignItems: 'center',
              }}
            >
              <div style={{ width: 200, height: 16, background: C.border, borderRadius: 4 }} />
              {NOTIFICATION_TYPES.map((type) => (
                <div key={type.key} style={{ width: 24, height: 24, background: C.border, borderRadius: 12 }} />
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Empty state
  if (members.length === 0) {
    return (
      <div
        style={{
          padding: 40,
          textAlign: 'center',
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderRadius: 8,
        }}
      >
        <p style={{ fontSize: 14, color: C.text2, marginBottom: 8 }}>No members yet</p>
        <p style={{ fontSize: 13, color: C.text2 }}>
          Invite members from the Members tab.
        </p>
      </div>
    );
  }

  // Grid view
  return (
    <div>
      <p style={{ fontSize: 13, color: C.text2, marginBottom: 16 }}>
        Manage notification preferences for all workspace members.
      </p>

      <div
        style={{
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderRadius: 8,
          overflow: 'hidden',
        }}
      >
        {/* Header Row */}
        <div
          style={{
            padding: '12px 16px',
            background: C.surface,
            borderBottom: `1px solid ${C.border}`,
            display: 'grid',
            gridTemplateColumns: '200px repeat(7, 80px)',
            gap: 12,
            alignItems: 'center',
          }}
        >
          <span style={{ fontSize: 12, fontWeight: 500, color: C.text2 }}>Member</span>
          {NOTIFICATION_TYPES.map((type) => (
            <div
              key={type.key}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
              }}
              title={type.tooltip}
            >
              <span
                style={{
                  fontSize: 12,
                  color: C.text2,
                  textAlign: 'center',
                }}
              >
                {type.label}
              </span>
              {type.mandatory && (
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 14 14"
                  fill="none"
                  style={{ opacity: 0.4, flexShrink: 0 }}
                >
                  <path
                    d="M10.5 6.5V5C10.5 3.067 8.933 1.5 7 1.5C5.067 1.5 3.5 3.067 3.5 5V6.5M7 9V10.5M5 12.5H9C9.828 12.5 10.5 11.828 10.5 11V8C10.5 7.172 9.828 6.5 9 6.5H5C4.172 6.5 3.5 7.172 3.5 8V11C3.5 11.828 4.172 12.5 5 12.5Z"
                    stroke={C.text3}
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              )}
            </div>
          ))}
        </div>

        {/* Member Rows */}
        {members.map((member) => (
          <div
            key={member.userId}
            style={{
              padding: '12px 16px',
              borderBottom: `1px solid ${C.border}`,
              display: 'grid',
              gridTemplateColumns: '200px repeat(7, 80px)',
              gap: 12,
              alignItems: 'center',
            }}
            title={member.email}
          >
            <div>
              <div style={{ fontSize: 13, color: C.text }}>{member.name || member.email}</div>
              <div style={{ fontSize: 11, color: C.text2 }}>
                {member.role.replace('org:', '')}
              </div>
            </div>

            {NOTIFICATION_TYPES.map((type) => {
              const pref = member.subscriptions[type.key];

              if (pref.mandatory) {
                return (
                  <div key={type.key} style={{ textAlign: 'center' }}>
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 14 14"
                      fill="none"
                      style={{ opacity: 0.4, display: 'inline-block' }}
                    >
                      <path
                        d="M10.5 6.5V5C10.5 3.067 8.933 1.5 7 1.5C5.067 1.5 3.5 3.067 3.5 5V6.5M7 9V10.5M5 12.5H9C9.828 12.5 10.5 11.828 10.5 11V8C10.5 7.172 9.828 6.5 9 6.5H5C4.172 6.5 3.5 7.172 3.5 8V11C3.5 11.828 4.172 12.5 5 12.5Z"
                        stroke={C.text2}
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      />
                    </svg>
                  </div>
                );
              }

              return (
                <div key={type.key} style={{ textAlign: 'center' }}>
                  <button
                    onClick={() => toggleSubscription(member.userId, type.key, pref.subscribed, pref.mandatory)}
                    style={{
                      width: 32,
                      height: 18,
                      borderRadius: 9,
                      border: 'none',
                      background: pref.subscribed ? C.indigo : C.border,
                      cursor: 'pointer',
                      position: 'relative',
                      transition: 'background 0.2s',
                    }}
                  >
                    <div
                      style={{
                        width: 14,
                        height: 14,
                        borderRadius: '50%',
                        background: 'white',
                        position: 'absolute',
                        top: 2,
                        left: pref.subscribed ? 16 : 2,
                        transition: 'left 0.2s',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
                      }}
                    />
                  </button>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
