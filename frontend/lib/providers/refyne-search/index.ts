// Refyne Search: the public interface
// Changes from previous version:
//   - Industry field post-processed through NAICS crosswalk after extraction
//   - Raw industry strings converted to canonical HubSpot picklist values
//   - classifyIndustry() called before cache write, not after

import { searchWeb, buildCompanyQueries } from './serper-client'
import { fetchWithJina } from './jina-client'
import { extractWithDeepSeek } from './deepseek-extractor'
import { extractWithHaiku } from './haiku-extractor'
import { classifyIndustry, getSourceTrustLevel } from './industry-classifier'
import { getCachedFields, storeCachedFields } from './cache'
import { supabase } from '@/lib/db/supabase'

export interface RefyneSearchResult {
  fieldKey: string
  value: string | number | null
  confidence: number
  level: 'high' | 'medium' | 'low' | 'insufficient'
  evidence: string
  sources: string[]
  fromCache: boolean
  requiresReview?: boolean  // For low-trust classifications (haiku_classified)
  trustLevel?: 'high' | 'medium' | 'low'  // Trust level from classification source
}

export type SearchContext = 'preview' | 'background'

const DEEPSEEK_TIMEOUT_MS = 5000

function confidenceLevel(
  score: number
): 'high' | 'medium' | 'low' | 'insufficient' {
  if (score >= 0.85) return 'high'
  if (score >= 0.6) return 'medium'
  if (score >= 0.4) return 'low'
  return 'insufficient'
}

async function extractWithFallback(
  companyName: string | null,
  domain: string | null,
  searchResults: Array<{ query: string; results: any[] }>,
  fieldKeys: string[],
  context: SearchContext
): Promise<Record<string, any>> {
  if (context === 'preview') {
    return extractWithHaiku(companyName, domain, searchResults, fieldKeys)
  }

  try {
    const result = await Promise.race([
      extractWithDeepSeek(companyName, domain, searchResults, fieldKeys),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error('DeepSeek timeout')),
          DEEPSEEK_TIMEOUT_MS
        )
      ),
    ])
    return result
  } catch (err: any) {
    console.warn(
      `[Refyne Search] DeepSeek failed (${err?.message}), falling back to Haiku`
    )
    return extractWithHaiku(companyName, domain, searchResults, fieldKeys)
  }
}

/**
 * Post-process extraction results.
 * Industry field: run through NAICS crosswalk to get canonical HubSpot value.
 * All other fields: pass through unchanged.
 */
async function postProcessExtraction(
  extraction: Record<string, any>,
  fieldKeys: string[]
): Promise<Record<string, any>> {
  const processed = { ...extraction }

  if (fieldKeys.includes('industry') && extraction.industry?.value) {
    const rawIndustry = extraction.industry.value as string
    const rawConfidence = extraction.industry.confidence ?? 0

    try {
      const classified = await classifyIndustry(rawIndustry, rawConfidence)

      if (classified) {
        const trustLevel = getSourceTrustLevel(classified.source)

        processed.industry = {
          value: classified.hubspotValue,           // e.g. 'MENTAL_HEALTH_CARE'
          confidence: classified.confidence,
          evidence: extraction.industry.evidence,
          sources: extraction.industry.sources ?? [],
          // Store raw value and classification path in evidence for debugging
          _rawValue: rawIndustry,
          _naicsCode: classified.naicsCode,
          _naicsLabel: classified.naicsLabel,
          _classificationSource: classified.source,
          _trustLevel: trustLevel,
          _requiresReview: trustLevel === 'low',
        }
        console.log(
          `[Industry] "${rawIndustry}" → ${classified.naicsCode} → ${classified.hubspotValue} (${classified.source}, trust: ${trustLevel})`
        )
      } else {
        // Classification failed - null out the industry value
        // Better to write nothing than write a non-HubSpot value
        console.warn(
          `[Industry] Could not classify "${rawIndustry}", skipping`
        )
        processed.industry = {
          value: null,
          confidence: 0,
          evidence: `Classification failed for: ${rawIndustry}`,
          sources: [],
        }
      }
    } catch (err: any) {
      console.error('[Industry] Post-processing error:', err?.message)
      processed.industry = {
        value: null,
        confidence: 0,
        evidence: `Classification error: ${err?.message}`,
        sources: [],
      }
    }
  }

  return processed
}

