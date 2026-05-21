/**
 * Provider Adapter Tests
 *
 * Tests adapter interface compliance and response shapes.
 * Uses mocked fetch to avoid real API calls.
 *
 * @vitest-environment node
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  ProviderAdapter,
  ProviderResponse,
  ContactResponse,
  ProviderError,
  createProviderResponse,
  createContactResponse,
  formatRevenue,
  getProvider,
  getProviderIds,
  getProviderRegistry,
  hasProvider,
  registerProvider,
} from './index';
import { SerperAdapter } from './serper';
import { ApolloAdapter } from './apollo';
import { ZoomInfoAdapter, clearTokenCache } from './zoominfo';
import { ClayAdapter } from './clay';
import { GraphiqAdapter } from './graphiq';
import { YelpAdapter } from './yelp';

// ─────────────────────────────────────────────────────────────
// Mock Setup
// ─────────────────────────────────────────────────────────────

const mockFetch = vi.fn();

beforeEach(() => {
  // Mock global fetch
  vi.stubGlobal('fetch', mockFetch);

  // Set up test environment variables
  process.env.SERPER_API_KEY = 'test-serper-key';
  process.env.APOLLO_API_KEY = 'test-apollo-key';
  process.env.ZOOMINFO_CLIENT_ID = 'test-zi-client';
  process.env.ZOOMINFO_CLIENT_SECRET = 'test-zi-secret';
  process.env.CLAY_API_KEY = 'test-clay-key';
  process.env.GRAPHIQ_API_KEY = 'test-graphiq-key';
  process.env.YELP_API_KEY = 'test-yelp-key';

  // Clear ZoomInfo token cache between tests
  clearTokenCache();
});

afterEach(() => {
  vi.unstubAllGlobals();
  mockFetch.mockReset();

  // Clean up environment
  delete process.env.SERPER_API_KEY;
  delete process.env.APOLLO_API_KEY;
  delete process.env.ZOOMINFO_CLIENT_ID;
  delete process.env.ZOOMINFO_CLIENT_SECRET;
  delete process.env.CLAY_API_KEY;
  delete process.env.GRAPHIQ_API_KEY;
  delete process.env.YELP_API_KEY;
});

// ─────────────────────────────────────────────────────────────
// Helper: Create Mock Response
// ─────────────────────────────────────────────────────────────

function createMockResponse(data: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    statusText: ok ? 'OK' : 'Error',
    json: async () => data,
    headers: new Headers(),
    redirected: false,
    type: 'basic',
    url: '',
    clone: () => createMockResponse(data, ok, status),
    body: null,
    bodyUsed: false,
    arrayBuffer: async () => new ArrayBuffer(0),
    blob: async () => new Blob(),
    formData: async () => new FormData(),
    text: async () => JSON.stringify(data),
  } as Response;
}

// ─────────────────────────────────────────────────────────────
// Test: Utility Functions
// ─────────────────────────────────────────────────────────────

describe('Utility Functions', () => {
  describe('formatRevenue', () => {
    it('should format billions', () => {
      expect(formatRevenue(1_500_000_000)).toBe('$1.5B');
      expect(formatRevenue(5_000_000_000)).toBe('$5.0B');
    });

    it('should format millions', () => {
      expect(formatRevenue(50_000_000)).toBe('$50M');
      expect(formatRevenue(1_000_000)).toBe('$1M');
    });

    it('should format thousands', () => {
      expect(formatRevenue(500_000)).toBe('$500K');
      expect(formatRevenue(1_000)).toBe('$1K');
    });

    it('should format small numbers', () => {
      expect(formatRevenue(500)).toBe('$500');
    });

    it('should handle null/undefined', () => {
      expect(formatRevenue(null)).toBe('Unknown');
      expect(formatRevenue(undefined)).toBe('Unknown');
    });

    it('should handle string input', () => {
      expect(formatRevenue('50000000')).toBe('$50M');
      expect(formatRevenue('not a number')).toBe('not a number');
    });
  });

  describe('createProviderResponse', () => {
    it('should create response with required fields', () => {
      const response = createProviderResponse('test', { foo: 'bar' });

      expect(response._source).toBe('test');
      expect(response._retrieved_at).toBeDefined();
      expect(new Date(response._retrieved_at).getTime()).not.toBeNaN();
      expect(response.raw).toEqual({ foo: 'bar' });
      expect(response.normalized).toBeUndefined();
    });

    it('should include normalized fields when provided', () => {
      const response = createProviderResponse('test', { foo: 'bar' }, { name: 'Test' });

      expect(response.normalized).toEqual({ name: 'Test' });
    });
  });

  describe('createContactResponse', () => {
    it('should create contact response with metadata', () => {
      const response = createContactResponse('test', {
        name: 'John Doe',
        title: 'CEO',
        email: 'john@example.com',
        raw: { id: '123' },
      });

      expect(response._source).toBe('test');
      expect(response._retrieved_at).toBeDefined();
      expect(response.name).toBe('John Doe');
      expect(response.title).toBe('CEO');
      expect(response.email).toBe('john@example.com');
    });
  });
});

// ─────────────────────────────────────────────────────────────
// Test: Provider Registry
// ─────────────────────────────────────────────────────────────

describe('Provider Registry', () => {
  it('should have all expected providers', () => {
    const ids = getProviderIds();

    expect(ids).toContain('serper');
    expect(ids).toContain('apollo');
    expect(ids).toContain('zoominfo');
    expect(ids).toContain('clay');
    expect(ids).toContain('graphiq');
    expect(ids).toContain('yelp');
  });

  it('should return provider by ID', () => {
    const apollo = getProvider('apollo');

    expect(apollo).toBeDefined();
    expect(apollo?.id).toBe('apollo');
    expect(apollo?.name).toBe('Apollo');
  });

  it('should return undefined for unknown provider', () => {
    const unknown = getProvider('unknown-provider');

    expect(unknown).toBeUndefined();
  });

  it('should check provider existence', () => {
    expect(hasProvider('apollo')).toBe(true);
    expect(hasProvider('unknown')).toBe(false);
  });

  it('should allow registering new providers', () => {
    const customAdapter: ProviderAdapter = {
      id: 'custom',
      name: 'Custom Provider',
      enrichCompany: async () => null,
    };

    registerProvider(customAdapter);

    expect(hasProvider('custom')).toBe(true);
    expect(getProvider('custom')).toBe(customAdapter);
  });
});

// ─────────────────────────────────────────────────────────────
// Test: Interface Compliance
// ─────────────────────────────────────────────────────────────

describe('Provider Interface Compliance', () => {
  const adapters: ProviderAdapter[] = [
    new SerperAdapter(),
    new ApolloAdapter('test-apollo-key'),
    new ZoomInfoAdapter(),
    new ClayAdapter(),
    new GraphiqAdapter(),
    new YelpAdapter(),
  ];

  it.each(adapters.map((a) => [a.id, a]))(
    '%s adapter should have required properties',
    (id, adapter) => {
      expect(adapter.id).toBe(id);
      expect(typeof adapter.name).toBe('string');
      expect(adapter.name.length).toBeGreaterThan(0);
      expect(typeof adapter.enrichCompany).toBe('function');
    }
  );
});

// ─────────────────────────────────────────────────────────────
// Test: Serper Adapter
// ─────────────────────────────────────────────────────────────

describe('SerperAdapter', () => {
  const adapter = new SerperAdapter();

  it('should have correct id and name', () => {
    expect(adapter.id).toBe('serper');
    expect(adapter.name).toBe('Serper');
  });

  it('should enrich company by name', async () => {
    mockFetch.mockResolvedValueOnce(
      createMockResponse({
        places: [
          {
            title: 'Acme Fitness',
            address: '123 Main St, Austin, TX',
            phoneNumber: '555-1234',
            website: 'https://acmefitness.com',
            rating: 4.5,
            ratingCount: 150,
            category: 'Fitness Center',
          },
        ],
      })
    );

    const result = await adapter.enrichCompany({ name: 'Acme Fitness' });

    expect(result).not.toBeNull();
    expect(result?._source).toBe('serper');
    expect(result?._retrieved_at).toBeDefined();
    expect(result?.normalized?.name).toBe('Acme Fitness');
    expect(result?.normalized?.rating).toBe(4.5);
  });

  it('should return null when no results found', async () => {
    mockFetch.mockResolvedValueOnce(createMockResponse({ places: [] }));

    const result = await adapter.enrichCompany({ name: 'Nonexistent' });

    expect(result).toBeNull();
  });

  it('should search local businesses', async () => {
    mockFetch.mockResolvedValueOnce(
      createMockResponse({
        places: [
          { title: 'Gym 1', address: '111 St', rating: 4.0 },
          { title: 'Gym 2', address: '222 St', rating: 4.5 },
        ],
      })
    );

    const results = await adapter.search!({
      term: 'fitness centers',
      location: 'Austin, TX',
      limit: 10,
    });

    expect(results).toHaveLength(2);
    expect(results[0]._source).toBe('serper');
  });

  it('should throw on missing API key', async () => {
    delete process.env.SERPER_API_KEY;

    await expect(adapter.enrichCompany({ name: 'Test' })).rejects.toThrow(ProviderError);
  });
});

// ─────────────────────────────────────────────────────────────
// Test: Apollo Adapter
// ─────────────────────────────────────────────────────────────

describe('ApolloAdapter', () => {
  const adapter = new ApolloAdapter('test-apollo-key');

  it('should have correct id and name', () => {
    expect(adapter.id).toBe('apollo');
    expect(adapter.name).toBe('Apollo');
  });

  it('should enrich company by domain', async () => {
    mockFetch.mockResolvedValueOnce(
      createMockResponse({
        organization: {
          name: 'Notion Labs',
          primary_domain: 'notion.so',
          industry: 'Software',
          estimated_num_employees: 500,
          annual_revenue: 50_000_000,
          founded_year: 2016,
          linkedin_url: 'https://linkedin.com/company/notion',
          short_description: 'All-in-one workspace',
          city: 'San Francisco',
          state: 'California',
          country: 'United States',
        },
      })
    );

    const result = await adapter.enrichCompany({ domain: 'notion.so' });

    expect(result).not.toBeNull();
    expect(result?._source).toBe('apollo');
    expect(result?.normalized?.name).toBe('Notion Labs');
    expect(result?.normalized?.employee_count).toBe(500);
    expect(result?.normalized?.revenue_range).toBe('$50M');
  });

  it('should return null when organization not found', async () => {
    mockFetch.mockResolvedValueOnce(createMockResponse({ organization: null }));

    const result = await adapter.enrichCompany({ domain: 'unknown.com' });

    expect(result).toBeNull();
  });

  it('should search contacts', async () => {
    mockFetch.mockResolvedValueOnce(
      createMockResponse({
        people: [
          {
            name: 'Jane Smith',
            title: 'CEO',
            email: 'jane@example.com',
            linkedin_url: 'https://linkedin.com/in/janesmith',
            city: 'New York',
            state: 'NY',
          },
        ],
      })
    );

    const contacts = await adapter.searchContacts!({
      domain: 'example.com',
      titles: ['CEO', 'CTO'],
      limit: 5,
    });

    expect(contacts).toHaveLength(1);
    expect(contacts[0]._source).toBe('apollo');
    expect(contacts[0].name).toBe('Jane Smith');
    expect(contacts[0].title).toBe('CEO');
  });
});

// ─────────────────────────────────────────────────────────────
// Test: ZoomInfo Adapter
// ─────────────────────────────────────────────────────────────

describe('ZoomInfoAdapter', () => {
  const adapter = new ZoomInfoAdapter();

  beforeEach(() => {
    clearTokenCache();
  });

  it('should have correct id and name', () => {
    expect(adapter.id).toBe('zoominfo');
    expect(adapter.name).toBe('ZoomInfo');
  });

  it('should authenticate and enrich company', async () => {
    // Auth response
    mockFetch.mockResolvedValueOnce(
      createMockResponse({ jwt: 'test-token' })
    );

    // Company enrich response
    mockFetch.mockResolvedValueOnce(
      createMockResponse({
        data: {
          result: [
            {
              data: [
                {
                  name: 'Salesforce',
                  website: 'salesforce.com',
                  industry: 'Software',
                  employeeCount: 70000,
                  revenue: 26_500_000_000,
                  city: 'San Francisco',
                  state: 'CA',
                  country: 'USA',
                },
              ],
            },
          ],
        },
      })
    );

    // Contacts response
    mockFetch.mockResolvedValueOnce(
      createMockResponse({
        data: {
          result: [
            {
              firstName: 'Marc',
              lastName: 'Benioff',
              jobTitle: 'CEO',
              email: 'marc@salesforce.com',
            },
          ],
        },
      })
    );

    const result = await adapter.enrichCompany({ domain: 'salesforce.com' });

    expect(result).not.toBeNull();
    expect(result?._source).toBe('zoominfo');
    expect((result?.normalized?.company as Record<string, unknown>)?.name).toBe('Salesforce');
    expect((result?.normalized?.contacts as unknown[])?.[0]).toBeDefined();
  });

  it('should cache JWT token', async () => {
    const companyResult = {
      data: {
        result: [{ data: [{ name: 'Test Company' }] }],
      },
    };
    const contactsResult = { data: { result: [] } };

    // First call - auth + enrich + contacts
    mockFetch
      .mockResolvedValueOnce(createMockResponse({ jwt: 'cached-token' }))
      .mockResolvedValueOnce(createMockResponse(companyResult))
      .mockResolvedValueOnce(createMockResponse(contactsResult));

    await adapter.enrichCompany({ domain: 'test1.com' });

    // Second call - should reuse token (no auth call)
    mockFetch
      .mockResolvedValueOnce(createMockResponse(companyResult))
      .mockResolvedValueOnce(createMockResponse(contactsResult));

    await adapter.enrichCompany({ domain: 'test2.com' });

    // Should have 5 calls total: 1 auth + 2 enrichments (each with company + contacts)
    expect(mockFetch).toHaveBeenCalledTimes(5);
  });

  it('should require domain for enrichment', async () => {
    await expect(adapter.enrichCompany({ name: 'Test' })).rejects.toThrow(
      'Domain is required for ZoomInfo enrichment'
    );
  });
});

// ─────────────────────────────────────────────────────────────
// Test: Clay Adapter
// ─────────────────────────────────────────────────────────────

describe('ClayAdapter', () => {
  const adapter = new ClayAdapter();

  it('should have correct id and name', () => {
    expect(adapter.id).toBe('clay');
    expect(adapter.name).toBe('Clay');
  });

  it('should generate mock brief without webhook URL', async () => {
    const result = await adapter.enrichCompany({ name: 'Test Company', domain: 'test.com' });

    expect(result).not.toBeNull();
    expect(result?._source).toBe('clay');
    expect(result?.normalized?.company_name).toBe('Test Company');
    expect(result?.normalized?.domain).toBe('test.com');
    expect(result?.normalized?.status).toBe('complete');
    expect(result?.normalized?.summary).toContain('AI-generated intelligence brief');
  });

  it('should use webhook URL when configured', async () => {
    process.env.CLAY_WEBHOOK_URL = 'https://clay.example.com/webhook';

    mockFetch.mockResolvedValueOnce(
      createMockResponse({
        status: 'triggered',
        run_id: 'abc123',
      })
    );

    const result = await adapter.enrichCompany({ name: 'Test' });

    expect(result).not.toBeNull();
    expect(mockFetch).toHaveBeenCalledWith(
      'https://clay.example.com/webhook',
      expect.any(Object)
    );

    delete process.env.CLAY_WEBHOOK_URL;
  });
});

// ─────────────────────────────────────────────────────────────
// Test: GraphIQ Adapter
// ─────────────────────────────────────────────────────────────

describe('GraphiqAdapter', () => {
  const adapter = new GraphiqAdapter();

  it('should have correct id and name', () => {
    expect(adapter.id).toBe('graphiq');
    expect(adapter.name).toBe('GraphIQ');
  });

  it('should enrich company by name', async () => {
    mockFetch.mockResolvedValueOnce(
      createMockResponse({
        entities: [
          {
            name: 'Precision Parts Inc',
            website: 'precisionparts.com',
            description: 'Precision machining company',
            capabilities: ['CNC machining', 'ball bearings'],
            industry: 'Manufacturing',
            city: 'Detroit',
            state: 'MI',
            country: 'USA',
            employee_count: 250,
          },
        ],
      })
    );

    const result = await adapter.enrichCompany({ name: 'Precision Parts' });

    expect(result).not.toBeNull();
    expect(result?._source).toBe('graphiq');
    expect(result?.normalized?.name).toBe('Precision Parts Inc');
    expect(result?.normalized?.capabilities).toContain('CNC machining');
  });

  it('should search by capabilities', async () => {
    mockFetch.mockResolvedValueOnce(
      createMockResponse({
        entities: [
          { name: 'Company A', capabilities: ['ball bearing'] },
          { name: 'Company B', capabilities: ['ball bearing', 'CNC'] },
        ],
      })
    );

    const results = await adapter.search!({
      capabilities: ['ball bearing', 'CNC machining'],
      limit: 10,
    });

    expect(results).toHaveLength(2);
    expect(results[0]._source).toBe('graphiq');
  });

  it('should search by query and filters', async () => {
    mockFetch.mockResolvedValueOnce(
      createMockResponse({
        entities: [{ name: 'Test Mfg', industry: 'Manufacturing' }],
      })
    );

    const results = await adapter.search!({
      query: 'precision machining',
      industry: 'Manufacturing',
      location: 'Michigan',
    });

    expect(results).toHaveLength(1);

    // Verify correct payload was sent
    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(callBody.organization.query).toBe('precision machining');
    expect(callBody.organization.industry).toBe('Manufacturing');
  });
});

// ─────────────────────────────────────────────────────────────
// Test: Yelp Adapter
// ─────────────────────────────────────────────────────────────

describe('YelpAdapter', () => {
  const adapter = new YelpAdapter();

  it('should have correct id and name', () => {
    expect(adapter.id).toBe('yelp');
    expect(adapter.name).toBe('Yelp');
  });

  it('should enrich business by name', async () => {
    mockFetch.mockResolvedValueOnce(
      createMockResponse({
        data: {
          search: {
            total: 1,
            business: [
              {
                id: 'biz-123',
                name: 'Great Pizza Place',
                url: 'https://yelp.com/biz/great-pizza',
                phone: '+15551234567',
                display_phone: '(555) 123-4567',
                rating: 4.5,
                review_count: 250,
                price: '$$',
                is_closed: false,
                categories: [{ title: 'Pizza', alias: 'pizza' }],
                location: {
                  address1: '456 Pizza St',
                  city: 'Austin',
                  state: 'TX',
                  zip_code: '78701',
                },
              },
            ],
          },
        },
      })
    );

    const result = await adapter.enrichCompany({ name: 'Great Pizza Place' });

    expect(result).not.toBeNull();
    expect(result?._source).toBe('yelp');
    expect(result?.normalized?.name).toBe('Great Pizza Place');
    expect(result?.normalized?.yelp_rating).toBe(4.5);
    expect(result?.normalized?.price_level).toBe('$$');
  });

  it('should search businesses with categories', async () => {
    mockFetch.mockResolvedValueOnce(
      createMockResponse({
        data: {
          search: {
            total: 2,
            business: [
              { id: 'gym-1', name: 'Fitness First', rating: 4.0 },
              { id: 'gym-2', name: 'Workout World', rating: 4.2 },
            ],
          },
        },
      })
    );

    const results = await adapter.search!({
      term: 'gyms',
      location: 'Austin, TX',
      industry: 'fitness',
      limit: 10,
    });

    expect(results).toHaveLength(2);
    expect(results[0]._source).toBe('yelp');
  });

  it('should handle GraphQL errors', async () => {
    mockFetch.mockResolvedValueOnce(
      createMockResponse({
        errors: [{ message: 'Invalid API key' }],
      })
    );

    await expect(adapter.enrichCompany({ name: 'Test' })).rejects.toThrow(ProviderError);
  });

  it('should get business by ID', async () => {
    mockFetch.mockResolvedValueOnce(
      createMockResponse({
        data: {
          business: {
            id: 'biz-456',
            name: 'Test Business',
            rating: 4.0,
            reviews: [{ id: 'r1', rating: 5, text: 'Great!' }],
          },
        },
      })
    );

    const result = await adapter.getBusinessById('biz-456');

    expect(result).not.toBeNull();
    expect(result?._source).toBe('yelp');
    expect(result?.normalized?.yelp_id).toBe('biz-456');
  });
});

// ─────────────────────────────────────────────────────────────
// Test: Response Shape Validation
// ─────────────────────────────────────────────────────────────

describe('Response Shape Validation', () => {
  function isValidProviderResponse(response: ProviderResponse | null): boolean {
    if (!response) return true; // null is valid for not found

    return (
      typeof response._source === 'string' &&
      response._source.length > 0 &&
      typeof response._retrieved_at === 'string' &&
      !isNaN(new Date(response._retrieved_at).getTime()) &&
      typeof response.raw === 'object' &&
      response.raw !== null
    );
  }

  function isValidContactResponse(response: ContactResponse): boolean {
    return (
      typeof response._source === 'string' &&
      typeof response._retrieved_at === 'string' &&
      typeof response.name === 'string' &&
      typeof response.raw === 'object'
    );
  }

  it('should return valid response shape from all adapters', async () => {
    const adapters = [
      { adapter: new SerperAdapter(), mockData: { places: [{ title: 'Test' }] } },
      {
        adapter: new ApolloAdapter('test-apollo-key'),
        mockData: { organization: { name: 'Test', primary_domain: 'test.com' } },
      },
      { adapter: new ClayAdapter(), mockData: null }, // Uses mock brief
      {
        adapter: new GraphiqAdapter(),
        mockData: { entities: [{ name: 'Test', website: 'test.com' }] },
      },
      {
        adapter: new YelpAdapter(),
        mockData: {
          data: { search: { total: 1, business: [{ id: '1', name: 'Test' }] } },
        },
      },
    ];

    for (const { adapter, mockData } of adapters) {
      if (mockData) {
        mockFetch.mockResolvedValueOnce(createMockResponse(mockData));
      }

      const result = await adapter.enrichCompany({ name: 'Test' });

      expect(
        isValidProviderResponse(result),
        `${adapter.id} should return valid response shape`
      ).toBe(true);

      mockFetch.mockReset();
    }
  });

  it('should return valid contact response shape', async () => {
    const adapter = new ApolloAdapter('test-apollo-key');

    mockFetch.mockResolvedValueOnce(
      createMockResponse({
        people: [{ name: 'John', title: 'CEO', email: 'john@test.com' }],
      })
    );

    const contacts = await adapter.searchContacts!({ domain: 'test.com' });

    expect(contacts.length).toBeGreaterThan(0);
    expect(isValidContactResponse(contacts[0])).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────
// Test: Error Handling
// ─────────────────────────────────────────────────────────────

describe('Error Handling', () => {
  it('should throw ProviderError with proper details', async () => {
    const adapter = new ApolloAdapter('test-apollo-key');

    mockFetch.mockResolvedValueOnce(createMockResponse({}, false, 401));

    try {
      await adapter.enrichCompany({ domain: 'test.com' });
      expect.fail('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(ProviderError);
      const providerError = error as ProviderError;
      expect(providerError.provider).toBe('apollo');
      expect(providerError.code).toBe('api_error');
      expect(providerError.statusCode).toBe(401);
    }
  });

  it('should throw on missing required params', async () => {
    const adapter = new ApolloAdapter('test-apollo-key');

    await expect(adapter.enrichCompany({})).rejects.toThrow(
      'Must provide either domain or name'
    );
  });

  it('should throw config error on missing API key', async () => {
    const adapter = new ApolloAdapter(); // No API key passed

    try {
      await adapter.enrichCompany({ domain: 'test.com' });
      expect.fail('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(ProviderError);
      expect((error as ProviderError).code).toBe('config_error');
    }
  });
});
