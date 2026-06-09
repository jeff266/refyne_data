'use client';

/**
 * MapFieldsStep Component
 *
 * Step 3 of import wizard - Map CSV columns to HubSpot fields
 *
 * Features:
 * - Show ALL CSV columns (not just detected ones)
 * - Display: CSV column → sample value → HubSpot field dropdown
 * - Email field is required and cannot be set to "Don't import"
 * - Pre-select based on auto-detection
 */

import { useState, useEffect, useMemo } from 'react';
import { ArrowRight, ArrowLeft, AlertCircle, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';

interface Column {
  name: string;
  type: string;
}

interface MapFieldsStepProps {
  columns: Column[];
  previewRows: any[];
  initialMapping: Record<string, string>;
  loading?: boolean;
  onBack: () => void;
  onContinue: (mapping: Record<string, string>) => void;
}

// Available HubSpot fields
const HUBSPOT_FIELDS = [
  { value: 'first_name', label: 'First name' },
  { value: 'last_name', label: 'Last name' },
  { value: 'full_name', label: 'Full name (split on import)' },
  { value: 'email', label: 'Email' },
  { value: 'job_title', label: 'Job title' },
  { value: 'company', label: 'Company name' },
  { value: 'linkedin_url', label: 'LinkedIn URL' },
  { value: 'location', label: 'LinkedIn location' },
  { value: 'phone', label: 'Phone' },
  { value: '', label: "── Don't import ──" },
];

export function MapFieldsStep({
  columns,
  previewRows,
  initialMapping,
  loading = false,
  onBack,
  onContinue,
}: MapFieldsStepProps) {
  // Build reverse mapping: CSV column → HubSpot field
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [emailColumn, setEmailColumn] = useState<string | null>(null);

  useEffect(() => {
    // Reverse the initialMapping to get CSV column → HubSpot field
    const reversed: Record<string, string> = {};
    for (const [hubspotField, csvColumn] of Object.entries(initialMapping)) {
      reversed[csvColumn] = hubspotField;
    }

    // Fill in all columns that aren't mapped
    for (const col of columns) {
      if (!reversed[col.name]) {
        reversed[col.name] = ''; // Don't import by default
      }
    }

    setMapping(reversed);

    // Find email column
    const emailCol = Object.entries(reversed).find(([_, hsField]) => hsField === 'email')?.[0];
    setEmailColumn(emailCol || null);
  }, [columns, initialMapping]);

  // Get sample value for a column
  const getSampleValue = (columnName: string): string => {
    for (const row of previewRows) {
      const value = row[columnName];
      if (value && typeof value === 'string' && value.trim()) {
        // Truncate at 30 chars
        return value.length > 30 ? value.substring(0, 30) + '...' : value;
      }
    }
    return '';
  };

  // Update mapping
  const updateMapping = (csvColumn: string, hubspotField: string) => {
    setMapping({ ...mapping, [csvColumn]: hubspotField });

    // Track email column
    if (hubspotField === 'email') {
      setEmailColumn(csvColumn);
    } else if (csvColumn === emailColumn) {
      setEmailColumn(null);
    }
  };

  // Validate and continue
  const handleContinue = () => {
    // Check email is mapped
    if (!emailColumn) {
      alert('Email field is required. Please map an email column.');
      return;
    }

    // Convert back to HubSpot field → CSV column format
    const hubspotMapping: Record<string, string> = {};
    for (const [csvColumn, hubspotField] of Object.entries(mapping)) {
      if (hubspotField) {
        hubspotMapping[hubspotField] = csvColumn;
      }
    }

    onContinue(hubspotMapping);
  };

  // Check if email is mapped
  const emailMapped = Object.values(mapping).includes('email');

  // Calculate validation statistics
  const validationStats = useMemo(() => {
    const stats: {
      emptyValueWarnings: Array<{ field: string; csvColumn: string; emptyCount: number }>;
      rowsWithoutEmail: number;
      isActivityExport: boolean;
    } = {
      emptyValueWarnings: [],
      rowsWithoutEmail: 0,
      isActivityExport: false,
    };

    // Check for activity export indicators
    const activityIndicators = ['Call Result', 'Call Duration', 'Subject', 'Activity Type'];
    stats.isActivityExport = columns.some((col) =>
      activityIndicators.some((indicator) =>
        col.name.toLowerCase().includes(indicator.toLowerCase())
      )
    );

    // Count empty values for each mapped field
    for (const [csvColumn, hubspotField] of Object.entries(mapping)) {
      if (!hubspotField) continue; // Skip unmapped columns

      let emptyCount = 0;
      for (const row of previewRows) {
        const value = row[csvColumn];
        if (!value || (typeof value === 'string' && value.trim() === '')) {
          emptyCount++;
        }
      }

      // Warn if > 10% empty
      const emptyPercentage = (emptyCount / previewRows.length) * 100;
      if (emptyPercentage > 10) {
        const fieldLabel = HUBSPOT_FIELDS.find((f) => f.value === hubspotField)?.label || hubspotField;
        stats.emptyValueWarnings.push({
          field: fieldLabel,
          csvColumn,
          emptyCount,
        });
      }
    }

    // Count rows without email
    if (emailColumn) {
      for (const row of previewRows) {
        const emailValue = row[emailColumn];
        if (!emailValue || (typeof emailValue === 'string' && emailValue.trim() === '')) {
          stats.rowsWithoutEmail++;
        }
      }
    }

    return stats;
  }, [mapping, emailColumn, previewRows, columns]);

  return (
    <div>
      <h2 className="text-lg font-medium text-white mb-4">Step 3: Map Fields</h2>
      <p className="text-zinc-400 mb-6">
        Map your CSV columns to HubSpot fields. Email is required.
      </p>

      {/* Warning if activity export detected */}
      {validationStats.isActivityExport && (
        <div className="mb-6 p-4 bg-amber-900/20 border border-amber-700/50 flex gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <div className="text-amber-500 font-medium mb-1">
              This looks like an activity export, not a contact list
            </div>
            <div className="text-sm text-amber-400/80">
              Import works best with contact CSV files containing email addresses.
              Activity exports may not contain the necessary contact information.
            </div>
          </div>
        </div>
      )}

      {/* Warning if email not mapped */}
      {!emailMapped && (
        <div className="mb-6 p-4 bg-amber-900/20 border border-amber-700/50 flex gap-3">
          <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <div className="text-amber-500 font-medium mb-1">Email field required</div>
            <div className="text-sm text-amber-400/80">
              Please map at least one column to the Email field to continue.
            </div>
          </div>
        </div>
      )}

      {/* Field mappings table */}
      <div className="mb-6 border border-zinc-700 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-zinc-900">
            <tr className="border-b border-zinc-700">
              <th className="text-left py-3 px-4 text-zinc-400 font-medium w-1/4">
                CSV Column
              </th>
              <th className="text-left py-3 px-4 text-zinc-400 font-medium w-1/3">
                Sample Value
              </th>
              <th className="text-center py-3 px-2 text-zinc-400 font-medium w-12"></th>
              <th className="text-left py-3 px-4 text-zinc-400 font-medium w-1/3">
                HubSpot Field
              </th>
            </tr>
          </thead>
          <tbody>
            {columns.map((col) => {
              const hubspotField = mapping[col.name] || '';
              const isEmail = hubspotField === 'email';
              const sampleValue = getSampleValue(col.name);

              return (
                <tr key={col.name} className="border-b border-zinc-800 hover:bg-zinc-900/50">
                  <td className="py-3 px-4 text-white">{col.name}</td>
                  <td className="py-3 px-4 text-zinc-400 font-mono text-xs">{sampleValue}</td>
                  <td className="py-3 px-2 text-center text-zinc-500">→</td>
                  <td className="py-3 px-4">
                    <select
                      value={hubspotField}
                      onChange={(e) => updateMapping(col.name, e.target.value)}
                      disabled={isEmail}
                      className={`w-full px-3 py-2 bg-zinc-800 border border-zinc-700 text-white text-sm ${
                        isEmail
                          ? 'opacity-60 cursor-not-allowed'
                          : 'hover:border-zinc-600 focus:border-indigo-500 focus:outline-none'
                      }`}
                    >
                      {HUBSPOT_FIELDS.map((field) => {
                        // Don't show "Don't import" for email column
                        if (isEmail && field.value === '') return null;

                        return (
                          <option key={field.value} value={field.value}>
                            {field.label}
                            {isEmail && field.value === 'email' ? ' (required)' : ''}
                          </option>
                        );
                      })}
                    </select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Validation Summary */}
      <div className="mb-6 p-4 bg-zinc-900 border border-zinc-700">
        <h3 className="text-sm font-medium text-white mb-3">Validation Summary</h3>

        {/* Email mapping check */}
        <div className="mb-3">
          {emailMapped && emailColumn ? (
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
              <span className="text-green-400">
                Email mapped to "{emailColumn}"
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm">
              <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
              <span className="text-red-400">
                Email is required. Map a column to Email to continue.
              </span>
            </div>
          )}
        </div>

        {/* Empty value warnings */}
        {validationStats.emptyValueWarnings.length > 0 && (
          <div className="mb-3 space-y-2">
            {validationStats.emptyValueWarnings.map((warning) => (
              <div key={warning.csvColumn} className="flex items-start gap-2 text-sm">
                <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                <span className="text-amber-400">
                  {warning.field}: {warning.emptyCount} rows have no value (will be imported
                  without {warning.field.toLowerCase()})
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Row skip preview */}
        {validationStats.rowsWithoutEmail > 0 && (
          <div className="flex items-start gap-2 text-sm">
            <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
            <span className="text-amber-400">
              {validationStats.rowsWithoutEmail} rows will be skipped (no email address)
            </span>
          </div>
        )}

        {/* All good message */}
        {emailMapped &&
          validationStats.emptyValueWarnings.length === 0 &&
          validationStats.rowsWithoutEmail === 0 && (
            <div className="text-sm text-zinc-400">All validations passed.</div>
          )}
      </div>

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
          disabled={!emailMapped || loading}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Matching contacts...' : 'Continue'}
          {!loading && <ArrowRight className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}
