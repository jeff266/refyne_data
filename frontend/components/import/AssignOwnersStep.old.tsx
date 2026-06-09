'use client';

/**
 * AssignOwnersStep Component
 *
 * Step 6 of import wizard - Assign HubSpot owners to imported contacts
 */

import { useState, useEffect } from 'react';
import { ArrowRight, ArrowLeft, Plus, X, AlertCircle } from 'lucide-react';

interface OwnerAssignment {
  id: string;
  ownerId: string;
  weight: number;
}

interface HubSpotOwner {
  id: string;
  email: string | null;
  name: string;
}

interface AssignOwnersStepProps {
  sessionId: string;
  totalContacts: number;
  onBack: () => void;
  onContinue: (enabled: boolean, assignments: OwnerAssignment[]) => void;
}

export function AssignOwnersStep({
  sessionId,
  totalContacts,
  onBack,
  onContinue,
}: AssignOwnersStepProps) {
  const [enabled, setEnabled] = useState(false);
  const [owners, setOwners] = useState<HubSpotOwner[]>([]);
  const [assignments, setAssignments] = useState<OwnerAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [manualMode, setManualMode] = useState(false);

  // Fetch HubSpot owners on mount
  useEffect(() => {
    fetchOwners();
  }, []);

  const fetchOwners = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/hubspot/owners');

      if (!response.ok) {
        throw new Error('Failed to fetch HubSpot owners');
      }

      const data = await response.json();
      setOwners(data.owners || []);
    } catch (err) {
      console.error('[AssignOwnersStep] Failed to fetch owners:', err);
      setError('Could not load HubSpot owners. You can enter owner emails manually.');
      setManualMode(true);
    } finally {
      setLoading(false);
    }
  };

  const addOwner = () => {
    const newAssignment: OwnerAssignment = {
      id: Math.random().toString(36).substr(2, 9),
      ownerId: '',
      weight: 1,
    };
    setAssignments([...assignments, newAssignment]);
  };

  const removeOwner = (id: string) => {
    setAssignments(assignments.filter((a) => a.id !== id));
  };

  const updateAssignment = (id: string, field: 'ownerId' | 'weight', value: string | number) => {
    setAssignments(
      assignments.map((a) =>
        a.id === id ? { ...a, [field]: field === 'weight' ? Number(value) : value } : a
      )
    );
  };

  const handleContinue = () => {
    if (!enabled) {
      onContinue(false, []);
      return;
    }

    // Validate assignments
    const validAssignments = assignments.filter(
      (a) => a.ownerId && a.weight > 0
    );

    if (validAssignments.length === 0) {
      alert('Please add at least one owner with a weight greater than 0');
      return;
    }

    onContinue(true, validAssignments);
  };

  // Calculate preview distribution
  const totalWeight = assignments.reduce((sum, a) => sum + a.weight, 0);
  const preview = assignments.map((a) => {
    const ownerInfo = owners.find((o) => o.id === a.ownerId);
    const ownerLabel = manualMode
      ? a.ownerId
      : ownerInfo
      ? ownerInfo.email ? `${ownerInfo.name} (${ownerInfo.email})` : ownerInfo.name
      : 'Unknown owner';

    const percentage = totalWeight > 0 ? (a.weight / totalWeight) * 100 : 0;
    const estimatedContacts = Math.round((percentage / 100) * totalContacts);

    return {
      ...a,
      ownerLabel,
      percentage: percentage.toFixed(1),
      estimatedContacts,
    };
  });

  return (
    <div>
      <h2 className="text-lg font-medium text-white mb-4">
        Step 6: Owner Assignment (Optional)
      </h2>

      {/* Toggle */}
      <label className="flex items-center gap-3 mb-6 cursor-pointer">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="w-4 h-4"
        />
        <span className="text-sm text-white">Assign HubSpot owners on import</span>
      </label>

      {/* Owner assignment UI - only show when enabled */}
      {enabled && (
        <div className="mb-6 space-y-4">
          {/* Loading state */}
          {loading && (
            <div className="text-sm text-zinc-400">Loading HubSpot owners...</div>
          )}

          {/* Error state */}
          {error && (
            <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <div>
                <div className="font-medium">Could not load HubSpot owners</div>
                <div className="text-xs text-amber-400/80 mt-1">{error}</div>
              </div>
            </div>
          )}

          {/* Owner rows */}
          {!loading && (
            <>
              <div className="space-y-2">
                {assignments.map((assignment) => (
                  <div key={assignment.id} className="flex items-center gap-2">
                    {/* Owner selector */}
                    {manualMode ? (
                      <input
                        type="text"
                        value={assignment.ownerId}
                        onChange={(e) => updateAssignment(assignment.id, 'ownerId', e.target.value)}
                        placeholder="Owner email address"
                        className="flex-1 px-3 py-2 bg-zinc-800 border border-zinc-700 text-white text-sm"
                      />
                    ) : (
                      <select
                        value={assignment.ownerId}
                        onChange={(e) => updateAssignment(assignment.id, 'ownerId', e.target.value)}
                        className="flex-1 px-3 py-2 bg-zinc-800 border border-zinc-700 text-white text-sm"
                      >
                        <option value="">Select owner...</option>
                        {owners.filter(o => o.id !== '').map((owner) => (
                          <option key={owner.id} value={owner.id}>
                            {owner.name} {owner.email ? `(${owner.email})` : ''}
                          </option>
                        ))}
                      </select>
                    )}

                    {/* Weight input */}
                    <input
                      type="number"
                      min="1"
                      value={assignment.weight}
                      onChange={(e) => updateAssignment(assignment.id, 'weight', e.target.value)}
                      className="w-20 px-3 py-2 bg-zinc-800 border border-zinc-700 text-white text-sm"
                    />

                    {/* Remove button */}
                    <button
                      onClick={() => removeOwner(assignment.id)}
                      className="p-2 text-zinc-400 hover:text-red-400 transition-colors"
                      title="Remove owner"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Add owner button */}
              <button
                onClick={addOwner}
                className="flex items-center gap-2 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-white text-sm border border-zinc-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add owner
              </button>
            </>
          )}

          {/* Assignment preview */}
          {assignments.length > 0 && totalWeight > 0 && (
            <div className="mt-6 p-4 bg-zinc-900 border border-zinc-700">
              <h3 className="text-sm font-medium text-white mb-3">Assignment Preview</h3>
              <div className="space-y-2">
                {preview.map((item) => (
                  <div key={item.id} className="flex items-center justify-between text-sm">
                    <span className="text-zinc-300">{item.ownerLabel}</span>
                    <span className="text-zinc-400">
                      {item.percentage}% (~{item.estimatedContacts} contacts)
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-3 pt-3 border-t border-zinc-700 flex items-center justify-between text-sm">
                <span className="text-white font-medium">Total</span>
                <span className="text-white">{totalContacts} contacts</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Navigation buttons */}
      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white flex items-center gap-2 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
        <button
          onClick={handleContinue}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-2 transition-colors"
        >
          Continue
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
