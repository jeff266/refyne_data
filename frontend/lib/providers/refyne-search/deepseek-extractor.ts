// DeepSeek V4 Flash extraction via Fireworks.ai
// Keys managed centrally by Refyne
// Model: accounts/fireworks/models/deepseek-v4-flash
// US-hosted for better latency vs direct DeepSeek China routing

// Railway uses FIREWORKS_API_KEY, local dev uses REFYNE_FIREWORKS_KEY
const FIREWORKS_API_KEY = process.env.FIREWORKS_API_KEY || process.env.REFYNE_FIREWORKS_KEY;
const FIREWORKS_ENDPOINT = 'https://api.fireworks.ai/inference/v1/chat/completions';

// Startup check: warn if API key is missing
if (!FIREWORKS_API_KEY) {
  console.error('[Refyne Search] CRITICAL: FIREWORKS_API_KEY or REFYNE_FIREWORKS_KEY not set - extraction disabled');
  console.error('[Refyne Search] Set FIREWORKS_API_KEY in production or REFYNE_FIREWORKS_KEY for local dev');
} else {
  console.log(`[Refyne Search] Fireworks API key configured (${FIREWORKS_API_KEY.substring(0, 8)}...)`);
}
// DeepSeek V4 Flash - fastest and cheapest DeepSeek model on Fireworks
const DEEPSEEK_MODEL = 'accounts/fireworks/models/deepseek-v4-flash';

// Pricing constants for DeepSeek V4 Flash on Fireworks
// Source: https://fireworks.ai/pricing
const INPUT_COST_PER_TOKEN = 0.00000014;  // $0.14 per 1M tokens
const OUTPUT_COST_PER_TOKEN = 0.00000028; // $0.28 per 1M tokens

export interface ExtractionField {
  value: string | number | null;
  confidence: number; // 0-1
  evidence: string; // snippet supporting the value
  sources: string[]; // URLs that contained the evidence
}

export interface ExtractionResult {
  industry?: ExtractionField;
  employee_count?: ExtractionField;
  revenue?: ExtractionField;
  linkedin_url?: ExtractionField;
  phone?: ExtractionField;
}

const SYSTEM_PROMPT = `You are a company data extraction specialist.
Extract structured firmographic data from web search results.

CRITICAL: Return ONLY valid JSON matching the exact structure requested.
- NO explanations before or after the JSON
- NO markdown code blocks
- NO comments inside the JSON
- If no evidence found, return the structure with null values and 0.0 confidence
- NEVER explain why you cannot extract data - just return the null structure

Format:
{
  "field_name": {
    "value": null,
    "confidence": 0.0,
    "evidence": "",
    "sources": []
  }
}`;

function buildExtractionPrompt(
  companyName: string | null,
  domain: string | null,
  searchResults: Array<{ query: string; results: any[] }>,
  fieldKeys: string[]
): string {
  const resultsText = searchResults
    .map((sr) => {
      const snippets = sr.results
        .map((r, i) => `[${i + 1}] ${r.title}\nURL: ${r.link}\n${r.snippet}`)
        .join('\n\n');
      return `Query: "${sr.query}"\n${snippets}`;
    })
    .join('\n\n---\n\n');

  const fieldInstructions = fieldKeys
    .map((f) => {
      switch (f) {
        case 'industry':
          return `"industry": extract the company's primary industry or sector`;
        case 'employee_count':
          return `"employee_count": extract total number of employees as integer`;
        case 'revenue':
          return `"revenue": extract annual revenue as integer in USD (e.g. 4200000 for $4.2M)`;
        case 'linkedin_url':
          return `"linkedin_url": extract the full LinkedIn company page URL`;
        case 'phone':
          return `"phone": extract the main business phone number`;
        default:
          return null;
      }
    })
    .filter(Boolean)
    .join('\n');

  return `Company: ${companyName ?? 'unknown'}
Domain: ${domain ?? 'unknown'}

Search Results:
${resultsText}

Extract these fields:
${fieldInstructions}

Return JSON with this exact structure for each requested field:
{
  "field_name": {
    "value": <extracted value or null>,
    "confidence": <0.0 to 1.0>,
    "evidence": "<exact text snippet from results>",
    "sources": ["<url1>", "<url2>"]
  }
}

Confidence guidelines:
- 0.9+: Multiple authoritative sources agree (LinkedIn + one other)
- 0.7-0.89: One authoritative source (LinkedIn, Crunchbase, company website)
- 0.5-0.69: One lower-authority source (job postings, news articles)
- 0.3-0.49: Indirect evidence or single mention
- below 0.3: Uncertain, include but flag as low confidence
- 0.0 / null: No evidence found`;
}

export async function extractWithDeepSeek(
  companyName: string | null,
  domain: string | null,
  searchResults: Array<{ query: string; results: any[] }>,
  fieldKeys: string[]
): Promise<ExtractionResult> {
  // Early return if no API key
  if (!FIREWORKS_API_KEY) {
    console.warn('[Fireworks DeepSeek] Skipping extraction - no API key configured');
    return {};
  }

  const prompt = buildExtractionPrompt(
    companyName,
    domain,
    searchResults,
    fieldKeys
  );

  const response = await fetch(FIREWORKS_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${FIREWORKS_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: DEEPSEEK_MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
      max_tokens: 800,
      temperature: 0.1, // low temperature for factual extraction
    }),
  });

  if (!response.ok) {
    throw new Error(`Fireworks DeepSeek error: ${response.status}`);
  }

  const data = await response.json();
  const text = data.choices[0]?.message?.content ?? '';

  // Track token usage for cost accounting (Fireworks pricing for DeepSeek V4 Flash)
  const usage = {
    inputTokens: data.usage?.prompt_tokens ?? 0,
    outputTokens: data.usage?.completion_tokens ?? 0,
    costUsd:
      (data.usage?.prompt_tokens ?? 0) * INPUT_COST_PER_TOKEN +
      (data.usage?.completion_tokens ?? 0) * OUTPUT_COST_PER_TOKEN,
  };

  try {
    const cleaned = text
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();
    const parsed = JSON.parse(cleaned);
    return { ...parsed, _usage: usage };
  } catch {
    console.error('[Fireworks DeepSeek] Failed to parse JSON:', text.slice(0, 200));
    return {};
  }
}
