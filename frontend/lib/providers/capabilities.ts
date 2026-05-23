/**
 * Provider Capability Matrix
 *
 * Defines requirements and capabilities for each enrichment provider.
 * Used for smart routing and domain-skip logic.
 */

import {
  hasDomain,
  hasName,
  hasLocation,
} from '../enrichment/domain-routing';

export interface ProviderCapabilities {
  requiresDomain: boolean;
  requiresName: boolean;
  requiresLocation: boolean;
  supportsFields: string[]; // canonical field keys
  rateLimitPerMinute: number; // default, overridden by detected
  managed: boolean; // true = Refyne pays, false = BYOK
}

export interface HubSpotCompany {
  id: string;
  properties: {
    domain?: string | null;
    website?: string | null;
    name?: string | null;
    city?: string | null;
    state?: string | null;
    country?: string | null;
    [key: string]: any;
  };
}

export const PROVIDER_CAPABILITIES: Record<string, ProviderCapabilities> = {
  apollo: {
    requiresDomain: false, // can match on name too but domain is best
    requiresName: true,
    requiresLocation: false,
    supportsFields: [
      'industry',
      'employee_count',
      'revenue',
      'phone',
      'linkedin_url',
    ],
    rateLimitPerMinute: 50, // default, overridden by detected limit
    managed: false,
  },
  graphiq: {
    requiresDomain: true,
    requiresName: false,
    requiresLocation: false,
    supportsFields: [
      'industry',
      'employee_count',
      'revenue',
      'linkedin_url',
      'description',
    ],
    rateLimitPerMinute: 100,
    managed: true,
  },
  serper_haiku: {
    requiresDomain: false,
    requiresName: true,
    requiresLocation: true,
    supportsFields: ['industry', 'employee_count', 'phone', 'description'],
    rateLimitPerMinute: 500, // no meaningful rate limit
    managed: true,
  },
  zoominfo: {
    requiresDomain: false,
    requiresName: true,
    requiresLocation: false,
    supportsFields: [
      'industry',
      'employee_count',
      'revenue',
      'phone',
      'linkedin_url',
    ],
    rateLimitPerMinute: 1500, // 25/sec default
    managed: false,
  },
  cognism: {
    requiresDomain: false,
    requiresName: true,
    requiresLocation: false,
    supportsFields: ['industry', 'employee_count', 'phone', 'linkedin_url'],
    rateLimitPerMinute: 60,
    managed: false,
  },
  refyne: {
    requiresDomain: false,
    requiresName: true,
    requiresLocation: false,
    supportsFields: [
      'industry',
      'employee_count',
      'revenue',
      'phone',
      'linkedin_url',
      'description',
    ],
    rateLimitPerMinute: 100, // orchestrates GraphIQ + Serper
    managed: true,
  },
};

/**
 * Check if a provider can enrich a given company record based on available signals
 */
export function canProviderEnrichRecord(
  provider: string,
  company: HubSpotCompany
): boolean {
  const caps = PROVIDER_CAPABILITIES[provider];
  if (!caps) return false;

  // Use proper validation from domain-routing.ts (includes regex validation)
  if (caps.requiresDomain && !hasDomain(company)) return false;
  if (caps.requiresName && !hasName(company)) return false;
  if (caps.requiresLocation && !hasLocation(company)) return false;

  return true;
}

/**
 * Get provider capabilities
 */
export function getProviderCapabilities(
  provider: string
): ProviderCapabilities | null {
  return PROVIDER_CAPABILITIES[provider] ?? null;
}

/**
 * Check if provider is managed (Refyne pays) or BYOK
 */
export function isManagedProvider(provider: string): boolean {
  const caps = PROVIDER_CAPABILITIES[provider];
  return caps?.managed ?? false;
}

/**
 * Get list of all available providers
 */
export function getAllProviders(): string[] {
  return Object.keys(PROVIDER_CAPABILITIES);
}

/**
 * Get list of BYOK providers
 */
export function getBYOKProviders(): string[] {
  return Object.keys(PROVIDER_CAPABILITIES).filter(
    (p) => !PROVIDER_CAPABILITIES[p].managed
  );
}

/**
 * Get list of managed providers
 */
export function getManagedProviders(): string[] {
  return Object.keys(PROVIDER_CAPABILITIES).filter(
    (p) => PROVIDER_CAPABILITIES[p].managed
  );
}
