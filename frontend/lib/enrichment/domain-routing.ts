/**
 * Domain-Skip Routing Logic
 *
 * Validates company signals (domain, name, location) and determines
 * which providers can enrich a given record.
 *
 * Security: Domain field is user-controlled, so validation is required
 * before use in any HTTP requests or provider calls.
 */

export interface HubSpotCompany {
  id: string;
  properties: {
    domain?: string | null;
    website?: string | null;
    hs_additional_domains?: string | null;
    name?: string | null;
    city?: string | null;
    state?: string | null;
    country?: string | null;
    [key: string]: any;
  };
}

/**
 * Domain validation regex
 * Matches valid domain format: example.com, subdomain.example.com
 * Does NOT match: http://example.com, example, localhost
 */
const DOMAIN_REGEX =
  /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$/i;

/**
 * Clean domain value by removing protocol, path, and whitespace
 */
export function cleanDomain(raw: string): string | null {
  if (!raw) return null;

  let cleaned = raw.trim().toLowerCase();

  // Remove protocol
  cleaned = cleaned.replace(/^https?:\/\//, '');
  cleaned = cleaned.replace(/^www\./, '');

  // Remove path and query string
  cleaned = cleaned.split('/')[0];
  cleaned = cleaned.split('?')[0];

  // Remove trailing dot
  cleaned = cleaned.replace(/\.$/, '');

  if (cleaned.length === 0) return null;

  return cleaned;
}

/**
 * Check if company has a valid domain
 *
 * Checks domain, website, and hs_additional_domains in priority order.
 * Applies regex validation to prevent injection attacks.
 *
 * Priority:
 * 1. domain (already clean)
 * 2. website (needs cleaning - has https://, paths, etc.)
 * 3. hs_additional_domains (alternate domains, needs cleaning)
 *
 * Security: Treats null, undefined, and empty string as "no domain"
 */
export function hasDomain(company: HubSpotCompany): boolean {
  // Try domain first (already clean)
  const domain = company.properties?.domain;
  if (domain && domain.trim() !== '') {
    const cleaned = cleanDomain(domain);
    if (cleaned && DOMAIN_REGEX.test(cleaned)) return true;
  }

  // Fall back to website (needs cleaning)
  const website = company.properties?.website;
  if (website && website.trim() !== '') {
    const cleaned = cleanDomain(website);
    if (cleaned && DOMAIN_REGEX.test(cleaned)) return true;
  }

  // Fall back to hs_additional_domains (may be comma-separated)
  const additionalDomains = company.properties?.hs_additional_domains;
  if (additionalDomains && additionalDomains.trim() !== '') {
    // Split by comma if multiple domains
    const domains = additionalDomains.split(',').map(d => d.trim());
    for (const d of domains) {
      const cleaned = cleanDomain(d);
      if (cleaned && DOMAIN_REGEX.test(cleaned)) return true;
    }
  }

  return false;
}

/**
 * Get cleaned domain value from company record
 *
 * Priority:
 * 1. domain (already clean - just "example.com")
 * 2. website (needs cleaning - has "https://example.com/home/")
 * 3. hs_additional_domains (alternate domains, may be comma-separated)
 *
 * Returns null if no valid domain found.
 */
export function getDomain(company: HubSpotCompany): string | null {
  // Try domain first (already clean)
  const domain = company.properties?.domain;
  if (domain && domain.trim() !== '') {
    const cleaned = cleanDomain(domain);
    if (cleaned && DOMAIN_REGEX.test(cleaned)) return cleaned;
  }

  // Fall back to website (needs cleaning)
  const website = company.properties?.website;
  if (website && website.trim() !== '') {
    const cleaned = cleanDomain(website);
    if (cleaned && DOMAIN_REGEX.test(cleaned)) return cleaned;
  }

  // Fall back to hs_additional_domains (first valid domain wins)
  const additionalDomains = company.properties?.hs_additional_domains;
  if (additionalDomains && additionalDomains.trim() !== '') {
    // Split by comma if multiple domains
    const domains = additionalDomains.split(',').map(d => d.trim());
    for (const d of domains) {
      const cleaned = cleanDomain(d);
      if (cleaned && DOMAIN_REGEX.test(cleaned)) return cleaned;
    }
  }

  return null;
}

/**
 * Check if company has a name
 */
export function hasName(company: HubSpotCompany): boolean {
  const name = company.properties?.name;
  return !!(name && name.trim().length > 0);
}

/**
 * Get company name
 */
export function getName(company: HubSpotCompany): string | null {
  const name = company.properties?.name;
  if (!name || name.trim().length === 0) return null;
  return name.trim();
}

/**
 * Check if company has location information
 *
 * Returns true if city, state, OR country is present.
 */
export function hasLocation(company: HubSpotCompany): boolean {
  const city = company.properties?.city;
  const state = company.properties?.state;
  const country = company.properties?.country;

  return !!(
    (city && city.trim().length > 0) ||
    (state && state.trim().length > 0) ||
    (country && country.trim().length > 0)
  );
}

/**
 * Get location string for provider enrichment
 *
 * Returns format: "City, State, Country" with available components
 */
export function getLocation(company: HubSpotCompany): string | null {
  const city = company.properties?.city?.trim();
  const state = company.properties?.state?.trim();
  const country = company.properties?.country?.trim();

  const parts: string[] = [];
  if (city) parts.push(city);
  if (state) parts.push(state);
  if (country) parts.push(country);

  if (parts.length === 0) return null;

  return parts.join(', ');
}

/**
 * Determine if a company record has sufficient signals for enrichment
 *
 * Minimal requirement: name OR domain
 */
export function hasMinimalSignals(company: HubSpotCompany): boolean {
  return hasName(company) || hasDomain(company);
}

/**
 * Get enrichment routing recommendation
 *
 * Returns which provider type is best for this company:
 * - 'domain-based': Apollo, GraphIQ, Clearbit, ZoomInfo (have domain)
 * - 'name-based': Serper+Haiku (no domain, has name + location)
 * - 'insufficient': Cannot enrich (no name, no domain)
 */
export function getRoutingRecommendation(company: HubSpotCompany): {
  type: 'domain-based' | 'name-based' | 'insufficient';
  reason: string;
} {
  const hasValidDomain = hasDomain(company);
  const hasValidName = hasName(company);
  const hasValidLocation = hasLocation(company);

  if (hasValidDomain) {
    return {
      type: 'domain-based',
      reason: 'Company has valid domain - use Apollo, GraphIQ, or ZoomInfo',
    };
  }

  if (hasValidName && hasValidLocation) {
    return {
      type: 'name-based',
      reason:
        'Company has name and location but no domain - use Serper+Haiku',
    };
  }

  if (hasValidName) {
    return {
      type: 'name-based',
      reason:
        'Company has name only - use Serper+Haiku (best effort without location)',
    };
  }

  return {
    type: 'insufficient',
    reason: 'Company has no name and no domain - cannot enrich',
  };
}
