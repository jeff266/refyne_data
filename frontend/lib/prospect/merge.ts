/**
 * Cross-Provider Merge
 *
 * Deduplicate and merge company data from multiple providers.
 */

import { ProspectCompany } from './types';

/**
 * Normalize domain for deduplication.
 * Removes www., protocol, trailing slashes, etc.
 */
function normalizeDomain(domain: string | undefined): string {
  if (!domain) return '';

  return domain
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/$/, '')
    .trim();
}

/**
 * Merge company records from multiple providers.
 *
 * Deduplicates by domain and merges data with provider priority:
 * 1. ZoomInfo (most comprehensive)
 * 2. Apollo (good coverage)
 * 3. Refyne (fallback)
 *
 * For each field, prefer non-null values from higher-priority providers.
 */
export function mergeCompanyRecords(
  companies: ProspectCompany[]
): ProspectCompany[] {
  // Group by normalized domain
  const domainMap = new Map<string, ProspectCompany[]>();

  for (const company of companies) {
    const normalizedDomain = normalizeDomain(company.domain);
    if (!normalizedDomain) continue; // Skip companies without domain

    if (!domainMap.has(normalizedDomain)) {
      domainMap.set(normalizedDomain, []);
    }
    domainMap.get(normalizedDomain)!.push(company);
  }

  // Merge records for each domain
  const merged: ProspectCompany[] = [];

  for (const [domain, records] of Array.from(domainMap.entries())) {
    if (records.length === 1) {
      // No duplicates, use as-is
      merged.push(records[0]);
      continue;
    }

    // Sort by provider priority
    const providerPriority: Record<string, number> = {
      zoominfo: 1,
      apollo: 2,
      refyne: 3,
    };

    records.sort((a, b) => {
      const priorityA = providerPriority[a.provider] || 999;
      const priorityB = providerPriority[b.provider] || 999;
      return priorityA - priorityB;
    });

    // Merge fields, preferring non-null values from higher-priority providers
    const mergedRecord: ProspectCompany = {
      provider: records.map((r) => r.provider).join('+'), // Show all providers
      domain: records[0].domain, // Use original domain from highest-priority provider
      name: records.find((r) => r.name)?.name || '',
      industry: records.find((r) => r.industry)?.industry,
      employee_count: records.find((r) => r.employee_count !== undefined)
        ?.employee_count,
      revenue: records.find((r) => r.revenue !== undefined)?.revenue,
      city: records.find((r) => r.city)?.city,
      state: records.find((r) => r.state)?.state,
      country: records.find((r) => r.country)?.country,
      website: records.find((r) => r.website)?.website,
      linkedin_url: records.find((r) => r.linkedin_url)?.linkedin_url,
      description: records.find((r) => r.description)?.description,
      founded_year: records.find((r) => r.founded_year !== undefined)
        ?.founded_year,
      technologies: Array.from(
        new Set(
          records
            .flatMap((r) => r.technologies || [])
            .filter((t): t is string => !!t)
        )
      ),
      raw: {
        // Merge all raw responses
        merged_from: records.map((r) => ({
          provider: r.provider,
          raw: r.raw,
        })),
      },
    };

    merged.push(mergedRecord);
  }

  return merged;
}
