/**
 * Serper Provider Adapter
 *
 * Google Maps data for SMB Brick & Mortar enrichment via Serper API.
 * Provides local business search with ratings, reviews, and contact info.
 *
 * API Docs: https://serper.dev/docs
 */

import {
  ProviderAdapter,
  ProviderResponse,
  CompanyQuery,
  SearchQuery,
  ProviderError,
  createProviderResponse,
  LocalBusinessResult,
} from './types';

const SERPER_MAPS_URL = 'https://google.serper.dev/maps';

/**
 * Get Serper API key from environment.
 */
function getApiKey(): string {
  const key = process.env.SERPER_API_KEY;
  if (!key) {
    throw new ProviderError('serper', 'config_error', 'SERPER_API_KEY not configured');
  }
  return key;
}

/**
 * Search for local businesses using Serper's Google Maps API.
 */
async function searchLocalBusinesses(
  industry: string,
  location: string,
  numResults: number = 20
): Promise<LocalBusinessResult[]> {
  const apiKey = getApiKey();
  const query = `${industry} in ${location}`;

  const response = await fetch(SERPER_MAPS_URL, {
    method: 'POST',
    headers: {
      'X-API-KEY': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      q: query,
      num: numResults,
    }),
  });

  if (!response.ok) {
    throw new ProviderError(
      'serper',
      'api_error',
      `API request failed: ${response.statusText}`,
      response.status
    );
  }

  const data = await response.json();
  const places = data.places || [];

  return places.map((place: Record<string, unknown>) => ({
    name: (place.title as string) || '',
    address: (place.address as string) || '',
    phone: (place.phoneNumber as string) || '',
    website: (place.website as string) || '',
    rating: place.rating as number | undefined,
    reviews: place.ratingCount as number | undefined,
    category: (place.category as string) || '',
  }));
}

/**
 * Serper Provider Adapter
 *
 * Specializes in local business search via Google Maps.
 * enrichCompany attempts to find a business by name in a general search.
 */
export class SerperAdapter implements ProviderAdapter {
  id = 'serper';
  name = 'Serper';

  /**
   * Enrich a company by searching for it.
   * Since Serper is a search API, we search by company name.
   */
  async enrichCompany(query: CompanyQuery): Promise<ProviderResponse | null> {
    if (!query.name && !query.domain) {
      throw new ProviderError('serper', 'api_error', 'Must provide either domain or name');
    }

    const searchTerm = query.name || query.domain || '';
    const apiKey = getApiKey();

    const response = await fetch(SERPER_MAPS_URL, {
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        q: searchTerm,
        num: 1,
      }),
    });

    if (!response.ok) {
      throw new ProviderError(
        'serper',
        'api_error',
        `API request failed: ${response.statusText}`,
        response.status
      );
    }

    const data = await response.json();
    const places = data.places || [];

    if (places.length === 0) {
      return null;
    }

    const place = places[0];

    return createProviderResponse(
      this.id,
      place,
      {
        name: place.title || '',
        address: place.address || '',
        phone: place.phoneNumber || '',
        website: place.website || '',
        rating: place.rating,
        reviews: place.ratingCount,
        category: place.category || '',
      }
    );
  }

  /**
   * Search for local businesses by industry and location.
   */
  async search(query: SearchQuery): Promise<ProviderResponse[]> {
    const industry = query.term || query.industry || query.query || '';
    const location = query.location || '';

    if (!industry || !location) {
      throw new ProviderError(
        'serper',
        'api_error',
        'Must provide term/industry and location for search'
      );
    }

    const results = await searchLocalBusinesses(industry, location, query.limit || 20);

    return results.map((result) =>
      createProviderResponse(
        this.id,
        result as unknown as Record<string, unknown>,
        result as unknown as Record<string, unknown>
      )
    );
  }
}

export default SerperAdapter;
