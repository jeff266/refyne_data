/**
 * Provider Benchmark Stream API
 *
 * Tests providers (Apollo, Refyne Data/GraphIQ) against a statistically significant
 * sample of the user's database using SSE for live progress updates.
 */

import { NextRequest } from 'next/server';
import { getOrgContext } from '@/lib/auth/clerk-helpers';
import { getAccessToken } from '@/lib/hubspot/get-access-token';
import { HubSpotClient } from '@/lib/hubspot/client';
import { getStratifiedSample } from '@/lib/benchmark/stratified-sampling';
import { getBenchmarkSampleSize, getConfidenceDescription } from '@/lib/benchmark/sampling';
import { ApolloAdapter } from '@/lib/providers/apollo';
import { getApolloKey } from '@/lib/providers/apollo-key';
import { supabase } from '@/lib/db/supabase';
import type { HubSpotCompany } from '@/lib/hubspot/types';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

interface ProviderBenchmarkResult {
  match_rate: number;
  field_coverage: Record<string, number>;
  tested: number;
  matched: number;
}

interface BenchmarkRecommendation {
  best_provider: string;
  top_industries: Array<{ industry: string; count: number }>;
  combined_waterfall_coverage: number;
  apollo_coverage?: number;
  refyne_coverage?: number;
  message: string;
}

export async function GET(req: NextRequest) {
  const ctx = await getOrgContext();
  const { searchParams } = new URL(req.url);
  const fields = searchParams.get('fields')?.split(',') || ['industry'];

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        // Get HubSpot client
        send({ type: 'init', message: 'Connecting to HubSpot...' });

        const accessToken = await getAccessToken(ctx.orgId);
        if (!supabase) {
          throw new Error('Database not configured');
        }

        const { data: connection } = await supabase
          .from('hubspot_connections')
          .select('portal_id')
          .eq('org_id', ctx.orgId)
          .single();

        if (!connection) {
          throw new Error('HubSpot connection not found');
        }

        const hubspot = new HubSpotClient(accessToken, connection.portal_id);

        // Fetch stratified sample
        send({ type: 'init', message: 'Analyzing database and sampling companies...' });

        const { sample, distribution, totalMissing } = await getStratifiedSample(
          hubspot,
          getBenchmarkSampleSize(10000), // Use max sample size for now
          fields
        );

        const sampleSize = sample.length;
        const confidence = getConfidenceDescription(totalMissing, sampleSize);

        send({
          type: 'sample_ready',
          total_companies: totalMissing,
          sample_size: sampleSize,
          distribution,
          confidence,
        });

        // Benchmark Apollo
        send({ type: 'provider_start', provider: 'apollo' });
        const apolloKey = await getApolloKey(ctx.orgId);
        let apolloResults: ProviderBenchmarkResult | null = null;

        if (apolloKey) {
          apolloResults = await benchmarkApollo(sample, fields, apolloKey, send);
          send({ type: 'provider_complete', provider: 'apollo', results: apolloResults });
        } else {
          send({
            type: 'provider_skip',
            provider: 'apollo',
            reason: 'Apollo API key not configured'
          });
        }

        // Benchmark Refyne Data (GraphIQ)
        send({ type: 'provider_start', provider: 'refyne' });
        const refyneResults = await benchmarkGraphIQ(sample, fields, send);
        send({ type: 'provider_complete', provider: 'refyne', results: refyneResults });

        // Calculate recommendations
        const recommendation = generateRecommendation(
          apolloResults,
          refyneResults,
          distribution,
          totalMissing,
          sampleSize
        );
        send({ type: 'complete', recommendation });

        controller.close();
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        send({ type: 'error', error: message });
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

async function benchmarkApollo(
  companies: HubSpotCompany[],
  fields: string[],
  apiKey: string,
  send: (data: object) => void
): Promise<ProviderBenchmarkResult> {
  const apollo = new ApolloAdapter(apiKey);
  const BATCH_SIZE = 25;
  let matched = 0;
  const fieldMatches: Record<string, number> = {};

  for (let i = 0; i < companies.length; i += BATCH_SIZE) {
    const batch = companies.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(
      batch.map(async (company) => {
        const domain = company.properties.domain;
        if (!domain) return null;
        try {
          return await apollo.enrichCompany({ domain });
        } catch {
          return null;
        }
      })
    );

    // Count matches
    for (let j = 0; j < results.length; j++) {
      const result = results[j];
      if (result) {
        let hasMatch = false;
        for (const field of fields) {
          // Map common field names to Apollo response structure
          const apolloField = mapFieldToApollo(field);
          const value = result.fields?.[apolloField] || (result.normalized as any)?.[apolloField];
          if (value) {
            fieldMatches[field] = (fieldMatches[field] || 0) + 1;
            hasMatch = true;
          }
        }
        if (hasMatch) matched++;
      }
    }

    send({
      type: 'progress',
      provider: 'apollo',
      tested: Math.min(i + batch.length, companies.length),
      matched,
      total: companies.length
    });

    // Small delay to avoid rate limits
    if (i + BATCH_SIZE < companies.length) {
      await sleep(50);
    }
  }

  return {
    match_rate: matched / companies.length,
    field_coverage: fieldMatches,
    tested: companies.length,
    matched
  };
}

async function benchmarkGraphIQ(
  companies: HubSpotCompany[],
  fields: string[],
  send: (data: object) => void
): Promise<ProviderBenchmarkResult> {
  const BATCH_SIZE = 10;
  const DELAY_MS = 200;
  let matched = 0;
  const fieldMatches: Record<string, number> = {};

  for (let i = 0; i < companies.length; i += BATCH_SIZE) {
    const batch = companies.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(
      batch.map(async (company) => {
        const domain = company.properties.domain;
        if (!domain) return null;
        try {
          return await enrichWithGraphIQ(domain, fields);
        } catch {
          return null;
        }
      })
    );

    // Count matches
    for (const result of results) {
      if (result) {
        let hasMatch = false;
        for (const field of fields) {
          if (result[field]) {
            fieldMatches[field] = (fieldMatches[field] || 0) + 1;
            hasMatch = true;
          }
        }
        if (hasMatch) matched++;
      }
    }

    send({
      type: 'progress',
      provider: 'refyne',
      tested: Math.min(i + batch.length, companies.length),
      matched,
      total: companies.length
    });

    // Delay between batches
    if (i + BATCH_SIZE < companies.length) {
      await sleep(DELAY_MS);
    }
  }

  return {
    match_rate: matched / companies.length,
    field_coverage: fieldMatches,
    tested: companies.length,
    matched
  };
}

/**
 * Enrich a domain using GraphIQ (Refyne Data)
 */
async function enrichWithGraphIQ(
  domain: string,
  fields: string[]
): Promise<Record<string, unknown> | null> {
  const apiKey = process.env.GRAPHIQ_API_KEY;
  if (!apiKey) return null;

  try {
    const response = await fetch('https://app.graphiq.ai/api/v2/organizations/search', {
      method: 'POST',
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        organization: {
          website: domain,
        },
        limit: 1,
      }),
    });

    if (!response.ok) return null;

    const data = await response.json();
    const entities = data.entities || [];
    if (entities.length === 0) return null;

    const org = entities[0];

    // Map GraphIQ fields to HubSpot fields
    return {
      industry: org.industry || null,
      numberofemployees: org.employee_count || org.employees || null,
      linkedin_company_page: org.linkedin_url || null,
      phone: org.phone || null,
      annualrevenue: org.revenue || null,
      domain: org.website || org.domain || null,
    };
  } catch {
    return null;
  }
}

