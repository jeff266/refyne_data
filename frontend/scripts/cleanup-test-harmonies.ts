#!/usr/bin/env tsx
/**
 * Cleanup Test Harmonies
 *
 * Deletes test harmonies created during development ("Test", "Test 2", "asdfadfsd")
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

  const testHarmonyNames = ['Test', 'Test 2', 'asdfadfsd'];

  console.log('Finding test harmonies...');

  const { data: harmonies, error: findError } = await supabase
    .from('harmonies')
    .select('id, name, org_id, is_preset')
    .in('name', testHarmonyNames);

  if (findError) {
    console.error('Error finding harmonies:', findError);
    process.exit(1);
  }

  if (!harmonies || harmonies.length === 0) {
    console.log('No test harmonies found.');
    return;
  }

  console.log(`Found ${harmonies.length} test harmonies:`);
  harmonies.forEach((h) => {
    console.log(`  - ${h.name} (id: ${h.id}, org_id: ${h.org_id}, preset: ${h.is_preset})`);
  });

  console.log('\nDeleting test harmonies...');

  const { error: deleteError } = await supabase
    .from('harmonies')
    .delete()
    .in('id', harmonies.map(h => h.id));

  if (deleteError) {
    console.error('Error deleting harmonies:', deleteError);
    process.exit(1);
  }

  console.log(`✅ Successfully deleted ${harmonies.length} test harmonies`);
}

main();
