/**
 * Enrich Page Worker
 *
 * Worker processors for preview and apply jobs from the Enrich page.
 * Split from enrichment-queue.ts for clarity - preview/apply flow is distinct
 * from arrangement-based enrichment.
 */

import { Job } from 'bullmq';
import { createClient } from 'redis';
import { supabase } from '../db/supabase';
import { getAccessToken } from '../hubspot/get-access-token';
import { HubSpotClient } from '../hubspot/client';
import { refyneSearch } from '../providers/refyne-search';
import { classifyIndustry } from '../providers/refyne-search/industry-classifier';

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

// ─────────────────────────────────────────────────────────────
// Job Data Types
// ─────────────────────────────────────────────────────────────

export interface PreviewJobData {
  runId: string;
  orgId: string;
  userId: string;
  objectType: string;
  source: {
    type: 'gaps' | 'all' | 'list';
    fields?: string[];
    list_id?: string;
  };
  fieldKeys: string[];
  providerId: string;
  recordLimit: number;
  harmonyIds: string[];
}

export interface PreviewJobProgress {
  completed: number;
  total: number;
  percentage: number;
  currentCompany: string | null;
  step?: number;
  stepName?: string;
  current?: number;
  recordsProcessed?: number;
}

/**
 * Redis client for caching preview results.
 */
let redisClient: ReturnType<typeof createClient> | null = null;

function getRedisClient() {
  if (!redisClient && REDIS_URL && REDIS_TOKEN) {
    redisClient = createClient({
      url: REDIS_URL,
      password: REDIS_TOKEN,
    });
    redisClient.connect();
  }
  return redisClient;
}

/**
 * Preview result for a single company.
 */
export interface PreviewResult {
  hubspotCompanyId: string;
  companyName: string;
  domain: string | null;
  fields: Array<{
    fieldKey: string;
    currentValue: string | null;
    foundValue: string | null;
    provider: string;
    confidence: number;
    level: 'high' | 'medium' | 'low' | 'insufficient';
    action: 'would_fill' | 'would_override' | 'already_set' | 'no_data' | 'requires_review';
    evidence: string;
    trustLevel?: 'high' | 'medium' | 'low';
    requiresReview?: boolean;
  }>;
}

/**
 * Process a preview job - enrich companies without writing to HubSpot.
 */
