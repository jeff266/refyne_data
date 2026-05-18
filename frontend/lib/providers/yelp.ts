/**
 * Yelp Provider Adapter
 *
 * Local business search using Yelp's GraphQL API.
 * Better rate limits than REST API (25,000 points/day vs 500 calls/day).
 *
 * API Docs: https://docs.developer.yelp.com/docs/graphql-overview
 */

import {
  ProviderAdapter,
  ProviderResponse,
  CompanyQuery,
  SearchQuery,
  ProviderError,
  createProviderResponse,
} from './types';

const YELP_GRAPHQL_URL = 'https://api.yelp.com/v3/graphql';

/**
 * Get Yelp API key from environment.
 */
function getApiKey(): string {
  const key = process.env.YELP_API_KEY;
  if (!key) {
    throw new ProviderError('yelp', 'config_error', 'YELP_API_KEY not configured');
  }
  return key;
}

/**
 * Category mapping for common industries.
 */
const YELP_CATEGORIES: Record<string, string> = {
  fitness: 'fitness,gyms',
  restaurants: 'restaurants',
  auto_repair: 'autorepair',
  beauty: 'beautysvc',
  medical: 'health',
  legal: 'lawyers',
  accounting: 'accountants',
  real_estate: 'realestate',
  home_services: 'homeservices',
  pet_services: 'pets',
};

/**
 * Map common industry names to Yelp category aliases.
 */
function getCategoryAlias(industry: string): string | undefined {
  const industryLower = industry.toLowerCase().replace(/[\s-]/g, '_');
  return YELP_CATEGORIES[industryLower];
}

/**
 * Format Yelp hours array to readable string.
 */
function formatHours(hoursList: Array<{ day: number; start: string; end: string }>): string | null {
  if (!hoursList || hoursList.length === 0) {
    return null;
  }

  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const formatted: string[] = [];

  for (const entry of hoursList) {
    const dayIdx = entry.day || 0;
    const start = entry.start || '';
    const end = entry.end || '';

    if (start && end) {
      const startFmt = `${start.slice(0, 2)}:${start.slice(2)}`;
      const endFmt = `${end.slice(0, 2)}:${end.slice(2)}`;
      formatted.push(`${days[dayIdx]}: ${startFmt}-${endFmt}`);
    }
  }

  return formatted.length > 0 ? formatted.join('; ') : null;
}

/**
 * Transform a single Yelp business to standard format.
 */
function transformBusiness(business: Record<string, unknown>): Record<string, unknown> {
  const location = (business.location as Record<string, unknown>) || {};

  // Build formatted address
  const addressParts = [
    location.address1,
    location.address2,
    [location.city, location.state, location.zip_code].filter(Boolean).join(' ').trim(),
  ].filter(Boolean);
  const address = addressParts.join(', ');

  // Format hours
  const hoursData = business.hours as Array<{ is_open_now?: boolean; open?: Array<{ day: number; start: string; end: string }> }>;
  let hoursFormatted: string | null = null;
  if (hoursData && hoursData.length > 0 && hoursData[0].open) {
    hoursFormatted = formatHours(hoursData[0].open);
  }

  // Extract categories
  const categories = ((business.categories as Array<{ title: string }>) || []).map((c) => c.title);

  return {
    name: business.name,
    address: address || location.formatted_address,
    phone: business.display_phone || business.phone,
    website: null, // Yelp doesn't provide business websites directly
    yelp_url: business.url,
    yelp_rating: business.rating,
    yelp_review_count: business.review_count,
    price_level: business.price,
    categories,
    hours: hoursFormatted,
    is_closed: business.is_closed || false,
    photos: business.photos || [],
    coordinates: business.coordinates,
    yelp_id: business.id,
  };
}

/**
 * Search for businesses using Yelp GraphQL API.
 */
