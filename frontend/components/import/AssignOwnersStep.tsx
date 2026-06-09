'use client';

/**
 * AssignOwnersStep Component - V2 with Rule-Based Assignment
 *
 * Step 6 of import wizard - Assign HubSpot owners using rules + fallback
 */

import { useState, useEffect, useMemo } from 'react';
import { ArrowRight, ArrowLeft, Plus, X, AlertCircle, Save, Download } from 'lucide-react';
import { RuleBuilder } from './RuleBuilder';
import type {
  AssignmentRule,
  FallbackConfig,
  OwnerAssignmentConfig,
  SavedRuleSet,
} from '@/lib/import/rule-types';
import { previewAssignments } from '@/lib/import/rule-engine';

interface HubSpotOwner {
  id: string;
  email: string | null;
  name: string;
}

interface ContactData {
  email?: string;
  first_name?: string;
  last_name?: string;
  job_title?: string;
  company?: string;
  location?: string;
  bucket?: string;
}

interface AssignOwnersStepProps {
  sessionId: string;
  totalContacts: number;
  sampleRows: any[]; // Raw CSV rows
  fieldMapping: any; // Field mapping from Step 3
  matchSummary: any; // Match summary for bucket data
  onBack: () => void;
  onContinue: (config: OwnerAssignmentConfig | null) => void;
}

