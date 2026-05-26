/**
 * Serper API Diagnostic Endpoint
 *
 * GET /api/debug/serper
 *
 * Tests Serper API connection and queries from production environment.
 * Returns detailed diagnostics including API key status and test results.
 */

import { NextResponse } from 'next/server';
import { searchWeb, buildCompanyQueries } from '@/lib/providers/refyne-search/serper-client';

export async function GET() {
  const diagnostics: any = {
    timestamp: new Date().toISOString(),
    environment: {
      NODE_ENV: process.env.NODE_ENV,
      VERCEL: !!process.env.VERCEL,
    },
    api_keys: {
      SERPER_API_KEY: process.env.SERPER_API_KEY ? {
        present: true,
        prefix: process.env.SERPER_API_KEY.substring(0, 8) + '...',
        length: process.env.SERPER_API_KEY.length,
      } : { present: false },
      REFYNE_SERPER_KEY: process.env.REFYNE_SERPER_KEY ? {
        present: true,
        prefix: process.env.REFYNE_SERPER_KEY.substring(0, 8) + '...',
        length: process.env.REFYNE_SERPER_KEY.length,
      } : { present: false },
      active_key: process.env.SERPER_API_KEY || process.env.REFYNE_SERPER_KEY ?
        (process.env.SERPER_API_KEY ? 'SERPER_API_KEY' : 'REFYNE_SERPER_KEY') :
        'none',
    },
    tests: [],
  };

  // Test 1: Query generation
  const testDomain = 'fronteracare.com';
  const testCompanyName = 'Frontera Health';
  const fieldKeys = ['industry', 'employee_count', 'revenue'];

  const queries = buildCompanyQueries(testDomain, testCompanyName, fieldKeys);

  diagnostics.query_generation = {
    domain: testDomain,
    company_name: testCompanyName,
    field_keys: fieldKeys,
    queries_generated: queries.length,
    queries: queries,
  };

  // Test 2: Run actual Serper queries
  for (let i = 0; i < queries.length; i++) {
    const query = queries[i];
    const testResult: any = {
      query_number: i + 1,
      query_string: query,
      status: 'pending',
    };

    try {
      const startTime = Date.now();
      const results = await searchWeb(query, 5);
      const duration = Date.now() - startTime;

      testResult.status = 'success';
      testResult.duration_ms = duration;
      testResult.results_count = results.length;
      testResult.results = results.map(r => ({
        title: r.title,
        link: r.link,
        snippet: r.snippet.substring(0, 100) + '...',
      }));
    } catch (error: any) {
      testResult.status = 'error';
      testResult.error = error.message;
      testResult.error_details = error.toString();
    }

    diagnostics.tests.push(testResult);
  }

  // Summary
  const successfulTests = diagnostics.tests.filter((t: any) => t.status === 'success');
  const totalResults = diagnostics.tests.reduce((sum: number, t: any) => sum + (t.results_count || 0), 0);

  diagnostics.summary = {
    total_queries: queries.length,
    successful_queries: successfulTests.length,
    failed_queries: diagnostics.tests.length - successfulTests.length,
    total_results_found: totalResults,
    conclusion: totalResults > 0 ? '✅ Serper is working!' : '❌ No results found - check API key',
  };

  return NextResponse.json(diagnostics, {
    headers: {
      'Cache-Control': 'no-store',
    },
  });
}
