/**
 * harmonies_preview MCP Tool
 *
 * Runs Harmony transformations in dry-run mode to generate a preview
 * of what changes would be applied to records.
 *
 * Used by the explicit normalization UI to show users what will change
 * before they commit.
 */

import type {
  HarmoniesPreviewInput,
  HarmoniesPreviewOutput,
  RawRecord,
  RecordPreviewResult,
  FieldPreviewResult,
  PreviewSummary,
  McpResponse,
  McpToolDefinition,
} from '../types';
import { getHarmonyById } from '../../harmonies/library';
import { Normalizer } from '../../harmonies/pipeline/normalizer';
import type { RawCandidate } from '../../harmonies/pipeline/types';
import type { ValidatedHarmony } from '../../harmonies/spec/schema';

/**
 * Get the record label for display.
 */
function getRecordLabel(record: RawRecord): string {
  // Try common label fields in priority order
  if (record._label) return String(record._label);
  if (record.name) return String(record.name);
  if (record.company_name) return String(record.company_name);
  if (record.full_name) return String(record.full_name);
  if (record.domain) return String(record.domain);
  return record._id;
}

/**
 * Extract the field value from a record using dot notation.
 */
function extractFieldValue(record: RawRecord, field: string): unknown {
  // Handle dot notation (e.g., 'company.name' -> check 'name' field)
  const fieldParts = field.split('.');
  const simpleField = fieldParts[fieldParts.length - 1];

  // Try the simple field name first
  if (simpleField in record) {
    return record[simpleField];
  }

  // Try variations
  const variations = [
    simpleField,
    simpleField.replace(/_/g, ''),
    `${fieldParts[0]}_${simpleField}`,
  ];

  for (const variant of variations) {
    if (variant in record) {
      return record[variant];
    }
  }

  return undefined;
}

/**
 * Preview a single field transformation.
 */
async function previewField(
  record: RawRecord,
  harmony: ValidatedHarmony,
  field: string
): Promise<FieldPreviewResult> {
  const currentValue = extractFieldValue(record, field);

  // If no value, nothing to transform
  if (currentValue === undefined || currentValue === null || currentValue === '') {
    return {
      field,
      current: currentValue,
      projected: currentValue,
      status: 'unchanged',
      harmonyId: harmony.spec.id,
    };
  }

  try {
    const normalizer = new Normalizer([harmony]);
    const candidate: RawCandidate = {
      value: currentValue,
      source: 'preview',
      retrieved_at: new Date().toISOString(),
      record: record as Record<string, unknown>,
    };

    const result = await normalizer.normalize(candidate);

    if (!result.success) {
      const errorMsg = typeof result.error === 'string'
        ? result.error
        : result.error?.message || 'Normalization failed';
      return {
        field,
        current: currentValue,
        projected: currentValue,
        status: 'error',
        error: errorMsg,
        harmonyId: harmony.spec.id,
      };
    }

    const projectedValue = result.candidate?.value;

    // Determine if value changed
    const changed = JSON.stringify(currentValue) !== JSON.stringify(projectedValue);

    return {
      field,
      current: currentValue,
      projected: projectedValue,
      status: changed ? 'changed' : 'unchanged',
      harmonyId: harmony.spec.id,
    };
  } catch (err) {
    return {
      field,
      current: currentValue,
      projected: null,
      status: 'error',
      error: err instanceof Error ? err.message : 'Unknown error',
      harmonyId: harmony.spec.id,
    };
  }
}

/**
 * Preview transformations for a single record.
 */
async function previewRecord(
  record: RawRecord,
  harmonies: ValidatedHarmony[]
): Promise<RecordPreviewResult> {
  const fieldResults: FieldPreviewResult[] = [];

  for (const harmony of harmonies) {
    // Get fields this Harmony applies to
    const targetFields = harmony.spec.applies_to.fields;

    for (const field of targetFields) {
      const fieldResult = await previewField(record, harmony, field);
      fieldResults.push(fieldResult);
    }
  }

  // Determine overall record status
  const hasError = fieldResults.some(f => f.status === 'error');
  const hasChange = fieldResults.some(f => f.status === 'changed');

  let status: 'changed' | 'unchanged' | 'error';
  if (hasError) {
    status = 'error';
  } else if (hasChange) {
    status = 'changed';
  } else {
    status = 'unchanged';
  }

  return {
    record_id: record._id,
    record_label: getRecordLabel(record),
    fields: fieldResults,
    status,
  };
}

/**
 * Execute the harmonies_preview tool.
 */
export async function executeHarmoniesPreview(
  input: HarmoniesPreviewInput
): Promise<McpResponse<HarmoniesPreviewOutput>> {
  const startTime = performance.now();

  // Validate input
  if (!input.harmony_ids || input.harmony_ids.length === 0) {
    return {
      success: false,
      error: {
        code: 'invalid_input',
        message: 'At least one harmony_id is required',
      },
      timing: { totalMs: performance.now() - startTime },
    };
  }

  if (!input.records || input.records.length === 0) {
    return {
      success: false,
      error: {
        code: 'invalid_input',
        message: 'At least one record is required',
      },
      timing: { totalMs: performance.now() - startTime },
    };
  }

  // Load harmonies
  const harmonies: ValidatedHarmony[] = [];
  const missingIds: string[] = [];

  for (const id of input.harmony_ids) {
    const harmony = getHarmonyById(id);
    if (harmony) {
      harmonies.push(harmony);
    } else {
      missingIds.push(id);
    }
  }

  if (missingIds.length > 0) {
    return {
      success: false,
      error: {
        code: 'harmony_not_found',
        message: `Harmonies not found: ${missingIds.join(', ')}`,
        details: { missingIds },
      },
      timing: { totalMs: performance.now() - startTime },
    };
  }

  // Process each record
  const results: RecordPreviewResult[] = [];

  for (const record of input.records) {
    // Ensure record has an _id
    if (!record._id) {
      record._id = `record_${results.length + 1}`;
    }

    const recordResult = await previewRecord(record, harmonies);
    results.push(recordResult);
  }

  // Calculate summary
  const summary: PreviewSummary = {
    changed: results.filter(r => r.status === 'changed').length,
    unchanged: results.filter(r => r.status === 'unchanged').length,
    errors: results.filter(r => r.status === 'error').length,
    total: results.length,
  };

  return {
    success: true,
    data: {
      summary,
      results,
    },
    timing: { totalMs: performance.now() - startTime },
  };
}

/**
 * Tool definition for harmonies_preview.
 */
export const harmoniesPreviewTool: McpToolDefinition<
  HarmoniesPreviewInput,
  HarmoniesPreviewOutput
> = {
  name: 'harmonies_preview',
  description:
    'Preview Harmony transformations on records without applying them. ' +
    'Returns a diff showing what would change for each record and field.',
  inputSchema: {
    type: 'object',
    properties: {
      harmony_ids: {
        type: 'array',
        items: { type: 'string' },
        description: 'Harmony IDs to apply in the preview',
      },
      records: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            _id: { type: 'string', description: 'Unique record identifier' },
            _label: { type: 'string', description: 'Human-readable label' },
          },
          required: ['_id'],
          additionalProperties: true,
        },
        description: 'Records to preview transformations on',
      },
    },
    required: ['harmony_ids', 'records'],
  },
  execute: executeHarmoniesPreview,
};
