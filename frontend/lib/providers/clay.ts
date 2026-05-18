/**
 * Clay Provider Adapter
 *
 * Claygent AI-generated intelligence briefs via Clay's webhook API.
 * Generates contextual company briefs using AI analysis.
 *
 * API Docs: https://docs.clay.com/
 */

import {
  ProviderAdapter,
  ProviderResponse,
  CompanyQuery,
  ProviderError,
  createProviderResponse,
  ClaygentBrief,
} from './types';

const CLAY_BASE_URL = 'https://api.clay.com/v3/sources/webhook';

/**
 * Get Clay API key from environment.
 */
function getApiKey(): string {
  const key = process.env.CLAY_API_KEY;
  if (!key) {
    throw new ProviderError('clay', 'config_error', 'CLAY_API_KEY not configured');
  }
  return key;
}

/**
 * Get optional Clay webhook URL for Claygent tables.
 */
function getWebhookUrl(): string | undefined {
  return process.env.CLAY_WEBHOOK_URL;
}

/**
 * Generate a mock Claygent brief for demo purposes.
 * Replace with actual Clay API integration in production.
 */
function generateMockBrief(companyName: string, domain?: string): ClaygentBrief {
  return {
    status: 'complete',
    company_name: companyName,
    domain: domain || 'unknown',
    brief: {
      summary: `AI-generated intelligence brief for ${companyName}. In production, this would contain Claygent's analysis.`,
      recent_news: [
        'Recent funding, product launches, or leadership changes would appear here.',
      ],
      competitive_positioning: 'Analysis of market position and competitive landscape.',
      potential_pain_points: [
        'Scaling challenges identified from public information',
        'Technology modernization needs',
        'Market expansion opportunities',
      ],
      recommended_approach: 'Personalized outreach strategy based on company context.',
    },
    note: 'This is a mock response. Configure CLAY_WEBHOOK_URL to connect to your Claygent table.',
  };
}

/**
 * Trigger a Claygent run to generate an AI intelligence brief.
 */
async function generateClaygentBrief(
  companyName: string,
  domain?: string,
  webhookUrl?: string
): Promise<ClaygentBrief> {
  // Verify API key is configured
  getApiKey();

  const payload: Record<string, string> = {
    company_name: companyName,
  };

  if (domain) {
    payload.domain = domain;
  }

  // If a specific webhook URL is provided, use it to trigger Claygent
  const targetUrl = webhookUrl || getWebhookUrl();

  if (targetUrl) {
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new ProviderError(
        'clay',
        'api_error',
        `Webhook request failed: ${response.statusText}`,
        response.status
      );
    }

    const data = await response.json();
    return {
      status: 'triggered',
      company_name: companyName,
      domain,
      ...data,
    };
  }

  // If no webhook URL, return mock brief for demo
  return generateMockBrief(companyName, domain);
}

/**
 * Check the status of a Claygent run.
 * Placeholder for async status checking in production.
 */
export function checkClaygentStatus(runId: string): { status: string; run_id: string } {
  return {
    status: 'complete',
    run_id: runId,
  };
}

/**
 * Clay Provider Adapter
 *
 * Generates AI intelligence briefs using Claygent.
 */
export class ClayAdapter implements ProviderAdapter {
  id = 'clay';
  name = 'Clay';

  /**
   * Enrich a company by generating a Claygent AI brief.
   */
  async enrichCompany(query: CompanyQuery): Promise<ProviderResponse | null> {
    if (!query.name && !query.domain) {
      throw new ProviderError('clay', 'api_error', 'Must provide either domain or name');
    }

    const companyName = query.name || query.domain || '';
    const brief = await generateClaygentBrief(companyName, query.domain);

    return createProviderResponse(
      this.id,
      brief as unknown as Record<string, unknown>,
      {
        company_name: brief.company_name,
        domain: brief.domain,
        summary: brief.brief?.summary,
        recent_news: brief.brief?.recent_news,
        competitive_positioning: brief.brief?.competitive_positioning,
        potential_pain_points: brief.brief?.potential_pain_points,
        recommended_approach: brief.brief?.recommended_approach,
        status: brief.status,
      }
    );
  }
}

export default ClayAdapter;
