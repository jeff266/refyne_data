'use client';

import { useState, useEffect } from 'react';
import { C, F } from '@/lib/design-tokens';
import { Card, Toggle } from '@/components/refyne';
import { useRole } from '@/hooks/useRole';
import { AdminOnlyNotice } from '@/components/auth/AdminOnlyNotice';
import { FEATURE_FLAGS } from '@/lib/features/flags';

interface FeatureFlagState {
  [key: string]: boolean;
}

interface FeatureInfo {
  flag: string;
  name: string;
  description: string;
}

const BETA_FEATURES: FeatureInfo[] = [
  {
    flag: FEATURE_FLAGS.EVENT_LIST_IMPORT,
    name: 'Event List Import',
    description: 'Import CSV lists of contacts and automatically match them to your HubSpot records.',
  },
  {
    flag: FEATURE_FLAGS.CONTACT_DEDUP,
    name: 'Contact Dedup',
    description: 'Find and merge duplicate contacts in your HubSpot instance.',
  },
];

export function BetaTab() {
  const { isAdmin } = useRole();
  const [loading, setLoading] = useState(true);
  const [flags, setFlags] = useState<FeatureFlagState>({});
  const [hasStaffOverride, setHasStaffOverride] = useState(false);

  useEffect(() => {
    fetchFlags();
  }, []);

  async function fetchFlags() {
    try {
      const allFlags = [FEATURE_FLAGS.BETA_FEATURES, ...BETA_FEATURES.map(f => f.flag)];
      const res = await fetch(`/api/features/flags?flags=${allFlags.join(',')}`);
      if (res.ok) {
        const data = await res.json();
        setFlags(data.flags);
      }
    } catch (err) {
      console.error('Failed to fetch feature flags:', err);
    } finally {
      setLoading(false);
    }
  }

  async function toggleFlag(flag: string, currentValue: boolean) {
    const newValue = !currentValue;

    // Optimistic update
    setFlags(prev => ({ ...prev, [flag]: newValue }));

    try {
      const res = await fetch('/api/features/flags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ flag, enabled: newValue }),
      });

      if (!res.ok) {
        // Revert on error
        setFlags(prev => ({ ...prev, [flag]: currentValue }));
        showToast('Failed to update setting', 'error');
      }
    } catch (err) {
      // Revert on error
      setFlags(prev => ({ ...prev, [flag]: currentValue }));
      showToast('Failed to update setting', 'error');
    }
  }

  function showToast(message: string, type: 'success' | 'error') {
    const toast = document.createElement('div');
    toast.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      padding: 12px 20px;
      background: ${type === 'success' ? C.greenDim : C.redDim};
      border: 1px solid ${type === 'success' ? C.greenBrd : C.redBrd};
      color: ${type === 'success' ? C.green : C.red};
      border-radius: 8px;
      font-size: 14px;
      z-index: 10000;
      font-family: ${F.sans};
    `;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  }

  if (!isAdmin) {
    return <AdminOnlyNotice action="manage beta features" />;
  }

  if (loading) {
    return <div style={{ padding: 20, color: C.text3 }}>Loading...</div>;
  }

  const masterToggleEnabled = flags[FEATURE_FLAGS.BETA_FEATURES] || false;

  return (
    <div style={{ maxWidth: 720 }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, color: C.text, marginBottom: 8 }}>
          Beta features
        </h2>
        <p style={{ fontSize: 13, color: C.text3 }}>
          Get early access to features in development. These may change before general availability.
        </p>
      </div>

      {/* Staff Override Notice */}
      {hasStaffOverride && (
        <div
          style={{
            padding: 12,
            background: C.blueDim,
            border: `1px solid ${C.blueBrd}`,
            borderRadius: 8,
            marginBottom: 24,
            fontSize: 12,
            color: C.blue,
          }}
        >
          Some features have been enabled by Refyne staff.
        </div>
      )}

      {/* Master Toggle */}
      <Card style={{ marginBottom: 20 }}>
        <div style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ flex: 1, marginRight: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: C.text, marginBottom: 6 }}>
                Enable beta features
              </div>
              <div style={{ fontSize: 12, color: C.text3 }}>
                Turn this on to access features below as they become available.
              </div>
            </div>
            <Toggle
              on={masterToggleEnabled}
              onToggle={() => toggleFlag(FEATURE_FLAGS.BETA_FEATURES, masterToggleEnabled)}
            />
          </div>
        </div>
      </Card>

      {/* Individual Features */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {BETA_FEATURES.map((feature) => {
          const isEnabled = flags[feature.flag] || false;
          const isDisabled = !masterToggleEnabled;

          return (
            <Card key={feature.flag} style={{ opacity: isDisabled ? 0.6 : 1 }}>
              <div style={{ padding: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1, marginRight: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 500, color: C.text }}>
                        {feature.name}
                      </span>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 600,
                          color: C.steel,
                          border: `1px solid ${C.steel}`,
                          borderRadius: 4,
                          padding: '2px 6px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                        }}
                      >
                        Beta
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: C.text3 }}>
                      {feature.description}
                    </div>
                  </div>
                  <Toggle
                    on={isEnabled}
                    onToggle={() => toggleFlag(feature.flag, isEnabled)}
                    disabled={isDisabled}
                  />
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
