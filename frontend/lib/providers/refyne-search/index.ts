// Refyne Search: the public interface
// This is what the rest of the app sees
// Serper, Jina, DeepSeek, and Haiku are internal implementation details
//
// Changes from previous version:
//   - Jina homepage fetch runs in parallel with Serper (not after)
//   - Haiku fallback when DeepSeek V4 Flash exceeds 5s timeout
//   - Cached industry passed to query builder (removes ABA hardcode)
//   - Preview vs background context controls which model runs

import { searchWeb, buildCompanyQueries } from './serper-client';
import { fetchWithJina } from './jina-client';
import { extractWithDeepSeek } from './deepseek-extractor';
import { extractWithHaiku } from './haiku-extractor';
import { getCachedFields, storeCachedFields } from './cache';
import { supabase } from '@/lib/db/supabase';

export interface RefyneSearchResult {
  fieldKey: string;
  value: string | number | null;
  confidence: number;
  level: 'high' | 'medium' | 'low' | 'insufficient';
  evidence: string;
  sources: string[];
  fromCache: boolean;
}

export type SearchContext = 'preview' | 'background';

const DEEPSEEK_TIMEOUT_MS = 5000;

function confidenceLevel(
  score: number
): 'high' | 'medium' | 'low' | 'insufficient' {
  if (score >= 0.85) return 'high';
  if (score >= 0.6) return 'medium';
  if (score >= 0.4) return 'low';
  return 'insufficient';
}

/**
 * Extract fields using DeepSeek V4 Flash with a 5s timeout.
 * Falls back to Claude Haiku on timeout or error.
 *
 * Preview context: always uses Haiku (fast, good enough for UI feedback)
 * Background context: tries DeepSeek first, Haiku on timeout
 */
async function extractWithFallback(
  companyName: string | null,
  domain: string | null,
  searchResults: Array<{ query: string; results: any[] }>,
  fieldKeys: string[],
  context: SearchContext
): Promise<Record<string, any>> {
  // Preview always uses Haiku for speed
  if (context === 'preview') {
    console.log(`[Refyne Search] Preview context, using Haiku`);
    return extractWithHaiku(companyName, domain, searchResults, fieldKeys);
  }

  // Background: try DeepSeek with timeout, fall back to Haiku
  try {
    const result = await Promise.race([
      extractWithDeepSeek(companyName, domain, searchResults, fieldKeys),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error('DeepSeek timeout')),
          DEEPSEEK_TIMEOUT_MS
        )
      ),
    ]);
    return result;
  } catch (err: any) {
    const reason = err?.message ?? 'unknown';
    console.warn(
      `[Refyne Search] DeepSeek failed (${reason}), falling back to Haiku`
    );
    return extractWithHaiku(companyName, domain, searchResults, fieldKeys);
  }
}

