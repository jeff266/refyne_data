/**
 * Dedup Index Manager
 *
 * Manages the company_dedup_index table for fast candidate lookups
 * during incremental dedup scanning.
 */

import { supabase } from '../db/supabase';
import { normalizeDomain } from './company-signals';
import type { HubSpotCompany } from '../hubspot/types';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface IndexRow {
  org_id: string;
  portal_id: string;
  hubspot_company_id: string;
  name_prefix: string | null;
  domain_normalized: string | null;
  phone_prefix: string | null;
  linkedin_id: string | null;
  name_full: string | null;
  last_modified_at: Date | null;
  indexed_at?: Date;
}

// ─────────────────────────────────────────────────────────────────────────────
// Blocking Key Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extract name prefix (first 4 chars, lowercased, stripped of punctuation).
 */
function namePrefix(name: string | null): string | null {
  if (!name) return null;
  const cleaned = name.toLowerCase().replace(/[^\w\s]/g, '').trim();
  return cleaned.length >= 4 ? cleaned.slice(0, 4) : null;
}

/**
 * Normalize name for full fuzzy matching.
 */
function normalizeName(name: string | null): string | null {
  if (!name) return null;
  return name.toLowerCase().replace(/[^\w\s]/g, '').trim();
}

/**
 * Extract phone prefix (first 7 digits, E.164 format).
 */
function phonePrefix(phone: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 7 ? digits.slice(0, 7) : null;
}

/**
 * Extract LinkedIn company ID from URL.
 * Example: https://www.linkedin.com/company/anthropic-ai → anthropic-ai
 */
