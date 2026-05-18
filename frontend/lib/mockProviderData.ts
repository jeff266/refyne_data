/**
 * Mock Provider Data Generators
 *
 * Provides mock response data for each provider to enable cascade testing
 * without making actual API calls.
 */

export type ResponseScenario = 'success' | 'partial' | 'empty' | 'error';

export interface MockResponse {
  data: Record<string, any>;
  latencyMs: number;
  error?: string;
}

/**
 * Mock responses for each provider across different scenarios
 */
export const MOCK_PROVIDER_RESPONSES: Record<
  string,
  Record<ResponseScenario, MockResponse>
> = {
  serper: {
    success: {
      data: {
        name: 'Acme Technologies Inc.',
        address: '123 Main Street, San Francisco, CA 94102',
        phone: '(415) 555-0100',
        website: 'acmetechnologies.com',
        rating: 4.5,
        reviews_count: 127,
        place_id: 'ChIJN1t_tDeuEmsRUsoyG83frY4',
        category: 'Technology Company',
        hours: 'Mon-Fri: 9AM-6PM',
      },
      latencyMs: 150,
    },
    partial: {
      data: {
        name: 'Acme Technologies Inc.',
        address: '123 Main Street, San Francisco, CA 94102',
        category: 'Technology Company',
      },
      latencyMs: 120,
    },
    empty: {
      data: {},
      latencyMs: 80,
    },
    error: {
      data: {},
      latencyMs: 50,
      error: 'Rate limit exceeded - 429 Too Many Requests',
    },
  },
  apollo: {
    success: {
      data: {
        name: 'Acme Corporation',
        domain: 'acme.com',
        employee_count: 150,
        revenue: '$10M-$50M',
        industry: 'Software & Technology',
        email: 'contact@acme.com',
        phone: '+1-555-123-4567',
        linkedin_url: 'https://linkedin.com/company/acme',
        city: 'San Francisco',
        state: 'California',
        country: 'United States',
        founded_year: 2015,
        company_type: 'Private',
      },
      latencyMs: 280,
    },
    partial: {
      data: {
        name: 'Acme Corporation',
        domain: 'acme.com',
        industry: 'Software & Technology',
        city: 'San Francisco',
        state: 'California',
      },
      latencyMs: 220,
    },
    empty: {
      data: {},
      latencyMs: 100,
    },
    error: {
      data: {},
      latencyMs: 30,
      error: 'API key invalid or expired',
    },
  },
  zoominfo: {
    success: {
      data: {
        name: 'Acme Enterprise Solutions',
        domain: 'acme-enterprise.com',
        employee_count: 500,
        revenue: '$50M-$100M',
        email: 'sales@acme-enterprise.com',
        direct_dial: '+1-800-555-0199',
        verified_contacts: ['John Smith (CEO)', 'Jane Doe (CTO)', 'Bob Wilson (CFO)'],
        technologies: ['Salesforce', 'AWS', 'Slack', 'Snowflake'],
        intent_signals: ['Cloud Migration', 'Sales Automation', 'Data Analytics'],
        sic_code: '7372',
        naics_code: '541512',
      },
      latencyMs: 350,
    },
    partial: {
      data: {
        name: 'Acme Enterprise Solutions',
        domain: 'acme-enterprise.com',
        employee_count: 500,
        sic_code: '7372',
      },
      latencyMs: 280,
    },
    empty: {
      data: {},
      latencyMs: 150,
    },
    error: {
      data: {},
      latencyMs: 40,
      error: 'ZoomInfo authentication failed - Invalid credentials',
    },
  },
  graphiq: {
    success: {
      data: {
        name: 'Acme Innovations',
        domain: 'acmeinnovations.io',
        capabilities: ['AI/ML', 'Cloud Computing', 'Data Engineering'],
        employee_count: 75,
        funding: '$15M Series A',
        technologies: ['Python', 'TensorFlow', 'Kubernetes', 'React'],
        competitors: ['TechCorp', 'InnovateCo', 'DataDriven Inc'],
        key_people: ['Alice Johnson (CEO)', 'Charlie Brown (CTO)'],
        description:
          'Acme Innovations is a cutting-edge AI company focused on enterprise automation solutions.',
      },
      latencyMs: 420,
    },
    partial: {
      data: {
        name: 'Acme Innovations',
        domain: 'acmeinnovations.io',
        employee_count: 75,
        description: 'AI-focused technology company',
      },
      latencyMs: 350,
    },
    empty: {
      data: {},
      latencyMs: 200,
    },
    error: {
      data: {},
      latencyMs: 60,
      error: 'GraphIQ service unavailable - 503 Service Unavailable',
    },
  },
  clay: {
    success: {
      data: {
        summary:
          'Acme Inc. is a rapidly growing B2B SaaS company specializing in workflow automation. They have recently expanded their sales team and are actively investing in new technology infrastructure.',
        recent_news: [
          'Acme Inc. raises $20M in Series B funding',
          'Acme launches new enterprise product line',
          'Acme expands to European markets',
        ],
        pain_points: [
          'Scaling sales operations',
          'Data integration challenges',
          'Customer retention optimization',
        ],
        social_profiles: [
          'twitter.com/acmeinc',
          'linkedin.com/company/acme-inc',
          'facebook.com/acmeinc',
        ],
        scraped_data: 'Homepage mentions key focus areas: automation, integration, analytics',
        ai_insights:
          'High likelihood of interest in sales automation tools based on recent hiring patterns and tech stack.',
      },
      latencyMs: 580,
    },
    partial: {
      data: {
        summary: 'Acme Inc. is a B2B SaaS company focused on workflow automation.',
        social_profiles: ['linkedin.com/company/acme-inc'],
      },
      latencyMs: 450,
    },
    empty: {
      data: {},
      latencyMs: 250,
    },
    error: {
      data: {},
      latencyMs: 70,
      error: 'Clay API quota exceeded for this billing period',
    },
  },
};

