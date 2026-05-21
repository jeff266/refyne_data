/**
 * Prospect Search Orchestrator
 *
 * Coordinates multi-provider search, merge, CRM check, and ICP scoring.
 */

import {
  searchCompaniesApollo,
  searchCompaniesZoomInfo,
  searchCompaniesRefyne,
} from './providers';
import { mergeCompanyRecords } from './merge';
import { scoreCompanyICP } from './icp-scorer';
import {
  ProspectSearchQuery,
  ProspectSearchResult,
  ICPConfig,
  ProviderSearchResponse,
} from './types';

/**
 * Check CRM status for companies.
 * Returns a map of domain -> HubSpot company data.
 */
async function checkCRMStatus(
  orgId: string,
  domains: string[]
): Promise<
  Map<
    string,
    {
      in_crm: boolean;
      hubspot_company_id?: string;
      hubspot_url?: string;
    }
  >
> {
  const statusMap = new Map();

  try {
    // Call HubSpot search API to check if companies exist
    const response = await fetch('/api/hubspot/companies/batch-check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domains }),
    });

    if (!response.ok) {
      console.error('Failed to check CRM status:', response.statusText);
      // Return empty map on error, don't block search
      return statusMap;
    }

    const data = await response.json();

    // Map results by domain
    for (const result of data.results || []) {
      statusMap.set(result.domain, {
        in_crm: result.exists,
        hubspot_company_id: result.company_id,
        hubspot_url: result.hubspot_url,
      });
    }
  } catch (error) {
    console.error('Error checking CRM status:', error);
    // Don't block search on CRM check failure
  }

  // Fill in missing domains with false
  for (const domain of domains) {
    if (!statusMap.has(domain)) {
      statusMap.set(domain, { in_crm: false });
    }
  }

  return statusMap;
}

/**
 * Search for prospect companies across multiple providers.
 *
 * @param orgId - Organization ID (for CRM status check)
 * @param query - Search query with filters
 * @param icpConfig - Optional ICP scoring configuration
 * @returns Search results with CRM status and ICP scores
 */
export async function searchProspects(
  orgId: string,
  query: ProspectSearchQuery,
  icpConfig?: ICPConfig
): Promise<{
  results: ProspectSearchResult[];
  provider_stats: {
    [provider: string]: {
      count: number;
      query_time_ms: number;
      error?: string;
    };
  };
  total_before_dedup: number;
  total_after_dedup: number;
}> {
  const enabledProviders = query.providers || ['apollo', 'zoominfo'];

  // Query all providers in parallel
  const providerQueries: Promise<ProviderSearchResponse>[] = [];

  if (enabledProviders.includes('apollo')) {
    providerQueries.push(searchCompaniesApollo(query, orgId));
  }

  if (enabledProviders.includes('zoominfo')) {
    providerQueries.push(searchCompaniesZoomInfo(query));
  }

  if (enabledProviders.includes('refyne')) {
    providerQueries.push(searchCompaniesRefyne(query));
  }

  // Wait for all providers to respond
  const providerResponses = await Promise.all(providerQueries);

  // Build provider stats
  const providerStats: Record<
    string,
    { count: number; query_time_ms: number; error?: string }
  > = {};

  for (const response of providerResponses) {
    providerStats[response.provider] = {
      count: response.companies.length,
      query_time_ms: response.query_time_ms,
      error: response.error,
    };
  }

  // Merge all companies
  const allCompanies = providerResponses.flatMap(
    (response) => response.companies
  );
  const totalBeforeDedup = allCompanies.length;

  const mergedCompanies = mergeCompanyRecords(allCompanies);
  const totalAfterDedup = mergedCompanies.length;

  // Check CRM status for all merged companies
  const domains = mergedCompanies
    .map((c) => c.domain)
    .filter((d): d is string => !!d);
  const crmStatusMap = await checkCRMStatus(orgId, domains);

  // Score against ICP and enrich results
  const results: ProspectSearchResult[] = mergedCompanies.map((company) => {
    const crmStatus = crmStatusMap.get(company.domain) || { in_crm: false };

    let icpScore: number | undefined;
    let icpBreakdown;

    if (icpConfig) {
      const scoring = scoreCompanyICP(company, icpConfig);
      icpScore = scoring.score;
      icpBreakdown = {
        industry_match: scoring.breakdown.industry_match,
        size_match: scoring.breakdown.size_match,
        location_match: scoring.breakdown.location_match,
        technology_match: scoring.breakdown.technology_match,
        total_score: scoring.score,
      };
    }

    return {
      ...company,
      icp_score: icpScore,
      icp_breakdown: icpBreakdown,
      in_crm: crmStatus.in_crm,
      hubspot_company_id: crmStatus.hubspot_company_id,
      hubspot_url: crmStatus.hubspot_url,
    };
  });

  // Sort by ICP score (descending) if scoring was performed
  if (icpConfig) {
    results.sort((a, b) => (b.icp_score || 0) - (a.icp_score || 0));
  }

  return {
    results,
    provider_stats: providerStats,
    total_before_dedup: totalBeforeDedup,
    total_after_dedup: totalAfterDedup,
  };
}
