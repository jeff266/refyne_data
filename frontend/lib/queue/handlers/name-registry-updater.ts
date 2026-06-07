/**
 * Name Registry Updater Handler
 *
 * Runs nightly at 2am UTC via the digest worker cron to populate the global
 * name registry with fresh company names from external sources.
 *
 * Data Sources:
 * 1. Wikidata SPARQL endpoint (always runs)
 * 2. Crunchbase API (only if CRUNCHBASE_API_KEY is set)
 *
 * Updates the global name_registry table with company names for use in
 * name normalization and standardization across the platform.
 */

import * as Sentry from '@sentry/node';
import { supabaseAdmin } from '../../db/admin-client';

interface WikidataResult {
  results: {
    bindings: Array<{
      companyLabel: { value: string };
      officialName?: { value: string };
    }>;
  };
}

interface CrunchbaseResult {
  entities: Array<{
    properties: {
      name: string;
    };
  }>;
}

interface RegistryStats {
  wikidataAdded: number;
  crunchbaseAdded: number;
  skippedExisting: number;
  totalGlobalEntries: number;
}

/**
 * Main handler function for name registry update
 */
export async function updateNameRegistry(): Promise<RegistryStats> {
  const startTime = Date.now();
  console.log(`[Registry Updater] Starting at ${new Date().toISOString()}`);

  const stats: RegistryStats = {
    wikidataAdded: 0,
    crunchbaseAdded: 0,
    skippedExisting: 0,
    totalGlobalEntries: 0,
  };

  // Fetch existing global entries to avoid duplicates
  const existingTokens = await getExistingGlobalTokens();
  console.log(`[Registry Updater] Found ${existingTokens.size} existing global entries`);

  // SOURCE A: Wikidata (always runs)
  try {
    stats.wikidataAdded = await fetchFromWikidata(existingTokens);
    console.log(`[Registry Updater] Added ${stats.wikidataAdded} entries from Wikidata`);
  } catch (error) {
    console.error('[Registry Updater] Wikidata error:', error);
    Sentry.captureException(error, {
      tags: { source: 'wikidata' },
      extra: { message: 'Non-fatal error fetching from Wikidata' },
    });
    // Continue execution - non-fatal error
  }

  // SOURCE B: Crunchbase (only if API key is set)
  if (process.env.CRUNCHBASE_API_KEY) {
    try {
      stats.crunchbaseAdded = await fetchFromCrunchbase(existingTokens);
      console.log(`[Registry Updater] Added ${stats.crunchbaseAdded} entries from Crunchbase`);
    } catch (error) {
      console.error('[Registry Updater] Crunchbase error:', error);
      Sentry.captureException(error, {
        tags: { source: 'crunchbase' },
        extra: { message: 'Non-fatal error fetching from Crunchbase' },
      });
      // Continue execution - non-fatal error
    }
  } else {
    console.log('[Registry Updater] Skipping Crunchbase (CRUNCHBASE_API_KEY not set)');
  }

  // Calculate stats
  stats.skippedExisting = existingTokens.size;

  // Get final count
  const { count } = await supabaseAdmin
    .from('name_registry')
    .select('*', { count: 'exact', head: true })
    .is('org_id', null)
    .eq('registry_type', 'company')
    .eq('status', 'active');

  stats.totalGlobalEntries = count || 0;

  const durationMs = Date.now() - startTime;

  // Log summary
  console.log('[Registry Updater] Summary:');
  console.log(`  Added ${stats.wikidataAdded} entries from Wikidata`);
  console.log(`  Added ${stats.crunchbaseAdded} entries from Crunchbase`);
  console.log(`  Skipped ${stats.skippedExisting} existing entries`);
  console.log(`  Total global entries: ${stats.totalGlobalEntries}`);
  console.log(`  Duration: ${durationMs}ms`);

  return stats;
}

/**
 * Fetch existing global company name tokens to avoid duplicates
 */
async function getExistingGlobalTokens(): Promise<Set<string>> {
  const { data, error } = await supabaseAdmin
    .from('name_registry')
    .select('input_token')
    .is('org_id', null)
    .eq('registry_type', 'company')
    .eq('status', 'active');

  if (error) {
    console.error('[Registry Updater] Error fetching existing tokens:', error);
    return new Set();
  }

  return new Set(data?.map((row) => row.input_token) || []);
}

/**
 * Fetch company names from Wikidata SPARQL endpoint
 */
