/**
 * MCP Module - Phase 8: MCP Tool Definitions
 *
 * Exports all MCP tools for the Enrichment Switcher:
 * - enrichment_pull: Fetch data from providers with optional normalization
 * - enrichment_normalize: Apply Harmony pipeline to data
 * - harmony_list: List available Harmonies for field/entity
 * - harmony_test: Test a Harmony against sample data
 */

// Types
export type {
  // Common
  ProviderId,
  EntityType,
  McpError,
  McpResponse,
  McpToolDefinition,
  McpToolName,
  // enrichment_pull
  EnrichmentQuery,
  EnrichmentPullInput,
  EnrichmentPullOutput,
  CanonicalCompanyOutput,
  CanonicalPersonOutput,
  // enrichment_normalize
  EnrichmentNormalizeInput,
  EnrichmentNormalizeOutput,
  // harmony_list
  HarmonyListInput,
  HarmonyListOutput,
  HarmonySummary,
  // harmony_test
  HarmonyTestInput,
  HarmonyTestOutput,
  HarmonyTestCaseResult,
  // harmonies_preview
  RawRecord,
  HarmoniesPreviewInput,
  HarmoniesPreviewOutput,
  PreviewSummary,
  RecordPreviewResult,
  FieldPreviewResult,
  // harmonies_apply
  HarmoniesApplyInput,
  HarmoniesApplyOutput,
  ApplyError,
} from './types';

// Tool Implementations (re-exported from tools index)
export {
  executeEnrichmentPull,
  enrichmentPullInputSchema,
  enrichmentPullTool,
  executeEnrichmentNormalize,
  enrichmentNormalizeInputSchema,
  enrichmentNormalizeTool,
  executeHarmonyList,
  harmonyListInputSchema,
  harmonyListTool,
  executeHarmonyTest,
  harmonyTestInputSchema,
  harmonyTestTool,
  executeHarmoniesPreview,
  harmoniesPreviewTool,
  executeHarmoniesApply,
  harmoniesApplyTool,
} from './tools';

// Tool imports for registry
import {
  enrichmentPullTool,
  enrichmentNormalizeTool,
  harmonyListTool,
  harmonyTestTool,
  harmoniesPreviewTool,
  harmoniesApplyTool,
} from './tools';
import type { McpToolDefinition, McpToolName, McpResponse } from './types';

// ─────────────────────────────────────────────────────────────
// Tool Registry
// ─────────────────────────────────────────────────────────────

/**
 * Registry of all MCP tools.
 */
const TOOL_REGISTRY: Record<McpToolName, McpToolDefinition<any, any>> = {
  enrichment_pull: enrichmentPullTool,
  enrichment_normalize: enrichmentNormalizeTool,
  harmony_list: harmonyListTool,
  harmony_test: harmonyTestTool,
  harmonies_preview: harmoniesPreviewTool,
  harmonies_apply: harmoniesApplyTool,
};

/**
 * Get a tool by name.
 */
export function getTool<TInput, TOutput>(
  name: McpToolName
): McpToolDefinition<TInput, TOutput> | undefined {
  return TOOL_REGISTRY[name];
}

/**
 * Get all available tool names.
 */
export function getToolNames(): McpToolName[] {
  return Object.keys(TOOL_REGISTRY) as McpToolName[];
}

/**
 * Get tool descriptions for documentation/discovery.
 */
export function getToolDescriptions(): Array<{
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}> {
  return Object.values(TOOL_REGISTRY).map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
  }));
}

/**
 * Execute a tool by name.
 * This is the main entry point for MCP tool invocation.
 */
export async function executeTool<TInput, TOutput>(
  name: McpToolName,
  input: TInput
): Promise<McpResponse<TOutput>> {
  const tool = getTool<TInput, TOutput>(name);

  if (!tool) {
    return {
      success: false,
      error: {
        code: 'invalid_input',
        message: `Unknown tool: ${name}`,
        details: {
          tool: name,
          availableTools: getToolNames(),
        },
      },
    };
  }

  return tool.execute(input);
}

/**
 * Validate tool input against schema (basic validation).
 * For full JSON Schema validation, use a library like ajv.
 */
export function validateToolInput(
  name: McpToolName,
  input: unknown
): { valid: boolean; errors?: string[] } {
  const tool = getTool(name);

  if (!tool) {
    return {
      valid: false,
      errors: [`Unknown tool: ${name}`],
    };
  }

  const schema = tool.inputSchema;
  const errors: string[] = [];

  // Basic required field validation
  if (
    schema.required &&
    Array.isArray(schema.required) &&
    typeof input === 'object' &&
    input !== null
  ) {
    const inputObj = input as Record<string, unknown>;
    for (const field of schema.required) {
      if (!(field in inputObj)) {
        errors.push(`Missing required field: ${field}`);
      }
    }
  }

  // Basic type validation for top-level
  if (schema.type === 'object' && (typeof input !== 'object' || input === null)) {
    errors.push('Input must be an object');
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
  };
}

// Default export
export default TOOL_REGISTRY;
