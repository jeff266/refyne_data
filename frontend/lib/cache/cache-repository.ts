/**
 * Cache Repository
 *
 * Data access layer for the provider entity cache.
 * Handles get, set, and eviction operations.
 */

import { supabase, isSupabaseConfigured } from '../db/supabase';
import type {
  CacheRow,
  CacheEntry,
  CacheEntityType,
  CacheGetResult,
} from './types';

/**
 * Get cached entries for a domain or email.
 *
 * Returns all cached provider responses for the given lookup key.
 * On hit, increments hit_count in a fire-and-forget manner.
 *
 * @param orgId - Organization ID
 * @param lookupKey - Domain (for companies) or email (for contacts)
 * @param entityType - Entity type to lookup
 * @returns Cache result with hit status and rows
 */
export async function get(
  orgId: string,
  lookupKey: string,
  entityType: CacheEntityType
): Promise<CacheGetResult> {
  if (!isSupabaseConfigured() || !supabase) {
    return { hit: false, rows: [] };
  }

  const lookupColumn = entityType === 'company' ? 'domain' : 'email';
  const normalizedKey = lookupKey.toLowerCase().trim();

  const { data, error } = await supabase
    .from('provider_entity_cache')
    .select('*')
    .eq('org_id', orgId)
    .eq(lookupColumn, normalizedKey)
    .eq('entity_type', entityType)
    .gt('ttl_expires_at', new Date().toISOString());

  if (error) {
    console.error('[Cache] Get error:', error);
    return { hit: false, rows: [] };
  }

  if (!data || data.length === 0) {
    return { hit: false, rows: [] };
  }

  // Fire-and-forget: increment hit_count for all returned rows
  // Do not await - must not add latency to the hot path
  const ids = data.map((row) => row.id);
  incrementHitCounts(ids).catch((err) => {
    console.error('[Cache] Failed to increment hit counts:', err);
  });

  return {
    hit: true,
    rows: data as CacheRow[],
  };
}

/**
 * Get cached entry by provider and provider_id.
 * Used for dedup index population.
 */
export async function getByProviderId(
  orgId: string,
  provider: string,
  providerId: string
): Promise<CacheRow | null> {
  if (!isSupabaseConfigured() || !supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from('provider_entity_cache')
    .select('*')
    .eq('org_id', orgId)
    .eq('provider', provider)
    .eq('provider_id', providerId)
    .gt('ttl_expires_at', new Date().toISOString())
    .single();

  if (error || !data) {
    return null;
  }

  return data as CacheRow;
}

/**
 * Get all valid cache entries for an org and entity type.
 * Used for building dedup indexes from cache.
 */
export async function getAllValid(
  orgId: string,
  entityType: CacheEntityType
): Promise<CacheRow[]> {
  if (!isSupabaseConfigured() || !supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from('provider_entity_cache')
    .select('provider, provider_id, domain')
    .eq('org_id', orgId)
    .eq('entity_type', entityType)
    .gt('ttl_expires_at', new Date().toISOString());

  if (error) {
    console.error('[Cache] getAllValid error:', error);
    return [];
  }

  return (data || []) as CacheRow[];
}

/**
 * Set (upsert) cache entries.
 *
 * On conflict (org_id, provider, provider_id):
 * - Updates canonical_data, raw_response, retrieved_at, ttl_expires_at
 * - Resets hit_count to 0
 *
 * @param orgId - Organization ID
 * @param entries - Cache entries to upsert
 * @returns Number of entries upserted
 */
export async function set(
  orgId: string,
  entries: CacheEntry[]
): Promise<number> {
  if (!isSupabaseConfigured() || !supabase) {
    console.warn('[Cache] Supabase not configured - entries not cached');
    return 0;
  }

  if (entries.length === 0) {
    return 0;
  }

  let upsertedCount = 0;

  // Upsert each entry
  for (const entry of entries) {
    const row = {
      org_id: orgId,
      entity_type: entry.entity_type,
      provider: entry.provider,
      provider_id: entry.provider_id,
      domain: entry.domain?.toLowerCase().trim() || null,
      email: entry.email?.toLowerCase().trim() || null,
      canonical_data: entry.canonical_data,
      raw_response: entry.raw_response || null,
      retrieved_at: new Date().toISOString(),
      ttl_expires_at: entry.ttl_expires_at.toISOString(),
      hit_count: 0, // Reset on upsert
    };

    const { error } = await supabase
      .from('provider_entity_cache')
      .upsert(row, {
        onConflict: 'org_id,provider,provider_id',
      });

    if (error) {
      console.error('[Cache] Set error for provider', entry.provider, ':', error);
    } else {
      upsertedCount++;
    }
  }

  return upsertedCount;
}

/**
 * Evict all expired cache entries.
 *
 * @returns Number of entries deleted
 */
export async function evictExpired(): Promise<number> {
  if (!isSupabaseConfigured() || !supabase) {
    return 0;
  }

  const { data, error } = await supabase
    .from('provider_entity_cache')
    .delete()
    .lt('ttl_expires_at', new Date().toISOString())
    .select('id');

  if (error) {
    console.error('[Cache] Eviction error:', error);
    return 0;
  }

  return data?.length || 0;
}

/**
 * Increment hit_count for cache entries.
 * Internal helper - fire-and-forget.
 */
async function incrementHitCounts(ids: string[]): Promise<void> {
  if (!isSupabaseConfigured() || !supabase || ids.length === 0) {
    return;
  }

  // Use raw SQL for atomic increment
  // Supabase doesn't have a direct increment, so we use RPC or raw update
  const { error } = await supabase.rpc('increment_cache_hit_counts', {
    cache_ids: ids,
  });

  // If RPC doesn't exist, fall back to individual updates
  if (error && error.code === 'PGRST202') {
    // RPC not found - use individual updates (less efficient but works)
    for (const id of ids) {
      await supabase
        .from('provider_entity_cache')
        .update({ hit_count: supabase.rpc('increment_hit_count', { row_id: id }) })
        .eq('id', id);
    }
  }
}

/**
 * Clear all cache entries for an org (for testing).
 */
export async function clearOrgCache(orgId: string): Promise<void> {
  if (!isSupabaseConfigured() || !supabase) {
    return;
  }

  await supabase
    .from('provider_entity_cache')
    .delete()
    .eq('org_id', orgId);
}
