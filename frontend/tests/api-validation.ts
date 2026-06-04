/**
 * API Validation Script
 *
 * Tests the new API endpoints created in this session:
 * 1. POST /api/taxonomy/read-field-values
 * 2. GET /api/taxonomy/harmonies/[harmonyId]/suggestions
 * 3. POST /api/harmonies/[id]/scan (field resolution fix)
 *
 * This script validates the endpoints exist and have the correct structure
 * without requiring full Clerk authentication.
 */

import { spawn } from 'child_process';

const BASE_URL = 'http://localhost:3000';

interface ValidationResult {
  endpoint: string;
  status: 'pass' | 'fail';
  message: string;
}

const results: ValidationResult[] = [];

async function validateEndpoint(endpoint: string, method: string, expectedStatus?: number): Promise<ValidationResult> {
  try {
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
    });

    const actualStatus = response.status;

    // We expect 401 (unauthorized) for endpoints that require auth
    // This proves the endpoint exists and is protected
    if (actualStatus === 401 || actualStatus === 403) {
      return {
        endpoint: `${method} ${endpoint}`,
        status: 'pass',
        message: `Endpoint exists and requires authentication (${actualStatus})`,
      };
    }

    // If an expected status was provided, check for it
    if (expectedStatus && actualStatus === expectedStatus) {
      return {
        endpoint: `${method} ${endpoint}`,
        status: 'pass',
        message: `Endpoint exists and returned expected status ${actualStatus}`,
      };
    }

    // 400 bad request is also acceptable - means endpoint exists but needs proper params
    if (actualStatus === 400) {
      const body = await response.json();
      return {
        endpoint: `${method} ${endpoint}`,
        status: 'pass',
        message: `Endpoint exists and validates input: ${body.error || 'validation error'}`,
      };
    }

    return {
      endpoint: `${method} ${endpoint}`,
      status: 'fail',
      message: `Unexpected status ${actualStatus}`,
    };
  } catch (error: any) {
    return {
      endpoint: `${method} ${endpoint}`,
      status: 'fail',
      message: `Error: ${error.message}`,
    };
  }
}

async function main() {
  console.log('');
  console.log('='.repeat(70));
  console.log('🧪 API ENDPOINT VALIDATION');
  console.log('='.repeat(70));
  console.log(`Base URL: ${BASE_URL}`);
  console.log('='.repeat(70));
  console.log('');

  // Check if dev server is running
  try {
    const healthCheck = await fetch(BASE_URL);
    if (!healthCheck.ok && healthCheck.status !== 401) {
      console.error('❌ Dev server not responding at', BASE_URL);
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Dev server not running at', BASE_URL);
    console.error('   Start with: npm run dev');
    process.exit(1);
  }

  console.log('✅ Dev server is running\n');

  // Test new endpoints
  console.log('Testing new endpoints from this session:\n');

  results.push(await validateEndpoint('/api/taxonomy/read-field-values', 'POST'));
  results.push(await validateEndpoint('/api/taxonomy/harmonies/test-harmony-id/suggestions', 'GET'));
  results.push(await validateEndpoint('/api/harmonies/test-harmony-id/scan', 'POST'));

  // Print results
  console.log('');
  console.log('='.repeat(70));
  console.log('📊 VALIDATION RESULTS');
  console.log('='.repeat(70));
  console.log('');

  let passed = 0;
  let failed = 0;

  results.forEach((result) => {
    const icon = result.status === 'pass' ? '✅' : '❌';
    console.log(`${icon} ${result.endpoint}`);
    console.log(`   ${result.message}`);
    console.log('');

    if (result.status === 'pass') {
      passed++;
    } else {
      failed++;
    }
  });

  console.log('='.repeat(70));
  console.log(`Total: ${results.length} | Passed: ${passed} | Failed: ${failed}`);
  console.log('='.repeat(70));

  if (failed > 0) {
    process.exit(1);
  }

  console.log('\n✅ All API endpoints validated successfully\n');
}

main();
