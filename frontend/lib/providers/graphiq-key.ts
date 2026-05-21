/**
 * GraphIQ API Key Helper
 *
 * Retrieves GraphIQ API key from environment or database.
 * Falls back to global env var, but can be overridden per-org.
 */

import { supabase } from '@/lib/db/supabase';
import { decryptKey } from '@/lib/crypto/providerKeys';

/**
 * Get GraphIQ API key.
 * Priority:
 * 1. Org-specific key from provider_connections (future)
 * 2. Global env var GRAPHIQ_API_KEY
 * 3. Hardcoded fallback for production (temporary)
 */
export async function getGraphiqKey(orgId?: string): Promise<string | null> {
  // Try org-specific key first (if orgId provided)
  if (orgId && supabase) {
    const { data } = await supabase
      .from('provider_connections')
      .select('api_key_enc')
      .match({ org_id: orgId, provider: 'graphiq', status: 'active' })
      .single();

    if (data) {
      return decryptKey(data.api_key_enc);
    }
  }

  // Fall back to env var
  const envKey = process.env.GRAPHIQ_API_KEY;
  if (envKey) {
    return envKey;
  }

  // TEMPORARY: Hardcoded for production until Coolify env vars work
  // TODO: Remove once Coolify env vars are fixed
  const TEMP_KEY = 'api_MKHC2ZREQ0paxXqI2vM2VPJMlxILndy2wGPCCEAOHYw';
  return TEMP_KEY;
}
