/**
 * Matcher - Import Contact Matching Engine
 *
 * Matches CSV contacts against HubSpot contacts/companies using:
 * - Email exact match
 * - LinkedIn URL match
 * - Company fuzzy match (Jaro-Winkler)
 *
 * Also handles company grouping and owner assignment.
 */

import { normalizeCompanyName, extractEmailDomain } from './name-cleaner';

// Match result types
export type MatchType = 'email' | 'linkedin' | 'company_fuzzy' | 'none';

export type Bucket =
  | 'customer'
  | 'open_deal'
  | 'former_customer'
  | 'known_contact'
  | 'new_contact'
  | 'needs_review';

export interface MatchResult {
  matchType: MatchType;
  confidence: number; // 0.0 - 1.0
  hubspotContactId: string | null;
  hubspotCompanyId: string | null;
  bucket: Bucket;
  reviewReason: string | null;
}

export interface ParsedRow {
  email: string;
  linkedin_url?: string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
  job_title?: string;
  company?: string;
  location?: string;
}

export interface HubSpotContact {
  id: string;
  properties: {
    email?: string | null;
    linkedin_url?: string | null;
    lifecyclestage?: string | null;
    hs_lead_status?: string | null;
    num_associated_deals?: string | null;
    recent_deal_close_date?: string | null;
    jobtitle?: string | null;
  };
}

export interface HubSpotCompany {
  id: string;
  properties: {
    name?: string | null;
    domain?: string | null;
  };
}

/**
 * Jaro-Winkler string similarity algorithm
 * Returns score between 0.0 (no match) and 1.0 (exact match)
 *
 * Based on Jaro distance with prefix bonus for strings that match at the beginning.
 */
export function jaroWinkler(a: string, b: string): number {
  if (!a || !b) return 0.0;
  if (a === b) return 1.0;

  const s1 = a.toLowerCase();
  const s2 = b.toLowerCase();

  // Maximum allowed distance for matching characters
  const matchWindow = Math.floor(Math.max(s1.length, s2.length) / 2) - 1;
  if (matchWindow < 0) return 0.0;

  const s1Matches = new Array(s1.length).fill(false);
  const s2Matches = new Array(s2.length).fill(false);

  let matches = 0;
  let transpositions = 0;

  // Find matches
  for (let i = 0; i < s1.length; i++) {
    const start = Math.max(0, i - matchWindow);
    const end = Math.min(i + matchWindow + 1, s2.length);

    for (let j = start; j < end; j++) {
      if (s2Matches[j]) continue;
      if (s1[i] !== s2[j]) continue;
      s1Matches[i] = true;
      s2Matches[j] = true;
      matches++;
      break;
    }
  }

  if (matches === 0) return 0.0;

  // Count transpositions
  let k = 0;
  for (let i = 0; i < s1.length; i++) {
    if (!s1Matches[i]) continue;
    while (!s2Matches[k]) k++;
    if (s1[i] !== s2[k]) transpositions++;
    k++;
  }

  // Jaro similarity
  const jaro =
    (matches / s1.length + matches / s2.length + (matches - transpositions / 2) / matches) / 3;

  // Winkler prefix bonus (up to 4 characters)
  let prefixLength = 0;
  for (let i = 0; i < Math.min(s1.length, s2.length, 4); i++) {
    if (s1[i] === s2[i]) {
      prefixLength++;
    } else {
      break;
    }
  }

  const prefixScale = 0.1; // Standard Winkler scaling factor
  const jaroWinklerScore = jaro + prefixLength * prefixScale * (1 - jaro);

  return Math.min(jaroWinklerScore, 1.0);
}

/**
 * Get blocking candidates for fuzzy matching
 * Pre-filters HubSpot companies to reduce comparison count
 *
 * Returns companies that share:
 * - Same email domain, OR
 * - First 3 characters of normalized name
 *
 * Max 50 candidates returned.
 */
export function getBlockingCandidates(
  normalizedName: string,
  emailDomain: string,
  hubspotCompanies: HubSpotCompany[]
): HubSpotCompany[] {
  const candidates: HubSpotCompany[] = [];

  const prefix = normalizedName.slice(0, 3).toLowerCase();

  for (const company of hubspotCompanies) {
    // Check domain match
    if (emailDomain && company.properties.domain) {
      const companyDomain = extractEmailDomain(`user@${company.properties.domain}`);
      if (companyDomain === emailDomain) {
        candidates.push(company);
        continue;
      }
    }

    // Check name prefix match
    if (company.properties.name) {
      const companyNormalized = normalizeCompanyName(company.properties.name);
      const companyPrefix = companyNormalized.slice(0, 3).toLowerCase();
      if (companyPrefix === prefix) {
        candidates.push(company);
      }
    }

    // Stop at 50 candidates
    if (candidates.length >= 50) break;
  }

  return candidates;
}