export async function processPreviewJob(
  job: Job<PreviewJobData>
): Promise<{ resultCount: number }> {
  const { runId, orgId, source, fieldKeys, providerId, recordLimit } = job.data;

  if (!supabase) {
    throw new Error('Database not configured');
  }

  // Update run status to processing
  await supabase
    .from('arrangement_runs')
    .update({ status: 'processing' })
    .eq('id', runId);

  try {
    // Step 1: Fetching records from HubSpot
    await job.updateProgress({
      step: 1,
      stepName: 'Fetching records from HubSpot',
      current: 0,
      total: recordLimit,
      completed: 0,
      percentage: 0,
      recordsProcessed: 0,
      currentCompany: null,
    });

    // Get HubSpot access token with clear error message
    let accessToken: string;
    try {
      accessToken = await getAccessToken(orgId);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to decrypt access token';
      const detailedError = errorMsg.includes('TOKEN_ENCRYPTION_KEY')
        ? 'TOKEN_ENCRYPTION_KEY not configured in worker environment - contact support'
        : errorMsg;

      console.error('[Preview Job] Token decryption failed:', detailedError);

      await supabase
        .from('arrangement_runs')
        .update({
          status: 'failed',
          error_message: detailedError,
          completed_at: new Date().toISOString(),
        })
        .eq('id', runId);

      throw new Error(detailedError);
    }

    // Get portal info
    const { data: connection } = await supabase
      .from('hubspot_connections')
      .select('portal_id')
      .eq('org_id', orgId)
      .eq('connection_status', 'active')
      .single();

    if (!connection) {
      throw new Error('HubSpot not connected');
    }

    const hubspot = new HubSpotClient(accessToken, connection.portal_id);

    // Fetch companies based on source
    const companies = await fetchCompaniesForPreview(
      hubspot,
      source,
      fieldKeys,
      recordLimit
    );

    console.log(`[Preview Job] Fetched ${companies.length} companies to enrich`);

    const results: PreviewResult[] = [];
    const redis = getRedisClient();

    // Map provider ID to display name
    const providerName = providerId === 'apollo' ? 'Apollo' :
                         providerId === 'graphiq' ? 'GraphIQ' :
                         providerId === 'refyne_search' ? 'Refyne Search' :
                         providerId;

    // Build field names display
    const fieldNamesDisplay = fieldKeys.map(key => {
      const labels: Record<string, string> = {
        industry: 'Industry',
        numberofemployees: 'Employee count',
        linkedin_company_page: 'LinkedIn',
        phone: 'Phone',
        domain: 'Domain',
        annualrevenue: 'Revenue',
      };
      return labels[key] || key;
    }).join(', ');

    for (let i = 0; i < companies.length; i++) {
      const company = companies[i];
      const companyDomain = company.properties.domain || null;
      const companyName = company.properties.name || companyDomain || company.id;

      // Step 2: Enriching records (update every 10 records to reduce overhead)
      if (i % 10 === 0 || i === companies.length - 1) {
        await job.updateProgress({
          step: 2,
          stepName: `Querying ${providerName} for ${fieldNamesDisplay}`,
          current: i,
          total: companies.length,
          completed: i,
          percentage: Math.round((i / companies.length) * 100),
          recordsProcessed: i,
          currentCompany: companyName,
        });
      }

      // Enrich via Refyne Search
      const enrichmentResults = await refyneSearch(
        orgId,
        companyDomain,
        companyName,
        fieldKeys,
        'preview' // Context for preview mode
      );

      // Build preview result
      const previewResult: PreviewResult = {
        hubspotCompanyId: company.id,
        companyName,
        domain: companyDomain,
        fields: [],
      };

      for (const fieldKey of fieldKeys) {
        const currentValue = company.properties[fieldKey] || null;
        const enrichResult = enrichmentResults.find((r) => r.fieldKey === fieldKey);

        if (!enrichResult) {
          previewResult.fields.push({
            fieldKey,
            currentValue,
            foundValue: null,
            provider: providerId,
            confidence: 0,
            level: 'insufficient',
            action: 'no_data',
            evidence: 'No data found',
          });
          continue;
        }

        // Determine action
        let action: PreviewResult['fields'][0]['action'];
        if (!enrichResult.value) {
          action = 'no_data';
        } else if (enrichResult.requiresReview) {
          action = 'requires_review';
        } else if (!currentValue || currentValue.trim() === '') {
          action = 'would_fill';
        } else if (currentValue === String(enrichResult.value)) {
          action = 'already_set';
        } else {
          action = 'would_override';
        }

        previewResult.fields.push({
          fieldKey,
          currentValue,
          foundValue: enrichResult.value ? String(enrichResult.value) : null,
          provider: providerId,
          confidence: enrichResult.confidence,
          level: enrichResult.level,
          action,
          evidence: enrichResult.evidence,
          trustLevel: enrichResult.trustLevel,
          requiresReview: enrichResult.requiresReview,
        });
      }

      results.push(previewResult);

      // Push partial result to Redis for progressive rendering
      if (redis) {
        await redis.rPush(`preview:${job.id}:partial`, JSON.stringify(previewResult));
        await redis.expire(`preview:${job.id}:partial`, 600); // 10 min TTL
      }
    }

    // Step 3: Preparing preview
    await job.updateProgress({
      step: 3,
      stepName: 'Preparing preview',
      current: companies.length,
      total: companies.length,
      completed: companies.length,
      percentage: 100,
      recordsProcessed: companies.length,
      currentCompany: null,
    });

    // Store full results in Redis
    if (redis) {
      await redis.setEx(
        `preview:${job.id}:results`,
        600, // 10 minutes
        JSON.stringify(results)
      );
    }

    // Update arrangement_runs
    const filledCount = results.reduce(
      (sum, r) => sum + r.fields.filter((f) => f.action === 'would_fill').length,
      0
    );

    await supabase
      .from('arrangement_runs')
      .update({
        status: 'completed',
        total_records: companies.length,
        processed_records: companies.length,
        successful_records: filledCount,
        completed_at: new Date().toISOString(),
      })
      .eq('id', runId);

    console.log(`[Preview Job] Completed: ${results.length} companies enriched`);

    return { resultCount: results.length };
  } catch (error) {
    // Mark run as failed
    await supabase
      .from('arrangement_runs')
      .update({
        status: 'failed',
        error_message: error instanceof Error ? error.message : 'Unknown error',
        completed_at: new Date().toISOString(),
      })
      .eq('id', runId);

    throw error;
  }
}

