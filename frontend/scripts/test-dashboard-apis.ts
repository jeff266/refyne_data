/**
 * Dashboard API Test Script
 *
 * Tests all dashboard API endpoints to verify they work correctly
 * and return expected data structures.
 *
 * Usage:
 *   npx tsx scripts/test-dashboard-apis.ts
 */

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

interface TestResult {
  endpoint: string;
  status: 'pass' | 'fail';
  statusCode?: number;
  error?: string;
  data?: any;
}

async function testEndpoint(
  path: string,
  expectedKeys: string[]
): Promise<TestResult> {
  try {
    console.log(`\nTesting ${path}...`);
    const response = await fetch(`${BASE_URL}${path}`);

    if (!response.ok) {
      const errorText = await response.text();
      return {
        endpoint: path,
        status: 'fail',
        statusCode: response.status,
        error: errorText,
      };
    }

    const data = await response.json();

    // Check for expected keys
    const missingKeys = expectedKeys.filter((key) => !(key in data));
    if (missingKeys.length > 0) {
      return {
        endpoint: path,
        status: 'fail',
        error: `Missing keys: ${missingKeys.join(', ')}`,
        data,
      };
    }

    console.log(`✅ ${path} - PASS`);
    console.log(`   Status: ${response.status}`);
    console.log(`   Keys: ${Object.keys(data).join(', ')}`);

    return {
      endpoint: path,
      status: 'pass',
      statusCode: response.status,
      data,
    };
  } catch (error) {
    const err = error as Error;
    console.error(`❌ ${path} - FAIL`);
    console.error(`   Error: ${err.message}`);

    return {
      endpoint: path,
      status: 'fail',
      error: err.message,
    };
  }
}

async function main() {
  console.log('='.repeat(60));
  console.log('Dashboard API Tests');
  console.log('='.repeat(60));
  console.log(`Base URL: ${BASE_URL}`);

  const results: TestResult[] = [];

  // Test 1: Dashboard Summary
  results.push(
    await testEndpoint('/api/dashboard/summary', ['lastNight', 'pendingAttention'])
  );

  // Test 2: Fill Rates - Company
  results.push(
    await testEndpoint('/api/dashboard/fill-rates?objectType=company', ['fillRates'])
  );

  // Test 3: Fill Rates - Contact
  results.push(
    await testEndpoint('/api/dashboard/fill-rates?objectType=contact', ['fillRates'])
  );

  // Test 4: Always On Status
  results.push(
    await testEndpoint('/api/settings/always-on-status', ['enabled'])
  );

  // Print Summary
  console.log('\n' + '='.repeat(60));
  console.log('Test Summary');
  console.log('='.repeat(60));

  const passed = results.filter((r) => r.status === 'pass').length;
  const failed = results.filter((r) => r.status === 'fail').length;

  console.log(`Total: ${results.length}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);

  if (failed > 0) {
    console.log('\nFailed Tests:');
    results
      .filter((r) => r.status === 'fail')
      .forEach((r) => {
        console.log(`  - ${r.endpoint}`);
        console.log(`    Status: ${r.statusCode || 'N/A'}`);
        console.log(`    Error: ${r.error || 'Unknown'}`);
      });

    process.exit(1);
  }

  console.log('\n✨ All tests passed!');
  process.exit(0);
}

main().catch((err) => {
  console.error('Test script failed:', err);
  process.exit(1);
});