export async function refyneSearch(
  orgId: string,
  domain: string | null,
  companyName: string | null,
  fieldKeys: string[],
  context: SearchContext = 'background'
): Promise<RefyneSearchResult[]> {
  const lookupKey = domain?.toLowerCase() ?? null;
  const results: RefyneSearchResult[] = [];
  const fieldsToSearch: string[] = [];

  // Step 1: Check cache first
  // Also pull cached industry to use as query context (replaces ABA hardcode)
  let cachedIndustry: string | null = null;

  if (lookupKey) {
    const allCachedKeys = [...fieldKeys, 'industry'];
    const cached = await getCachedFields(lookupKey, allCachedKeys);

    // Extract industry hint if available (used in query builder below)
    cachedIndustry = (cached['industry']?.value as string) ?? null;

    for (const fieldKey of fieldKeys) {
      if (cached[fieldKey]) {
        const c = cached[fieldKey]!;
        results.push({
          fieldKey,
          value: c.value,
          confidence: c.confidence,
          level: confidenceLevel(c.confidence),
          evidence: c.evidence,
          sources: [],
          fromCache: true,
        });

        await logUsage(orgId, lookupKey, fieldKey, true, c.confidence, 0, 0, 0, 0);
      } else {
        fieldsToSearch.push(fieldKey);
      }
    }
  } else {
    fieldsToSearch.push(...fieldKeys);
  }

  if (fieldsToSearch.length === 0) return results;

  // Step 2: Cache miss - run Serper + Jina in parallel, then extract
  const queries = buildCompanyQueries(
    domain,
    companyName,
    fieldsToSearch,
    cachedIndustry // passes e.g. "Healthcare Technology" instead of hardcoded "ABA therapy"
  );

  if (queries.length === 0) {
    for (const fieldKey of fieldsToSearch) {
      results.push({
        fieldKey,
        value: null,
        confidence: 0,
        level: 'insufficient',
        evidence: 'No domain or company name provided',
        sources: [],
        fromCache: false,
      });
    }
    return results;
  }

  // Run Serper queries AND Jina homepage fetch in parallel
  // Jina gives us full homepage text - critical for phone numbers
  // which almost never appear in search snippets
  const [searchResults, jinaResults] = await Promise.all([
    Promise.allSettled(
      queries.map(async (q) => ({
        query: q,
        results: await searchWeb(q, 5),
      }))
    ),
    domain ? fetchWithJina(domain) : Promise.resolve([]),
  ]);

  const serperCallCount = queries.length;

  const successfulSearches = searchResults
    .filter((r) => r.status === 'fulfilled')
    .map((r) => (r as PromiseFulfilledResult<any>).value)
    .filter((sr) => sr.results && sr.results.length > 0);

  // Append Jina homepage content as an additional "search result"
  // It uses the same SerperResult[] shape so DeepSeek sees it naturally
  if (jinaResults.length > 0) {
    successfulSearches.push({
      query: `Homepage: ${domain}`,
      results: jinaResults,
    });
    console.log(`[Jina] Added homepage content for ${domain}`);
  }

  const hasResults =
    successfulSearches.length > 0 &&
    successfulSearches.some((sr) => sr.results && sr.results.length > 0);

  if (!hasResults) {
    console.log(
      `[Refyne Search] No results for ${domain || companyName}, skipping extraction`
    );

    for (const fieldKey of fieldsToSearch) {
      results.push({
        fieldKey,
        value: null,
        confidence: 0,
        level: 'insufficient',
        evidence: 'No search results found',
        sources: [],
        fromCache: false,
      });

      await logUsage(
        orgId,
        lookupKey ?? companyName ?? 'unknown',
        fieldKey,
        false,
        0,
        serperCallCount,
        0,
        0,
        0
      );
    }
    return results;
  }

  // Step 3: Extract with DeepSeek (background) or Haiku (preview)
  // Haiku fallback fires automatically on DeepSeek timeout
  const extraction = await extractWithFallback(
    companyName,
    domain,
    successfulSearches,
    fieldsToSearch,
    context
  );

  const usage = (extraction as any)._usage ?? {
    inputTokens: 0,
    outputTokens: 0,
    costUsd: 0,
  };

  // Step 4: Store high-confidence results in cache
  if (lookupKey) {
    const toCache: Record<string, any> = {};
    for (const fieldKey of fieldsToSearch) {
      const e = (extraction as any)[fieldKey];
      if (e) toCache[fieldKey] = e;
    }
    await storeCachedFields(lookupKey, companyName, toCache);
  }

  // Step 5: Build results
  for (const fieldKey of fieldsToSearch) {
    const e = (extraction as any)[fieldKey];
    const value = e?.value ?? null;
    const confidence = e?.confidence ?? 0;

    results.push({
      fieldKey,
      value,
      confidence,
      level: confidenceLevel(confidence),
      evidence: e?.evidence ?? '',
      sources: e?.sources ?? [],
      fromCache: false,
    });

    await logUsage(
      orgId,
      lookupKey ?? companyName ?? 'unknown',
      fieldKey,
      false,
      confidence,
      serperCallCount,
      usage.inputTokens,
      usage.outputTokens,
      usage.costUsd
    );
  }

  return results;
}

async function logUsage(
  orgId: string,
  domain: string,
  fieldKey: string,
  cacheHit: boolean,
  confidence: number,
  serperCalls: number,
  inputTokens: number,
  outputTokens: number,
  costUsd: number
): Promise<void> {
  if (!supabase) return;

  await supabase
    .from('refyne_search_usage')
    .insert({
      org_id: orgId,
      domain,
      field_key: fieldKey,
      cache_hit: cacheHit,
      confidence,
      serper_calls: serperCalls,
      deepseek_input_tokens: inputTokens,
      deepseek_output_tokens: outputTokens,
      cost_usd: costUsd,
    })
    .throwOnError();
}
