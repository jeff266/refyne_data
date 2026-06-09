'use client';

/**
 * Event List Import Page
 *
 * Multi-step wizard for importing contact lists from CSV.
 * Follows pattern from JobSegmentationWizard.
 *
 * Steps:
 * 1. Upload CSV
 * 2. Filter rows
 * 3. Map fields
 * 4. View match results
 * 5. Configure write settings
 * 6. Assign owners (optional)
 * 7. Confirm and execute
 */

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, ArrowRight, ArrowLeft, CheckCircle } from 'lucide-react';
import { FilterStep } from '@/components/import/FilterStep';
import { MatchResultsStep } from '@/components/import/MatchResultsStep';
import { AssignOwnersStep } from '@/components/import/AssignOwnersStep';

export default function ImportPage() {
  const router = useRouter();
  const [step, setStep] = useState<number>(1);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [filename, setFilename] = useState<string>('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1: Upload
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);

  // Step 2: Filter
  const [columns, setColumns] = useState<any[]>([]);
  const [previewRows, setPreviewRows] = useState<any[]>([]);
  const [rowCount, setRowCount] = useState<number>(0);
  const [filters, setFilters] = useState<Record<string, any>>({});

  // Step 3: Field mapping
  const [fieldMapping, setFieldMapping] = useState<any>({});

  // Step 4: Match results
  const [matchSummary, setMatchSummary] = useState<any>(null);
  const [sampleRows, setSampleRows] = useState<any>(null);

  // Step 5: Write config
  const [writeConfig, setWriteConfig] = useState({
    update_customers: false,
    create_new_contacts: true,
    update_known_contacts: false,
    skip_needs_review: true,
  });

  // Step 6: Owner assignment
  const [ownerAssignmentEnabled, setOwnerAssignmentEnabled] = useState(false);
  const [ownerAssignments, setOwnerAssignments] = useState<Array<{ id: string; ownerId: string; weight: number }>>([]);

  // Step 7: HubSpot list
  const [hubspotListEnabled, setHubspotListEnabled] = useState(false);
  const [hubspotListName, setHubspotListName] = useState('');
  const [hubspotListBuckets, setHubspotListBuckets] = useState<string[]>([
    'customer',
    'new_contact',
  ]);

  // Handle file upload
  const handleFileUpload = async (uploadFile: File) => {
    setError(null);
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', uploadFile);

      const response = await fetch('/api/import/parse', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Upload failed');
      }

      const data = await response.json();

      setSessionId(data.session_id);
      setFilename(uploadFile.name);
      setColumns(data.columns);
      setPreviewRows(data.preview_rows);
      setRowCount(data.row_count || data.preview_rows.length);

      // Auto-map fields based on detected types
      const autoMapping: any = {};
      for (const col of data.columns) {
        if (col.type === 'email') autoMapping.email = col.name;
        if (col.type === 'linkedin') autoMapping.linkedin_url = col.name;
        if (col.type === 'name' && col.name.toLowerCase().includes('first'))
          autoMapping.first_name = col.name;
        if (col.type === 'name' && col.name.toLowerCase().includes('last'))
          autoMapping.last_name = col.name;
        if (col.type === 'name' && col.name.toLowerCase() === 'name')
          autoMapping.full_name = col.name;
        if (col.type === 'title') autoMapping.job_title = col.name;
        if (col.type === 'company') autoMapping.company = col.name;
        if (col.type === 'location') autoMapping.location = col.name;
      }
      setFieldMapping(autoMapping);

      // Auto-name list
      setHubspotListName(`Import - ${uploadFile.name.replace('.csv', '')} - ${new Date().toLocaleDateString()}`);

      // Advance to next step
      setStep(2);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  // Handle drag events
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.name.endsWith('.csv')) {
        setFile(droppedFile);
        handleFileUpload(droppedFile);
      } else {
        setError('Please upload a .csv file');
      }
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      handleFileUpload(selectedFile);
    }
  };

  // Run matching
  const runMatching = async () => {
    setError(null);
    setUploading(true);

    try {
      const response = await fetch('/api/import/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          field_mapping: fieldMapping,
          filters,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Matching failed');
      }

      const data = await response.json();
      setMatchSummary(data.summary);
      setSampleRows(data.sample_rows);
      setStep(4);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  // Execute import
  const executeImport = async () => {
    setError(null);
    setUploading(true);

    try {
      const response = await fetch('/api/import/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          write_config: writeConfig,
          hubspot_list: hubspotListEnabled
            ? {
                enabled: true,
                list_name: hubspotListName,
                buckets: hubspotListBuckets,
              }
            : undefined,
          owner_assignment: ownerAssignmentEnabled
            ? {
                enabled: true,
                assignments: ownerAssignments,
              }
            : undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Import failed');
      }

      const data = await response.json();

      // Redirect to progress page
      router.push(`/import/${sessionId}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-white mb-2">Import Contacts</h1>
        <p className="text-zinc-400">
          Upload a CSV file to import contacts into HubSpot with matching and bucketing.
        </p>
      </div>

      {/* Progress Steps */}
      <div className="mb-8 flex items-center justify-between">
        {[
          'Upload',
          'Filter',
          'Map',
          'Match',
          'Configure',
          'Owners',
          'Confirm',
        ].map((label, idx) => {
          const stepNum = idx + 1;
          const isActive = stepNum === step;
          const isCompleted = stepNum < step;

          return (
            <div key={stepNum} className="flex items-center">
              <div
                className={`flex items-center justify-center w-8 h-8 rounded-full ${
                  isCompleted
                    ? 'bg-green-600'
                    : isActive
                    ? 'bg-indigo-600'
                    : 'bg-zinc-700'
                }`}
              >
                {isCompleted ? (
                  <CheckCircle className="w-5 h-5 text-white" />
                ) : (
                  <span className="text-sm text-white">{stepNum}</span>
                )}
              </div>
              <span
                className={`ml-2 text-sm ${
                  isActive ? 'text-white' : 'text-zinc-400'
                }`}
              >
                {label}
              </span>
              {idx < 6 && (
                <div className="w-12 h-px bg-zinc-700 mx-4"></div>
              )}
            </div>
          );
        })}
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Step 1: Upload */}
      {step === 1 && (
        <div>
          <h2 className="text-lg font-medium text-white mb-4">
            Step 1: Upload CSV
          </h2>

          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${
              dragActive
                ? 'border-indigo-500 bg-indigo-500/10'
                : 'border-zinc-700 hover:border-zinc-600'
            }`}
          >
            <input
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="hidden"
              id="file-upload"
            />
            <label htmlFor="file-upload" className="cursor-pointer">
              <Upload className="w-12 h-12 mx-auto mb-4 text-zinc-400" />
              <p className="text-white mb-2">
                {uploading
                  ? 'Uploading...'
                  : 'Drag and drop your CSV file here'}
              </p>
              <p className="text-sm text-zinc-400">or click to browse</p>
              <p className="text-xs text-zinc-500 mt-4">
                Max 10MB, 10,000 rows
              </p>
            </label>
          </div>
        </div>
      )}

      {/* Step 2: Filter */}
      {step === 2 && (
        <FilterStep
          columns={columns}
          previewRows={previewRows}
          totalRows={rowCount}
          filters={filters}
          onFiltersChange={setFilters}
          onBack={() => setStep(1)}
          onContinue={() => setStep(3)}
        />
      )}

      {/* Step 3: Map Fields */}
      {step === 3 && (
        <div>
          <h2 className="text-lg font-medium text-white mb-4">
            Step 3: Map Fields
          </h2>
          <p className="text-zinc-400 mb-6">
            Verify the field mappings detected automatically.
          </p>

          <div className="space-y-4 mb-6">
            {Object.entries(fieldMapping).map(([key, value]) => (
              <div key={key} className="flex items-center gap-4">
                <span className="text-sm text-zinc-400 w-32">{key}:</span>
                <span className="text-sm text-white">{value as string}</span>
              </div>
            ))}
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setStep(2)}
              className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
            <button
              onClick={runMatching}
              disabled={uploading}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg flex items-center gap-2 disabled:opacity-50"
            >
              {uploading ? 'Matching...' : 'Run Matching'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Match Results */}
      {step === 4 && matchSummary && sampleRows && sessionId && (
        <MatchResultsStep
          sessionId={sessionId}
          matchSummary={matchSummary}
          sampleRows={sampleRows}
          totalRows={rowCount}
          filteredRows={rowCount}
          onBack={() => setStep(3)}
          onContinue={() => setStep(5)}
        />
      )}

      {/* Step 5: Configure */}
      {step === 5 && (
        <div>
          <h2 className="text-lg font-medium text-white mb-4">
            Step 5: Configure Write Settings
          </h2>

          <div className="space-y-4 mb-6">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={writeConfig.create_new_contacts}
                onChange={(e) =>
                  setWriteConfig({
                    ...writeConfig,
                    create_new_contacts: e.target.checked,
                  })
                }
                className="w-4 h-4"
              />
              <span className="text-sm text-white">Create new contacts</span>
            </label>

            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={writeConfig.update_customers}
                onChange={(e) =>
                  setWriteConfig({
                    ...writeConfig,
                    update_customers: e.target.checked,
                  })
                }
                className="w-4 h-4"
              />
              <span className="text-sm text-white">Update customers</span>
            </label>

            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={writeConfig.update_known_contacts}
                onChange={(e) =>
                  setWriteConfig({
                    ...writeConfig,
                    update_known_contacts: e.target.checked,
                  })
                }
                className="w-4 h-4"
              />
              <span className="text-sm text-white">Update known contacts</span>
            </label>

            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={writeConfig.skip_needs_review}
                onChange={(e) =>
                  setWriteConfig({
                    ...writeConfig,
                    skip_needs_review: e.target.checked,
                  })
                }
                className="w-4 h-4"
              />
              <span className="text-sm text-white">
                Skip contacts that need review
              </span>
            </label>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setStep(4)}
              className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
            <button
              onClick={() => setStep(6)}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg flex items-center gap-2"
            >
              Continue
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Step 6: Owner Assignment */}
      {step === 6 && matchSummary && sessionId && (
        <AssignOwnersStep
          sessionId={sessionId}
          totalContacts={
            matchSummary.customer +
            matchSummary.open_deal +
            matchSummary.former_customer +
            matchSummary.known_contact +
            matchSummary.new_contact +
            matchSummary.needs_review
          }
          onBack={() => setStep(5)}
          onContinue={(enabled, assignments) => {
            setOwnerAssignmentEnabled(enabled);
            setOwnerAssignments(assignments);
            setStep(7);
          }}
        />
      )}

      {/* Step 7: Confirm */}
      {step === 7 && (
        <div>
          <h2 className="text-lg font-medium text-white mb-4">
            Step 7: Confirm and Execute
          </h2>

          <div className="mb-6 space-y-4">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={hubspotListEnabled}
                onChange={(e) => setHubspotListEnabled(e.target.checked)}
                className="w-4 h-4"
              />
              <span className="text-sm text-white">
                Create HubSpot static list
              </span>
            </label>

            {hubspotListEnabled && (
              <input
                type="text"
                value={hubspotListName}
                onChange={(e) => setHubspotListName(e.target.value)}
                placeholder="List name"
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white"
              />
            )}
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setStep(6)}
              className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
            <button
              onClick={executeImport}
              disabled={uploading}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center gap-2 disabled:opacity-50"
            >
              {uploading ? 'Starting...' : 'Start Import'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
