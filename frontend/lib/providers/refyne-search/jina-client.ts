// Jina Reader client
// Fetches full homepage content and returns it in the same
// SerperResult[] structure that DeepSeek expects.
// Runs in parallel with Serper, not after it.

export interface SerperResult {
  title: string;
  link: string;
  snippet: string;
  date?: string;
}

// Railway uses JINA_API_KEY, local dev uses REFYNE_JINA_KEY
const JINA_API_KEY =
  process.env.JINA_API_KEY || process.env.REFYNE_JINA_KEY || null;

const JINA_TIMEOUT_MS = 8000;
const MAX_CONTENT_CHARS = 3000; // Keep token cost low for DeepSeek

/**
 * Fetch a domain's homepage via Jina Reader and return as SerperResult[].
 * Returns empty array on failure so callers can treat it as a no-op.
 */
export async function fetchWithJina(
  domain: string
): Promise<SerperResult[]> {
  if (!domain) return [];

  const url = `https://r.jina.ai/https://${domain}`;

  const headers: Record<string, string> = {
    Accept: 'text/plain',
    'X-Return-Format': 'text',
    'X-Timeout': String(Math.floor(JINA_TIMEOUT_MS / 1000)),
    'User-Agent': 'Refyne-Enrichment/1.0',
  };

  if (JINA_API_KEY) {
    headers['Authorization'] = `Bearer ${JINA_API_KEY}`;
  }

  try {
    const res = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(JINA_TIMEOUT_MS),
    });

    if (!res.ok) {
      console.log(`[Jina] ${domain} returned HTTP ${res.status}`);
      return [];
    }

    const text = await res.text();

    if (!text || text.trim().length < 100) {
      console.log(`[Jina] ${domain} returned empty or too-short content`);
      return [];
    }

    // Truncate to keep DeepSeek input tokens reasonable
    const content = text.slice(0, MAX_CONTENT_CHARS);

    // Return as a single SerperResult so it slots into the
    // existing successfulSearches structure unchanged
    return [
      {
        title: `Homepage: ${domain}`,
        link: `https://${domain}`,
        snippet: content,
      },
    ];
  } catch (err: any) {
    const reason =
      err?.name === 'TimeoutError' ? 'timeout' : err?.message ?? 'unknown';
    console.log(`[Jina] ${domain} failed: ${reason}`);
    return [];
  }
}
