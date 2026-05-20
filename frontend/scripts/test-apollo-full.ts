#!/usr/bin/env npx tsx
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(__dirname, '../.env.local') });

import { searchCompaniesApollo } from '../lib/prospect/providers/apollo';
import { ProspectSearchQuery } from '../lib/prospect/types';

async function test() {
  console.log('Testing Apollo with full query...\n');

  const query: ProspectSearchQuery = {
    industries: ['Technology', 'Software'],
    employeeMin: 50,
    employeeMax: 500,
    location: {
      country: 'United States',
    },
    limit: 5,
  };

  console.log('Query:', JSON.stringify(query, null, 2));
  console.log('\n' + '='.repeat(60) + '\n');

  const result = await searchCompaniesApollo(query);

  console.log(`Status: ${result.error ? 'Failed' : 'Success'}`);
  console.log(`Total Results: ${result.total_results}`);
  console.log(`Query Time: ${result.query_time_ms}ms`);
  console.log(`Companies Returned: ${result.companies.length}`);

  if (result.error) {
    console.log(`Error: ${result.error}`);
    return;
  }

  console.log('\n' + '='.repeat(60));
  console.log('FIRST 3 COMPANIES:');
  console.log('='.repeat(60) + '\n');

  result.companies.slice(0, 3).forEach((company, i) => {
    console.log(`${i + 1}. ${company.name}`);
    console.log(`   Domain: ${company.domain}`);
    console.log(`   Industry: ${company.industry || 'N/A'}`);
    console.log(`   Employees: ${company.employee_count?.toLocaleString() || 'N/A'}`);
    console.log(`   Revenue: ${company.revenue ? '$' + company.revenue.toLocaleString() : 'N/A'}`);
    console.log(`   Location: ${[company.city, company.state, company.country].filter(Boolean).join(', ')}`);
    console.log(`   Founded: ${company.founded_year || 'N/A'}`);
    console.log(`   Technologies: ${company.technologies?.join(', ') || 'N/A'}`);
    console.log(`   Provider: ${company.provider}`);
    console.log('');
  });
}

test();