export function AssignOwnersStep({
  sessionId,
  totalContacts,
  sampleRows,
  fieldMapping,
  matchSummary,
  onBack,
  onContinue,
}: AssignOwnersStepProps) {
  // HubSpot owners
  const [owners, setOwners] = useState<HubSpotOwner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Assignment config
  const [rules, setRules] = useState<AssignmentRule[]>([]);
  const [fallback, setFallback] = useState<FallbackConfig>({
    type: 'unassigned',
  });
  const [overrideExisting, setOverrideExisting] = useState(false);

  // Saved rule sets
  const [savedRuleSets, setSavedRuleSets] = useState<SavedRuleSet[]>([]);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveRuleSetName, setSaveRuleSetName] = useState('');
  const [saveRuleSetDescription, setSaveRuleSetDescription] = useState('');
  const [saving, setSaving] = useState(false);

  // Preview state
  const [previewResults, setPreviewResults] = useState<any>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [hasRunPreview, setHasRunPreview] = useState(false);

  // Fetch HubSpot owners on mount
  useEffect(() => {
    fetchOwners();
    fetchSavedRuleSets();
  }, []);

  // Invalidate preview when rules or fallback change
  useEffect(() => {
    if (hasRunPreview) {
      setHasRunPreview(false);
      setPreviewResults(null);
    }
  }, [rules, fallback]);

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
      setError('Could not load HubSpot owners.');
    } finally {
      setLoading(false);
    }
  };

  const fetchSavedRuleSets = async () => {
    try {
      const response = await fetch('/api/import/rule-sets');
      if (response.ok) {
        const data = await response.json();
        setSavedRuleSets(data.ruleSets || []);
      }
    } catch (err) {
      console.error('[AssignOwnersStep] Failed to fetch rule sets:', err);
    }
  };

  const loadRuleSet = (ruleSet: SavedRuleSet) => {
    setRules(ruleSet.rules);
  };

  const saveRuleSet = async () => {
    if (!saveRuleSetName.trim()) {
      alert('Please enter a name for the rule set');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch('/api/import/rule-sets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: saveRuleSetName.trim(),
          description: saveRuleSetDescription.trim() || undefined,
          rules,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save rule set');
      }

      // Refresh saved rule sets
      await fetchSavedRuleSets();

      // Close modal
      setShowSaveModal(false);
      setSaveRuleSetName('');
      setSaveRuleSetDescription('');

      alert('Rule set saved successfully');
    } catch (err) {
      console.error('[AssignOwnersStep] Failed to save rule set:', err);
      alert('Failed to save rule set');
    } finally {
      setSaving(false);
    }
  };

  // Transform raw CSV rows using field mapping
  const mappedContacts = useMemo(() => {
    if (!fieldMapping || sampleRows.length === 0) {
      console.warn('[AssignOwnersStep] Cannot map contacts:', {
        hasFieldMapping: !!fieldMapping,
        sampleRowsCount: sampleRows.length,
      });
      return [];
    }

    console.log('[AssignOwnersStep] Field mapping:', fieldMapping);
    console.log('[AssignOwnersStep] First sample row keys:', Object.keys(sampleRows[0] || {}));

    const mapped = sampleRows.map((row) => {
      const mapped: any = {};

      // Map fields from CSV columns to expected field names
      if (fieldMapping.email && row[fieldMapping.email]) {
        mapped.email = row[fieldMapping.email];
      }
      if (fieldMapping.job_title && row[fieldMapping.job_title]) {
        mapped.job_title = row[fieldMapping.job_title];
      }
      if (fieldMapping.company && row[fieldMapping.company]) {
        mapped.company = row[fieldMapping.company];
      }
      if (fieldMapping.location && row[fieldMapping.location]) {
        mapped.location = row[fieldMapping.location];
      }

      // Add bucket from match summary if available
      // For preview, we'll assume all contacts could be in any bucket
      // The actual bucket assignment happens during matching
      mapped.bucket = row.bucket || 'New Contact';

      return mapped;
    });

    console.log('[AssignOwnersStep] Mapped contacts sample:', mapped.slice(0, 2));

    return mapped;
  }, [sampleRows, fieldMapping]);

  // Manual preview calculation (triggered by button)
  const runPreview = () => {
    if (mappedContacts.length === 0) {
      console.warn('[AssignOwnersStep] No mapped contacts available for preview');
      return;
    }

    setPreviewLoading(true);

    // Use setTimeout to allow UI to update with loading state
    setTimeout(() => {
      try {
        console.log('[AssignOwnersStep] Running preview with:', {
          sampleRowsCount: sampleRows.length,
          mappedContactsCount: mappedContacts.length,
          fieldMapping,
          firstMappedContact: mappedContacts[0],
          firstRawRow: sampleRows[0],
          rulesCount: rules.length,
          fallback,
        });

        const results = previewAssignments(mappedContacts, rules, fallback);

        console.log('[AssignOwnersStep] Preview results:', results);

        setPreviewResults(results);
        setHasRunPreview(true);
      } catch (err) {
        console.error('[AssignOwnersStep] Preview calculation failed:', err);
        alert('Failed to calculate preview');
      } finally {
        setPreviewLoading(false);
      }
    }, 100);
  };

  // Owner name lookup for preview
  const getOwnerName = (ownerId: string) => {
    const owner = owners.find((o) => o.id === ownerId);
    return owner ? owner.name : 'Unknown owner';
  };

  const handleContinue = () => {
    // If no rules and fallback is unassigned, skip owner assignment
    if (rules.length === 0 && fallback.type === 'unassigned') {
      onContinue(null);
      return;
    }

    // Validate fallback
    if (fallback.type === 'round_robin' && (!fallback.owners || fallback.owners.length === 0)) {
      alert('Please add at least one owner for round-robin fallback');
      return;
    }

    if (fallback.type === 'specific_owner' && !fallback.owner_id) {
      alert('Please select an owner for specific owner fallback');
      return;
    }

    // Build config
    const config: OwnerAssignmentConfig = {
      rules,
      fallback,
      override_existing: overrideExisting,
    };

    onContinue(config);
  };

  return (
    <div>
      <h2 className="text-lg font-medium text-white mb-4">
        Step 6: Owner Assignment (Optional)
      </h2>

      {/* Loading state */}
      {loading && <div className="text-sm text-zinc-400 mb-4">Loading HubSpot owners...</div>}

      {/* Error state */}
      {error && (
        <div className="flex items-start gap-2 p-3 mb-4 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <div>
            <div className="font-medium">Could not load HubSpot owners</div>
            <div className="text-xs text-amber-400/80 mt-1">{error}</div>
          </div>
        </div>
      )}

      {!loading && (
        <>
          {/* Load/Save rule sets */}
          {rules.length > 0 && (
            <div className="flex items-center gap-2 mb-6">
              <select
                className="px-3 py-2 bg-zinc-800 border border-zinc-700 text-white text-sm"
                onChange={(e) => {
                  const ruleSet = savedRuleSets.find((r) => r.id === e.target.value);
                  if (ruleSet) loadRuleSet(ruleSet);
                }}
                value=""
              >
                <option value="">Load saved ruleset</option>
                {savedRuleSets.map((rs) => (
                  <option key={rs.id} value={rs.id}>
                    {rs.name} ({rs.rules.length} rules)
                  </option>
                ))}
              </select>

              <button
                onClick={() => setShowSaveModal(true)}
                className="flex items-center gap-2 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-white text-sm border border-zinc-700 transition-colors"
              >
                <Save className="w-4 h-4" />
                Save current as ruleset
              </button>
            </div>
          )}

          {/* Rules section */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-white mb-2">Rules</h3>
            <RuleBuilder rules={rules} owners={owners} onChange={setRules} />
          </div>

          {/* Fallback section */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-white mb-2">Fallback</h3>
            <div className="text-sm text-zinc-400 mb-3">Contacts not matched by any rule:</div>

            <div className="space-y-3">
              {/* Round robin option */}
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="radio"
                  checked={fallback.type === 'round_robin'}
                  onChange={() =>
                    setFallback({
                      type: 'round_robin',
                      owners: [],
                    })
                  }
                  className="mt-0.5"
                />
                <div className="flex-1">
                  <div className="text-sm text-white">Split evenly between owners (round-robin)</div>

                  {fallback.type === 'round_robin' && (
                    <div className="mt-2 space-y-2">
                      {(fallback.owners || []).map((owner, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <select
                            value={owner.id}
                            onChange={(e) => {
                              const newOwners = [...(fallback.owners || [])];
                              const selectedOwner = owners.find((o) => o.id === e.target.value);
                              newOwners[idx] = {
                                id: e.target.value,
                                name: selectedOwner?.name || '',
                                weight: owner.weight,
                              };
                              setFallback({ ...fallback, owners: newOwners });
                            }}
                            className="flex-1 px-3 py-2 bg-zinc-800 border border-zinc-700 text-white text-sm"
                          >
                            <option value="">Select owner...</option>
                            {owners.filter((o) => o.id !== '').map((o) => (
                              <option key={o.id} value={o.id}>
                                {o.name} {o.email ? `(${o.email})` : ''}
                              </option>
                            ))}
                          </select>
                          <input
                            type="number"
                            min="1"
                            value={owner.weight}
                            onChange={(e) => {
                              const newOwners = [...(fallback.owners || [])];
                              newOwners[idx].weight = parseInt(e.target.value) || 1;
                              setFallback({ ...fallback, owners: newOwners });
                            }}
                            className="w-20 px-3 py-2 bg-zinc-800 border border-zinc-700 text-white text-sm"
                          />
                          <button
                            onClick={() => {
                              const newOwners = (fallback.owners || []).filter((_, i) => i !== idx);
                              setFallback({ ...fallback, owners: newOwners });
                            }}
                            className="p-2 text-zinc-400 hover:text-red-400 transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}

                      <button
                        onClick={() => {
                          setFallback({
                            ...fallback,
                            owners: [
                              ...(fallback.owners || []),
                              { id: '', name: '', weight: 1 },
                            ],
                          });
                        }}
                        className="flex items-center gap-2 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-white text-sm border border-zinc-700 transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                        Add owner for round-robin
                      </button>
                    </div>
                  )}
                </div>
              </label>

              {/* Specific owner option */}
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="radio"
                  checked={fallback.type === 'specific_owner'}
                  onChange={() => setFallback({ type: 'specific_owner', owner_id: '' })}
                  className="mt-0.5"
                />
                <div className="flex-1">
                  <div className="text-sm text-white">Assign all to one owner</div>

                  {fallback.type === 'specific_owner' && (
                    <div className="mt-2">
                      <select
                        value={fallback.owner_id || ''}
                        onChange={(e) => setFallback({ ...fallback, owner_id: e.target.value })}
                        className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 text-white text-sm"
                      >
                        <option value="">Select owner...</option>
                        {owners.filter((o) => o.id !== '').map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.name} {o.email ? `(${o.email})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </label>

              {/* Unassigned option */}
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  checked={fallback.type === 'unassigned'}
                  onChange={() => setFallback({ type: 'unassigned' })}
                  className="mt-0.5"
                />
                <div className="text-sm text-white">Leave unassigned</div>
              </label>
            </div>
          </div>

          {/* Options */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-white mb-2">Options</h3>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={overrideExisting}
                onChange={(e) => setOverrideExisting(e.target.checked)}
                className="mt-0.5"
              />
              <div>
                <div className="text-sm text-white">Override existing HubSpot owner assignments</div>
                <div className="text-xs text-zinc-500 mt-1">
                  If a contact already has an owner in HubSpot, replace with this assignment
                </div>
              </div>
            </label>
          </div>

          {/* Preview button */}
          <div className="mb-6">
            <button
              onClick={runPreview}
              disabled={previewLoading || sampleRows.length === 0}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-zinc-700 disabled:cursor-not-allowed text-white text-sm transition-colors"
            >
              {previewLoading ? 'Calculating...' : 'Preview assignments'}
            </button>
            {!hasRunPreview && sampleRows.length > 0 && (
              <p className="mt-2 text-sm text-zinc-400">
                Click to preview how contacts will be assigned based on your rules
              </p>
            )}
          </div>

          {/* Assignment preview */}
          {hasRunPreview && previewResults && (
            <div className="mb-6 p-4 bg-zinc-900 border border-zinc-700">
              <h3 className="text-sm font-medium text-white mb-3">Assignment Preview</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-700">
                      <th className="text-left py-2 text-zinc-400 font-medium">Owner</th>
                      <th className="text-right py-2 text-zinc-400 font-medium">Rules matched</th>
                      <th className="text-right py-2 text-zinc-400 font-medium">Fallback</th>
                      <th className="text-right py-2 text-zinc-400 font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(previewResults.byOwner).map(([ownerId, counts]: [string, any]) => (
                      <tr key={ownerId} className="border-b border-zinc-800">
                        <td className="py-2 text-white">{getOwnerName(ownerId)}</td>
                        <td className="py-2 text-right text-zinc-300">
                          {counts.rules} contacts
                        </td>
                        <td className="py-2 text-right text-zinc-300">
                          {counts.fallback} contacts
                        </td>
                        <td className="py-2 text-right text-white font-medium">
                          {counts.total}
                        </td>
                      </tr>
                    ))}
                    {previewResults.unassigned > 0 && (
                      <tr className="border-b border-zinc-800">
                        <td className="py-2 text-zinc-400 italic">Unassigned</td>
                        <td className="py-2 text-right text-zinc-300">0 contacts</td>
                        <td className="py-2 text-right text-zinc-300">
                          {previewResults.unassigned} contacts
                        </td>
                        <td className="py-2 text-right text-white font-medium">
                          {previewResults.unassigned}
                        </td>
                      </tr>
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-zinc-700">
                      <td className="py-2 text-white font-medium">Total</td>
                      <td className="py-2 text-right text-zinc-300">
                        {Object.values(previewResults.byOwner).reduce((sum: number, c: any) => sum + c.rules, 0)}
                      </td>
                      <td className="py-2 text-right text-zinc-300">
                        {Object.values(previewResults.byOwner).reduce((sum: number, c: any) => sum + c.fallback, 0)}
                      </td>
                      <td className="py-2 text-right text-white font-medium">
                        {sampleRows.length}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </>
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
          disabled={loading}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-2 transition-colors disabled:opacity-50"
        >
          Continue
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* Save rule set modal */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-zinc-900 border border-zinc-700 p-6 w-full max-w-md">
            <h3 className="text-lg font-medium text-white mb-4">Save rule set</h3>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm text-zinc-400 mb-1">Name *</label>
                <input
                  type="text"
                  value={saveRuleSetName}
                  onChange={(e) => setSaveRuleSetName(e.target.value)}
                  placeholder="e.g., Enterprise leads to Tyler"
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 text-white text-sm"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm text-zinc-400 mb-1">Description (optional)</label>
                <input
                  type="text"
                  value={saveRuleSetDescription}
                  onChange={(e) => setSaveRuleSetDescription(e.target.value)}
                  placeholder="Brief description of this rule set"
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 text-white text-sm"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowSaveModal(false);
                  setSaveRuleSetName('');
                  setSaveRuleSetDescription('');
                }}
                disabled={saving}
                className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveRuleSet}
                disabled={saving || !saveRuleSetName.trim()}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
