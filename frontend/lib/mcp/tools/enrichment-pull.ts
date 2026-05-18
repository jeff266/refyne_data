/**
 * enrichment_pull MCP Tool
 *
 * Fetches data from an enrichment provider with optional normalization.
 * Includes cache check to avoid redundant API calls.
 *
 * Mode behavior:
 * - Implicit mode: normalize=true by default (auto-normalize)
 * - Explicit mode: normalize=false by default (return raw)
 *
 * Cache behavior:
 * - Cache hit: Returns cached data with source='cache', no provider API calls
 * - Cache miss: Calls provider, stores result, returns with source='live'
 */

import type {
  EnrichmentPullInput,
  EnrichmentPullOutput,
  CanonicalCompanyOutput,
  CanonicalPersonOutput,
  McpResponse,
  McpToolDefinition,
  ProviderId,
} from '../types';
import {
  getProvider,
  hasProvider,
  type ProviderResponse,
  type CompanyQuery,
  type SearchQuery,
  ProviderError,
} from '../../providers/index';
import {
  getHarmoniesByEntity,
  getHarmoniesForField,
} from '../../harmonies/library';
import { Normalizer } from '../../harmonies/pipeline/normalizer';
import type { ValidatedHarmony } from '../../harmonies/spec/schema';
import type { RawCandidate } from '../../harmonies/pipeline/types';
import {
  get as cacheGet,
  set as cacheSet,
  resolve as cacheResolve,
  calculateTTLExpiration,
  type CacheEntry,
  type EnrichmentSource,
} from '../../cache';
import { extractDomain } from '../../harmonies/runtime/builtins';

/**
 * Default normalization mode.
 * In production, this would be determined by org settings.
 * For now, default to false (explicit mode).
 */
const DEFAULT_NORMALIZE = false;

/**
 * Build a CompanyQuery from EnrichmentQuery input.
 */
function buildCompanyQuery(
  input: EnrichmentPullInput['query']
): CompanyQuery {
  return {
    domain: input.domain,
    name: input.name,
  };
}

/**
 * Build a SearchQuery from EnrichmentQuery input.
 */
function buildSearchQuery(input: EnrichmentPullInput['query']): SearchQuery {
  return {
    term: input.term,
    location: input.location,
    industry: input.industry,
    query: input.term || input.name,
    limit: input.limit,
    capabilities: input.capabilities,
    categories: input.categories,
  };
}

/**
 * Get Harmonies for normalizing company data.
 */
function getCompanyHarmonies(): ValidatedHarmony[] {
  return getHarmoniesByEntity('company');
}

/**
 * Get Harmonies for normalizing person data.
 */
function getPersonHarmonies(): ValidatedHarmony[] {
  return getHarmoniesByEntity('person');
}

/**
 * Normalize a provider response to canonical company format.
 */
