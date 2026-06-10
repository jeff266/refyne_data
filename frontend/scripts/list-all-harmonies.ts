#!/usr/bin/env tsx
/**
 * List All Harmonies
 *
 * Shows all harmonies grouped by org_id to diagnose cross-org visibility
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';

// Load .env.local explicitly
config({ path: resolve(process.cwd(), '.env.local') });

async function main() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not configured');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log('Fetching all harmonies...\n');

  const { data: harmonies, error } = await supabase
    .from('harmonies')
    .select('id, name, org_id, is_preset, object_type, created_at')
    .order('org_id', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching harmonies:', error);
    process.exit(1);
  }

  if (!harmonies || harmonies.length === 0) {
    console.log('No harmonies found.');
    return;
  }

  // Group by org_id
  const byOrg = harmonies.reduce((acc, h) => {
    const key = h.org_id || 'PRESET';
    if (!acc[key]) acc[key] = [];
    acc[key].push(h);
    return acc;
  }, {} as Record<string, typeof harmonies>);

  console.log(`Total harmonies: ${harmonies.length}\n`);

  for (const [orgId, orgHarmonies] of Object.entries(byOrg)) {
    console.log(`\n━━━ ${orgId} (${orgHarmonies.length} harmonies) ━━━`);
    orgHarmonies.forEach((h) => {
      const preset = h.is_preset ? '[PRESET]' : '';
      console.log(`  ${h.name.padEnd(30)} ${h.object_type.padEnd(10)} ${preset}`);
    });
  }

  // Show any non-preset harmonies that might be test data
  const nonPresets = harmonies.filter(h => !h.is_preset);
  if (nonPresets.length > 0) {
    console.log(`\n\n━━━ NON-PRESET HARMONIES (${nonPresets.length}) ━━━`);
    nonPresets.forEach((h) => {
      console.log(`  ${h.name.padEnd(30)} org: ${(h.org_id || 'NULL').padEnd(40)} type: ${h.object_type}`);
    });
  }
}

main();