/**
 * Fetch companies for preview based on source filter.
 */
async function fetchCompaniesForPreview(
  hubspot: HubSpotClient,
  source: PreviewJobData['source'],
  fieldKeys: string[],
  limit: number
): Promise<any[]> {
  // HubSpot Search API has a max limit of 200
  const cappedLimit = Math.min(limit, 200);
  const properties = ['name', 'domain', ...fieldKeys];
  const companies: any[] = [];

  if (source.type === 'gaps' && source.fields) {
    // Fetch companies with missing fields
    const filterGroups = source.fields.slice(0, 5).map((field) => ({
      filters: [
        {
          propertyName: field,
          operator: 'NOT_HAS_PROPERTY',
        },
      ],
    }));

    const searchRequest = {
      filterGroups,
      properties,
      limit: cappedLimit,
      sorts: [{ propertyName: 'hs_lastmodifieddate', direction: 'DESCENDING' as const }],
    };

    const response = await hubspot.request<{
      results: Array<{ id: string; properties: Record<string, string | null> }>;
    }>(
      '/crm/v3/objects/companies/search',
      {
        method: 'POST',
        body: JSON.stringify(searchRequest),
      },
      true
    );

    companies.push(...response.results.map((r) => ({ id: r.id, properties: r.properties })));
  } else if (source.type === 'list' && source.list_id) {
    // Fetch from HubSpot list
    for await (const batch of hubspot.getListMembers(source.list_id, properties)) {
      companies.push(...batch);
      if (companies.length >= cappedLimit) break;
    }
  } else {
    // All companies
    const searchRequest = {
      properties,
      limit: cappedLimit,
      sorts: [{ propertyName: 'hs_lastmodifieddate', direction: 'DESCENDING' as const }],
    };

    const response = await hubspot.request<{
      results: Array<{ id: string; properties: Record<string, string | null> }>;
    }>(
      '/crm/v3/objects/companies/search',
      {
        method: 'POST',
        body: JSON.stringify(searchRequest),
      },
      true
    );

    companies.push(...response.results.map((r) => ({ id: r.id, properties: r.properties })));
  }

  return companies.slice(0, cappedLimit);
}

// ─────────────────────────────────────────────────────────────
// Enrich Apply Queue (write preview results to HubSpot)
// ─────────────────────────────────────────────────────────────

export interface ApplyJobData {
  runId: string;
  orgId: string;
  userId: string;
  objectType: string;
  previewJobId: string;
  selectedRecordIds: string[];
}

/**
 * Process an apply job - write cached preview results to HubSpot.
 */
