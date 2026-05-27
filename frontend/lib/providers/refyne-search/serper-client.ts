// Serper client - Google search via Serper API
// Changes from previous version:
//   - Removed "ABA therapy" hardcode from Query 3
//   - Added optional cachedIndustry param for context-aware queries
//   - Query 3 now works universally across all verticals

// Railway uses SERPER_API_KEY, local dev uses REFYNE_SERPER_KEY
const SERPER_API_KEY =
  process.env.SERPER_API_KEY || process.env.REFYNE_SERPER_KEY;

export interface SerperResult {
  title: string;
  link: string;
  snippet: string;
  date?: string;
}

interface SerperResponse {
  organic: Array<{
    title: string;
    link: string;
    snippet: string;
    date?: string;
  }>;
}

export async function searchWeb(
  query: string,
  numResults: number = 5
): Promise<SerperResult[]> {
  if (!SERPER_API_KEY) {
    console.warn('[Serper] No API key configured');
    return [];
  }

  try {
    const res = await fetch('https://google.serper.dev/search', {
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

    if (!res.ok) {
      console.warn(`[Serper] HTTP ${res.status} for query: ${query}`);
      return [];
    }

    const data: SerperResponse = await res.json();
    return (data.organic ?? []).map((r) => ({
      title: r.title,
      link: r.link,
      snippet: r.snippet,
      date: r.date,
    }));
  } catch (err: any) {
    console.error(`[Serper] Error for query "${query}":`, err?.message);
    return [];
  }
}

/**
 * Build 1-3 search queries for a company.
 *
 * @param domain         Company domain (e.g. "fronteracare.com")
 * @param companyName    Company name (e.g. "Frontera Health")
 * @param fieldKeys      Fields being requested (unused currently, reserved)
 * @param cachedIndustry Optional industry hint from cache (e.g. "Healthcare Technology")
 *                       When provided, adds industry context to Query 3.
 *                       When null, Query 3 is still useful - just less precise.
 */
export function buildCompanyQueries(
  domain: string | null,
  companyName: string | null,
  fieldKeys: string[],
  cachedIndustry: string | null = null
): string[] {
  const queries: string[] = [];

  if (!domain && !companyName) return queries;

  // Query 1: LinkedIn by domain (best signal for employee count + industry)
  if (domain) {
    const domainWithoutTld = domain.replace(/\.[^.]+$/, '');
    queries.push(`site:linkedin.com/company "${domainWithoutTld}"`);
  }

  // Query 2: LinkedIn by company name (fallback for domains with no SEO)
  if (companyName && companyName !== domain) {
    queries.push(`site:linkedin.com/company "${companyName}"`);
  }

  // Query 3: General web search
  // Uses cached industry as context when available.
  // Falls back to bare company name search - still finds LinkedIn,
  // Glassdoor, Indeed, Crunchbase even without vertical hint.
  if (companyName) {
    const industryHint = cachedIndustry ? ` ${cachedIndustry}` : '';
    queries.push(
      `"${companyName}"${industryHint} employees OR revenue OR staff`
    );
  }

  // Query 4: Domain general search (fallback when we have few queries)
  if (domain && queries.length < 3) {
    const domainWithoutTld = domain.replace(/\.[^.]+$/, '');
    queries.push(`"${domain}" OR "${domainWithoutTld}" employees`);
  }

  // Deduplicate and cap at 3 to control Serper cost
  return Array.from(new Set(queries)).slice(0, 3);
}
