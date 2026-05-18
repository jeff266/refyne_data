/**
 * harmonies_apply MCP Tool
 *
 * Applies Harmony transformations to records and returns the
 * transformed results. This is the "commit" action after preview.
 *
 * Unlike preview, this tool actually produces the normalized output
 * that can be written back to the source system.
 */

import type {
  HarmoniesApplyInput,
  HarmoniesApplyOutput,
  RawRecord,
  ApplyError,
  McpResponse,
  McpToolDefinition,
} from '../types';
import { getHarmonyById } from '../../harmonies/library';
import { Normalizer } from '../../harmonies/pipeline/normalizer';
import type { RawCandidate } from '../../harmonies/pipeline/types';
import type { ValidatedHarmony } from '../../harmonies/spec/schema';

/**
 * Extract the field value from a record using dot notation.
 */
function extractFieldValue(record: RawRecord, field: string): unknown {
  const fieldParts = field.split('.');
  const simpleField = fieldParts[fieldParts.length - 1];

  if (simpleField in record) {
    return record[simpleField];
  }

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
 * Set a field value on a record.
 */
function setFieldValue(record: RawRecord, field: string, value: unknown): void {
  const fieldParts = field.split('.');
  const simpleField = fieldParts[fieldParts.length - 1];

  // If the simple field exists, update it
  if (simpleField in record) {
    record[simpleField] = value;
    return;
  }

  // Try variations
  const variations = [
    simpleField,
    simpleField.replace(/_/g, ''),
    `${fieldParts[0]}_${simpleField}`,
  ];

  for (const variant of variations) {
    if (variant in record) {
      record[variant] = value;
      return;
    }
  }

  // Field not found, add it with simple field name
  record[simpleField] = value;
}

/**
 * Apply Harmony transformations to a single record.
 * Returns the transformed record and any errors.
 */
async function applyToRecord(
  record: RawRecord,
  harmonies: ValidatedHarmony[]
): Promise<{ record: RawRecord; errors: ApplyError[] }> {
  const errors: ApplyError[] = [];
  const transformedRecord = { ...record };

  for (const harmony of harmonies) {
    const targetFields = harmony.spec.applies_to.fields;

    for (const field of targetFields) {
      const currentValue = extractFieldValue(record, field);

      // Skip empty values
      if (currentValue === undefined || currentValue === null || currentValue === '') {
        continue;
      }

      try {
        const normalizer = new Normalizer([harmony]);
        const candidate: RawCandidate = {
          value: currentValue,
          source: 'apply',
          retrieved_at: new Date().toISOString(),
          record: record as Record<string, unknown>,
        };

        const result = await normalizer.normalize(candidate);

        if (result.success && result.candidate) {
          setFieldValue(transformedRecord, field, result.candidate.value);
        } else {
          const errorMsg = typeof result.error === 'string'
            ? result.error
            : result.error?.message || 'Normalization failed';
          errors.push({
            record_id: record._id,
            error: errorMsg,
            field,
          });
        }
      } catch (err) {
        errors.push({
          record_id: record._id,
          error: err instanceof Error ? err.message : 'Unknown error',
          field,
        });
      }
    }
  }

  return { record: transformedRecord, errors };
}

/**
 * Execute the harmonies_apply tool.
 */
export async function executeHarmoniesApply(
  input: HarmoniesApplyInput
): Promise<McpResponse<HarmoniesApplyOutput>> {
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
  const transformedRecords: RawRecord[] = [];
  const allErrors: ApplyError[] = [];
  let appliedCount = 0;

  for (const record of input.records) {
    // Ensure record has an _id
    if (!record._id) {
      record._id = `record_${transformedRecords.length + 1}`;
    }

    const { record: transformedRecord, errors } = await applyToRecord(record, harmonies);
    transformedRecords.push(transformedRecord);

    if (errors.length === 0) {
      appliedCount++;
    }
    allErrors.push(...errors);
  }

  return {
    success: true,
    data: {
      applied: appliedCount,
      errors: allErrors,
      records: transformedRecords,
    },
    timing: { totalMs: performance.now() - startTime },
  };
}

/**
 * Tool definition for harmonies_apply.
 */
export const harmoniesApplyTool: McpToolDefinition<
  HarmoniesApplyInput,
  HarmoniesApplyOutput
> = {
  name: 'harmonies_apply',
  description:
    'Apply Harmony transformations to records. This is the commit action ' +
    'that produces normalized output. Use harmonies_preview first to show ' +
    'users what will change.',
  inputSchema: {
    type: 'object',
    properties: {
      harmony_ids: {
        type: 'array',
        items: { type: 'string' },
        description: 'Harmony IDs to apply',
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
        description: 'Records to transform',
      },
    },
    required: ['harmony_ids', 'records'],
  },
  execute: executeHarmoniesApply,
};
