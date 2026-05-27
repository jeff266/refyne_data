// Cache layer: check before searching, store after extracting
// Cross-org: domain-level cache shared across all orgs
// High confidence only: >= 0.70

import { supabase } from '@/lib/db/supabase';

const TTL_DAYS: Record<string, number> = {
  industry: 365,
  employee_count: 90,
  revenue: 180,
  linkedin_url: 180,
  phone: 365,
};

const MIN_CONFIDENCE_TO_CACHE = 0.7;

export interface CachedField {
  value: string | number | null;
  confidence: number;
  source: string;
  evidence: string;
  extractedAt: string;
  expiresAt: string;
  fromCache: true;
}

export async function getCachedFields(
  domain: string,
  fieldKeys: string[]
): Promise<Partial<Record<string, CachedField>>> {
  if (!supabase) return {};

  const { data } = await supabase
    .from('refyne_company_cache')
    .select('*')
    .eq('domain', domain.toLowerCase())
    .single();

  if (!data) return {};

  const result: Partial<Record<string, CachedField>> = {};
  const now = new Date();

  for (const fieldKey of fieldKeys) {
    const value = data[fieldKey];
    const expiresAt = data[`${fieldKey}_expires_at`];
    const confidence = data[`${fieldKey}_confidence`];

    if (
      value !== null &&
      value !== undefined &&
      expiresAt &&
      new Date(expiresAt) > now
    ) {
      result[fieldKey] = {
        value,
        confidence,
        source: data[`${fieldKey}_source`],
        evidence: data[`${fieldKey}_evidence`],
        extractedAt: data[`${fieldKey}_extracted_at`],
        expiresAt,
        fromCache: true,
      };
    }
  }

  return result;
}

export async function storeCachedFields(
  domain: string,
  companyName: string | null,
  extractions: Record<
    string,
    {
      value: string | number | null;
      confidence: number;
      evidence: string;
      sources: string[];
    }
  >
): Promise<void> {
  const updates: Record<string, any> = {
    domain: domain.toLowerCase(),
    company_name: companyName,
    company_name_normalized:
      companyName?.toLowerCase().replace(/[^a-z0-9]/g, '') ?? null,
    updated_at: new Date().toISOString(),
  };

  let hasHighConfidenceData = false;

  // Extract model name from extraction metadata (set by haiku/deepseek extractors)
  const model = (extractions as any)._model ?? 'deepseek';

  for (const [fieldKey, extraction] of Object.entries(extractions)) {
    if (
      extraction.value !== null &&
      extraction.confidence >= MIN_CONFIDENCE_TO_CACHE
    ) {
      // Don't cache haiku_classified results - require review first
      const trustLevel = (extraction as any)._trustLevel;
      if (fieldKey === 'industry' && trustLevel === 'low') {
        console.log(`[Cache] Skipping industry cache write - low trust (haiku_classified)`);
        continue;
      }

      const ttlDays = TTL_DAYS[fieldKey] ?? 90;
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + ttlDays);

      updates[fieldKey] = extraction.value;
      updates[`${fieldKey}_confidence`] = extraction.confidence;
      updates[`${fieldKey}_source`] = `refyne_search:${model}`;
      updates[`${fieldKey}_evidence`] = extraction.evidence;
      updates[`${fieldKey}_extracted_at`] = new Date().toISOString();
      updates[`${fieldKey}_expires_at`] = expiresAt.toISOString();

      hasHighConfidenceData = true;
    }
  }

  if (!hasHighConfidenceData) return;
  if (!supabase) return;

  await supabase
    .from('refyne_company_cache')
    .upsert(updates, { onConflict: 'domain' });
}
