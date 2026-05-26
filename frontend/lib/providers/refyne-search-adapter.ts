/**
 * Refyne Search Provider Adapter
 *
 * Web search + AI extraction enrichment using Serper + DeepSeek.
 * Built-in caching with confidence scoring.
 */

import {
  ProviderAdapter,
  ProviderResponse,
  CompanyQuery,
  ProviderError,
  createProviderResponse,
} from './types';
import { refyneSearch, RefyneSearchResult } from './refyne-search';

export class RefyneSearchAdapter implements ProviderAdapter {
  id = 'refyne';
  name = 'Refyne Search';

  constructor(private orgId: string) {}

  async enrichCompany(query: CompanyQuery): Promise<ProviderResponse | null> {
    const { domain, name } = query;

    if (!domain && !name) {
      throw new ProviderError(
        'refyne',
        'config_error',
        'Either domain or company name required'
      );
    }

    // Define fields to enrich (configurable later)
    const fieldKeys = ['industry', 'employee_count', 'annualrevenue', 'linkedin_url', 'phone'];

    try {
      const results = await refyneSearch(this.orgId, domain ?? null, name ?? null, fieldKeys);

      // Build raw response with all field results
      const raw: Record<string, any> = {
        domain: domain ?? null,
        company_name: name ?? null,
        fields: results,
      };

      // Build normalized response (for direct mapping to HubSpot fields)
      const normalized: Record<string, any> = {};

      for (const result of results) {
        if (result.value !== null && result.confidence >= 0.4) {
          normalized[result.fieldKey] = result.value;
          normalized[`${result.fieldKey}_confidence`] = result.confidence;
          normalized[`${result.fieldKey}_level`] = result.level;
          normalized[`${result.fieldKey}_evidence`] = result.evidence;
        }
      }

      // If no fields found at all, return null
      if (Object.keys(normalized).length === 0) {
        return null;
      }

      return createProviderResponse('refyne', raw, normalized);
    } catch (error: any) {
      throw new ProviderError(
        'refyne',
        'api_error',
        error?.message || 'Refyne Search failed'
      );
    }
  }

  /**
   * Test connection by running a sample enrichment.
   * Returns success if Serper and DeepSeek APIs are accessible.
   */
  async testConnection(): Promise<{
    success: boolean;
    headers?: Headers;
    error?: string;
  }> {
    try {
      // Test with a known domain
      await refyneSearch(this.orgId, 'anthropic.com', 'Anthropic', ['industry']);
      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        error: error?.message || 'Refyne Search connection test failed',
      };
    }
  }
}