async function searchBusinesses(
  term: string,
  location: string,
  limit: number = 20,
  categories?: string
): Promise<{ total: number; results: Record<string, unknown>[] }> {
  const apiKey = getApiKey();

  const query = `
    query SearchBusinesses($term: String!, $location: String!, $limit: Int, $categories: String) {
      search(term: $term, location: $location, limit: $limit, categories: $categories) {
        total
        business {
          id
          name
          url
          phone
          display_phone
          rating
          review_count
          price
          is_closed
          categories {
            title
            alias
          }
          coordinates {
            latitude
            longitude
          }
          location {
            address1
            address2
            city
            state
            zip_code
            country
            formatted_address
          }
          hours {
            is_open_now
            open {
              day
              start
              end
            }
          }
          photos
        }
      }
    }
  `;

  const variables: Record<string, unknown> = {
    term,
    location,
    limit: Math.min(limit, 50),
  };

  if (categories) {
    variables.categories = categories;
  }

  const response = await fetch(YELP_GRAPHQL_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    throw new ProviderError(
      'yelp',
      'api_error',
      `API request failed: ${response.statusText}`,
      response.status
    );
  }

  const data = await response.json();

  if (data.errors) {
    throw new ProviderError('yelp', 'api_error', `GraphQL error: ${JSON.stringify(data.errors)}`);
  }

  const searchData = data.data?.search || {};
  const businesses = searchData.business || [];

  return {
    total: searchData.total || 0,
    results: businesses.map(transformBusiness),
  };
}

/**
 * Get detailed information about a specific business.
 */
async function getBusinessDetails(businessId: string): Promise<Record<string, unknown> | null> {
  const apiKey = getApiKey();

  const query = `
    query GetBusiness($id: String!) {
      business(id: $id) {
        id
        name
        url
        phone
        display_phone
        rating
        review_count
        price
        is_closed
        categories {
          title
          alias
        }
        coordinates {
          latitude
          longitude
        }
        location {
          address1
          address2
          city
          state
          zip_code
          country
          formatted_address
        }
        hours {
          is_open_now
          open {
            day
            start
            end
          }
        }
        photos
        reviews(limit: 3) {
          id
          rating
          text
          time_created
          user {
            name
          }
        }
      }
    }
  `;

  const response = await fetch(YELP_GRAPHQL_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables: { id: businessId } }),
  });

  if (!response.ok) {
    throw new ProviderError(
      'yelp',
      'api_error',
      `API request failed: ${response.statusText}`,
      response.status
    );
  }

  const data = await response.json();

  if (data.errors) {
    throw new ProviderError('yelp', 'api_error', `GraphQL error: ${JSON.stringify(data.errors)}`);
  }

  const business = data.data?.business;
  return business ? transformBusiness(business) : null;
}

/**
 * Yelp Provider Adapter
 *
 * Local business search and enrichment via GraphQL API.
 */
export class YelpAdapter implements ProviderAdapter {
  id = 'yelp';
  name = 'Yelp';

  /**
   * Enrich a business by searching for it by name.
   */
  async enrichCompany(query: CompanyQuery): Promise<ProviderResponse | null> {
    if (!query.name && !query.domain) {
      throw new ProviderError('yelp', 'api_error', 'Must provide either domain or name');
    }

    // Yelp requires a location for search, default to USA if not specified
    const searchTerm = query.name || query.domain || '';

    // Try to get first result from a broad search
    const results = await searchBusinesses(searchTerm, 'USA', 1);

    if (results.results.length === 0) {
      return null;
    }

    const business = results.results[0];

    return createProviderResponse(this.id, business, business);
  }

  /**
   * Search for businesses by term and location.
   */
  async search(query: SearchQuery): Promise<ProviderResponse[]> {
    const term = query.term || query.query || query.industry || '';
    const location = query.location || 'USA';

    if (!term) {
      throw new ProviderError('yelp', 'api_error', 'Must provide term, query, or industry for search');
    }

    // Map industry to Yelp category if applicable
    let categories = query.categories;
    if (!categories && query.industry) {
      categories = getCategoryAlias(query.industry);
    }

    const results = await searchBusinesses(term, location, query.limit || 20, categories);

    return results.results.map((result) => createProviderResponse(this.id, result, result));
  }

  /**
   * Get detailed business information by Yelp ID.
   */
  async getBusinessById(businessId: string): Promise<ProviderResponse | null> {
    const business = await getBusinessDetails(businessId);

    if (!business) {
      return null;
    }

    return createProviderResponse(this.id, business, business);
  }
}

export default YelpAdapter;
