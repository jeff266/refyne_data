/**
 * Industry Crosswalk Lookup
 *
 * Maps provider-specific industry values to CRM enum values using NAICS crosswalk table.
 * Supports bidirectional lookups for different providers and CRMs.
 */

import { supabase } from '@/lib/db/supabase';

export interface CrosswalkEntry {
  naics_code: string;
  naics_label: string;
  apollo_label: string | null;
  hubspot_value: string | null;
  linkedin_value: string | null;
  sic_code: string | null;
}

/**
 * Look up HubSpot enum value from NAICS code.
 */
export async function naicsToHubSpot(naicsCode: string): Promise<string | null> {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('industry_crosswalk')
    .select('hubspot_value')
    .eq('naics_code', naicsCode)
    .single();

  if (error || !data) return null;
  return data.hubspot_value;
}

/**
 * Look up HubSpot enum value from NAICS label (fuzzy match).
 */
export async function naicsLabelToHubSpot(naicsLabel: string): Promise<string | null> {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('industry_crosswalk')
    .select('hubspot_value')
    .ilike('naics_label', naicsLabel)
    .single();

  if (error || !data) return null;
  return data.hubspot_value;
}

/**
 * Look up HubSpot enum value from Apollo label.
 */
export async function apolloToHubSpot(apolloLabel: string): Promise<string | null> {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('industry_crosswalk')
    .select('hubspot_value')
    .eq('apollo_label', apolloLabel)
    .single();

  if (error || !data) return null;
  return data.hubspot_value;
}

/**
 * Look up HubSpot enum value from LinkedIn label.
 */
export async function linkedinToHubSpot(linkedinLabel: string): Promise<string | null> {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('industry_crosswalk')
    .select('hubspot_value')
    .eq('linkedin_label', linkedinLabel)
    .single();

  if (error || !data) return null;
  return data.hubspot_value;
}

/**
 * Universal industry lookup - tries multiple strategies to find HubSpot enum value.
 *
 * Strategy order:
 * 1. Exact NAICS code match
 * 2. NAICS label match
 * 3. Provider label match (Apollo, LinkedIn, etc.)
 *
 * @param value - Industry value from provider
 * @param naicsCode - NAICS code if available
 * @param provider - Provider name ('apollo', 'graphiq', 'linkedin', etc.)
 * @returns HubSpot enum value or null if no mapping found
 */
export async function lookupIndustryCrosswalk(
  value: string,
  naicsCode?: string | null,
  provider?: string
): Promise<string | null> {
  if (!supabase) return null;

  // Strategy 1: Exact NAICS code match (most reliable)
  if (naicsCode) {
    const result = await naicsToHubSpot(naicsCode);
    if (result) return result;
  }

  // Strategy 2: NAICS label match
  const naicsResult = await naicsLabelToHubSpot(value);
  if (naicsResult) return naicsResult;

  // Strategy 3: Provider-specific label match
  if (provider === 'apollo') {
    const apolloResult = await apolloToHubSpot(value);
    if (apolloResult) return apolloResult;
  } else if (provider === 'linkedin') {
    const linkedinResult = await linkedinToHubSpot(value);
    if (linkedinResult) return linkedinResult;
  }

  // No mapping found
  return null;
}

/**
 * Get full crosswalk entry for a given NAICS code.
 * Useful for debugging and admin interfaces.
 */
export async function getCrosswalkEntry(naicsCode: string): Promise<CrosswalkEntry | null> {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('industry_crosswalk')
    .select('*')
    .eq('naics_code', naicsCode)
    .single();

  if (error || !data) return null;
  return data as CrosswalkEntry;
}

/**
 * Search crosswalk entries by any field (for admin UI).
 */
export async function searchCrosswalk(searchTerm: string): Promise<CrosswalkEntry[]> {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('industry_crosswalk')
    .select('*')
    .or(`naics_label.ilike.%${searchTerm}%,apollo_label.ilike.%${searchTerm}%,hubspot_value.ilike.%${searchTerm}%`)
    .limit(20);

  if (error || !data) return [];
  return data as CrosswalkEntry[];
}
