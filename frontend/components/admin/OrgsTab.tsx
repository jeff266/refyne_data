'use client';

import { useState, useEffect } from 'react';
import { C, F } from '@/lib/design-tokens';

interface Org {
  org_id: string;
  name: string;
  plan: string;
  plan_override: string | null;
  plan_override_reason: string | null;
  trial_state: string;
  trial_ends_at: string | null;
  trial_extended_by_days: number;
  is_trial_expired: boolean;
  credits_used: number;
  credits_total: number;
  hubspot_connected: boolean;
  member_count: number | null;
}

export default function OrgsTab() {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrg, setSelectedOrg] = useState<Org | null>(null);
  const [modalType, setModalType] = useState<'plan' | 'trial' | 'credits' | null>(null);

  // Modal state
  const [planOverride, setPlanOverride] = useState<string>('');
  const [planReason, setPlanReason] = useState('');
  const [extendDays, setExtendDays] = useState(14);
  const [grantCredits, setGrantCredits] = useState(500);
  const [creditReason, setCreditReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState(false);

  useEffect(() => {
    fetchOrgs();
  }, []);

  async function fetchOrgs() {
    try {
      const res = await fetch('/api/admin/orgs');
      if (!res.ok) throw new Error('Failed to fetch orgs');
      const data = await res.json();
      setOrgs(data.orgs);
    } catch (err) {
      console.error('Failed to fetch orgs:', err);
    } finally {
      setLoading(false);
    }
  }

  function openModal(org: Org, type: 'plan' | 'trial' | 'credits') {
    setSelectedOrg(org);
    setModalType(type);
    setActionError(null);
    setActionSuccess(false);

    // Reset form values
    if (type === 'plan') {
      setPlanOverride(org.plan_override || '');
      setPlanReason(org.plan_override_reason || '');
    } else if (type === 'trial') {
      setExtendDays(14);
    } else if (type === 'credits') {
      setGrantCredits(500);
      setCreditReason('');
    }
  }

  function closeModal() {
    setModalType(null);
    setSelectedOrg(null);
    setActionError(null);
    setActionSuccess(false);
  }

  async function handleSetPlan() {
    if (!selectedOrg) return;

    if (planOverride && !planReason.trim()) {
      setActionError('Reason is required');
      return;
    }

    setActionLoading(true);
    setActionError(null);

    try {
      const res = await fetch(`/api/admin/orgs/${selectedOrg.org_id}/plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan: planOverride || null,
          reason: planReason,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to set plan');
      }

      setActionSuccess(true);
      await fetchOrgs();
      setTimeout(closeModal, 1500);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to set plan');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleExtendTrial() {
    if (!selectedOrg) return;

    setActionLoading(true);
    setActionError(null);

    try {
      const res = await fetch(`/api/admin/orgs/${selectedOrg.org_id}/trial`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ extend_days: extendDays }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to extend trial');
      }

      setActionSuccess(true);
      await fetchOrgs();
      setTimeout(closeModal, 1500);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to extend trial');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleGrantCredits() {
    if (!selectedOrg) return;

    if (!creditReason.trim()) {
      setActionError('Reason is required');
      return;
    }

    setActionLoading(true);
    setActionError(null);

    try {
      const res = await fetch(`/api/admin/orgs/${selectedOrg.org_id}/credits`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          credits: grantCredits,
          reason: creditReason,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to grant credits');
      }

      setActionSuccess(true);
      await fetchOrgs();
      setTimeout(closeModal, 1500);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to grant credits');
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return (
      <div style={{ padding: 32, color: C.text3 }}>
        Loading organizations...
      </div>
    );
  }

  return (
    <div style={{ padding: 32 }}>
      <h2 style={{
        fontSize: 24,
        fontWeight: 600,
        color: C.text,
        fontFamily: F.serif,
        marginBottom: 24,
      }}>
        Organizations
      </h2>

      <div style={{
        background: C.surface,
        border: `1px solid ${C.border}`,
        overflow: 'hidden',
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${C.border}` }}>
              <th style={{ padding: 12, textAlign: 'left', color: C.text2, fontSize: 12, fontWeight: 500 }}>Org name</th>
              <th style={{ padding: 12, textAlign: 'left', color: C.text2, fontSize: 12, fontWeight: 500 }}>Members</th>
              <th style={{ padding: 12, textAlign: 'left', color: C.text2, fontSize: 12, fontWeight: 500 }}>Plan</th>
              <th style={{ padding: 12, textAlign: 'left', color: C.text2, fontSize: 12, fontWeight: 500 }}>Trial</th>
              <th style={{ padding: 12, textAlign: 'left', color: C.text2, fontSize: 12, fontWeight: 500 }}>Credits</th>
              <th style={{ padding: 12, textAlign: 'left', color: C.text2, fontSize: 12, fontWeight: 500 }}>HubSpot</th>
              <th style={{ padding: 12, textAlign: 'left', color: C.text2, fontSize: 12, fontWeight: 500 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {orgs.map((org) => (
              <tr key={org.org_id} style={{ borderBottom: `1px solid ${C.border}` }}>
                <td style={{ padding: 12, color: C.text, fontSize: 14 }}>
                  {org.name}
                </td>
                <td style={{ padding: 12, color: C.text2, fontSize: 14 }}>
                  {org.member_count !== null ? `${org.member_count} members` : '-- members'}
                </td>
                <td style={{ padding: 12 }}>
                  {org.plan_override ? (
                    <div style={{
                      display: 'inline-block',
                      padding: '4px 8px',
                      background: C.indigo + '30',
                      border: `1px solid ${C.indigo}`,
                      color: C.indigo,
                      fontSize: 12,
                      fontWeight: 500,
                    }}>
                      {org.plan_override}
                    </div>
                  ) : (
                    <span style={{ color: C.text2, fontSize: 14, textTransform: 'capitalize' }}>
                      {org.plan}
                    </span>
                  )}
                </td>
                <td style={{ padding: 12, fontSize: 14 }}>
                  <span style={{ color: org.trial_state === 'Expired' ? C.red : C.text2 }}>
                    {org.trial_state}
                  </span>
                </td>
                <td style={{ padding: 12, color: C.text2, fontSize: 14, fontFamily: F.mono }}>
                  {org.credits_used} / {org.credits_total}
                </td>
                <td style={{ padding: 12 }}>
                  <div style={{
                    width: 8,
                    height: 8,
                    background: org.hubspot_connected ? '#22c55e' : '#ef4444',
                  }} />
                </td>
                <td style={{ padding: 12, display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => openModal(org, 'plan')}
                    style={{
                      padding: '6px 12px',
                      background: C.surface,
                      border: `1px solid ${C.border}`,
                      color: C.text,
                      fontSize: 12,
                      cursor: 'pointer',
                    }}
                  >
                    Plan
                  </button>
                  <button
                    onClick={() => openModal(org, 'trial')}
                    style={{
                      padding: '6px 12px',
                      background: C.surface,
                      border: `1px solid ${C.border}`,
                      color: C.text,
                      fontSize: 12,
                      cursor: 'pointer',
                    }}
                  >
                    Trial
                  </button>
                  <button
                    onClick={() => openModal(org, 'credits')}
                    style={{
                      padding: '6px 12px',
                      background: C.surface,
                      border: `1px solid ${C.border}`,
                      color: C.text,
                      fontSize: 12,
                      cursor: 'pointer',
                    }}
                  >
                    Credits
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modals */}
      {modalType && selectedOrg && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={closeModal}
        >
          <div
            style={{
              background: C.surface,
              border: `1px solid rgba(46,107,168,0.3)`,
              padding: 32,
              width: 500,
              maxWidth: '90%',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Plan Modal */}
            {modalType === 'plan' && (
              <>
                <h3 style={{ fontSize: 18, fontWeight: 600, color: C.text, marginBottom: 20 }}>
                  Set plan override for {selectedOrg.name}
                </h3>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 13, color: C.text2, marginBottom: 6 }}>
                    Plan
                  </label>
                  <select
                    value={planOverride}
                    onChange={(e) => setPlanOverride(e.target.value)}
                    style={{
                      width: '100%',
                      padding: 10,
                      background: C.bg,
                      border: `1px solid ${C.border}`,
                      color: C.text,
                      fontSize: 14,
                    }}
                  >
                    <option value="">Clear override (revert to Stripe)</option>
                    <option value="growth">Growth ($249)</option>
                    <option value="scale">Scale ($399)</option>
                    <option value="enterprise">Enterprise (contact sales)</option>
                  </select>
                </div>
                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: 'block', fontSize: 13, color: C.text2, marginBottom: 6 }}>
                    Reason
                  </label>
                  <input
                    type="text"
                    value={planReason}
                    onChange={(e) => setPlanReason(e.target.value)}
                    placeholder="e.g., Pilot - Frontera Health Q3 2026"
                    style={{
                      width: '100%',
                      padding: 10,
                      background: C.bg,
                      border: `1px solid ${C.border}`,
                      color: C.text,
                      fontSize: 14,
                    }}
                  />
                </div>
                {!planOverride && (
                  <div style={{ padding: 12, background: C.amber + '20', border: `1px solid ${C.amber}`, color: C.amber, fontSize: 13, marginBottom: 16 }}>
                    ⚠️ This will revert to Stripe plan. Confirm only if org has an active Stripe subscription.
                  </div>
                )}
                {actionError && (
                  <div style={{ padding: 12, background: C.red + '20', color: C.red, fontSize: 13, marginBottom: 16 }}>
                    {actionError}
                  </div>
                )}
                {actionSuccess && (
                  <div style={{ padding: 12, background: '#22c55e20', color: '#22c55e', fontSize: 13, marginBottom: 16 }}>
                    ✓ Plan updated successfully
                  </div>
                )}
                <div style={{ display: 'flex', gap: 12 }}>
                  <button
                    onClick={handleSetPlan}
                    disabled={actionLoading}
                    style={{
                      flex: 1,
                      padding: '10px 20px',
                      background: actionLoading ? C.text3 : C.indigo,
                      color: '#fff',
                      border: 'none',
                      fontSize: 14,
                      fontWeight: 500,
                      cursor: actionLoading ? 'not-allowed' : 'pointer',
                      opacity: actionLoading ? 0.6 : 1,
                    }}
                  >
                    {actionLoading ? 'Setting...' : 'Set override'}
                  </button>
                  <button
                    onClick={closeModal}
                    style={{
                      padding: '10px 20px',
                      background: C.surface,
                      color: C.text,
                      border: `1px solid ${C.border}`,
                      fontSize: 14,
                      cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}

            {/* Trial Modal */}
            {modalType === 'trial' && (
              <>
                <h3 style={{ fontSize: 18, fontWeight: 600, color: C.text, marginBottom: 20 }}>
                  Extend trial for {selectedOrg.name}
                </h3>
                {selectedOrg.trial_ends_at && (
                  <div style={{ marginBottom: 16, fontSize: 13, color: C.text2 }}>
                    Current trial ends: {new Date(selectedOrg.trial_ends_at).toLocaleDateString()}
                  </div>
                )}
                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: 'block', fontSize: 13, color: C.text2, marginBottom: 6 }}>
                    Extend by N days
                  </label>
                  <input
                    type="number"
                    value={extendDays}
                    onChange={(e) => setExtendDays(parseInt(e.target.value))}
                    min={1}
                    style={{
                      width: '100%',
                      padding: 10,
                      background: C.bg,
                      border: `1px solid ${C.border}`,
                      color: C.text,
                      fontSize: 14,
                    }}
                  />
                </div>
                {selectedOrg.trial_ends_at && (
                  <div style={{ marginBottom: 16, fontSize: 13, color: C.text3 }}>
                    New trial end: {new Date(new Date(selectedOrg.trial_ends_at).getTime() + extendDays * 24 * 60 * 60 * 1000).toLocaleDateString()}
                  </div>
                )}
                {actionError && (
                  <div style={{ padding: 12, background: C.red + '20', color: C.red, fontSize: 13, marginBottom: 16 }}>
                    {actionError}
                  </div>
                )}
                {actionSuccess && (
                  <div style={{ padding: 12, background: '#22c55e20', color: '#22c55e', fontSize: 13, marginBottom: 16 }}>
                    ✓ Trial extended successfully
                  </div>
                )}
                <div style={{ display: 'flex', gap: 12 }}>
                  <button
                    onClick={handleExtendTrial}
                    disabled={actionLoading}
                    style={{
                      flex: 1,
                      padding: '10px 20px',
                      background: actionLoading ? C.text3 : C.indigo,
                      color: '#fff',
                      border: 'none',
                      fontSize: 14,
                      fontWeight: 500,
                      cursor: actionLoading ? 'not-allowed' : 'pointer',
                      opacity: actionLoading ? 0.6 : 1,
                    }}
                  >
                    {actionLoading ? 'Extending...' : 'Extend trial'}
                  </button>
                  <button
                    onClick={closeModal}
                    style={{
                      padding: '10px 20px',
                      background: C.surface,
                      color: C.text,
                      border: `1px solid ${C.border}`,
                      fontSize: 14,
                      cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}

            {/* Credits Modal */}
            {modalType === 'credits' && (
              <>
                <h3 style={{ fontSize: 18, fontWeight: 600, color: C.text, marginBottom: 20 }}>
                  Grant credits to {selectedOrg.name}
                </h3>
                <div style={{ marginBottom: 16, fontSize: 13, color: C.text2 }}>
                  Current balance: {selectedOrg.credits_used} / {selectedOrg.credits_total}
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 13, color: C.text2, marginBottom: 6 }}>
                    Credits to grant
                  </label>
                  <input
                    type="number"
                    value={grantCredits}
                    onChange={(e) => setGrantCredits(parseInt(e.target.value))}
                    min={1}
                    style={{
                      width: '100%',
                      padding: 10,
                      background: C.bg,
                      border: `1px solid ${C.border}`,
                      color: C.text,
                      fontSize: 14,
                    }}
                  />
                </div>
                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: 'block', fontSize: 13, color: C.text2, marginBottom: 6 }}>
                    Reason
                  </label>
                  <input
                    type="text"
                    value={creditReason}
                    onChange={(e) => setCreditReason(e.target.value)}
                    placeholder="e.g., Bulk enrichment for pilot"
                    style={{
                      width: '100%',
                      padding: 10,
                      background: C.bg,
                      border: `1px solid ${C.border}`,
                      color: C.text,
                      fontSize: 14,
                    }}
                  />
                </div>
                <div style={{ marginBottom: 16, fontSize: 13, color: C.text3 }}>
                  New balance: {selectedOrg.credits_used} / {selectedOrg.credits_total + grantCredits}
                </div>
                {actionError && (
                  <div style={{ padding: 12, background: C.red + '20', color: C.red, fontSize: 13, marginBottom: 16 }}>
                    {actionError}
                  </div>
                )}
                {actionSuccess && (
                  <div style={{ padding: 12, background: '#22c55e20', color: '#22c55e', fontSize: 13, marginBottom: 16 }}>
                    ✓ Credits granted successfully
                  </div>
                )}
                <div style={{ display: 'flex', gap: 12 }}>
                  <button
                    onClick={handleGrantCredits}
                    disabled={actionLoading}
                    style={{
                      flex: 1,
                      padding: '10px 20px',
                      background: actionLoading ? C.text3 : C.indigo,
                      color: '#fff',
                      border: 'none',
                      fontSize: 14,
                      fontWeight: 500,
                      cursor: actionLoading ? 'not-allowed' : 'pointer',
                      opacity: actionLoading ? 0.6 : 1,
                    }}
                  >
                    {actionLoading ? 'Granting...' : 'Grant credits'}
                  </button>
                  <button
                    onClick={closeModal}
                    style={{
                      padding: '10px 20px',
                      background: C.surface,
                      color: C.text,
                      border: `1px solid ${C.border}`,
                      fontSize: 14,
                      cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
