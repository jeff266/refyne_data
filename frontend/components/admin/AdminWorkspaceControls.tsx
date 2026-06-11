'use client';

import { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle } from 'lucide-react';

interface BillingData {
  org_id: string;
  subscription_tier: string;
  subscription_status: string;
  trial_end_date: string | null;
  trial_merges_used: number;
  trial_normalize_writes_used: number;
  trial_enrich_credits_used: number;
  pro_monthly_enrich_credits: number;
}

interface AuditEntry {
  id: string;
  admin_user_id: string;
  action: string;
  note: string | null;
  created_at: string;
}

interface Props {
  orgId: string;
}

export default function AdminWorkspaceControls({ orgId }: Props) {
  const [billing, setBilling] = useState<BillingData | null>(null);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form state
  const [selectedPlan, setSelectedPlan] = useState('');
  const [planNote, setPlanNote] = useState('');
  const [customTrialDate, setCustomTrialDate] = useState('');
  const [creditsToAdd, setCreditsToAdd] = useState('');

  useEffect(() => {
    fetchBilling();
    fetchAuditLog();
  }, [orgId]);

  const fetchBilling = async () => {
    try {
      const res = await fetch(`/api/admin/workspaces/${orgId}/billing`);
      if (res.ok) {
        const data = await res.json();
        setBilling(data.billing);
        setSelectedPlan(data.billing.subscription_tier);
      }
    } catch (error) {
      console.error('Failed to fetch billing:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAuditLog = async () => {
    try {
      const res = await fetch(`/api/admin/workspaces/${orgId}/audit-log`);
      if (res.ok) {
        const data = await res.json();
        setAuditLog(data.entries);
      }
    } catch (error) {
      console.error('Failed to fetch audit log:', error);
    }
  };

  const updateBilling = async (updates: any) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/workspaces/${orgId}/billing`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      if (res.ok) {
        await fetchBilling();
        await fetchAuditLog();
        // Reset form fields
        setPlanNote('');
        setCustomTrialDate('');
        setCreditsToAdd('');
      } else {
        const error = await res.json();
        alert(`Error: ${error.error}`);
      }
    } catch (error) {
      console.error('Failed to update billing:', error);
      alert('Failed to update billing');
    } finally {
      setSaving(false);
    }
  };

  const handlePlanChange = () => {
    if (!billing || selectedPlan === billing.subscription_tier) return;
    updateBilling({
      subscription_tier: selectedPlan,
      note: planNote || `Changed plan from ${billing.subscription_tier} to ${selectedPlan}`,
    });
  };

  const handleTrialExtension = (days: number) => {
    if (!billing?.trial_end_date) return;
    const currentEnd = new Date(billing.trial_end_date);
    currentEnd.setDate(currentEnd.getDate() + days);
    updateBilling({
      trial_end_date: currentEnd.toISOString(),
      note: `Extended trial by ${days} days`,
    });
  };

  const handleCustomTrialDate = () => {
    if (!customTrialDate) return;
    updateBilling({
      trial_end_date: new Date(customTrialDate).toISOString(),
      note: `Set custom trial end date`,
    });
  };

  const handleResetTrialUsage = () => {
    if (!confirm('Reset all trial usage counters to zero?')) return;
    updateBilling({
      reset_trial_usage: true,
      note: 'Reset trial usage counters',
    });
  };

  const handleAddCredits = () => {
    const amount = parseInt(creditsToAdd);
    if (isNaN(amount) || amount <= 0) {
      alert('Please enter a valid credit amount');
      return;
    }
    updateBilling({
      add_enrich_credits: amount,
      note: `Added ${amount} enrichment credits`,
    });
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Never';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getDaysRemaining = () => {
    if (!billing?.trial_end_date) return null;
    const end = new Date(billing.trial_end_date);
    const now = new Date();
    const diff = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  };

  if (loading) {
    return <div className="text-gray-500 text-sm">Loading admin controls...</div>;
  }

  if (!billing) {
    return <div className="text-red-500 text-sm">Failed to load billing data</div>;
  }

  const daysRemaining = getDaysRemaining();

  return (
    <div className="bg-white rounded-lg border border-gray-200 mb-8">
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-black">Admin Controls</h2>
        <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
          <AlertTriangle size={12} />
          Changes are logged and cannot be undone
        </p>
      </div>

      <div className="p-6 space-y-6">
        {/* Plan Section */}
        <div className="pb-6 border-b border-gray-200">
          <div className="text-xs text-gray-500 uppercase mb-2">Plan</div>
          <div className="text-sm text-gray-700 mb-4">
            Current: <span className="font-medium">{billing.subscription_tier}</span>
            {billing.subscription_tier === 'trial' && daysRemaining !== null && (
              <span className="text-gray-500"> (expires {formatDate(billing.trial_end_date)})</span>
            )}
          </div>

          <select
            value={selectedPlan}
            onChange={(e) => setSelectedPlan(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 text-sm mb-2"
            disabled={saving}
          >
            <option value="trial">Trial</option>
            <option value="starter">Starter ($149)</option>
            <option value="growth">Growth ($249)</option>
            <option value="scale">Scale ($399)</option>
            <option value="exempt">Exempt (internal)</option>
          </select>

          <input
            type="text"
            placeholder="Note for audit log (optional)"
            value={planNote}
            onChange={(e) => setPlanNote(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 text-sm mb-2"
            disabled={saving}
          />

          <button
            onClick={handlePlanChange}
            disabled={saving || selectedPlan === billing.subscription_tier}
            className="px-4 py-2 bg-blue-600 text-white text-sm hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving...' : 'Save plan change'}
          </button>
        </div>

        {/* Trial Section */}
        {billing.subscription_tier === 'trial' && (
          <div className="pb-6 border-b border-gray-200">
            <div className="text-xs text-gray-500 uppercase mb-2">Trial</div>
            <div className="text-sm text-gray-700 mb-4">
              Expires: {formatDate(billing.trial_end_date)}
              {daysRemaining !== null && (
                <span className={`ml-2 ${daysRemaining < 3 ? 'text-red-600' : 'text-gray-500'}`}>
                  ({daysRemaining} days left)
                </span>
              )}
            </div>

            <div className="flex gap-2 mb-4">
              <button
                onClick={() => handleTrialExtension(7)}
                disabled={saving}
                className="px-3 py-1.5 border border-gray-300 text-sm hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                +7 days
              </button>
              <button
                onClick={() => handleTrialExtension(14)}
                disabled={saving}
                className="px-3 py-1.5 border border-gray-300 text-sm hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                +14 days
              </button>
              <button
                onClick={() => handleTrialExtension(30)}
                disabled={saving}
                className="px-3 py-1.5 border border-gray-300 text-sm hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                +30 days
              </button>
            </div>

            <div className="flex gap-2 mb-4">
              <input
                type="date"
                value={customTrialDate}
                onChange={(e) => setCustomTrialDate(e.target.value)}
                className="px-3 py-1.5 border border-gray-300 text-sm flex-1"
                disabled={saving}
              />
              <button
                onClick={handleCustomTrialDate}
                disabled={saving || !customTrialDate}
                className="px-4 py-1.5 bg-blue-600 text-white text-sm hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                Set custom date
              </button>
            </div>

            <label className="flex items-center gap-2 text-sm text-gray-700 mb-2">
              <input type="checkbox" className="w-4 h-4" />
              <span>Reset trial usage counters (merges: {billing.trial_merges_used}, normalizations: {billing.trial_normalize_writes_used}, credits: {billing.trial_enrich_credits_used})</span>
            </label>

            <button
              onClick={handleResetTrialUsage}
              disabled={saving}
              className="px-4 py-2 bg-amber-600 text-white text-sm hover:bg-amber-700 transition-colors disabled:opacity-50"
            >
              Reset trial usage
            </button>
          </div>
        )}

        {/* Credits Section */}
        <div className="pb-6 border-b border-gray-200">
          <div className="text-xs text-gray-500 uppercase mb-2">Enrichment Credits</div>
          <div className="text-sm text-gray-700 mb-4">
            Monthly limit: <span className="font-medium">{billing.pro_monthly_enrich_credits}</span>
          </div>

          <div className="flex gap-2">
            <input
              type="number"
              min="0"
              max="10000"
              placeholder="Amount to add"
              value={creditsToAdd}
              onChange={(e) => setCreditsToAdd(e.target.value)}
              className="px-3 py-2 border border-gray-300 text-sm flex-1"
              disabled={saving}
            />
            <button
              onClick={handleAddCredits}
              disabled={saving || !creditsToAdd}
              className="px-4 py-2 bg-blue-600 text-white text-sm hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              Add credits
            </button>
          </div>
        </div>

        {/* Change Log */}
        <div>
          <div className="text-xs text-gray-500 uppercase mb-3">Change Log</div>
          {auditLog.length === 0 ? (
            <div className="text-sm text-gray-400">No changes yet</div>
          ) : (
            <div className="space-y-2">
              {auditLog.slice(0, 5).map((entry) => (
                <div key={entry.id} className="flex items-start gap-2 text-sm">
                  <CheckCircle size={14} className="text-green-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="text-gray-700">
                      {formatDate(entry.created_at)} · {entry.action.replace(/_/g, ' ')}
                    </div>
                    {entry.note && (
                      <div className="text-xs text-gray-500">{entry.note}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
