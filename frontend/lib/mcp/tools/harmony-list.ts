/**
 * harmony_list MCP Tool
 *
 * Lists available Harmonies with optional filtering by field, entity, category, or tags.
 */

import type {
  HarmonyListInput,
  HarmonyListOutput,
  HarmonySummary,
  McpResponse,
  McpToolDefinition,
} from '../types';
import {
  getLibraryHarmonies,
  getHarmoniesForField,
  getHarmoniesByEntity,
  getHarmoniesByCategory,
  searchHarmoniesByTags,
} from '../../harmonies/library';
import type { ValidatedHarmony } from '../../harmonies/spec/schema';

/**
 * Convert a ValidatedHarmony to a HarmonySummary.
 */
function toSummary(
  harmony: ValidatedHarmony,
  includeSpec = false
): HarmonySummary {
  const { spec } = harmony;
  return {
    id: spec.id,
    version: spec.version,
    name: spec.name,
    description: spec.description,
    category: spec.category,
    entity: spec.applies_to.entity,
    fields: spec.applies_to.fields,
    tags: spec.tags || [],
    enabled: spec.default_enabled,
    ...(includeSpec ? { spec } : {}),
  };
}

/**
 * Execute the harmony_list tool.
 */
export async function executeHarmonyList(
  input: HarmonyListInput
): Promise<McpResponse<HarmonyListOutput>> {
  const startTime = performance.now();

  try {
    let harmonies: ValidatedHarmony[];

    // Apply filters based on input
    if (input.field) {
      // Filter by field
      harmonies = getHarmoniesForField(input.field);
    } else if (input.entity) {
      // Filter by entity type
      harmonies = getHarmoniesByEntity(input.entity);
    } else if (input.category) {
      // Filter by category
      // Need to cast because getHarmoniesByCategory expects specific category types
      harmonies = getHarmoniesByCategory(input.category as any);
    } else if (input.tags && input.tags.length > 0) {
      // Filter by tags
      harmonies = searchHarmoniesByTags(input.tags);
    } else {
      // No filter - return all
      harmonies = getLibraryHarmonies();
    }

    // Apply additional filters if multiple specified
    if (input.field && input.entity) {
      harmonies = harmonies.filter(
        (h) => h.spec.applies_to.entity === input.entity
      );
    }
    if (input.field && input.category) {
      harmonies = harmonies.filter((h) => h.spec.category === input.category);
    }
    if (input.entity && input.category) {
      harmonies = harmonies.filter((h) => h.spec.category === input.category);
    }
    if (input.tags && input.tags.length > 0 && (input.field || input.entity || input.category)) {
      const tagSet = new Set(input.tags.map((t) => t.toLowerCase()));
      harmonies = harmonies.filter((h) => {
        const harmonyTags = h.spec.tags || [];
        return harmonyTags.some((t) => tagSet.has(t.toLowerCase()));
      });
    }

    // Convert to summaries
    const summaries: HarmonySummary[] = harmonies.map((h) =>
      toSummary(h, input.includeSpec)
    );

    // Compute category breakdown
    const byCategory: Record<string, number> = {};
    const byEntity: Record<string, number> = {};

    for (const harmony of harmonies) {
      const cat = harmony.spec.category;
      byCategory[cat] = (byCategory[cat] || 0) + 1;

      const entity = harmony.spec.applies_to.entity || 'any';
      byEntity[entity] = (byEntity[entity] || 0) + 1;
    }

    const output: HarmonyListOutput = {
      total: summaries.length,
      harmonies: summaries,
      byCategory,
      byEntity,
    };

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
        code: 'internal_error',
        message: err instanceof Error ? err.message : String(err),
      },
      timing: {
        totalMs: performance.now() - startTime,
      },
    };
  }
}

/**
 * Input schema for harmony_list tool.
 */
export const harmonyListInputSchema = {
  type: 'object',
  properties: {
    field: {
      type: 'string',
      description: 'Filter by canonical field (e.g., "company.name", "person.title")',
    },
    entity: {
      type: 'string',
      enum: ['company', 'person'],
      description: 'Filter by entity type',
    },
    category: {
      type: 'string',
      description: 'Filter by category (e.g., "contact-fields", "business-entities")',
    },
    tags: {
      type: 'array',
      items: { type: 'string' },
      description: 'Filter by tags (returns Harmonies matching any tag)',
    },
    includeSpec: {
      type: 'boolean',
      description: 'Include full spec in output (default: false)',
      default: false,
    },
  },
  additionalProperties: false,
};

/**
 * harmony_list tool definition.
 */
export const harmonyListTool: McpToolDefinition<
  HarmonyListInput,
  HarmonyListOutput
> = {
  name: 'harmony_list',
  description:
    'List available Harmonies with optional filtering by field, entity, category, or tags. Returns summaries of all matching Harmonies.',
  inputSchema: harmonyListInputSchema,
  execute: executeHarmonyList,
};
