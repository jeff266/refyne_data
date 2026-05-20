#!/usr/bin/env npx tsx
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(__dirname, '../.env.local') });

import { searchCompaniesApollo } from '../lib/prospect/providers/apollo';
import { scoreCompanyICP } from '../lib/prospect/icp-scorer';
import { ProspectSearchQuery, ICPConfig } from '../lib/prospect/types';

async function test() {
  console.log('Broader verification query with ICP scoring:\n');

  const query: ProspectSearchQuery = {
    industries: ['Technology', 'Software'],
    employeeMin: 50,
    employeeMax: 500,
    location: {
      country: 'United States',
    },
    limit: 25,
  };

  const icpConfig: ICPConfig = {
    target_industries: ['Technology', 'Software'],
    target_employee_min: 50,
    target_employee_max: 500,
    target_locations: {
      countries: ['United States'],
    },
  };

  console.log('Query:', JSON.stringify(query, null, 2));
  console.log('\nRequesting 100 from Apollo, filtering to 25...\n');

  const result = await searchCompaniesApollo(query);

  console.log(`Results: ${result.companies.length} companies`);
  console.log(`Query time: ${result.query_time_ms}ms\n`);

  // Score each company
  const scored = result.companies.map(company => ({
    ...company,
    icp_score: scoreCompanyICP(company, icpConfig).score,
  }));

  // Check employee counts
  const outOfRange = scored.filter(c => {
    const count = c.employee_count;
    return count !== null && count !== undefined && (count < 50 || count > 500);
  });

  if (outOfRange.length > 0) {
    console.log('❌ FAILED: Companies out of range:');
    outOfRange.forEach(c => {
      console.log(`  ${c.name}: ${c.employee_count} employees`);
    });
    console.log('');
  } else {
    console.log('✅ All employee counts in range (50-500 or null)\n');
  }

  // Show first 5
  console.log('First 5 results with ICP scores:\n');
  scored.slice(0, 5).forEach((c, i) => {
    console.log(`${i + 1}. ${c.name}`);
    console.log(`   Employee count: ${c.employee_count !== null ? c.employee_count.toLocaleString() : 'null'}`);
    console.log(`   ICP score: ${c.icp_score}`);
    console.log(`   Industry: ${c.industry || 'N/A'}`);
    console.log(`   Location: ${[c.city, c.state].filter(Boolean).join(', ')}`);
    console.log('');
  });
}

test();