export async function refyneSearch(
  orgId: string,
  domain: string | null,
  companyName: string | null,
  fieldKeys: string[],
  context: SearchContext = 'background',
  mode: 'fast' | 'thorough' = 'fast'
): Promise<RefyneSearchResult[]> {
  const lookupKey = domain?.toLowerCase() ?? null
  const results: RefyneSearchResult[] = []
  const fieldsToSearch: string[] = []

  let cachedIndustry: string | null = null

  // Step 1: Check cache
  if (lookupKey) {
    const allCachedKeys = [...fieldKeys, 'industry']
    const cached = await getCachedFields(lookupKey, allCachedKeys)

    cachedIndustry = (cached['industry']?.value as string) ?? null

    for (const fieldKey of fieldKeys) {
      if (cached[fieldKey]) {
        const c = cached[fieldKey]!
        results.push({
          fieldKey,
          value: c.value,
          confidence: c.confidence,
          level: confidenceLevel(c.confidence),
          evidence: c.evidence,
          sources: [],
          fromCache: true,
        })
        await logUsage(orgId, lookupKey, fieldKey, true, c.confidence, 0, false, 'cache', 0, 0, 0, 0, 0)
      } else {
        fieldsToSearch.push(fieldKey)
      }
    }
  } else {
    fieldsToSearch.push(...fieldKeys)
  }

  if (fieldsToSearch.length === 0) return results

  // Step 2: Build queries
  const queries = buildCompanyQueries(
    domain,
    companyName,
    fieldsToSearch,
    cachedIndustry
  )

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
      })
    }
    return results
  }

  // Step 3: Serper + Jina in parallel
  const [searchResults, jinaResults] = await Promise.all([
    Promise.allSettled(
      queries.map(async (q) => ({
        query: q,
        results: await searchWeb(q, 5),
      }))
    ),
    // Only fetch Jina when mode is thorough
    mode === 'thorough' && domain
      ? fetchWithJina(domain)
      : Promise.resolve([]),
  ])

  const serperCallCount = queries.length

  const successfulSearches = searchResults
    .filter((r) => r.status === 'fulfilled')
    .map((r) => (r as PromiseFulfilledResult<any>).value)
    .filter((sr) => sr.results && sr.results.length > 0)

  if (jinaResults.length > 0) {
    successfulSearches.push({
      query: `Homepage: ${domain}`,
      results: jinaResults,
    })
  }

  const hasResults =
    successfulSearches.length > 0 &&
    successfulSearches.some((sr) => sr.results && sr.results.length > 0)

  if (!hasResults) {
    for (const fieldKey of fieldsToSearch) {
      results.push({
        fieldKey,
        value: null,
        confidence: 0,
        level: 'insufficient',
        evidence: 'No search results found',
        sources: [],
        fromCache: false,
      })
      await logUsage(
        orgId,
        lookupKey ?? companyName ?? 'unknown',
        fieldKey,
        false,
        0,
        serperCallCount,
        jinaResults.length > 0,
        null,
        0,
        0,
        0,
        0,
        0
      )
    }
    return results
  }

  // Step 4: Extract with DeepSeek or Haiku
  const rawExtraction = await extractWithFallback(
    companyName,
    domain,
    successfulSearches,
    fieldsToSearch,
    context
  )

  // Step 5: Post-process - run industry through NAICS crosswalk
  const extraction = await postProcessExtraction(rawExtraction, fieldsToSearch)

  const usage = (extraction as any)._usage ?? {
    inputTokens: 0,
    outputTokens: 0,
    costUsd: 0,
  }

  const modelUsed = (extraction as any)._model ?? null
  const jinaFetched = jinaResults.length > 0

  // Split tokens by model
  const deepseekInputTokens = modelUsed === 'deepseek' ? usage.inputTokens : 0
  const deepseekOutputTokens = modelUsed === 'deepseek' ? usage.outputTokens : 0
  const haikuInputTokens = modelUsed === 'haiku' ? usage.inputTokens : 0
  const haikuOutputTokens = modelUsed === 'haiku' ? usage.outputTokens : 0

  // Step 6: Store in cache
  if (lookupKey) {
    const toCache: Record<string, any> = {}
    for (const fieldKey of fieldsToSearch) {
      const e = (extraction as any)[fieldKey]
      if (e) toCache[fieldKey] = e
    }
    await storeCachedFields(lookupKey, companyName, toCache)
  }

  // Step 7: Build results
  for (const fieldKey of fieldsToSearch) {
    const e = (extraction as any)[fieldKey]
    const value = e?.value ?? null
    const confidence = e?.confidence ?? 0

    results.push({
      fieldKey,
      value,
      confidence,
      level: confidenceLevel(confidence),
      evidence: e?.evidence ?? '',
      sources: e?.sources ?? [],
      fromCache: false,
      requiresReview: e?._requiresReview ?? false,
      trustLevel: e?._trustLevel,
    })

    await logUsage(
      orgId,
      lookupKey ?? companyName ?? 'unknown',
      fieldKey,
      false,
      confidence,
      serperCallCount,
      jinaFetched,
      modelUsed,
      deepseekInputTokens,
      deepseekOutputTokens,
      haikuInputTokens,
      haikuOutputTokens,
      usage.costUsd
    )
  }

  return results
}

async function logUsage(
  orgId: string,
  domain: string,
  fieldKey: string,
  cacheHit: boolean,
  confidence: number,
  serperCalls: number,
  jinaFetched: boolean,
  modelUsed: string | null,
  deepseekInputTokens: number,
  deepseekOutputTokens: number,
  haikuInputTokens: number,
  haikuOutputTokens: number,
  costUsd: number
): Promise<void> {
  if (!supabase) return

  try {
    await supabase
      .from('refyne_search_usage')
      .insert({
        org_id: orgId,
        domain,
        field_key: fieldKey,
        cache_hit: cacheHit,
        confidence,
        serper_calls: serperCalls,
        jina_fetched: jinaFetched,
        model_used: modelUsed,
        deepseek_input_tokens: deepseekInputTokens,
        deepseek_output_tokens: deepseekOutputTokens,
        haiku_input_tokens: haikuInputTokens,
        haiku_output_tokens: haikuOutputTokens,
        cost_usd: costUsd,
      })
      .throwOnError()
  } catch (error) {
    // Log error but don't fail enrichment if usage tracking fails
    console.error('[Refyne Search] Failed to log usage:', error)
  }
}
