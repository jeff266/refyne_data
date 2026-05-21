/**
 * Apollo API Key Helper
 *
 * Centralized helper to retrieve Apollo API keys from provider_connections table.
 * Replaces direct process.env.APOLLO_API_KEY usage.
 */

import { supabase } from '@/lib/db/supabase';
import { decryptKey } from '@/lib/crypto/providerKeys';

/**
 * Get Apollo API key for an organization.
 *
 * @param orgId - Organization ID
 * @returns Decrypted API key or null if not found/configured
 */
export async function getApolloKey(orgId: string): Promise<string | null> {
  if (!supabase) return null;

  const { data } = await supabase
    .from('provider_connections')
    .select('api_key_enc')
    .match({ org_id: orgId, provider: 'apollo', status: 'active' })
    .single();

  if (!data) return null;
  return decryptKey(data.api_key_enc);
}