async function fetchFromWikidata(existingTokens: Set<string>): Promise<number> {
  const sparqlQuery = `
    SELECT ?company ?companyLabel ?officialName WHERE {
      ?company wdt:P31 wd:Q4830453.  # instance of business
      ?company wdt:P571 ?founded.    # has founding date
      FILTER(?founded > "2000-01-01"^^xsd:dateTime)
      OPTIONAL { ?company wdt:P1448 ?officialName. }
      SERVICE wikibase:label {
        bd:serviceParam wikibase:language "en".
      }
    }
    LIMIT 1000
  `;

  const url = new URL('https://query.wikidata.org/sparql');
  url.searchParams.set('query', sparqlQuery);
  url.searchParams.set('format', 'json');

  const response = await fetch(url.toString(), {
    headers: {
      'User-Agent': 'Refyne/1.0 (hello@refynedata.com)',
      'Accept': 'application/sparql-results+json',
    },
  });

  if (!response.ok) {
    throw new Error(`Wikidata SPARQL error: ${response.status} ${response.statusText}`);
  }

  const data: WikidataResult = await response.json();

  // Process results and insert into registry
  const entriesToInsert: Array<{
    org_id: null;
    registry_type: string;
    input_token: string;
    canonical_form: string;
    source: string;
    confidence: number;
    status: string;
  }> = [];

  for (const binding of data.results.bindings) {
    // Use officialName if available, otherwise use companyLabel
    const label = binding.officialName?.value || binding.companyLabel.value;
    const inputToken = label.toLowerCase().trim();

    // Skip if token is too short
    if (inputToken.length < 2) {
      continue;
    }

    // Skip if already in global registry
    if (existingTokens.has(inputToken)) {
      continue;
    }

    entriesToInsert.push({
      org_id: null,
      registry_type: 'company',
      input_token: inputToken,
      canonical_form: label,
      source: 'wikidata',
      confidence: 0.90,
      status: 'active',
    });

    // Add to set to avoid inserting duplicates from this batch
    existingTokens.add(inputToken);
  }

  // Batch insert with ignoreDuplicates pattern
  if (entriesToInsert.length > 0) {
    const { error } = await supabaseAdmin
      .from('name_registry')
      .upsert(entriesToInsert, {
        onConflict: 'org_id,registry_type,input_token',
        ignoreDuplicates: true,
      });

    if (error) {
      console.error('[Registry Updater] Error inserting Wikidata entries:', error);
      throw error;
    }
  }

  return entriesToInsert.length;
}

/**
 * Fetch company names from Crunchbase API
 */
async function fetchFromCrunchbase(existingTokens: Set<string>): Promise<number> {
  const apiKey = process.env.CRUNCHBASE_API_KEY;
  if (!apiKey) {
    return 0;
  }

  const url = 'https://api.crunchbase.com/api/v4/searches/organizations';

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'X-cb-user-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      field_ids: ['name', 'short_description'],
      query: [
        {
          field_id: 'founded_on',
          operator_id: 'gte',
          values: ['2020-01-01'],
        },
      ],
      limit: 100,
    }),
  });

  if (!response.ok) {
    throw new Error(`Crunchbase API error: ${response.status} ${response.statusText}`);
  }

  const data: CrunchbaseResult = await response.json();

  // Process results and insert into registry
  const entriesToInsert: Array<{
    org_id: null;
    registry_type: string;
    input_token: string;
    canonical_form: string;
    source: string;
    confidence: number;
    status: string;
  }> = [];

  for (const entity of data.entities || []) {
    const name = entity.properties?.name;
    if (!name) {
      continue;
    }

    const inputToken = name.toLowerCase().trim();

    // Skip if token is too short
    if (inputToken.length < 2) {
      continue;
    }

    // Skip if already in global registry
    if (existingTokens.has(inputToken)) {
      continue;
    }

    entriesToInsert.push({
      org_id: null,
      registry_type: 'company',
      input_token: inputToken,
      canonical_form: name,
      source: 'crunchbase',
      confidence: 0.90,
      status: 'active',
    });

    // Add to set to avoid inserting duplicates from this batch
    existingTokens.add(inputToken);
  }

  // Batch insert with ignoreDuplicates pattern
  if (entriesToInsert.length > 0) {
    const { error } = await supabaseAdmin
      .from('name_registry')
      .upsert(entriesToInsert, {
        onConflict: 'org_id,registry_type,input_token',
        ignoreDuplicates: true,
      });

    if (error) {
      console.error('[Registry Updater] Error inserting Crunchbase entries:', error);
      throw error;
    }
  }

  return entriesToInsert.length;
}

/**
 * Enqueue a name registry update job
 * Called by the digest worker cron scheduler
 */
export async function enqueueNameRegistryUpdate(): Promise<void> {
  console.log(`[Registry Updater] Enqueueing update at ${new Date().toISOString()}`);

  // Call directly since this is a simple scheduled task
  // No need for BullMQ queue overhead
  try {
    await updateNameRegistry();
  } catch (error) {
    console.error('[Registry Updater] Update failed:', error);
    Sentry.captureException(error, {
      tags: { job: 'name-registry-update' },
    });
    throw error;
  }
}