export async function processApplyJob(
  job: Job<ApplyJobData>
): Promise<{ filled: number; total: number }> {
  const { runId, orgId, previewJobId, selectedRecordIds } = job.data;

  if (!supabase) {
    throw new Error('Database not configured');
  }

  const redis = getRedisClient();
  if (!redis) {
    throw new Error('Redis not configured');
  }

  // Update run status
  await supabase
    .from('arrangement_runs')
    .update({ status: 'processing' })
    .eq('id', runId);

  try {
    // Fetch preview results from cache
    const cached = await redis.get(`preview:${previewJobId}:results`);
    if (!cached) {
      throw new Error('Preview results expired. Run preview again.');
    }

    const previewResults: PreviewResult[] = JSON.parse(cached);
    const selectedResults = previewResults.filter((r) =>
      selectedRecordIds.includes(r.hubspotCompanyId)
    );

    console.log(`[Apply Job] Processing ${selectedResults.length} selected records`);

    await job.updateProgress({
      total: selectedResults.length,
      completed: 0,
      percentage: 0,
      currentCompany: null,
    });

    // Get HubSpot access token with clear error message
    let accessToken: string;
    try {
      accessToken = await getAccessToken(orgId);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to decrypt access token';
      const detailedError = errorMsg.includes('TOKEN_ENCRYPTION_KEY')
        ? 'TOKEN_ENCRYPTION_KEY not configured in worker environment - contact support'
        : errorMsg;

      console.error('[Apply Job] Token decryption failed:', detailedError);

      await supabase
        .from('arrangement_runs')
        .update({
          status: 'failed',
          error_message: detailedError,
          completed_at: new Date().toISOString(),
        })
        .eq('id', runId);

      throw new Error(detailedError);
    }

    const { data: connection } = await supabase
      .from('hubspot_connections')
      .select('portal_id')
      .eq('org_id', orgId)
      .eq('connection_status', 'active')
      .single();

    if (!connection) {
      throw new Error('HubSpot not connected');
    }

    const hubspot = new HubSpotClient(accessToken, connection.portal_id);

    // Build batch updates
    const updates: Array<{ id: string; properties: Record<string, any> }> = [];
    let filled = 0;

    for (let i = 0; i < selectedResults.length; i++) {
      const result = selectedResults[i];

      await job.updateProgress({
        total: selectedResults.length,
        completed: i,
        percentage: Math.round((i / selectedResults.length) * 100),
        currentCompany: result.companyName,
      });

      const properties: Record<string, any> = {};

      for (const field of result.fields) {
        if (
          field.action === 'would_fill' ||
          field.action === 'would_override'
        ) {
          if (field.foundValue) {
            properties[field.fieldKey] = field.foundValue;
            filled++;
          }
        }
      }

      if (Object.keys(properties).length > 0) {
        updates.push({
          id: result.hubspotCompanyId,
          properties,
        });
      }

      // Log to arrangement_run_progress
      await supabase.from('arrangement_run_progress').insert({
        run_id: runId,
        org_id: orgId,
        record_id: result.hubspotCompanyId,
        record_data: {
          company_name: result.companyName,
          domain: result.domain,
        },
        status: 'completed',
        enrichment_results: {
          fields: result.fields,
        },
        result: properties,
        credits_used: 0,
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
      });
    }

    // Write to HubSpot in batches
    if (updates.length > 0) {
      const { results: writeResults, errors } = await hubspot.batchUpdateCompanies(updates);
      console.log(
        `[Apply Job] Wrote ${writeResults.length} companies, ${errors.length} errors`
      );

      // Track field sources for survivorship rules
      const fieldSourcesToWrite: Array<{
        org_id: string;
        hubspot_company_id: string;
        field_key: string;
        source: string;
      }> = [];

      for (const result of selectedResults) {
        for (const field of result.fields) {
          if (field.foundValue && field.provider) {
            fieldSourcesToWrite.push({
              org_id: orgId,
              hubspot_company_id: result.hubspotCompanyId,
              field_key: field.fieldKey,
              source: field.provider.toLowerCase().replace(/\s+/g, '_'), // Normalize provider name
            });
          }
        }
      }

      // Write field sources to database (upsert to handle re-enrichment)
      if (fieldSourcesToWrite.length > 0 && supabase) {
        const { error: sourcesError } = await supabase
          .from('enrichment_field_sources')
          .upsert(fieldSourcesToWrite, {
            onConflict: 'org_id,hubspot_company_id,field_key',
          });

        if (sourcesError) {
          console.error('[Apply Job] Failed to write field sources:', sourcesError);
        } else {
          console.log(`[Apply Job] Tracked ${fieldSourcesToWrite.length} field sources`);
        }
      }
    }

    // Clear preview cache
    await redis.del(`preview:${previewJobId}:results`);
    await redis.del(`preview:${previewJobId}:partial`);

    // Update run record
    await supabase
      .from('arrangement_runs')
      .update({
        status: 'completed',
        total_records: selectedResults.length,
        processed_records: selectedResults.length,
        successful_records: filled,
        fields_filled: { total: filled }, // JSONB field
        completed_at: new Date().toISOString(),
      })
      .eq('id', runId);

    await job.updateProgress({
      total: selectedResults.length,
      completed: selectedResults.length,
      percentage: 100,
      currentCompany: null,
    });

    console.log(`[Apply Job] Completed: ${filled} fields written`);

    return { filled, total: selectedResults.length };
  } catch (error) {
    // Mark run as failed
    await supabase
      .from('arrangement_runs')
      .update({
        status: 'failed',
        error_message: error instanceof Error ? error.message : 'Unknown error',
        completed_at: new Date().toISOString(),
      })
      .eq('id', runId);

    throw error;
  }
}
