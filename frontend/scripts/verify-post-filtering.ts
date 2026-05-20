#!/usr/bin/env npx tsx
/**
 * Verify server-side post-filtering works correctly.
 *
 * Query: Healthcare, 10-500 employees, United States
 * Should filter out: Google, Amazon, LinkedIn, Microsoft, Deloitte
 */

import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(__dirname, '../.env.local') });

import { searchCompaniesApollo } from '../lib/prospect/providers/apollo';
import { ProspectSearchQuery } from '../lib/prospect/types';

async function verify() {
  console.log('Verification Query:');
  console.log('  Industries: Healthcare');
  console.log('  Employees: 10-500');
  console.log('  Location: United States');
  console.log('  Expected: Request 100 from Apollo, filter to 25\n');

  const query: ProspectSearchQuery = {
    industries: ['Healthcare'],
    employeeMin: 10,
    employeeMax: 500,
    location: {
      country: 'United States',
    },
    limit: 25,
  };

  const result = await searchCompaniesApollo(query);

  console.log('Results:');
  console.log(`  Total matches: ${result.total_results.toLocaleString()}`);
  console.log(`  Returned: ${result.companies.length}`);
  console.log(`  Query time: ${result.query_time_ms}ms\n`);

  if (result.error) {
    console.log(`❌ Error: ${result.error}`);
    return;
  }

  // Check for banned companies
  const bannedCompanies = ['google', 'amazon', 'linkedin', 'microsoft', 'deloitte'];
  const foundBanned = result.companies.filter(c =>
    bannedCompanies.some(banned => c.name.toLowerCase().includes(banned))
  );

  if (foundBanned.length > 0) {
    console.log(`❌ FAILED: Found banned companies (should be filtered out):`);
    foundBanned.forEach(c => console.log(`  - ${c.name} (${c.employee_count} employees)`));
    console.log('');
  } else {
    console.log('✅ PASSED: No banned companies found\n');
  }

  // Verify employee counts
  let allInRange = true;
  let nullCount = 0;

  console.log('First 5 results:\n');

  result.companies.slice(0, 5).forEach((company, i) => {
    const count = company.employee_count;
    const inRange = count === null || count === undefined || (count >= 10 && count <= 500);

    if (!inRange) allInRange = false;
    if (count === null || count === undefined) nullCount++;

    const status = count === null || count === undefined ? '?' : (inRange ? '✓' : '✗');

    console.log(`${i + 1}. ${company.name}`);
    console.log(`   Domain: ${company.domain}`);
    console.log(`   Industry: ${company.industry || 'N/A'}`);
    console.log(`   Employees: ${count !== null && count !== undefined ? count.toLocaleString() : 'null'} ${status}`);
    console.log(`   Location: ${[company.city, company.state].filter(Boolean).join(', ')}`);
    console.log('');
  });

  console.log('Verification Summary:');
  console.log(`  Total results: ${result.companies.length}`);
  console.log(`  With employee count: ${result.companies.length - nullCount}`);
  console.log(`  With null count: ${nullCount}`);
  console.log(`  All in range (10-500 or null): ${allInRange ? '✅ YES' : '❌ NO'}`);

  if (!allInRange) {
    console.log('\n❌ FAILED: Some companies out of range:');
    result.companies.forEach(c => {
      const count = c.employee_count;
      if (count !== null && count !== undefined && (count < 10 || count > 500)) {
        console.log(`  - ${c.name}: ${count} employees`);
      }
    });
  } else {
    console.log('\n✅ VERIFICATION PASSED');
  }
}

verify();