async function normalizeToCompany(
  response: ProviderResponse,
  harmonies: ValidatedHarmony[]
): Promise<CanonicalCompanyOutput> {
  const normalizer = new Normalizer(harmonies);
  const raw = response.raw;

  // Build the canonical output with normalized fields
  const output: CanonicalCompanyOutput = {
    _type: 'company',
    _normalized_at: new Date().toISOString(),
    _sources: [response._source],
    _raw: raw,
  };

  // Get field-specific harmonies and normalize each field
  const fieldMappings: Array<{
    rawField: string;
    canonicalField: keyof CanonicalCompanyOutput;
    harmonyField: string;
  }> = [
    { rawField: 'name', canonicalField: 'name', harmonyField: 'company.name' },
    { rawField: 'domain', canonicalField: 'domain', harmonyField: 'company.domain' },
    { rawField: 'industry', canonicalField: 'industry', harmonyField: 'company.industry' },
    { rawField: 'employee_count', canonicalField: 'employee_count', harmonyField: 'company.employees' },
    { rawField: 'employees', canonicalField: 'employee_count', harmonyField: 'company.employees' },
    { rawField: 'estimated_num_employees', canonicalField: 'employee_count', harmonyField: 'company.employees' },
    { rawField: 'revenue', canonicalField: 'revenue', harmonyField: 'company.revenue' },
    { rawField: 'estimated_annual_revenue', canonicalField: 'revenue', harmonyField: 'company.revenue' },
    { rawField: 'description', canonicalField: 'description', harmonyField: 'company.description' },
    { rawField: 'short_description', canonicalField: 'description', harmonyField: 'company.description' },
    { rawField: 'founded_year', canonicalField: 'founded_year', harmonyField: 'company.founded_year' },
    { rawField: 'linkedin_url', canonicalField: 'linkedin_url', harmonyField: 'linkedin-url' },
    { rawField: 'phone', canonicalField: 'phone', harmonyField: 'phone' },
  ];

  for (const mapping of fieldMappings) {
    const rawValue = raw[mapping.rawField];
    if (rawValue === undefined || rawValue === null) continue;

    // Find Harmony for this field
    const fieldHarmonies = getHarmoniesForField(mapping.harmonyField);
    if (fieldHarmonies.length === 0) {
      // No harmony - use raw value
      (output as unknown as Record<string, unknown>)[mapping.canonicalField] = rawValue;
      continue;
    }

    // Create normalizer for this field
    const fieldNormalizer = new Normalizer(fieldHarmonies);
    const candidate: RawCandidate = {
      value: rawValue,
      source: response._source,
      retrieved_at: response._retrieved_at,
      record: raw,
    };

    const result = await fieldNormalizer.normalize(candidate);
    if (result.success && result.candidate) {
      // Extract the value from the normalized result
      const normalizedValue = result.candidate.value;
      // Some harmonies return objects (like person-title returns {title, seniority})
      // For company fields, we typically want the primitive value
      if (typeof normalizedValue === 'object' && normalizedValue !== null) {
        // If it's an object, try to extract the main value
        const obj = normalizedValue as Record<string, unknown>;
        if ('value' in obj) {
          (output as unknown as Record<string, unknown>)[mapping.canonicalField] = obj.value;
        } else if (mapping.canonicalField === 'employee_count' && 'employees' in obj) {
          (output as unknown as Record<string, unknown>)[mapping.canonicalField] = obj.employees;
        } else {
          // Use the whole object
          (output as unknown as Record<string, unknown>)[mapping.canonicalField] = normalizedValue;
        }
      } else {
        (output as unknown as Record<string, unknown>)[mapping.canonicalField] = normalizedValue;
      }
    } else {
      // Normalization failed - use raw value
      (output as unknown as Record<string, unknown>)[mapping.canonicalField] = rawValue;
    }
  }

  // Handle headquarters separately (nested object)
  if (raw.city || raw.state || raw.country) {
    output.headquarters = {
      city: raw.city as string | undefined,
      state: raw.state as string | undefined,
      country: raw.country as string | undefined,
    };
  } else if (raw.headquarters && typeof raw.headquarters === 'object') {
    const hq = raw.headquarters as Record<string, unknown>;
    output.headquarters = {
      city: hq.city as string | undefined,
      state: hq.state as string | undefined,
      country: hq.country as string | undefined,
    };
  }

  return output;
}

/**
 * Execute the enrichment_pull tool.
 */
