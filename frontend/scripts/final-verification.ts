#!/usr/bin/env npx tsx
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(__dirname, '../.env.local') });

import { searchCompaniesApollo } from '../lib/prospect/providers/apollo';
import { scoreCompanyICP } from '../lib/prospect/icp-scorer';
import { ProspectSearchQuery, ICPConfig } from '../lib/prospect/types';

async function test() {
  console.log('Final Verification - 5 Sample Results\n');
  console.log('Query: Technology, 20-1000 employees, United States\n');

  const query: ProspectSearchQuery = {
    industries: ['Technology'],
    employeeMin: 20,
    employeeMax: 1000,
    location: {
      country: 'United States',
    },
    limit: 25,
  };

  const icpConfig: ICPConfig = {
    target_industries: ['Technology'],
    target_employee_min: 20,
    target_employee_max: 1000,
    target_locations: {
      countries: ['United States'],
    },
  };

  const result = await searchCompaniesApollo(query);

  console.log(`Results: ${result.companies.length} companies returned`);
  console.log(`Query time: ${result.query_time_ms}ms\n`);

  // Score and show first 5
  const scored = result.companies.slice(0, 5).map(c => ({
    name: c.name,
    employee_count: c.employee_count,
    icp_score: scoreCompanyICP(c, icpConfig).score,
    industry: c.industry,
    location: [c.city, c.state].filter(Boolean).join(', '),
  }));

  console.log('Sample Results:\n');
  scored.forEach((c, i) => {
    const countStr = c.employee_count !== null && c.employee_count !== undefined
      ? c.employee_count.toLocaleString()
      : 'null';
    const inRange = c.employee_count === null || c.employee_count === undefined ||
      (c.employee_count >= 20 && c.employee_count <= 1000);

    console.log(`${i + 1}. ${c.name}`);
    console.log(`   employee_count: ${countStr} ${inRange ? '✓' : '✗'}`);
    console.log(`   icp_score: ${c.icp_score}`);
    console.log(`   industry: ${c.industry || 'N/A'}`);
    console.log(`   location: ${c.location || 'N/A'}`);
    console.log('');
  });

  // Verify all in range
  const outOfRange = result.companies.filter(c => {
    const count = c.employee_count;
    return count !== null && count !== undefined && (count < 20 || count > 1000);
  });

  console.log(`Verification: ${outOfRange.length === 0 ? '✅ All in range' : '❌ Some out of range'}`);
}

test();
