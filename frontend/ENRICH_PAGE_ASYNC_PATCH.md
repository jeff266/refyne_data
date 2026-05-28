# Enrich Page Async Patch

This documents the changes needed to convert the Enrich page to async preview/apply.

## 1. Add imports at top of file (after line 10)

```typescript
import { useJobPoller, useJobResults } from '@/hooks/useJobPoller';
import type { JobStatus } from '@/hooks/useJobPoller';
```

## 2. Add new state variables (after line 213, before portalId)

```typescript
  // Async preview/apply state
  const [previewJobId, setPreviewJobId] = useState<string | null>(null);
  const [previewRunId, setPreviewRunId] = useState<string | null>(null);
  const [applyJobId, setApplyJobId] = useState<string | null>(null);
  const [applyRunId, setApplyRunId] = useState<string | null>(null);

  // Use job poller hooks
  const previewJobStatus = useJobPoller(previewJobId);
  const applyJobStatus = useJobPoller(applyJobId);
  const { results: previewResultsFromJob } = useJobResults(previewJobId, previewJobStatus);
```

## 3. Replace runPreview() function (starting at line 723)

```typescript
  // Run preview on sample records (ASYNC VERSION)
  async function runPreview() {
    setPreviewLoading(true);
    setShowingPreview(false);
    setPreviewResults(null);
    setPreviewJobId(null);
    setPreviewRunId(null);

    try {
      // Build source config
      let source: any = { type: companyScope };

      if (companyScope === 'list') {
        source.list_id = selectedList;
      } else if (companyScope === 'segment') {
        const filters: any = { missing_fields: selectedFields };
        if (lifecycleStage) filters.lifecyclestage = lifecycleStage;
        if (ownerId) filters.hubspot_owner_id = ownerId;
        if (selectedIndustries.length > 0) filters.industry = selectedIndustries;
        source.filters = filters;
      } else if (companyScope === 'gaps') {
        source.fields = selectedGapFields;
      } else if (companyScope === 'csv') {
        source.domains = csvText.split('\n').filter(d => d.trim());
      } else {
        source.type = 'all';
        source.filters = { missing_fields: selectedFields };
      }

      // Enqueue preview job
      const response = await fetch('/api/enrich/preview/enqueue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source,
          fieldKeys: selectedFields,
          providerId: selectedProviders[0] || 'refyne_search',
          recordLimit: testRecordLimit,
          harmonyIds: [], // TODO: Get from harmony selector if needed
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to enqueue preview');
      }

      const data = await response.json();

      // Set job IDs to start polling
      setPreviewJobId(data.jobId);
      setPreviewRunId(data.runId);

      console.log(`[Preview] Job enqueued: ${data.jobId}, estimated ${data.estimatedSeconds}s`);

      // Note: Preview loading stays true until job completes
      // The useJobPoller hook will track progress automatically

    } catch (error) {
      console.error('Preview enqueue error:', error);
      alert(`Failed to start preview: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setPreviewLoading(false);
    }
  }
```

## 4. Add useEffect to handle preview job completion (after runPreview function)

```typescript
  // Handle preview job completion
  useEffect(() => {
    if (previewJobStatus?.status === 'completed' && previewResultsFromJob) {
      console.log('[Preview] Job completed, transforming results');

      // Transform results from job format to preview format
      const transformedResults: PreviewFieldResult[] = [];

      for (const companyResult of previewResultsFromJob) {
        for (const field of companyResult.fields) {
          transformedResults.push({
            company_id: companyResult.hubspotCompanyId,
            company_name: companyResult.companyName,
            field_key: field.fieldKey,
            field_label: ENRICHABLE_FIELDS.find(f => f.key === field.fieldKey)?.label || field.fieldKey,
            current_value: field.currentValue,
            found_value: field.foundValue,
            found_raw: field.foundValue,
            mapped_value: field.foundValue, // Already processed by worker
            mapping_confidence: field.level === 'high' ? 'high' : field.level === 'medium' ? 'medium' : 'low',
            source: field.provider,
            status: field.action as any,
            harmony_applied: false,
            harmony_name: null,
            selected: field.action === 'would_fill', // Auto-select would_fill
            confidence: field.confidence,
            confidence_level: field.level,
            evidence: field.evidence,
            from_cache: false,
          });
        }
      }

      // Calculate summary
      const summary = {
        would_fill: transformedResults.filter(r => r.status === 'would_fill').length,
        would_override: transformedResults.filter(r => r.status === 'would_override').length,
        already_set: transformedResults.filter(r => r.status === 'already_set').length,
        no_data: transformedResults.filter(r => r.status === 'no_data').length,
        skipped: transformedResults.filter(r => r.status === 'skipped').length,
        harmonies_applied: 0,
      };

      setPreviewResults({
        preview_id: previewJobId!,
        status: 'completed',
        records_processed: previewResultsFromJob.length,
        duration_seconds: 0,
        results: transformedResults,
        summary,
      });

      // Auto-select would_fill rows
      const autoSelectedRows = new Set<string>();
      transformedResults.forEach(r => {
        if (r.status === 'would_fill') {
          autoSelectedRows.add(`${r.company_id}-${r.field_key}`);
        }
      });
      setSelectedRows(autoSelectedRows);

      setShowingPreview(true);
      setPreviewLoading(false);

    } else if (previewJobStatus?.status === 'failed') {
      console.error('[Preview] Job failed:', previewJobStatus.error);
      alert(`Preview failed: ${previewJobStatus.error}`);
      setPreviewLoading(false);
    }
  }, [previewJobStatus, previewResultsFromJob, previewJobId]);