export async function executeEnrichmentPull(
  input: EnrichmentPullInput,
  orgId = 'default' // TODO: Get from auth context
): Promise<McpResponse<EnrichmentPullOutput>> {
  const startTime = performance.now();
  let pullMs = 0;
  let normalizeMs = 0;
  let cacheMs = 0;
  let source: EnrichmentSource = 'live';

  try {
    // Validate provider
    if (!hasProvider(input.provider)) {
      return {
        success: false,
        error: {
          code: 'invalid_input',
          message: `Unknown provider: ${input.provider}`,
          details: {
            provider: input.provider,
            availableProviders: ['apollo', 'zoominfo', 'serper', 'clay', 'graphiq', 'yelp'],
          },
        },
        timing: { totalMs: performance.now() - startTime },
      };
    }

    const provider = getProvider(input.provider);
    if (!provider) {
      return {
        success: false,
        error: {
          code: 'internal_error',
          message: `Failed to get provider: ${input.provider}`,
        },
        timing: { totalMs: performance.now() - startTime },
      };
    }

    // ═══════════════════════════════════════════════════════════
    // CACHE CHECK: Look for cached data before calling providers
    // ═══════════════════════════════════════════════════════════
    const normalizedDomain = input.query.domain
      ? extractDomain(input.query.domain)
      : null;

    // Only check cache for company enrichment by domain (not search queries)
    const shouldCheckCache = normalizedDomain && !input.query.term && !input.query.location;
    const shouldNormalize = input.normalize ?? DEFAULT_NORMALIZE;

    if (shouldCheckCache && normalizedDomain) {
      const cacheStart = performance.now();
      const cacheResult = await cacheGet(orgId, normalizedDomain, 'company');
      cacheMs = performance.now() - cacheStart;

      if (cacheResult.hit && cacheResult.rows.length > 0) {
        // CACHE HIT: Resolve from cache, no provider API calls
        source = 'cache';

        if (shouldNormalize) {
          const resolved = cacheResolve(cacheResult.rows);
          if (resolved) {
            const output: CanonicalCompanyOutput = {
              _type: 'company',
              _normalized_at: new Date().toISOString(),
              _sources: cacheResult.rows.map((r) => r.provider),
              _raw: cacheResult.rows[0].raw_response || {},
              name: resolved.name.value,
              domain: resolved.domain.value,
              industry: resolved.industry.value || undefined,
              employee_count: resolved.employee_count.value || undefined,
              revenue: resolved.annual_revenue.value || undefined,
              description: resolved.description.value || undefined,
              founded_year: resolved.founded_year.value || undefined,
              linkedin_url: resolved.linkedin_url.value || undefined,
              phone: resolved.phone.value || undefined,
              headquarters: {
                city: resolved.hq_city.value || undefined,
                state: resolved.hq_state.value || undefined,
                country: resolved.hq_country.value || undefined,
              },
            };

            return {
              success: true,
              data: output,
              timing: {
                totalMs: performance.now() - startTime,
                cacheMs,
              },
            };
          }
        } else {
          // Return raw cached data
          return {
            success: true,
            data: (cacheResult.rows[0].raw_response || cacheResult.rows[0].canonical_data) as unknown as EnrichmentPullOutput,
            timing: {
              totalMs: performance.now() - startTime,
              cacheMs,
            },
          };
        }
      }
    }

    // ═══════════════════════════════════════════════════════════
    // CACHE MISS: Call provider API
    // ═══════════════════════════════════════════════════════════

    // Determine which method to call based on query parameters
    const pullStart = performance.now();
    let response: ProviderResponse | ProviderResponse[] | null = null;

    // Route Serper and GraphIQ through server-side API for credit metering
    const isServerSideProvider = input.provider === 'serper' || input.provider === 'graphiq';

    if (isServerSideProvider) {
      // Determine action
      const action = (input.query.term || input.query.location || input.query.capabilities)
        ? 'search'
        : 'enrichCompany';

      const query = action === 'search'
        ? buildSearchQuery(input.query)
        : buildCompanyQuery(input.query);

      // Call server-side API
      const apiUrl = `/api/enrich/providers/${input.provider}`;
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, query }),
      });

      if (!res.ok) {
        const error = await res.json();
        return {
          success: false,
          error: {
            code: res.status === 429 ? 'credit_limit_reached' : 'api_error',
            message: error.error || 'Provider API call failed',
            details: error,
          },
          timing: { totalMs: performance.now() - startTime },
        };
      }

      const result = await res.json();
      response = result.data;
    } else {
      // BYOK providers (Apollo, ZoomInfo, etc.) - call directly from client
      // For search providers (Serper, Yelp, GraphIQ), use search if term/location provided
      if (
        (input.query.term || input.query.location || input.query.capabilities) &&
        provider.search
      ) {
        const searchQuery = buildSearchQuery(input.query);
        response = await provider.search(searchQuery);
      } else if (input.query.domain || input.query.name) {
        // Use enrichCompany for domain/name queries
        const companyQuery = buildCompanyQuery(input.query);
        response = await provider.enrichCompany(companyQuery);
      } else {
        return {
          success: false,
          error: {
            code: 'invalid_input',
            message: 'Query must include domain, name, or search term',
            details: { query: input.query },
          },
          timing: { totalMs: performance.now() - startTime },
        };
      }
    }

    pullMs = performance.now() - pullStart;

    // Handle not found
    if (response === null) {
      return {
        success: true,
        data: undefined,
        timing: {
          totalMs: performance.now() - startTime,
          pullMs,
        },
      };
    }

    if (!shouldNormalize) {
      // Store raw response in cache if it's a company enrichment
      if (normalizedDomain && !Array.isArray(response)) {
        const cacheEntry: CacheEntry = {
          provider: input.provider as CacheEntry['provider'],
          provider_id: String(response.raw?.id || response.raw?.organization_id || normalizedDomain),
          entity_type: 'company',
          domain: normalizedDomain,
          canonical_data: response.raw || {},
          raw_response: response.raw,
          ttl_expires_at: calculateTTLExpiration('company'),
        };
        // Fire-and-forget cache write
        cacheSet(orgId, [cacheEntry]).catch((err) => {
          console.error('[Cache] Failed to store response:', err);
        });
      }

      // Return raw response
      return {
        success: true,
        data: response,
        timing: {
          totalMs: performance.now() - startTime,
          pullMs,
        },
      };
    }

    // Normalize the response
    const normalizeStart = performance.now();

    let normalizedOutput: EnrichmentPullOutput;

    if (Array.isArray(response)) {
      // Multiple results - normalize each
      const normalizedResults = await Promise.all(
        response.map((r) => normalizeToCompany(r, getCompanyHarmonies()))
      );
      normalizedOutput = normalizedResults as CanonicalCompanyOutput[];
    } else {
      // Single result
      normalizedOutput = await normalizeToCompany(response, getCompanyHarmonies());
    }

    if (input.pipeline) {
      // Add pipeline info to output
      if (Array.isArray(normalizedOutput)) {
        normalizedOutput = normalizedOutput.map((o) => ({
          ...o,
          _pipeline: input.pipeline,
        }));
      } else {
        (normalizedOutput as CanonicalCompanyOutput)._pipeline = input.pipeline;
      }
    }

    normalizeMs = performance.now() - normalizeStart;

    // ═══════════════════════════════════════════════════════════
    // CACHE WRITE: Store provider response for future lookups
    // ═══════════════════════════════════════════════════════════
    if (normalizedDomain && !Array.isArray(response)) {
      const canonical = normalizedOutput as CanonicalCompanyOutput;
      const cacheEntry: CacheEntry = {
        provider: input.provider as CacheEntry['provider'],
        provider_id: String(response.raw?.id || response.raw?.organization_id || normalizedDomain),
        entity_type: 'company',
        domain: normalizedDomain,
        canonical_data: {
          name: canonical.name,
          domain: canonical.domain,
          industry: canonical.industry,
          employee_count: canonical.employee_count,
          annual_revenue: canonical.revenue,
          hq_city: canonical.headquarters?.city,
          hq_state: canonical.headquarters?.state,
          hq_country: canonical.headquarters?.country,
          founded_year: canonical.founded_year,
          linkedin_url: canonical.linkedin_url,
          description: canonical.description,
          phone: canonical.phone,
        },
        raw_response: response.raw,
        ttl_expires_at: calculateTTLExpiration('company'),
      };

      // Fire-and-forget cache write
      cacheSet(orgId, [cacheEntry]).catch((err) => {
        console.error('[Cache] Failed to store response:', err);
      });
    }

    return {
      success: true,
      data: normalizedOutput,
      timing: {
        totalMs: performance.now() - startTime,
        pullMs,
        normalizeMs,
      },
    };
  } catch (err) {
    // Handle provider errors
    if (err instanceof Error && err.name === 'ProviderError') {
      const providerError = err as ProviderError;
      return {
        success: false,
        error: {
          code: 'provider_error',
          message: providerError.message,
          details: {
            provider: providerError.provider,
            errorCode: providerError.code,
            statusCode: providerError.statusCode,
          },
        },
        timing: {
          totalMs: performance.now() - startTime,
          pullMs,
        },
      };
    }

    return {
      success: false,
      error: {
        code: 'internal_error',
        message: err instanceof Error ? err.message : String(err),
      },
      timing: {
        totalMs: performance.now() - startTime,
        pullMs,
      },
    };
  }
}