function extractLinkedInId(url: string | null): string | null {
  if (!url) return null;
  const match = url.match(/linkedin\.com\/company\/([^\/\?#]+)/i);
  return match ? match[1].toLowerCase() : null;
}

/**
 * Get domain exclusion set for an org.
 */
async function getDomainExclusionSet(orgId: string): Promise<Set<string>> {
  if (!supabase) return new Set();

  const { data, error } = await supabase
    .from('dedup_domain_exclusions')
    .select('domain')
    .eq('org_id', orgId);

  if (error) {
    console.error('[dedup-index] Failed to fetch domain exclusions:', error);
    return new Set();
  }

  return new Set(data.map((row) => row.domain));
}

// ─────────────────────────────────────────────────────────────────────────────
// Index Management
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build an index row from a HubSpot company record.
 */
export function buildIndexRow(
  orgId: string,
  portalId: string,
  company: HubSpotCompany,
  exclusions: Set<string>
): IndexRow {
  const domain = normalizeDomain(company.properties.domain);
  const isExcludedDomain = domain && exclusions.has(domain);

  return {
    org_id: orgId,
    portal_id: portalId,
    hubspot_company_id: company.id,
    name_prefix: namePrefix(company.properties.name),
    domain_normalized: isExcludedDomain ? null : domain,
    phone_prefix: phonePrefix(company.properties.phone),
    linkedin_id: extractLinkedInId(company.properties.linkedin_company_page),
    name_full: normalizeName(company.properties.name),
    last_modified_at: company.properties.hs_lastmodifieddate
      ? new Date(company.properties.hs_lastmodifieddate)
      : null,
  };
}

/**
 * Rebuild the full index for a portal (used during full scans).
 * Deletes existing index and inserts all companies.
 */
export async function rebuildFullIndex(
  orgId: string,
  portalId: string,
  companies: HubSpotCompany[]
): Promise<void> {
  if (!supabase) {
    throw new Error('Supabase not configured');
  }

  // Delete existing index for this portal
  const { error: deleteError } = await supabase
    .from('company_dedup_index')
    .delete()
    .eq('org_id', orgId)
    .eq('portal_id', portalId);

  if (deleteError) {
    throw new Error(`Failed to clear index: ${deleteError.message}`);
  }

  // Get domain exclusions
  const exclusions = await getDomainExclusionSet(orgId);

  // Build index rows
  const rows = companies.map((c) => buildIndexRow(orgId, portalId, c, exclusions));

  // Batch insert (500 rows per batch to stay under Supabase limits)
  for (let i = 0; i < rows.length; i += 500) {
    const batch = rows.slice(i, i + 500);
    const { error: insertError } = await supabase.from('company_dedup_index').insert(batch);

    if (insertError) {
      throw new Error(`Failed to insert index batch: ${insertError.message}`);
    }
  }

  console.log(`[dedup-index] Rebuilt index for ${portalId}: ${rows.length} companies indexed`);
}

/**
 * Upsert index records (used during incremental scans).
 * Updates existing records or inserts new ones.
 */
export async function upsertIndexRecords(
  orgId: string,
  portalId: string,
  companies: HubSpotCompany[]
): Promise<void> {
  if (!supabase) {
    throw new Error('Supabase not configured');
  }

  if (companies.length === 0) return;

  // Get domain exclusions
  const exclusions = await getDomainExclusionSet(orgId);

  // Build index rows
  const rows = companies.map((c) => buildIndexRow(orgId, portalId, c, exclusions));

  // Upsert in batches of 500
  for (let i = 0; i < rows.length; i += 500) {
    const batch = rows.slice(i, i + 500);
    const { error } = await supabase.from('company_dedup_index').upsert(batch, {
      onConflict: 'org_id,portal_id,hubspot_company_id',
    });

    if (error) {
      throw new Error(`Failed to upsert index batch: ${error.message}`);
    }
  }

  console.log(`[dedup-index] Upserted ${rows.length} index records for ${portalId}`);
}

/**
 * Find candidate duplicate records from the index.
 * Looks up by domain, phone prefix, name prefix, and LinkedIn ID.
 * Returns deduplicated set of candidates.
 */
export async function findCandidatesFromIndex(
  orgId: string,
  portalId: string,
  company: HubSpotCompany,
  exclusions: Set<string>
): Promise<IndexRow[]> {
  if (!supabase) {
    throw new Error('Supabase not configured');
  }

  const candidates = new Map<string, IndexRow>();
  const index = buildIndexRow(orgId, portalId, company, exclusions);

  // Domain match
  if (index.domain_normalized) {
    const { data } = await supabase
      .from('company_dedup_index')
      .select('*')
      .eq('org_id', orgId)
      .eq('portal_id', portalId)
      .eq('domain_normalized', index.domain_normalized)
      .neq('hubspot_company_id', company.id);

    data?.forEach((row) => candidates.set(row.hubspot_company_id, row as IndexRow));
  }

  // Phone prefix match
  if (index.phone_prefix) {
    const { data } = await supabase
      .from('company_dedup_index')
      .select('*')
      .eq('org_id', orgId)
      .eq('portal_id', portalId)
      .eq('phone_prefix', index.phone_prefix)
      .neq('hubspot_company_id', company.id);

    data?.forEach((row) => candidates.set(row.hubspot_company_id, row as IndexRow));
  }

  // Name prefix match
  if (index.name_prefix) {
    const { data } = await supabase
      .from('company_dedup_index')
      .select('*')
      .eq('org_id', orgId)
      .eq('portal_id', portalId)
      .eq('name_prefix', index.name_prefix)
      .neq('hubspot_company_id', company.id);

    data?.forEach((row) => candidates.set(row.hubspot_company_id, row as IndexRow));
  }

  // LinkedIn ID match
  if (index.linkedin_id) {
    const { data } = await supabase
      .from('company_dedup_index')
      .select('*')
      .eq('org_id', orgId)
      .eq('portal_id', portalId)
      .eq('linkedin_id', index.linkedin_id)
      .neq('hubspot_company_id', company.id);

    data?.forEach((row) => candidates.set(row.hubspot_company_id, row as IndexRow));
  }

  return Array.from(candidates.values());
}