```

## 5. Replace applyPreviewResults() function (starting at line 806)

```typescript
  // Apply preview results to HubSpot (ASYNC VERSION)
  async function applyPreviewResults() {
    if (!previewResults || !previewJobId) return;

    // Get selected record IDs
    const selectedRecordIds = Array.from(
      new Set(
        previewResults.results
          .filter(r => selectedRows.has(`${r.company_id}-${r.field_key}`))
          .map(r => r.company_id)
      )
    );

    if (selectedRecordIds.length === 0) {
      addToast('error', 'No rows selected');
      return;
    }

    setRunning(true);
    setApplyJobId(null);
    setApplyRunId(null);

    try {
      const response = await fetch('/api/enrich/apply/enqueue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId: previewJobId,
          runId: previewRunId,
          selectedRecordIds,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to enqueue apply');
      }

      const data = await response.json();

      setApplyJobId(data.jobId);
      setApplyRunId(data.runId);

      console.log(`[Apply] Job enqueued: ${data.jobId}`);

      // Running stays true until job completes (tracked by useEffect below)

    } catch (error) {
      console.error('Apply enqueue error:', error);
      addToast('error', `Failed to start apply: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setRunning(false);
    }
  }
```

## 6. Add useEffect to handle apply job completion (after applyPreviewResults function)

```typescript
  // Handle apply job completion
  useEffect(() => {
    if (applyJobStatus?.status === 'completed') {
      console.log('[Apply] Job completed');

      // Set apply result from job progress
      setApplyResult({
        written: applyJobStatus.progress.completed || 0,
        failed: 0,
        skipped_invalid_value: 0,
        field_breakdown: { total: applyJobStatus.progress.completed || 0 },
      });

      setPreviewState('completed');
      setShowingPreview(false);
      setRunning(false);

      // Refresh gap analysis
      fetchGapsNonStreaming();

    } else if (applyJobStatus?.status === 'failed') {
      console.error('[Apply] Job failed:', applyJobStatus.error);
      addToast('error', `Apply failed: ${applyJobStatus.error}`);
      setRunning(false);
    }
  }, [applyJobStatus]);
```

## 7. Add progress UI in the preview loading section

Find the section that shows "Generating preview..." and replace with progress UI.

Look for where `previewLoading` is checked and add:

```typescript
{previewLoading && previewJobStatus && (
  <div style={{ padding: 32, textAlign: 'center' }}>
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 16, fontWeight: 600, color: C.text, marginBottom: 8 }}>
        {previewJobStatus.status === 'queued' && 'Starting preview...'}
        {previewJobStatus.status === 'processing' && `Enriching ${previewJobStatus.progress.completed} of ${previewJobStatus.progress.total} companies`}
      </div>

      {previewJobStatus.status === 'processing' && (
        <>
          <div style={{
            width: '100%',
            maxWidth: 400,
            height: 8,
            background: C.border,
            borderRadius: 4,
            margin: '0 auto 8px',
            overflow: 'hidden',
          }}>
            <div style={{
              width: `${previewJobStatus.progress.percentage}%`,
              height: '100%',
              background: C.indigo,
              transition: 'width 0.3s ease',
            }} />
          </div>

          <div style={{ fontSize: 13, color: C.text3 }}>
            {previewJobStatus.progress.percentage}% complete
          </div>

          {previewJobStatus.progress.currentCompany && (
            <div style={{ fontSize: 12, color: C.text2, marginTop: 8 }}>
              Currently processing: {previewJobStatus.progress.currentCompany}
            </div>
          )}
        </>
      )}
    </div>
  </div>
)}
```

## 8. Add similar progress UI for apply

Where `running` is checked during apply, add:

```typescript
{running && applyJobStatus && (
  <div style={{ padding: 32, textAlign: 'center' }}>
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 16, fontWeight: 600, color: C.text, marginBottom: 8 }}>
        {applyJobStatus.status === 'queued' && 'Starting apply...'}
        {applyJobStatus.status === 'processing' && `Writing ${applyJobStatus.progress.completed} of ${applyJobStatus.progress.total} companies`}
      </div>

      {applyJobStatus.status === 'processing' && (
        <>
          <div style={{
            width: '100%',
            maxWidth: 400,
            height: 8,
            background: C.border,
            borderRadius: 4,
            margin: '0 auto 8px',
            overflow: 'hidden',
          }}>
            <div style={{
              width: `${applyJobStatus.progress.percentage}%`,
              height: '100%',
              background: C.green,
              transition: 'width 0.3s ease',
            }} />
          </div>

          <div style={{ fontSize: 13, color: C.text3 }}>
            {applyJobStatus.progress.percentage}% complete
          </div>

          {applyJobStatus.progress.currentCompany && (
            <div style={{ fontSize: 12, color: C.text2, marginTop: 8 }}>
              Currently writing: {applyJobStatus.progress.currentCompany}
            </div>
          )}
        </>
      )}
    </div>
  </div>
)}
```

---

## Summary of Changes

**New State:**
- `previewJobId`, `previewRunId` - Track preview job
- `applyJobId`, `applyRunId` - Track apply job
- `previewJobStatus`, `applyJobStatus` - Auto-polling job status via hooks
- `previewResultsFromJob` - Results fetched when preview completes

**Modified Functions:**
- `runPreview()` - Now enqueues job instead of synchronous fetch
- `applyPreviewResults()` - Now enqueues apply job

**New Effects:**
- Preview completion handler - Transforms job results to UI format
- Apply completion handler - Updates UI when apply finishes

**UI Changes:**
- Progress bars during preview showing company count and percentage
- Current company name display
- Progress bars during apply

**Benefits:**
- No timeouts (jobs run in background worker)
- Real-time progress updates every 1.5s
- Accurate history tracking (run record created immediately)
- Resumable (worker can restart from checkpoint if crashes)
- Multi-user concurrent previews without blocking
