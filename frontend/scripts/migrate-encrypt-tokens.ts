/**
 * One-time migration script to encrypt existing plaintext tokens
 * in hubspot_connections and provider_connections tables.
 *
 * Run with:
 * TOKEN_ENCRYPTION_KEY=xxx npx tsx scripts/migrate-encrypt-tokens.ts
 */

import { supabase } from '../lib/db/supabase';
import { encryptToken, isTokenEncrypted } from '../lib/crypto/token-encryption';

async function migrateHubSpotTokens() {
  console.log('[Migrate] Starting HubSpot token encryption...');

  if (!supabase) {
    throw new Error('Supabase not configured');
  }

  // Get all HubSpot connections
  const { data: connections, error } = await supabase
    .from('hubspot_connections')
    .select('id, org_id, portal_id, access_token, refresh_token, encrypted_token');

  if (error) {
    throw new Error(`Failed to fetch connections: ${error.message}`);
  }

  if (!connections || connections.length === 0) {
    console.log('[Migrate] No HubSpot connections found');
    return { migrated: 0, skipped: 0 };
  }

  console.log(`[Migrate] Found ${connections.length} HubSpot connections`);

  let migrated = 0;
  let skipped = 0;

  for (const conn of connections) {
    const updates: any = {};
    let needsUpdate = false;

    // Check access_token (OAuth)
    if (conn.access_token && !isTokenEncrypted(conn.access_token)) {
      console.log(`[Migrate] Encrypting access_token for portal ${conn.portal_id}`);
      updates.access_token = encryptToken(conn.access_token);
      needsUpdate = true;
    }

    // Check refresh_token (OAuth)
    if (conn.refresh_token && !isTokenEncrypted(conn.refresh_token)) {
      console.log(`[Migrate] Encrypting refresh_token for portal ${conn.portal_id}`);
      updates.refresh_token = encryptToken(conn.refresh_token);
      needsUpdate = true;
    }

    // Check encrypted_token (PAT - legacy field name, but still plaintext)
    if (conn.encrypted_token && !isTokenEncrypted(conn.encrypted_token)) {
      console.log(`[Migrate] Encrypting PAT (encrypted_token) for portal ${conn.portal_id}`);
      updates.encrypted_token = encryptToken(conn.encrypted_token);
      needsUpdate = true;
    }

    if (needsUpdate) {
      const { error: updateError } = await supabase
        .from('hubspot_connections')
        .update(updates)
        .eq('id', conn.id);

      if (updateError) {
        console.error(`[Migrate] Failed to update connection ${conn.id}:`, updateError.message);
        throw updateError;
      }

      migrated++;
      console.log(`[Migrate] ✓ Encrypted tokens for portal ${conn.portal_id} (org: ${conn.org_id})`);
    } else {
      skipped++;
      console.log(`[Migrate] ✓ Skipped portal ${conn.portal_id} (already encrypted)`);
    }
  }

  console.log('[Migrate] HubSpot token encryption complete');
  return { migrated, skipped };
}

async function migrateProviderTokens() {
  console.log('[Migrate] Starting provider token encryption...');

  if (!supabase) {
    throw new Error('Supabase not configured');
  }

  // Get all provider connections
  const { data: connections, error } = await supabase
    .from('provider_connections')
    .select('id, org_id, provider_name, access_token, refresh_token, api_key');

  if (error) {
    throw new Error(`Failed to fetch provider connections: ${error.message}`);
  }

  if (!connections || connections.length === 0) {
    console.log('[Migrate] No provider connections found');
    return { migrated: 0, skipped: 0 };
  }

  console.log(`[Migrate] Found ${connections.length} provider connections`);

  let migrated = 0;
  let skipped = 0;

  for (const conn of connections) {
    const updates: any = {};
    let needsUpdate = false;

    // Check access_token
    if (conn.access_token && !isTokenEncrypted(conn.access_token)) {
      console.log(`[Migrate] Encrypting access_token for provider ${conn.provider_name}`);
      updates.access_token = encryptToken(conn.access_token);
      needsUpdate = true;
    }

    // Check refresh_token
    if (conn.refresh_token && !isTokenEncrypted(conn.refresh_token)) {
      console.log(`[Migrate] Encrypting refresh_token for provider ${conn.provider_name}`);
      updates.refresh_token = encryptToken(conn.refresh_token);
      needsUpdate = true;
    }

    // Check api_key
    if (conn.api_key && !isTokenEncrypted(conn.api_key)) {
      console.log(`[Migrate] Encrypting api_key for provider ${conn.provider_name}`);
      updates.api_key = encryptToken(conn.api_key);
      needsUpdate = true;
    }

    if (needsUpdate) {
      const { error: updateError } = await supabase
        .from('provider_connections')
        .update(updates)
        .eq('id', conn.id);

      if (updateError) {
        console.error(`[Migrate] Failed to update provider connection ${conn.id}:`, updateError.message);
        throw updateError;
      }

      migrated++;
      console.log(`[Migrate] ✓ Encrypted tokens for provider ${conn.provider_name} (org: ${conn.org_id})`);
    } else {
      skipped++;
      console.log(`[Migrate] ✓ Skipped provider ${conn.provider_name} (already encrypted)`);
    }
  }

  console.log('[Migrate] Provider token encryption complete');
  return { migrated, skipped };
}

async function main() {
  try {
    console.log('='.repeat(60));
    console.log('Token Encryption Migration');
    console.log('='.repeat(60));

    // Check encryption key is set
    if (!process.env.TOKEN_ENCRYPTION_KEY) {
      throw new Error('TOKEN_ENCRYPTION_KEY environment variable not set');
    }

    console.log('✓ Encryption key configured\n');

    // Migrate HubSpot tokens
    const hubspotResult = await migrateHubSpotTokens();
    console.log(`\n✓ HubSpot: ${hubspotResult.migrated} encrypted, ${hubspotResult.skipped} skipped`);

    // Migrate provider tokens
    const providerResult = await migrateProviderTokens();
    console.log(`\n✓ Providers: ${providerResult.migrated} encrypted, ${providerResult.skipped} skipped`);

    console.log('\n' + '='.repeat(60));
    console.log('Migration Complete!');
    console.log(`Total migrated: ${hubspotResult.migrated + providerResult.migrated}`);
    console.log(`Total skipped: ${hubspotResult.skipped + providerResult.skipped}`);
    console.log('='.repeat(60));

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

main();
