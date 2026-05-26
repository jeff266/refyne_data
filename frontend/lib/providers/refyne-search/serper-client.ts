// Serper API client
// Keys managed centrally by Refyne (not org-specific)
// Never exposed to clients

// Railway uses SERPER_API_KEY, local dev uses REFYNE_SERPER_KEY
const SERPER_API_KEY = process.env.SERPER_API_KEY || process.env.REFYNE_SERPER_KEY;
const SERPER_ENDPOINT = 'https://google.serper.dev/search';

// Startup check: warn if API key is missing
if (!SERPER_API_KEY) {
  console.error('[Refyne Search] CRITICAL: SERPER_API_KEY or REFYNE_SERPER_KEY not set - all searches will return empty');
  console.error('[Refyne Search] Set SERPER_API_KEY in production or REFYNE_SERPER_KEY for local dev');
} else {
  console.log(`[Refyne Search] Serper API key configured (${SERPER_API_KEY.substring(0, 8)}...)`);
}

export interface SerperResult {
  title: string;
  link: string;
  snippet: string;
  date?: string;
}

export async function searchWeb(
  query: string,
  numResults: number = 5
): Promise<SerperResult[]> {
  // Early return if no API key
  if (!SERPER_API_KEY) {
    console.warn('[Serper] Skipping search - no API key configured');
    return [];
  }

  const response = await fetch(SERPER_ENDPOINT, {
    method: 'POST',
    headers: {
      'X-API-KEY': SERPER_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      q: query,
      num: numResults,
      gl: 'us',
      hl: 'en',
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[Serper] API error ${response.status}:`, errorText);
    throw new Error(`Serper error: ${response.status}`);
  }

  const data = await response.json();
  return (data.organic ?? []).map((r: any) => ({
    title: r.title,
    link: r.link,
    snippet: r.snippet,
    date: r.date,
  }));
}

export function buildCompanyQueries(
  domain: string | null,
  companyName: string | null,
  fieldKeys: string[]
): string[] {
  const queries: string[] = [];

  if (!domain && !companyName) return queries;

  // Query 1: LinkedIn by domain (best signal for employee count + industry)
  if (domain) {
    queries.push(`site:linkedin.com/company "${domain.replace(/\.[^.]+$/, '')}"`);
  }

  // Query 2: LinkedIn by company name (fallback for domains with no SEO)
  if (companyName && companyName !== domain) {
    queries.push(`site:linkedin.com/company "${companyName}"`);
  }

  // Query 3: General web search with company name
  // CRITICAL for small local businesses - finds LinkedIn, Glassdoor, Indeed, etc.
  // even when domain itself has no indexed pages
  if (companyName) {
    queries.push(`"${companyName}" ABA therapy employees OR revenue OR staff`);
  }

  // Query 4: Domain general search (fallback)
  if (domain && queries.length < 3) {
    queries.push(`"${domain}" OR "${domain.replace(/\.[^.]+$/, '')}" employees`);
  }

  // Deduplicate and return max 3 queries to save API costs
  return Array.from(new Set(queries)).slice(0, 3);
}
