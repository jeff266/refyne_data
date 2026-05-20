#!/usr/bin/env npx tsx
/**
 * Migration: Seed field mappings for existing connected orgs
 *
 * Runs seedFieldMappings for any org with active HubSpot connection
 * but missing field_mappings rows.
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';
import { seedFieldMappings } from '../lib/field-mappings/auto-configure';

config({ path: resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  console.error('Required: NEXT_PUBLIC_SUPABASE_URL and (SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY)');
  process.exit(1);
}

if (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY && !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.log('⚠ Warning: Using ANON key instead of SERVICE_ROLE key. This may fail on RLS-protected tables.\n');
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('[Migration] Starting field mappings seed for existing orgs...\n');

  // Get all active HubSpot connections
  const { data: connections, error: connectionsError } = await supabase
    .from('hubspot_connections')
    .select('org_id, portal_id, access_token, refresh_token, token_expires_at')
    .eq('connection_status', 'active')
    .not('access_token', 'is', null);

  if (connectionsError) {
    console.error('Failed to fetch connections:', connectionsError);
    process.exit(1);
  }

  if (!connections || connections.length === 0) {
    console.log('No active HubSpot connections found.');
    return;
  }

  console.log(`Found ${connections.length} active connections.\n`);

  for (const connection of connections) {
    console.log(`Processing org ${connection.org_id} (portal ${connection.portal_id})...`);

    // Check if field mappings already exist
    const { data: existingMappings } = await supabase
      .from('field_mappings')
      .select('id')
      .eq('org_id', connection.org_id)
      .eq('portal_id', connection.portal_id)
      .eq('is_system', true)
      .limit(1);

    if (existingMappings && existingMappings.length > 0) {
      console.log(`  ✓ Field mappings already exist. Skipping.\n`);
      continue;
    }

    // Check if token is expired
    const expiresAt = new Date(connection.token_expires_at);
    const now = new Date();

    if (expiresAt < now) {
      console.log(`  ⚠ Token expired. Skipping (would need refresh).\n`);
      continue;
    }

    // Seed field mappings
    try {
      const result = await seedFieldMappings(
        connection.org_id,
        connection.portal_id,
        connection.access_token
      );

      console.log(`  ✓ Created ${result.systemMappingsCreated} system mappings`);
      console.log(`  ✓ Cached ${result.propertiesCached} properties\n`);
    } catch (error) {
      console.error(`  ✗ Failed to seed mappings:`, error);
      console.log('');
    }
  }

  console.log('[Migration] Complete!');
}

main().catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});
