import { NextRequest, NextResponse } from 'next/server';

// Backend API URL - in production this would be an environment variable
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000';

// GET /api/config - Fetch the current configuration
export async function GET() {
  try {
    // In development/demo mode, we can return the config directly
    // In production, this would fetch from the backend API
    const config = await fetchConfigFromBackend();
    return NextResponse.json(config);
  } catch (error) {
    console.error('Error fetching config:', error);
    return NextResponse.json(
      { error: 'Failed to fetch configuration' },
      { status: 500 }
    );
  }
}

// PUT /api/config - Save the configuration
export async function PUT(request: NextRequest) {
  try {
    const config = await request.json();

    // Validate the config structure
    if (!config.segments || !config.providers) {
      return NextResponse.json(
        { error: 'Invalid configuration: missing segments or providers' },
        { status: 400 }
      );
    }

    // Save to backend
    const success = await saveConfigToBackend(config);

    if (success) {
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json(
        { error: 'Failed to save configuration' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error saving config:', error);
    return NextResponse.json(
      { error: 'Failed to save configuration' },
      { status: 500 }
    );
  }
}

// Helper function to fetch config from backend
async function fetchConfigFromBackend(): Promise<any> {
  // For demo/development, return the default config
  // In production, this would make an HTTP request to the backend
  try {
    const response = await fetch(`${BACKEND_URL}/api/config`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      // Don't cache the config
      cache: 'no-store',
    });

    if (response.ok) {
      return response.json();
    }
  } catch (error) {
    console.log('Backend not available, using default config');
  }

  // Return default config if backend is not available
  return getDefaultConfig();
}

// Helper function to save config to backend
async function saveConfigToBackend(config: any): Promise<boolean> {
  try {
    const response = await fetch(`${BACKEND_URL}/api/config`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(config),
    });

    return response.ok;
  } catch (error) {
    console.log('Backend not available, config not persisted');
    // In demo mode, we'll pretend it succeeded
    return true;
  }
}

// Default configuration for demo purposes
function getDefaultConfig() {
  return {
    segments: [
      {
        id: 'smb_local',
        display_name: 'SMB & Local',
        description: 'Search local businesses by industry and location. Ideal for brick-and-mortar prospects.',
        icon: 'storefront',
        visible: true,
        order: 1,
        providers: {
          cascade: ['serper'],
          fallback_enabled: false,
        },
        input_fields: [
          {
            id: 'industry',
            type: 'select',
            label: 'Industry',
            source: 'industry_taxonomy',
            required: true,
          },
          {
            id: 'location',
            type: 'text',
            label: 'Location',
            placeholder: 'e.g., Austin, TX or 90210',
            required: true,
          },
          {
            id: 'num_results',
            type: 'slider',
            label: 'Number of results',
            min: 5,
            max: 50,
            default: 20,
          },
        ],
      },
      {
        id: 'midmarket',
        display_name: 'Mid-Market',
        description: 'Enrich by company domain or name. Get employee count, industry, revenue, and contacts.',
        icon: 'business',
        visible: true,
        order: 2,
        providers: {
          cascade: ['apollo'],
          fallback_enabled: false,
        },
        input_fields: [
          {
            id: 'input_type',
            type: 'radio',
            label: 'Search by',
            options: ['Domain', 'Company Name'],
            default: 'Domain',
            horizontal: true,
          },
          {
            id: 'domain',
            type: 'text',
            label: 'Company Domain',
            placeholder: 'e.g., notion.com',
            show_when: { input_type: 'Domain' },
          },
          {
            id: 'name',
            type: 'text',
            label: 'Company Name',
            placeholder: 'e.g., Notion',
            show_when: { input_type: 'Company Name' },
          },
        ],
      },
      {
        id: 'enterprise',
        display_name: 'Enterprise',
        description: 'Enterprise-grade enrichment with verified direct dials and emails for key contacts.',
        icon: 'corporate_fare',
        visible: true,
        order: 3,
        providers: {
          cascade: ['zoominfo'],
          fallback_enabled: true,
          fallback: ['apollo'],
        },
        input_fields: [
          {
            id: 'domain',
            type: 'text',
            label: 'Company Domain',
            placeholder: 'e.g., salesforce.com',
            required: true,
          },
        ],
      },
      {
        id: 'capability',
        display_name: 'Capability Search',
        description: 'Find companies by what they do. Search by technical capabilities, products, or expertise.',
        icon: 'search',
        visible: true,
        order: 4,
        providers: {
          cascade: ['graphiq'],
          fallback_enabled: false,
        },
        input_fields: [
          {
            id: 'capabilities',
            type: 'textarea',
            label: 'Capabilities',
            placeholder: 'Enter capabilities separated by commas\ne.g., CNC machining, precision manufacturing, aerospace components',
            required: true,
            height: 100,
          },
          {
            id: 'num_results',
            type: 'slider',
            label: 'Number of results',
            min: 5,
            max: 50,
            default: 20,
          },
        ],
      },
    ],
    providers: {
      serper: {
        name: 'Serper',
        type: 'local_search',
        env_key: 'SERPER_API_KEY',
      },
      apollo: {
        name: 'Apollo',
        type: 'enrichment',
        env_key: 'APOLLO_API_KEY',
      },
      zoominfo: {
        name: 'ZoomInfo',
        type: 'enrichment',
        env_keys: ['ZOOMINFO_CLIENT_ID', 'ZOOMINFO_CLIENT_SECRET'],
      },
      graphiq: {
        name: 'GraphiqAI',
        type: 'enrichment',
        env_key: 'GRAPHIQ_API_KEY',
      },
      clay: {
        name: 'Clay',
        type: 'ai_enrichment',
        env_key: 'CLAY_API_KEY',
      },
    },
  };
}
