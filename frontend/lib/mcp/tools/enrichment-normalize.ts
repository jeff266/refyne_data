/**
 * enrichment_normalize MCP Tool
 *
 * Applies Harmony pipeline to provider data for explicit normalization.
 * This tool is always available regardless of normalization mode.
 *
 * Use cases:
 * - Explicit-mode orgs normalizing data on demand
 * - Re-normalizing previously pulled data
 * - Batch normalizing historical data
 * - Testing pipelines on real data
 */

import type {
  EnrichmentNormalizeInput,
  EnrichmentNormalizeOutput,
  CanonicalCompanyOutput,
  CanonicalPersonOutput,
  McpResponse,
  McpToolDefinition,
  EntityType,
} from '../types';
import type { ProviderResponse } from '../../providers/types';
import {
  getHarmoniesByEntity,
  getHarmoniesForField,
} from '../../harmonies/library';
import { Normalizer } from '../../harmonies/pipeline/normalizer';
import { processField, createPipeline } from '../../harmonies/pipeline';
import type { ValidatedHarmony } from '../../harmonies/spec/schema';
import type {
  RawCandidate,
  PipelineConfig,
} from '../../harmonies/pipeline/types';
import type { ResolutionStrategy } from '../../harmonies/canonical/provenance';

/**
 * Field mapping for company normalization.
 */
const COMPANY_FIELD_MAPPINGS: Array<{
  rawFields: string[];
  canonicalField: keyof CanonicalCompanyOutput;
  harmonyField: string;
}> = [
  { rawFields: ['name'], canonicalField: 'name', harmonyField: 'company.name' },
  { rawFields: ['domain', 'website_url', 'primary_domain'], canonicalField: 'domain', harmonyField: 'company.domain' },
  { rawFields: ['industry', 'industry_tag_id'], canonicalField: 'industry', harmonyField: 'company.industry' },
  { rawFields: ['employee_count', 'employees', 'estimated_num_employees', 'headcount'], canonicalField: 'employee_count', harmonyField: 'company.employees' },
  { rawFields: ['revenue', 'estimated_annual_revenue', 'annual_revenue'], canonicalField: 'revenue', harmonyField: 'company.revenue' },
  { rawFields: ['description', 'short_description', 'company_description'], canonicalField: 'description', harmonyField: 'company.description' },
  { rawFields: ['founded_year', 'year_founded', 'founded'], canonicalField: 'founded_year', harmonyField: 'company.founded_year' },
  { rawFields: ['linkedin_url', 'linkedin_company_url'], canonicalField: 'linkedin_url', harmonyField: 'linkedin-url' },
  { rawFields: ['phone', 'phone_number', 'primary_phone'], canonicalField: 'phone', harmonyField: 'phone' },
];

/**
 * Field mapping for person normalization.
 */
const PERSON_FIELD_MAPPINGS: Array<{
  rawFields: string[];
  canonicalField: keyof CanonicalPersonOutput;
  harmonyField: string;
}> = [
  { rawFields: ['full_name', 'name'], canonicalField: 'full_name', harmonyField: 'person.full_name' },
  { rawFields: ['first_name'], canonicalField: 'first_name', harmonyField: 'person.first_name' },
  { rawFields: ['last_name'], canonicalField: 'last_name', harmonyField: 'person.last_name' },
  { rawFields: ['title', 'job_title', 'position'], canonicalField: 'title', harmonyField: 'person.title_raw' },
  { rawFields: ['email', 'email_address', 'primary_email'], canonicalField: 'email', harmonyField: 'email' },
  { rawFields: ['phone', 'phone_number', 'mobile_phone', 'direct_dial'], canonicalField: 'phone', harmonyField: 'phone' },
  { rawFields: ['linkedin_url', 'linkedin_profile_url'], canonicalField: 'linkedin_url', harmonyField: 'linkedin-url' },
  { rawFields: ['company', 'company_name', 'organization_name'], canonicalField: 'company', harmonyField: 'company.name' },
];

/**
 * Extract a value from raw data using multiple possible field names.
 */
function extractValue(
  raw: Record<string, unknown>,
  fieldNames: string[]
): unknown {
  for (const field of fieldNames) {
    // Handle nested paths (e.g., "headquarters.city")
    if (field.includes('.')) {
      const parts = field.split('.');
      let current: unknown = raw;
      for (const part of parts) {
        if (current && typeof current === 'object' && part in current) {
          current = (current as Record<string, unknown>)[part];
        } else {
          current = undefined;
          break;
        }
      }
      if (current !== undefined) return current;
    } else if (raw[field] !== undefined) {
      return raw[field];
    }
  }
  return undefined;
}

