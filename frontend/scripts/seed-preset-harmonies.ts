#!/usr/bin/env npx tsx

/**
 * Seed Preset Harmonies
 *
 * Creates the 4 preset harmonies that should exist for all orgs.
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env.local
config({ path: resolve(__dirname, '../.env.local') });

import { supabase } from '../lib/db/supabase';

const PRESET_HARMONIES = [
  {
    id: 'company-industry',
    name: 'Company Industry',
    field: 'industry',
    object_type: 'company',
    transform_type: 'lookup',
    reference_table: 'ref_industries',
    fuzzy_threshold: 0.8,
    phonetic_enabled: true,
    is_active: true,
    is_preset: true,
    output_format: 'default',
    output_formats_available: [
      { key: 'default', label: 'Default', default: true },
    ],
  },
  {
    id: 'company-name',
    name: 'Company Name',
    field: 'name',
    object_type: 'company',
    transform_type: 'format',
    is_active: true,
    is_preset: true,
  },
  {
    id: 'phone-e164',
    name: 'Phone E.164',
    field: 'phone',
    object_type: 'company',
    transform_type: 'format',
    is_active: true,
    is_preset: true,
  },
  {
    id: 'linkedin-url',
    name: 'LinkedIn URL',
    field: 'linkedin_company_page',
    object_type: 'company',
    transform_type: 'format',
    is_active: true,
    is_preset: true,
  },
];

async function main() {
  console.log('Seeding preset harmonies...');

  if (!supabase) {
    console.error('Supabase not configured');
    process.exit(1);
  }

  // Get all orgs
  const { data: orgs, error: orgsError } = await supabase
    .from('organizations')
    .select('id, name');

  if (orgsError) {
    console.error('Failed to fetch orgs:', orgsError);
    process.exit(1);
  }

  if (!orgs || orgs.length === 0) {
    console.log('No organizations found');
    return;
  }

  console.log(`Found ${orgs.length} organizations`);

  // For each org, insert the preset harmonies
  for (const org of orgs) {
    console.log(`\nSeeding harmonies for org: ${org.name} (${org.id})`);

    const harmoniesToInsert = PRESET_HARMONIES.map(h => ({
      ...h,
      org_id: org.id,
    }));

    const { error: insertError } = await supabase
      .from('harmonies')
      .upsert(harmoniesToInsert, {
        onConflict: 'id,org_id',
        ignoreDuplicates: false,
      });

    if (insertError) {
      console.error(`  ❌ Failed to seed harmonies:`, insertError.message);
    } else {
      console.log(`  ✅ Seeded ${PRESET_HARMONIES.length} preset harmonies`);
    }
  }

  console.log('\n✅ Seed complete!');
}

main().catch((err) => {
  console.error('Seed error:', err);
  process.exit(1);
});