/**
 * Match a single contact to HubSpot
 * Runs in sequence: email match → LinkedIn match → company fuzzy match
 *
 * Returns match result with bucket assignment.
 */
export async function matchContact(
  row: ParsedRow,
  hubspotContacts: HubSpotContact[],
  hubspotCompanies: HubSpotCompany[],
  orgId: string
): Promise<MatchResult> {
  // STEP A: Email exact match
  if (row.email) {
    const normalizedEmail = row.email.toLowerCase().trim();
    const emailMatch = hubspotContacts.find(
      (c) => c.properties.email?.toLowerCase().trim() === normalizedEmail
    );

    if (emailMatch) {
      const bucket = await determineBucket(emailMatch, row);
      return {
        matchType: 'email',
        confidence: 1.0,
        hubspotContactId: emailMatch.id,
        hubspotCompanyId: null,
        bucket,
        reviewReason: null,
      };
    }
  }

  // STEP B: LinkedIn URL match
  if (row.linkedin_url) {
    const normalizedLinkedIn = normalizeLinkedInUrl(row.linkedin_url);
    if (normalizedLinkedIn) {
      const linkedInMatch = hubspotContacts.find((c) => {
        if (!c.properties.linkedin_url) return false;
        const hubspotLinkedIn = normalizeLinkedInUrl(c.properties.linkedin_url);
        return hubspotLinkedIn === normalizedLinkedIn;
      });

      if (linkedInMatch) {
        const bucket = await determineBucket(linkedInMatch, row);
        return {
          matchType: 'linkedin',
          confidence: 0.95,
          hubspotContactId: linkedInMatch.id,
          hubspotCompanyId: null,
          bucket,
          reviewReason: null,
        };
      }
    }
  }

  // STEP C: Company fuzzy match (for context only, not contact identity)
  if (row.company && row.email) {
    const normalizedName = normalizeCompanyName(row.company);
    const emailDomain = extractEmailDomain(row.email);

    const candidates = getBlockingCandidates(normalizedName, emailDomain, hubspotCompanies);

    let bestMatch: HubSpotCompany | null = null;
    let bestScore = 0.0;

    for (const candidate of candidates) {
      if (!candidate.properties.name) continue;

      const candidateNormalized = normalizeCompanyName(candidate.properties.name);
      const score = jaroWinkler(normalizedName, candidateNormalized);

      if (score > bestScore) {
        bestScore = score;
        bestMatch = candidate;
      }
    }

    // Check for outlier: domain matches but name differs significantly
    if (bestMatch && emailDomain) {
      const bestDomain = bestMatch.properties.domain
        ? extractEmailDomain(`user@${bestMatch.properties.domain}`)
        : '';

      if (bestDomain === emailDomain && bestScore < 0.7) {
        return {
          matchType: 'company_fuzzy',
          confidence: bestScore,
          hubspotContactId: null,
          hubspotCompanyId: bestMatch.id,
          bucket: 'needs_review',
          reviewReason: 'Domain matches but company name differs significantly',
        };
      }
    }

    // High confidence company match
    if (bestScore >= 0.9) {
      return {
        matchType: 'company_fuzzy',
        confidence: bestScore,
        hubspotContactId: null,
        hubspotCompanyId: bestMatch?.id || null,
        bucket: 'new_contact',
        reviewReason: null,
      };
    }

    // Partial match - needs review
    if (bestScore >= 0.75) {
      return {
        matchType: 'company_fuzzy',
        confidence: bestScore,
        hubspotContactId: null,
        hubspotCompanyId: bestMatch?.id || null,
        bucket: 'needs_review',
        reviewReason: 'Company name partial match - verify before importing',
      };
    }
  }

  // STEP D: No match found
  return {
    matchType: 'none',
    confidence: 0.0,
    hubspotContactId: null,
    hubspotCompanyId: null,
    bucket: 'new_contact',
    reviewReason: null,
  };
}

/**
 * Determine bucket for a matched contact
 * Based on lifecyclestage and deal associations
 */