/**
 * Map HubSpot field names to Apollo response fields
 */
function mapFieldToApollo(hubspotField: string): string {
  const mapping: Record<string, string> = {
    industry: 'industry',
    numberofemployees: 'employee_count',
    linkedin_company_page: 'linkedin_url',
    phone: 'phone',
    annualrevenue: 'revenue_range',
    domain: 'domain',
  };
  return mapping[hubspotField] || hubspotField;
}

function generateRecommendation(
  apollo: ProviderBenchmarkResult | null,
  refyne: ProviderBenchmarkResult,
  distribution: Record<string, number>,
  totalMissing: number,
  sampleSize: number
): BenchmarkRecommendation {
  const topIndustries = Object.entries(distribution)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([industry, count]) => ({ industry, count }));

  const apolloRate = apollo?.match_rate || 0;
  const refyneRate = refyne.match_rate;

  // Calculate waterfall coverage: Apollo first, then Refyne fills gaps
  const combinedCoverage = apolloRate + (refyneRate * (1 - apolloRate));

  const bestProvider = refyneRate > apolloRate ? 'refyne' : 'apollo';
  const bestRate = Math.max(refyneRate, apolloRate);

  let message = '';
  if (apollo) {
    message = `${bestProvider === 'refyne' ? 'Refyne Data' : 'Apollo'} has better coverage (${Math.round(bestRate * 100)}% vs ${Math.round((bestProvider === 'refyne' ? apolloRate : refyneRate) * 100)}%). `;
  } else {
    message = `Refyne Data coverage: ${Math.round(refyneRate * 100)}%. `;
  }

  message += `Using both in waterfall would fill ${Math.round(combinedCoverage * 100)}% of gaps.`;

  // Extrapolate to full database
  const estimatedFills = Math.round(totalMissing * combinedCoverage);

  return {
    best_provider: bestProvider,
    top_industries: topIndustries,
    combined_waterfall_coverage: combinedCoverage,
    apollo_coverage: apolloRate,
    refyne_coverage: refyneRate,
    message: `${message} Estimated ${estimatedFills.toLocaleString()} companies would be enriched.`,
  };
}