/**
 * Normalize a single provider response to a canonical entity.
 */
async function normalizeResponse(
  response: ProviderResponse,
  entity: EntityType,
  harmonies: ValidatedHarmony[]
): Promise<CanonicalCompanyOutput | CanonicalPersonOutput> {
  const raw = response.raw;
  const normalizer = new Normalizer(harmonies);

  if (entity === 'company') {
    const output: CanonicalCompanyOutput = {
      _type: 'company',
      _normalized_at: new Date().toISOString(),
      _sources: [response._source],
      _raw: raw,
    };

    for (const mapping of COMPANY_FIELD_MAPPINGS) {
      const rawValue = extractValue(raw, mapping.rawFields);
      if (rawValue === undefined || rawValue === null) continue;

      // Find Harmony for this field
      const fieldHarmonies = getHarmoniesForField(mapping.harmonyField);
      if (fieldHarmonies.length === 0) {
        // No harmony - use raw value
        (output as unknown as Record<string, unknown>)[mapping.canonicalField] = rawValue;
        continue;
      }

      // Normalize
      const fieldNormalizer = new Normalizer(fieldHarmonies);
      const candidate: RawCandidate = {
        value: rawValue,
        source: response._source,
        retrieved_at: response._retrieved_at,
        record: raw,
      };

      const result = await fieldNormalizer.normalize(candidate);
      if (result.success && result.candidate) {
        const normalizedValue = result.candidate.value;
        // Handle object outputs (some harmonies return structured data)
        if (typeof normalizedValue === 'object' && normalizedValue !== null) {
          const obj = normalizedValue as Record<string, unknown>;
          // For employee count, extract the number
          if (mapping.canonicalField === 'employee_count') {
            if ('min' in obj) {
              (output as unknown as Record<string, unknown>)[mapping.canonicalField] = obj.min;
            } else if ('employees' in obj) {
              (output as unknown as Record<string, unknown>)[mapping.canonicalField] = obj.employees;
            } else {
              (output as unknown as Record<string, unknown>)[mapping.canonicalField] = normalizedValue;
            }
          } else if (mapping.canonicalField === 'revenue' && 'value' in obj) {
            (output as unknown as Record<string, unknown>)[mapping.canonicalField] = obj.value;
          } else {
            (output as unknown as Record<string, unknown>)[mapping.canonicalField] = normalizedValue;
          }
        } else {
          (output as unknown as Record<string, unknown>)[mapping.canonicalField] = normalizedValue;
        }
      } else {
        (output as unknown as Record<string, unknown>)[mapping.canonicalField] = rawValue;
      }
    }

    // Handle headquarters
    const city = extractValue(raw, ['city', 'headquarters.city', 'hq_city']);
    const state = extractValue(raw, ['state', 'headquarters.state', 'hq_state']);
    const country = extractValue(raw, ['country', 'headquarters.country', 'hq_country']);

    if (city || state || country) {
      output.headquarters = {
        city: city as string | undefined,
        state: state as string | undefined,
        country: country as string | undefined,
      };
    }

    return output;
  } else {
    // Person entity
    const output: CanonicalPersonOutput = {
      _type: 'person',
      _normalized_at: new Date().toISOString(),
      _sources: [response._source],
      _raw: raw,
    };

    for (const mapping of PERSON_FIELD_MAPPINGS) {
      const rawValue = extractValue(raw, mapping.rawFields);
      if (rawValue === undefined || rawValue === null) continue;

      // Find Harmony for this field
      const fieldHarmonies = getHarmoniesForField(mapping.harmonyField);
      if (fieldHarmonies.length === 0) {
        (output as unknown as Record<string, unknown>)[mapping.canonicalField] = rawValue;
        continue;
      }

      // Normalize
      const fieldNormalizer = new Normalizer(fieldHarmonies);
      const candidate: RawCandidate = {
        value: rawValue,
        source: response._source,
        retrieved_at: response._retrieved_at,
        record: raw,
      };

      const result = await fieldNormalizer.normalize(candidate);
      if (result.success && result.candidate) {
        const normalizedValue = result.candidate.value;
        // Handle person-title output which includes seniority
        if (mapping.canonicalField === 'title' && typeof normalizedValue === 'object' && normalizedValue !== null) {
          const titleObj = normalizedValue as Record<string, unknown>;
          (output as unknown as Record<string, unknown>).title = titleObj.title ?? rawValue;
          if (titleObj.seniority) {
            output.seniority = titleObj.seniority as string;
          }
        } else if (typeof normalizedValue === 'object' && normalizedValue !== null && 'value' in normalizedValue) {
          (output as unknown as Record<string, unknown>)[mapping.canonicalField] = (normalizedValue as Record<string, unknown>).value;
        } else {
          (output as unknown as Record<string, unknown>)[mapping.canonicalField] = normalizedValue;
        }
      } else {
        (output as unknown as Record<string, unknown>)[mapping.canonicalField] = rawValue;
      }
    }

    return output;
  }
}

