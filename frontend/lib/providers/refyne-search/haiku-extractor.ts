// Haiku extractor
// Same interface as deepseek-extractor.ts.
// Used in two cases:
//   1. Preview context: always (fast UI feedback)
//   2. Background context: when DeepSeek V4 Flash exceeds 5s timeout
//
// Uses claude-haiku-4-5-20251001 via Anthropic API directly.
// Cost: $0.80/M input, $4/M output (vs DeepSeek $0.14/$0.28 via Fireworks)
// Speed: ~1-2s vs DeepSeek ~3-8s
// Quality: slightly lower for complex extractions, fine for most fields

const ANTHROPIC_API_KEY =
  process.env.ANTHROPIC_API_KEY || process.env.REFYNE_ANTHROPIC_KEY;

const HAIKU_MODEL = 'claude-haiku-4-5-20251001';

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

export async function extractWithHaiku(
  companyName: string | null,
  domain: string | null,
  searchResults: Array<{ query: string; results: any[] }>,
  fieldKeys: string[]
): Promise<Record<string, any>> {
  if (!ANTHROPIC_API_KEY) {
    console.warn('[Haiku] No Anthropic API key configured');
    return buildNullResult(fieldKeys);
  }

  const prompt = buildExtractionPrompt(
    companyName,
    domain,
    searchResults,
    fieldKeys
  );

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: HAIKU_MODEL,
        max_tokens: 800,
        temperature: 0.1,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!res.ok) {
      console.error(`[Haiku] HTTP ${res.status}`);
      return buildNullResult(fieldKeys);
    }

    const data = await res.json();
    const text = data.content?.[0]?.text ?? '';

    // Track usage for cost logging
    const inputTokens = data.usage?.input_tokens ?? 0;
    const outputTokens = data.usage?.output_tokens ?? 0;
    // Haiku pricing: $0.80/M input, $4/M output
    const costUsd =
      inputTokens * 0.0000008 + outputTokens * 0.000004;

    const cleaned = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleaned);

    // Attach usage metadata same pattern as deepseek-extractor
    parsed._usage = { inputTokens, outputTokens, costUsd };
    parsed._model = 'haiku';

    return parsed;
  } catch (err: any) {
    console.error('[Haiku] Extraction error:', err?.message);
    return buildNullResult(fieldKeys);
  }
}

function buildNullResult(fieldKeys: string[]): Record<string, any> {
  const result: Record<string, any> = {};
  for (const key of fieldKeys) {
    result[key] = {
      value: null,
      confidence: 0,
      evidence: '',
      sources: [],
    };
  }
  result._usage = { inputTokens: 0, outputTokens: 0, costUsd: 0 };
  result._model = 'haiku-null';
  return result;
}
