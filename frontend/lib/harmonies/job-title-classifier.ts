/**
 * Job Title Classifier
 *
 * Uses Claude Haiku to classify job titles into:
 * - Level: C-Suite, VP, Director, Manager, IC, Founder, Other
 * - Function: Clinical/Healthcare, Revenue Operations, Sales, Marketing, etc.
 *
 * Results are cached in job_title_cache table to avoid redundant API calls.
 */

import Anthropic from '@anthropic-ai/sdk';
import { supabaseAdmin } from '../db/admin-client';

export type JobLevel = 'C-Suite' | 'VP' | 'Director' | 'Manager' | 'IC' | 'Founder' | 'Other';
export type JobFunction =
  | 'Clinical/Healthcare'
  | 'Revenue Operations'
  | 'Sales'
  | 'Marketing'
  | 'Finance'
  | 'Engineering'
  | 'Operations'
  | 'Executive'
  | 'People/HR'
  | 'Other';

export interface JobClassification {
  level: JobLevel;
  function: JobFunction;
  confidence: 'high' | 'low';
}

const CLASSIFICATION_PROMPT = `You are a B2B job title classifier. Given a raw job title, return JSON with two fields:
- level: one of [C-Suite, VP, Director, Manager, IC, Founder, Other]
- function: one of [Clinical/Healthcare, Revenue Operations, Sales, Marketing, Finance, Engineering, Operations, Executive, People/HR, Other]

Rules:
- BCBA, Board Certified Behavior Analyst, Therapist, Psychologist, Behavior Technician → IC, Clinical/Healthcare
- Clinical Director, Clinical Supervisor, Program Director → Director, Clinical/Healthcare
- Chief Clinical Officer, Chief Medical Officer → C-Suite, Clinical/Healthcare
- Chief Executive Officer, CEO → C-Suite, Executive
- Chief Technology Officer, CTO → C-Suite, Engineering
- Chief Financial Officer, CFO → C-Suite, Finance
- Chief Operating Officer, COO → C-Suite, Operations
- Chief Marketing Officer, CMO → C-Suite, Marketing
- Chief Revenue Officer, CRO → C-Suite, Revenue Operations
- Founder, Co-Founder, Owner → Founder, Executive
- Revenue Operations, RevOps, Sales Operations → use Manager/Director/IC based on seniority keywords
- "Assistant to the VP of X" → IC level (not VP), function from X
- When title contains multiple level keywords, use the most prominent one
- Empty or null titles → Other, Other

Return ONLY valid JSON, no explanation: {"level": "...", "function": "..."}`;

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function classifyJobTitle(rawTitle: string): Promise<JobClassification> {
  if (!rawTitle?.trim()) {
    return { level: 'Other', function: 'Other', confidence: 'low' };
  }

  const normalized = rawTitle.trim();

  // Check cache first
  const { data: cached } = await supabaseAdmin
    .from('job_title_cache')
    .select('job_level, job_function, confidence')
    .ilike('raw_title', normalized)
    .single();

  if (cached) {
    return {
      level: cached.job_level as JobLevel,
      function: cached.job_function as JobFunction,
      confidence: cached.confidence as 'high' | 'low',
    };
  }

  // Call Haiku
  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 100,
    messages: [
      {
        role: 'user',
        content: `${CLASSIFICATION_PROMPT}\n\nJob title: "${normalized}"`,
      },
    ],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '{}';

  // Strip markdown code fences if present
  const cleanedText = text.trim().replace(/^```json\s*/, '').replace(/\s*```$/, '');

  let result: { level: JobLevel; function: JobFunction };
  try {
    result = JSON.parse(cleanedText);
  } catch (parseError) {
    console.warn(`[Classifier] Failed to parse response for "${normalized}":`, text);
    result = { level: 'Other', function: 'Other' };
  }

  const classification: JobClassification = {
    level: result.level ?? 'Other',
    function: result.function ?? 'Other',
    confidence: 'high',
  };

  // Write to cache
  await supabaseAdmin
    .from('job_title_cache')
    .upsert(
      {
        raw_title: normalized,
        job_level: classification.level,
        job_function: classification.function,
        confidence: classification.confidence,
      },
      { onConflict: 'raw_title' }
    );

  return classification;
}

export async function classifyJobTitleBatch(
  titles: string[]
): Promise<Map<string, JobClassification>> {
  const results = new Map<string, JobClassification>();
  const uniqueTitles = Array.from(new Set(titles.filter(Boolean)));

  // Check cache for all titles at once
  const { data: cached } = await supabaseAdmin
    .from('job_title_cache')
    .select('raw_title, job_level, job_function, confidence')
    .in('raw_title', uniqueTitles);

  const cachedMap = new Map(
    (cached ?? []).map((r) => [
      r.raw_title.toLowerCase(),
      {
        level: r.job_level as JobLevel,
        function: r.job_function as JobFunction,
        confidence: r.confidence as 'high' | 'low',
      },
    ])
  );

  // Process uncached titles
  const uncached = uniqueTitles.filter((t) => !cachedMap.has(t.toLowerCase()));

  // Classify uncached in parallel (max 10 concurrent)
  const BATCH_SIZE = 10;
  for (let i = 0; i < uncached.length; i += BATCH_SIZE) {
    const batch = uncached.slice(i, i + BATCH_SIZE);
    const classifications = await Promise.all(batch.map((title) => classifyJobTitle(title)));
    batch.forEach((title, idx) => {
      results.set(title, classifications[idx]);
    });
  }

  // Add cached results
  cachedMap.forEach((classification, title) => {
    const originalTitle = uniqueTitles.find((t) => t.toLowerCase() === title);
    if (originalTitle) results.set(originalTitle, classification);
  });

  return results;
}
