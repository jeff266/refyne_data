/**
 * Generic Provider Key Helper
 *
 * Centralized helper to retrieve API keys from provider_connections table.
 * Works for any provider (Apollo, GraphIQ, Cognism, ZoomInfo, etc.).
 */

import { supabase } from '@/lib/db/supabase';
import { decryptKey } from '@/lib/crypto/providerKeys';

/**
 * Get API key for any provider.
 *
 * @param orgId - Organization ID
 * @param provider - Provider name (apollo, graphiq, cognism, zoominfo, etc.)
 * @returns Decrypted API key or null if not found/configured
 */
export async function getProviderKey(orgId: string, provider: string): Promise<string | null> {
  if (!supabase) return null;

  const { data } = await supabase
    .from('provider_connections')
    .select('api_key_enc')
    .match({ org_id: orgId, provider, status: 'active' })
    .single();

  if (!data) return null;
  return decryptKey(data.api_key_enc);
}
