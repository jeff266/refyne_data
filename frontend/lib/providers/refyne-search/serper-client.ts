// Serper API client
// Keys managed centrally by Refyne (not org-specific)
// Never exposed to clients

// Railway uses SERPER_API_KEY, local dev uses REFYNE_SERPER_KEY
const SERPER_API_KEY = process.env.SERPER_API_KEY || process.env.REFYNE_SERPER_KEY;
const SERPER_ENDPOINT = 'https://google.serper.dev/search';

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
  const response = await fetch(SERPER_ENDPOINT, {
    method: 'POST',
    headers: {
      'X-API-KEY': SERPER_API_KEY!,
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
  const target = domain ?? companyName;

  if (!target) return queries;

  // Base query: LinkedIn for employee count + industry
  if (fieldKeys.includes('employee_count') || fieldKeys.includes('industry')) {
    queries.push(
      domain
        ? `site:linkedin.com/company "${domain.replace(/\.[^.]+$/, '')}"`
        : `site:linkedin.com/company "${companyName}"`
    );
  }

  // Revenue query: Crunchbase, Pitchbook, ZoomInfo
  if (fieldKeys.includes('revenue')) {
    queries.push(
      `"${companyName ?? domain}" revenue annual 2024 OR 2025`
    );
  }

  // General firmographic query
  queries.push(
    domain
      ? `"${domain}" company employees industry`
      : `"${companyName}" company employees industry headquarters`
  );

  return queries;
}
