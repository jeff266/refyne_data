#!/usr/bin/env tsx
/**
 * Seed Harmony Reference Data
 *
 * Loads preset reference data (industries, legal suffixes, countries)
 * into the harmony_reference_data table. Run once during migration.
 *
 * Usage:
 *   npx tsx scripts/seed-harmony-reference-data.ts
 */

import { supabase } from '../lib/db/supabase';
import { INDUSTRY_SEED } from '../lib/harmonies/seed-data/industries';
import { LEGAL_SUFFIX_SEED } from '../lib/harmonies/seed-data/legal-suffixes';
import { COUNTRIES_SEED } from '../lib/harmonies/seed-data/countries';

interface HarmonyReferenceRow {
  table_name: string;
  input_value: string;
  canonical_value: string;
  language: string;
  source: string;
  fuzzy_eligible: boolean;
  org_id: null;
  is_active: boolean;
}

async function seedReferenceData() {
  console.log('[Reference Data Seeder] Starting...');

  if (!supabase) {
    console.error('[Reference Data Seeder] Supabase client not configured');
    process.exit(1);
  }

  const allRows: HarmonyReferenceRow[] = [];

  // ── Industries ─────────────────────────────────────────────────
  console.log(`[Reference Data Seeder] Loading ${INDUSTRY_SEED.length} industry mappings...`);
  for (const row of INDUSTRY_SEED) {
    allRows.push({
      table_name: 'industries',
      input_value: row.input,
      canonical_value: row.canonical,
      language: row.lang,
      source: 'refyne',
      fuzzy_eligible: row.fuzzyEligible ?? true,
      org_id: null, // Global preset
      is_active: true,
    });
  }

  // ── Legal Suffixes ─────────────────────────────────────────────
  console.log(`[Reference Data Seeder] Loading ${LEGAL_SUFFIX_SEED.length} legal suffix mappings...`);
  for (const row of LEGAL_SUFFIX_SEED) {
    allRows.push({
      table_name: 'legal_suffixes',
      input_value: row.input,
      canonical_value: row.canonical,
      language: row.lang,
      source: 'refyne',
      fuzzy_eligible: row.fuzzyEligible ?? true,
      org_id: null,
      is_active: true,
    });
  }

  // ── Countries ──────────────────────────────────────────────────
  console.log(`[Reference Data Seeder] Loading ${COUNTRIES_SEED.length} country mappings...`);
  for (const row of COUNTRIES_SEED) {
    allRows.push({
      table_name: 'countries',
      input_value: row.input,
      canonical_value: row.canonical,
      language: row.lang,
      source: 'refyne',
      fuzzy_eligible: row.fuzzyEligible ?? true,
      org_id: null,
      is_active: true,
    });
  }

  console.log(`[Reference Data Seeder] Total rows to insert: ${allRows.length}`);

  // ── Upsert in batches of 500 ──────────────────────────────────
  const BATCH_SIZE = 500;
  let insertedCount = 0;
  let errorCount = 0;

  for (let i = 0; i < allRows.length; i += BATCH_SIZE) {
    const batch = allRows.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;

    console.log(`[Reference Data Seeder] Inserting batch ${batchNum} (${batch.length} rows)...`);

    const { data, error } = await supabase
      .from('harmony_reference_data')
      .upsert(batch, {
        onConflict: 'table_name,lower(input_value),COALESCE(org_id,\'\')',
        ignoreDuplicates: false,
      });

    if (error) {
      console.error(`[Reference Data Seeder] Error in batch ${batchNum}:`, error);
      errorCount++;
    } else {
      insertedCount += batch.length;
      console.log(`[Reference Data Seeder] ✓ Batch ${batchNum} inserted`);
    }
  }

  console.log(`[Reference Data Seeder] Complete!`);
  console.log(`[Reference Data Seeder]   Inserted: ${insertedCount} rows`);
  console.log(`[Reference Data Seeder]   Errors: ${errorCount} batches`);

  if (errorCount > 0) {
    console.error('[Reference Data Seeder] ⚠️  Some batches failed. Check errors above.');
    process.exit(1);
  } else {
    console.log('[Reference Data Seeder] ✓ All reference data seeded successfully');
    process.exit(0);
  }
}

seedReferenceData();