/**
 * Get mock response for a specific provider and scenario
 */
export function getMockResponse(
  providerId: string,
  scenario: ResponseScenario
): MockResponse {
  const providerResponses = MOCK_PROVIDER_RESPONSES[providerId];

  if (!providerResponses) {
    return {
      data: {},
      latencyMs: 50,
      error: `Unknown provider: ${providerId}`,
    };
  }

  return providerResponses[scenario] || providerResponses.empty;
}

/**
 * Get a random mock response based on weighted probabilities
 */
export function getRandomMockResponse(
  providerId: string,
  weights: { success: number; partial: number; empty: number; error: number } = {
    success: 0.6,
    partial: 0.2,
    empty: 0.1,
    error: 0.1,
  }
): MockResponse {
  const random = Math.random();
  let cumulative = 0;

  if (random < (cumulative += weights.success)) {
    return getMockResponse(providerId, 'success');
  }
  if (random < (cumulative += weights.partial)) {
    return getMockResponse(providerId, 'partial');
  }
  if (random < (cumulative += weights.empty)) {
    return getMockResponse(providerId, 'empty');
  }
  return getMockResponse(providerId, 'error');
}

/**
 * Get all fields that a provider can return (from success scenario)
 */
export function getProviderFieldList(providerId: string): string[] {
  const response = getMockResponse(providerId, 'success');
  return Object.keys(response.data);
}

/**
 * Simulate provider response with realistic delay
 */
export async function simulateProviderCall(
  providerId: string,
  scenario: ResponseScenario
): Promise<MockResponse> {
  const response = getMockResponse(providerId, scenario);

  // Simulate network delay
  await new Promise((resolve) =>
    setTimeout(resolve, response.latencyMs + Math.random() * 50)
  );

  return response;
}

/**
 * Get human-readable scenario description
 */
export function getScenarioDescription(scenario: ResponseScenario): string {
  const descriptions: Record<ResponseScenario, string> = {
    success: 'Provider returns complete data',
    partial: 'Provider returns partial data (some fields missing)',
    empty: 'Provider returns no results',
    error: 'Provider returns an error',
  };
  return descriptions[scenario];
}