/**
 * Normalize multiple provider responses with resolution.
 */
async function normalizeWithResolution(
  responses: ProviderResponse[],
  entity: EntityType,
  resolutionStrategy: ResolutionStrategy,
  priorityOrder?: string[]
): Promise<CanonicalCompanyOutput | CanonicalPersonOutput> {
  const harmonies = getHarmoniesByEntity(entity);

  if (entity === 'company') {
    const output: CanonicalCompanyOutput = {
      _type: 'company',
      _normalized_at: new Date().toISOString(),
      _sources: responses.map((r) => r._source),
      _raw: undefined,
    };

    // For each field, collect candidates and resolve
    for (const mapping of COMPANY_FIELD_MAPPINGS) {
      const candidates: RawCandidate[] = [];

      for (const response of responses) {
        const rawValue = extractValue(response.raw, mapping.rawFields);
        if (rawValue !== undefined && rawValue !== null) {
          candidates.push({
            value: rawValue,
            source: response._source,
            retrieved_at: response._retrieved_at,
            record: response.raw,
          });
        }
      }

      if (candidates.length === 0) continue;

      // Get field harmonies
      const fieldHarmonies = getHarmoniesForField(mapping.harmonyField);

      // Process through pipeline
      const config: PipelineConfig = {
        harmonies: fieldHarmonies,
        resolutionStrategy,
        priorityOrder,
      };

      const result = await processField(mapping.harmonyField, candidates, config);

      if (result.resolved) {
        const resolvedValue = result.resolved.value;
        // Handle structured outputs
        if (typeof resolvedValue === 'object' && resolvedValue !== null) {
          const obj = resolvedValue as Record<string, unknown>;
          if (mapping.canonicalField === 'employee_count' && 'min' in obj) {
            (output as unknown as Record<string, unknown>)[mapping.canonicalField] = obj.min;
          } else if (mapping.canonicalField === 'revenue' && 'value' in obj) {
            (output as unknown as Record<string, unknown>)[mapping.canonicalField] = obj.value;
          } else {
            (output as unknown as Record<string, unknown>)[mapping.canonicalField] = resolvedValue;
          }
        } else {
          (output as unknown as Record<string, unknown>)[mapping.canonicalField] = resolvedValue;
        }
      }
    }

    return output;
  } else {
    // Person entity with resolution
    const output: CanonicalPersonOutput = {
      _type: 'person',
      _normalized_at: new Date().toISOString(),
      _sources: responses.map((r) => r._source),
      _raw: undefined,
    };

    for (const mapping of PERSON_FIELD_MAPPINGS) {
      const candidates: RawCandidate[] = [];

      for (const response of responses) {
        const rawValue = extractValue(response.raw, mapping.rawFields);
        if (rawValue !== undefined && rawValue !== null) {
          candidates.push({
            value: rawValue,
            source: response._source,
            retrieved_at: response._retrieved_at,
            record: response.raw,
          });
        }
      }

      if (candidates.length === 0) continue;

      const fieldHarmonies = getHarmoniesForField(mapping.harmonyField);
      const config: PipelineConfig = {
        harmonies: fieldHarmonies,
        resolutionStrategy,
        priorityOrder,
      };

      const result = await processField(mapping.harmonyField, candidates, config);

      if (result.resolved) {
        const resolvedValue = result.resolved.value;
        if (mapping.canonicalField === 'title' && typeof resolvedValue === 'object' && resolvedValue !== null) {
          const titleObj = resolvedValue as Record<string, unknown>;
          (output as unknown as Record<string, unknown>).title = titleObj.title;
          if (titleObj.seniority) {
            output.seniority = titleObj.seniority as string;
          }
        } else {
          (output as unknown as Record<string, unknown>)[mapping.canonicalField] = resolvedValue;
        }
      }
    }

    return output;
  }
}

