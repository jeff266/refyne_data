/**
 * Stratified Sampling for Provider Benchmarks
 *
 * Fetches companies missing specified fields and samples proportionally by industry
 * to ensure representative benchmark results across different segments.
 */

import { HubSpotClient } from '@/lib/hubspot/client';
import type { HubSpotCompany } from '@/lib/hubspot/types';

interface CompanyGroup {
  industry: string;
  companies: HubSpotCompany[];
}

/**
 * Fetch companies missing specified fields, grouped by industry
 */
async function fetchCompaniesMissingFields(
  hubspot: HubSpotClient,
  fields: string[]
): Promise<HubSpotCompany[]> {
  // Use HubSpot Search API with NOT_HAS_PROPERTY filter (OR logic)
  const filterGroups = fields.map(field => ({
    filters: [{
      propertyName: field,
      operator: 'NOT_HAS_PROPERTY'
    }]
  }));

  const companies: HubSpotCompany[] = [];
  let after: string | undefined;

  do {
    const response = await hubspot.request<{
      results: Array<{
        id: string;
        properties: Record<string, string | null>;
        createdAt: string;
        updatedAt: string;
      }>;
      paging?: { next?: { after: string } };
    }>('/crm/v3/objects/companies/search', {
      method: 'POST',
      body: JSON.stringify({
        filterGroups,
        properties: ['name', 'domain', 'industry', ...fields],
        limit: 100,
        after,
      })
    }, true); // isSearchApi = true

    companies.push(...response.results.map(r => ({
      id: r.id,
      properties: r.properties,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    })));

    after = response.paging?.next?.after;
  } while (after && companies.length < 10000); // Safety limit

  return companies;
}

/**
 * Group companies by industry
 */
function groupByIndustry(companies: HubSpotCompany[]): CompanyGroup[] {
  const groups = new Map<string, HubSpotCompany[]>();

  for (const company of companies) {
    const industry = company.properties.industry || '(no industry)';
    if (!groups.has(industry)) {
      groups.set(industry, []);
    }
    groups.get(industry)!.push(company);
  }

  return Array.from(groups.entries()).map(([industry, companies]) => ({
    industry,
    companies
  }));
}

/**
 * Sample proportionally from each industry group
 */
function proportionalSample(
  groups: CompanyGroup[],
  totalSampleSize: number
): HubSpotCompany[] {
  const totalCompanies = groups.reduce((sum, g) => sum + g.companies.length, 0);
  const sample: HubSpotCompany[] = [];

  for (const group of groups) {
    const proportion = group.companies.length / totalCompanies;
    const groupSampleSize = Math.max(1, Math.round(totalSampleSize * proportion));

    // Random sample from this group
    const shuffled = [...group.companies].sort(() => Math.random() - 0.5);
    sample.push(...shuffled.slice(0, Math.min(groupSampleSize, group.companies.length)));
  }

  // If under target due to rounding, fill remaining from largest groups
  while (sample.length < totalSampleSize) {
    const largestGroup = groups.sort((a, b) => b.companies.length - a.companies.length)[0];
    const unused = largestGroup.companies.filter(c => !sample.includes(c));
    if (unused.length === 0) break;
    sample.push(unused[0]);
  }

  return sample.slice(0, totalSampleSize);
}

/**
 * Get stratified sample for benchmark
 */
export async function getStratifiedSample(
  hubspot: HubSpotClient,
  sampleSize: number,
  fields: string[]
): Promise<{ sample: HubSpotCompany[], distribution: Record<string, number>, totalMissing: number }> {
  const allMissing = await fetchCompaniesMissingFields(hubspot, fields);
  const groups = groupByIndustry(allMissing);
  const sample = proportionalSample(groups, Math.min(sampleSize, allMissing.length));

  // Calculate distribution for UI display
  const distribution: Record<string, number> = {};
  for (const company of sample) {
    const industry = company.properties.industry || '(no industry)';
    distribution[industry] = (distribution[industry] || 0) + 1;
  }

  return { sample, distribution, totalMissing: allMissing.length };
}
