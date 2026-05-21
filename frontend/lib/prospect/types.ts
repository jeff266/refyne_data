/**
 * Prospect Types
 *
 * Types for company discovery and ICP scoring.
 */

// ─────────────────────────────────────────────────────────────
// Search Query Types
// ─────────────────────────────────────────────────────────────

export interface ProspectSearchQuery {
  /** Industries to filter by */
  industries?: string[];
  /** Employee count range */
  employeeMin?: number;
  employeeMax?: number;
  /** Revenue range (in USD) */
  revenueMin?: number;
  revenueMax?: number;
  /** Location filters (deprecated - use locations array) */
  location?: {
    city?: string;
    state?: string;
    country?: string;
  };
  /** Locations as chip array */
  locations?: string[];
  /** Keywords to search for */
  keywords?: string[];
  /** Technologies used (if provider supports) */
  technologies?: string[];
  /** Max results per provider */
  limit?: number;
  /** Providers to query */
  providers?: Array<'apollo' | 'zoominfo' | 'refyne'>;
}

// ─────────────────────────────────────────────────────────────
// Company Result Types
// ─────────────────────────────────────────────────────────────

/**
 * Standardized company result from prospect search.
 */
export interface ProspectCompany {
  /** Provider that returned this company */
  provider: string;
  /** Company domain (primary identifier for dedup) */
  domain: string;
  /** Company name */
  name: string;
  /** Industry/sector */
  industry?: string;
  /** Employee count */
  employee_count?: number;
  /** Annual revenue (USD) */
  revenue?: number;
  /** Location */
  city?: string;
  state?: string;
  country?: string;
  /** Company website */
  website?: string;
  /** LinkedIn URL */
  linkedin_url?: string;
  /** Company description */
  description?: string;
  /** Founded year */
  founded_year?: number;
  /** Technologies used */
  technologies?: string[];
  /** Raw provider response */
  raw: Record<string, unknown>;
}

/**
 * Search result with CRM status and ICP score.
 */
export interface ProspectSearchResult extends ProspectCompany {
  /** ICP score (0-100) */
  icp_score?: number;
  /** ICP score breakdown */
  icp_breakdown?: {
    industry_match: number;
    size_match: number;
    location_match: number;
    technology_match: number;
    total_score: number;
  };
  /** Whether company exists in HubSpot */
  in_crm: boolean;
  /** HubSpot company ID if exists */
  hubspot_company_id?: string;
  /** HubSpot record URL */
  hubspot_url?: string;
}

// ─────────────────────────────────────────────────────────────
// Provider Query Response
// ─────────────────────────────────────────────────────────────

/**
 * Response from a provider search query.
 */
export interface ProviderSearchResponse {
  provider: string;
  companies: ProspectCompany[];
  total_results: number;
  query_time_ms: number;
  error?: string;
}

// ─────────────────────────────────────────────────────────────
// ICP Configuration
// ─────────────────────────────────────────────────────────────

/**
 * ICP scoring configuration.
 */
export interface ICPConfig {
  /** Target industries (exact match or contains) */
  target_industries?: string[];
  /** Target employee range */
  target_employee_min?: number;
  target_employee_max?: number;
  /** Target revenue range */
  target_revenue_min?: number;
  target_revenue_max?: number;
  /** Target locations */
  target_locations?: {
    cities?: string[];
    states?: string[];
    countries?: string[];
  };
  /** Target technologies */
  target_technologies?: string[];
  /** Scoring weights (must sum to 1.0) */
  weights?: {
    industry: number;
    size: number;
    location: number;
    technology: number;
  };
}
