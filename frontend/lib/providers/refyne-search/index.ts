// Refyne Search: the public interface
// This is what the rest of the app sees
// Serper and DeepSeek are internal implementation details

import { searchWeb, buildCompanyQueries } from './serper-client';
import { extractWithDeepSeek } from './deepseek-extractor';
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

function confidenceLevel(
  score: number
): 'high' | 'medium' | 'low' | 'insufficient' {
  if (score >= 0.85) return 'high';
  if (score >= 0.6) return 'medium';
  if (score >= 0.4) return 'low';
  return 'insufficient';
}

export async function refyneSearch(
  orgId: string,
  domain: string | null,
  companyName: string | null,
  fieldKeys: string[]
): Promise<RefyneSearchResult[]> {
  const lookupKey = domain?.toLowerCase() ?? null;
  const results: RefyneSearchResult[] = [];
  const fieldsToSearch: string[] = [];

  // Step 1: Check cache first
  if (lookupKey) {
    const cached = await getCachedFields(lookupKey, fieldKeys);

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

        await logUsage(
          orgId,
          lookupKey,
          fieldKey,
          true,
          c.confidence,
          0,
          0,
          0,
          0
        );
      } else {
        fieldsToSearch.push(fieldKey);
      }
    }
  } else {
    fieldsToSearch.push(...fieldKeys);
  }

  if (fieldsToSearch.length === 0) return results;

  // Step 2: Cache miss, run Serper + DeepSeek
  const queries = buildCompanyQueries(domain, companyName, fieldsToSearch);

  if (queries.length === 0) {
    for (const fieldKey of fieldsToSearch) {
      results.push({
        fieldKey,
        value: null,
        confidence: 0,
        level: 'insufficient',
        evidence: '',
        sources: [],
        fromCache: false,
      });
    }
    return results;
  }

  // Run all Serper queries in parallel
  const searchResults = await Promise.allSettled(
    queries.map(async (q) => ({
      query: q,
      results: await searchWeb(q, 5),
    }))
  );

  const successfulSearches = searchResults
    .filter((r) => r.status === 'fulfilled')
    .map((r) => (r as PromiseFulfilledResult<any>).value);

  const serperCallCount = successfulSearches.length;

  // Extract with DeepSeek
  const extraction = await extractWithDeepSeek(
    companyName,
    domain,
    successfulSearches,
    fieldsToSearch
  );

  const usage = (extraction as any)._usage ?? {
    inputTokens: 0,
    outputTokens: 0,
    costUsd: 0,
  };

  // Step 3: Store high-confidence results in cache
  if (lookupKey) {
    const toCache: Record<string, any> = {};
    for (const fieldKey of fieldsToSearch) {
      const e = (extraction as any)[fieldKey];
      if (e) toCache[fieldKey] = e;
    }
    await storeCachedFields(lookupKey, companyName, toCache);
  }

  // Step 4: Build results
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