/**
 * Input schema for enrichment_pull tool.
 */
export const enrichmentPullInputSchema = {
  type: 'object',
  properties: {
    provider: {
      type: 'string',
      enum: ['apollo', 'zoominfo', 'serper', 'clay', 'graphiq', 'yelp'],
      description: 'Provider to pull data from',
    },
    query: {
      type: 'object',
      description: 'Query parameters for the enrichment',
      properties: {
        domain: {
          type: 'string',
          description: 'Company domain (e.g., "notion.com")',
        },
        name: {
          type: 'string',
          description: 'Company name',
        },
        term: {
          type: 'string',
          description: 'Search term (for search providers)',
        },
        location: {
          type: 'string',
          description: 'Location filter (city, state, zip)',
        },
        industry: {
          type: 'string',
          description: 'Industry filter',
        },
        titles: {
          type: 'array',
          items: { type: 'string' },
          description: 'Job titles to filter contacts by',
        },
        limit: {
          type: 'number',
          description: 'Max results for search queries',
        },
        capabilities: {
          type: 'array',
          items: { type: 'string' },
          description: 'Capabilities search (GraphIQ)',
        },
        categories: {
          type: 'string',
          description: 'Categories (Yelp)',
        },
      },
    },
    normalize: {
      type: 'boolean',
      description:
        'Whether to normalize the result (default: depends on org mode)',
    },
    pipeline: {
      type: 'string',
      description: 'Pipeline ID for normalization (default: org default)',
    },
    resolutionStrategy: {
      type: 'string',
      enum: ['priority', 'recency', 'consensus', 'conservative'],
      description: 'Resolution strategy for multiple sources',
    },
  },
  required: ['provider', 'query'],
  additionalProperties: false,
};

/**
 * enrichment_pull tool definition.
 */
export const enrichmentPullTool: McpToolDefinition<
  EnrichmentPullInput,
  EnrichmentPullOutput
> = {
  name: 'enrichment_pull',
  description:
    'Fetch data from an enrichment provider with optional normalization. Returns raw provider response or normalized canonical entity based on mode.',
  inputSchema: enrichmentPullInputSchema,
  execute: executeEnrichmentPull,
};
