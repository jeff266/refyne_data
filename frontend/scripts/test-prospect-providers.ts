#!/usr/bin/env npx tsx
/**
 * Test Prospect Providers
 *
 * Tests provider search functions with a simple query.
 * Run this before building the UI to verify integrations work.
 *
 * Usage:
 *   npx tsx scripts/test-prospect-providers.ts
 */

import { searchCompaniesApollo } from '../lib/prospect/providers/apollo';
import { searchCompaniesZoomInfo } from '../lib/prospect/providers/zoominfo';
import { ProspectSearchQuery } from '../lib/prospect/types';

async function main() {
  console.log('═'.repeat(60));
  console.log('Testing Prospect Provider Integrations');
  console.log('═'.repeat(60));

  // Simple test query
  const testQuery: ProspectSearchQuery = {
    industries: ['Technology', 'Software'],
    employeeMin: 50,
    employeeMax: 500,
    location: {
      country: 'United States',
    },
    limit: 5,
  };

  console.log('\nTest Query:');
  console.log(JSON.stringify(testQuery, null, 2));
  console.log('');

  // Test Apollo
  console.log('Testing Apollo...');
  try {
    const apolloResults = await searchCompaniesApollo(testQuery);
    console.log(`✅ Apollo: ${apolloResults.companies.length} results`);
    console.log(`   Query time: ${apolloResults.query_time_ms}ms`);
    if (apolloResults.error) {
      console.log(`   ⚠️  Error: ${apolloResults.error}`);
    }
    if (apolloResults.companies.length > 0) {
      const sample = apolloResults.companies[0];
      console.log(`   Sample: ${sample.name} (${sample.domain})`);
      console.log(`   Industry: ${sample.industry || 'N/A'}`);
      console.log(`   Employees: ${sample.employee_count || 'N/A'}`);
    }
  } catch (error) {
    console.log(`❌ Apollo failed: ${error instanceof Error ? error.message : error}`);
  }

  console.log('');

  // Test ZoomInfo
  console.log('Testing ZoomInfo...');
  try {
    const zoomInfoResults = await searchCompaniesZoomInfo(testQuery);
    console.log(`✅ ZoomInfo: ${zoomInfoResults.companies.length} results`);
    console.log(`   Query time: ${zoomInfoResults.query_time_ms}ms`);
    if (zoomInfoResults.error) {
      console.log(`   ⚠️  Error: ${zoomInfoResults.error}`);
    }
    if (zoomInfoResults.companies.length > 0) {
      const sample = zoomInfoResults.companies[0];
      console.log(`   Sample: ${sample.name} (${sample.domain})`);
      console.log(`   Industry: ${sample.industry || 'N/A'}`);
      console.log(`   Employees: ${sample.employee_count || 'N/A'}`);
    }
  } catch (error) {
    console.log(`❌ ZoomInfo failed: ${error instanceof Error ? error.message : error}`);
  }

  console.log('\n' + '═'.repeat(60));
  console.log('Testing Complete');
  console.log('═'.repeat(60));
  console.log('\nNext steps:');
  console.log('1. Review results above to ensure provider data looks correct');
  console.log('2. If providers work, proceed to build the Prospect UI');
  console.log('3. If providers fail, check API credentials and error messages');
}

main().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
