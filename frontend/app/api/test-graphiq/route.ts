/**
 * Test GraphIQ API connection
 * GET /api/test-graphiq
 */

import { NextResponse } from 'next/server';

export async function GET() {
  const apiKey = process.env.GRAPHIQ_API_KEY;

  // Debug: Show all env var KEYS (not values) that start with GRAPH
  const graphiqRelatedKeys = Object.keys(process.env).filter(k =>
    k.includes('GRAPH') || k.includes('graphiq')
  );

  if (!apiKey) {
    return NextResponse.json({
      error: 'GRAPHIQ_API_KEY not configured',
      has_key: false,
      all_env_keys_with_graph: graphiqRelatedKeys,
      total_env_vars: Object.keys(process.env).length,
    }, { status: 500 });
  }

  // Test with a known domain
  const testDomain = 'apple.com';

  try {
    const response = await fetch('https://app.graphiq.ai/api/v2/organizations/search', {
      method: 'POST',
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        organization: {
          website_url: testDomain,
        },
        limit: 1,
      }),
    });

    const data = await response.json();

    return NextResponse.json({
      success: true,
      has_key: true,
      key_length: apiKey.length,
      key_prefix: apiKey.substring(0, 8),
      test_domain: testDomain,
      api_status: response.status,
      entities_found: data.entities?.length || 0,
      first_entity: data.entities?.[0] ? {
        name: data.entities[0].name,
        website: data.entities[0].website_url,
        industry: data.entities[0].industries?.[0]?.title,
        employees: data.entities[0].num_employees,
      } : null,
      raw_response_keys: data.entities?.[0] ? Object.keys(data.entities[0]).slice(0, 20) : [],
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      has_key: true,
      stack: error instanceof Error ? error.stack : undefined,
    }, { status: 500 });
  }
}
