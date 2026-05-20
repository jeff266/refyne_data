#!/usr/bin/env npx tsx
/**
 * End-to-end test for Healthcare search
 * Tests: Healthcare industry, United States, 10-500 employees
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { searchCompaniesApollo } from '../lib/prospect/providers/apollo';

config({ path: resolve(__dirname, '../.env.local') });

async function testHealthcareSearch() {
  console.log('Testing Healthcare search (E2E)');
  console.log('Filters: Healthcare, United States, 10-500 employees\n');

  const query = {
    industries: ['Healthcare'],
    employeeMin: 10,
    employeeMax: 500,
    location: { country: 'United States' },
    limit: 10,
  };

  console.log('Query:', JSON.stringify(query, null, 2), '\n');

  const result = await searchCompaniesApollo(query);

  console.log(`✅ Results: ${result.companies.length} companies`);
  console.log(`Query time: ${result.query_time_ms}ms\n`);

  if (result.error) {
    console.error('❌ Error:', result.error);
    return;
  }

  if (result.companies.length === 0) {
    console.log('⚠️  No results returned');
    return;
  }

  console.log('Sample results:\n');

  result.companies.slice(0, 5).forEach((company, i) => {
    console.log(`${i + 1}. ${company.name || 'N/A'}`);
    console.log(`   Domain: ${company.domain || 'N/A'}`);
    console.log(`   Industry: ${company.industry || 'N/A'}`);
    console.log(`   Employees: ${company.employee_count || 'N/A'}`);
    console.log(`   Location: ${[company.city, company.state, company.country].filter(Boolean).join(', ') || 'N/A'}`);

    // Verify filter accuracy
    const employeeOk = !company.employee_count ||
      (company.employee_count >= 10 && company.employee_count <= 500);
    const locationOk = !company.country ||
      company.country.toLowerCase() === 'united states';

    if (employeeOk && locationOk) {
      console.log('   ✓ Filters respected');
    } else {
      console.log(`   ⚠️  Filter issue - Employees: ${employeeOk ? '✓' : '✗'}, Location: ${locationOk ? '✓' : '✗'}`);
    }
    console.log('');
  });

  // Check filter accuracy
  const withEmployees = result.companies.filter(c => c.employee_count !== undefined);
  const inRange = withEmployees.filter(c =>
    c.employee_count! >= 10 && c.employee_count! <= 500
  );
  const inUS = result.companies.filter(c =>
    !c.country || c.country.toLowerCase() === 'united states'
  );

  console.log('Filter accuracy:');
  console.log(`  Employee range (10-500): ${inRange.length}/${withEmployees.length}`);
  console.log(`  Location (US): ${inUS.length}/${result.companies.length}`);
  console.log('');

  if (inRange.length === withEmployees.length && inUS.length === result.companies.length) {
    console.log('✅ All filters respected correctly');
  } else {
    console.log('⚠️  Some filter mismatches detected');
  }
}

testHealthcareSearch().catch(console.error);
