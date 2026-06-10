#!/usr/bin/env node
/**
 * Check for duplicate Company Industry harmonies
 *
 * Usage: npx tsx scripts/check-duplicate-harmonies.ts
 */

// Load .env.local before any imports
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local') });

import { createClient } from '@supabase/supabase-js';

async function checkDuplicates() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('Supabase credentials not found in .env.local');
    console.error('Need: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log('Checking for Industry harmonies...\n');

  const { data, error } = await supabase
    .from('harmonies')
    .select('id, name, object_type, is_active, created_at')
    .ilike('name', '%industry%')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error querying harmonies:', error);
    process.exit(1);
  }

  if (!data || data.length === 0) {
    console.log('No industry harmonies found.');
    process.exit(0);
  }

  console.log(`Found ${data.length} industry harmonies:\n`);

  data.forEach((h, idx) => {
    console.log(`${idx + 1}. ${h.name}`);
    console.log(`   ID: ${h.id}`);
    console.log(`   Object Type: ${h.object_type}`);
    console.log(`   Active: ${h.is_active}`);
    console.log(`   Created: ${new Date(h.created_at).toISOString()}`);
    console.log('');
  });

  // Check for exact duplicates
  const nameCount = new Map<string, number>();
  data.forEach(h => {
    const key = `${h.name}|${h.object_type}`;
    nameCount.set(key, (nameCount.get(key) || 0) + 1);
  });

  const duplicates = Array.from(nameCount.entries()).filter(([_, count]) => count > 1);

  if (duplicates.length > 0) {
    console.log('\n⚠️  DUPLICATES FOUND:');
    duplicates.forEach(([key, count]) => {
      const [name, objectType] = key.split('|');
      console.log(`   "${name}" (${objectType}): ${count} entries`);
    });
  } else {
    console.log('✓ No exact duplicates found.');
  }
}

checkDuplicates().catch(console.error);