/**
 * Execute the enrichment_normalize tool.
 */
export async function executeEnrichmentNormalize(
  input: EnrichmentNormalizeInput
): Promise<McpResponse<EnrichmentNormalizeOutput>> {
  const startTime = performance.now();

  try {
    // Validate entity type
    if (!['company', 'person'].includes(input.entity)) {
      return {
        success: false,
        error: {
          code: 'invalid_input',
          message: `Invalid entity type: ${input.entity}. Must be "company" or "person".`,
        },
        timing: { totalMs: performance.now() - startTime },
      };
    }

    const harmonies = getHarmoniesByEntity(input.entity);
    const resolutionStrategy = input.resolutionStrategy ?? 'priority';

    // Handle single vs multiple responses
    const responses: ProviderResponse[] = Array.isArray(input.data)
      ? input.data
      : [input.data];

    // Validate responses
    for (const response of responses) {
      if (!response._source || !response.raw) {
        return {
          success: false,
          error: {
            code: 'invalid_input',
            message: 'Invalid provider response: missing _source or raw fields',
            details: { response },
          },
          timing: { totalMs: performance.now() - startTime },
        };
      }
    }

    let output: EnrichmentNormalizeOutput;

    if (responses.length === 1) {
      // Single response - simple normalization
      const normalized = await normalizeResponse(
        responses[0],
        input.entity,
        harmonies
      );
      if (input.pipeline) {
        (normalized as any)._pipeline = input.pipeline;
      }
      output = normalized;
    } else {
      // Multiple responses - normalize with resolution
      const normalized = await normalizeWithResolution(
        responses,
        input.entity,
        resolutionStrategy,
        input.priorityOrder
      );
      if (input.pipeline) {
        (normalized as any)._pipeline = input.pipeline;
      }
      output = normalized;
    }

    return {
      success: true,
      data: output,
      timing: {
        totalMs: performance.now() - startTime,
      },
    };
  } catch (err) {
    return {
      success: false,
      error: {
        code: 'normalization_error',
        message: err instanceof Error ? err.message : String(err),
      },
      timing: {
        totalMs: performance.now() - startTime,
      },
    };
  }
}

/**
 * Input schema for enrichment_normalize tool.
 */
export const enrichmentNormalizeInputSchema = {
  type: 'object',
  properties: {
    data: {
      oneOf: [
        {
          type: 'object',
          description: 'Single provider response to normalize',
          properties: {
            _source: { type: 'string' },
            _retrieved_at: { type: 'string' },
            raw: { type: 'object' },
          },
          required: ['_source', 'raw'],
        },
        {
          type: 'array',
          description: 'Multiple provider responses to normalize and resolve',
          items: {
            type: 'object',
            properties: {
              _source: { type: 'string' },
              _retrieved_at: { type: 'string' },
              raw: { type: 'object' },
            },
            required: ['_source', 'raw'],
          },
        },
      ],
    },
    entity: {
      type: 'string',
      enum: ['company', 'person'],
      description: 'Entity type to normalize to',
    },
    pipeline: {
      type: 'string',
      description: 'Pipeline ID for normalization (default: org default)',
    },
    resolutionStrategy: {
      type: 'string',
      enum: ['priority', 'recency', 'consensus', 'conservative'],
      description: 'Resolution strategy for multiple sources (default: priority)',
    },
    priorityOrder: {
      type: 'array',
      items: { type: 'string' },
      description: 'Provider priority order for priority strategy',
    },
  },
  required: ['data', 'entity'],
  additionalProperties: false,
};

/**
 * enrichment_normalize tool definition.
 */
export const enrichmentNormalizeTool: McpToolDefinition<
  EnrichmentNormalizeInput,
  EnrichmentNormalizeOutput
> = {
  name: 'enrichment_normalize',
  description:
    'Apply Harmony pipeline to normalize provider data. Supports single or multiple provider responses with resolution strategies.',
  inputSchema: enrichmentNormalizeInputSchema,
  execute: executeEnrichmentNormalize,
};