async function determineBucket(contact: HubSpotContact, row: ParsedRow): Promise<Bucket> {
  const props = contact.properties;

  // Customer
  if (props.lifecyclestage === 'customer') {
    return 'customer';
  }

  // Open deal (not closedwon or closedlost)
  // Note: Would need to query deals API for full implementation
  // For now, approximate based on num_associated_deals
  // if (props.num_associated_deals && parseInt(props.num_associated_deals) > 0) {
  //   return 'open_deal';
  // }

  // Former customer
  if (props.lifecyclestage === 'other' || props.lifecyclestage === 'evangelist') {
    return 'former_customer';
  }

  // Check for ambiguous title
  const ambiguousTitles = /^(Member|Expert|Advisor|Consultant|Principal)$/i;
  if (row.job_title && ambiguousTitles.test(row.job_title.trim())) {
    return 'needs_review';
  }

  // Known contact (matched but not in special categories)
  return 'known_contact';
}

/**
 * Normalize LinkedIn URL to slug for comparison
 * Example: "https://www.linkedin.com/in/john-smith/" → "john-smith"
 */
function normalizeLinkedInUrl(url: string): string | null {
  if (!url) return null;

  try {
    const lower = url.toLowerCase().trim();

    // Extract slug from various LinkedIn URL formats
    const match = lower.match(/linkedin\.com\/in\/([a-z0-9-]+)/);
    if (match && match[1]) {
      return match[1].replace(/\/$/, ''); // Remove trailing slash
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Group contacts by company for owner assignment
 * Priority:
 * 1. Group by email domain
 * 2. Group by normalized company name
 * 3. Jaro-Winkler ≥ 0.92 on normalized name (flagged for review)
 *
 * Returns Map<companyKey, ParsedRow[]>
 */
export function groupByCompany(rows: ParsedRow[]): Map<string, ParsedRow[]> {
  const groups = new Map<string, ParsedRow[]>();

  for (const row of rows) {
    let groupKey: string | null = null;

    // Priority 1: Email domain
    if (row.email) {
      const domain = extractEmailDomain(row.email);
      if (domain) {
        groupKey = `domain:${domain}`;
      }
    }

    // Priority 2: Normalized company name
    if (!groupKey && row.company) {
      const normalized = normalizeCompanyName(row.company);
      if (normalized) {
        groupKey = `name:${normalized}`;
      }
    }

    // Priority 3: Fuzzy grouping (check if similar to existing groups)
    if (!groupKey && row.company) {
      const normalized = normalizeCompanyName(row.company);
      for (const [existingKey, existingRows] of Array.from(groups.entries())) {
        if (existingKey.startsWith('name:')) {
          const existingName = existingKey.slice(5); // Remove 'name:' prefix
          const score = jaroWinkler(normalized, existingName);
          if (score >= 0.92) {
            groupKey = existingKey;
            break;
          }
        }
      }

      // If no fuzzy match, create new group
      if (!groupKey) {
        groupKey = `name:${normalized}`;
      }
    }

    // Fallback: Individual group per contact
    if (!groupKey) {
      groupKey = `individual:${row.email || Math.random()}`;
    }

    // Add to group
    if (!groups.has(groupKey)) {
      groups.set(groupKey, []);
    }
    groups.get(groupKey)!.push(row);
  }

  return groups;
}

/**
 * Assign owners to company groups using weighted round-robin
 * Largest companies assigned first (greedy algorithm)
 * Never splits a company across owners
 *
 * Returns Map<companyKey, ownerId>
 */
export function assignOwners(
  companyGroups: Map<string, ParsedRow[]>,
  owners: Array<{ id: string; weight: number }>
): Map<string, string> {
  const assignments = new Map<string, string>();

  // Normalize weights to sum to 1.0
  const totalWeight = owners.reduce((sum, o) => sum + o.weight, 0);
  const normalizedOwners = owners.map((o) => ({
    id: o.id,
    weight: o.weight / totalWeight,
    assignedCount: 0,
  }));

  // Sort company groups by size (largest first)
  const sortedGroups = Array.from(companyGroups.entries()).sort(
    ([, a], [, b]) => b.length - a.length
  );

  // Assign companies to owners using greedy algorithm
  const totalContacts = Array.from(companyGroups.values()).reduce((sum, rows) => sum + rows.length, 0);

  for (const [companyKey, rows] of sortedGroups) {
    // Find owner furthest below their target allocation
    let bestOwner = normalizedOwners[0];
    let maxDeficit = -Infinity;

    for (const owner of normalizedOwners) {
      const targetCount = owner.weight * totalContacts;
      const deficit = targetCount - owner.assignedCount;

      if (deficit > maxDeficit) {
        maxDeficit = deficit;
        bestOwner = owner;
      }
    }

    // Assign this company to the best owner
    assignments.set(companyKey, bestOwner.id);
    bestOwner.assignedCount += rows.length;
  }

  return assignments;
}
