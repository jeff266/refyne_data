#!/usr/bin/env npx tsx
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(__dirname, '../.env.local') });

const APOLLO_BASE_URL = 'https://api.apollo.io/v1';

async function testVariation(
  name: string,
  endpoint: string,
  payload: Record<string, any>
) {
  console.log('='.repeat(60));
  console.log(`${name}`);
  console.log('='.repeat(60));
  console.log('Endpoint:', endpoint);
  console.log('Payload:', JSON.stringify(payload, null, 2), '\n');

  const response = await fetch(`${APOLLO_BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  console.log(`Status: ${response.status} ${response.statusText}\n`);

  if (response.ok) {
    const data: any = await response.json();
    const orgs = data.organizations || [];

    console.log(`Results: ${orgs.length} companies`);
    console.log(`Total: ${data.pagination?.total_entries || 0}\n`);

    if (orgs.length > 0) {
      console.log('First 5 results:\n');
      orgs.slice(0, 5).forEach((org: any, i: number) => {
        const count = org.estimated_num_employees;
        const inRange = count >= 51 && count <= 1000;
        console.log(`${i + 1}. ${org.name}`);
        console.log(`   Employees: ${count} ${inRange ? '✓' : '✗'}`);
      });

      // Check if employee filter respected
      const outOfRange = orgs.filter((o: any) => {
        const count = o.estimated_num_employees;
        return count < 51 || count > 1000;
      });

      console.log(`\nEmployee filter respected: ${outOfRange.length === 0 ? '✅ YES' : '❌ NO'}`);
      if (outOfRange.length > 0) {
        console.log(`Out of range: ${outOfRange.length}/${orgs.length} companies`);
      }
    }
  } else {
    const error = await response.text();
    console.log('Error:', error);
  }

  console.log('\n');
}

async function runTests() {
  const apiKey = process.env.APOLLO_API_KEY;

  // Variation A: q_organization_name
  await testVariation(
    'Variation A: q_organization_name',
    '/organizations/search',
    {
      api_key: apiKey,
      q_organization_name: 'healthcare',
      organization_num_employees_ranges: [
        '1,10',
        '11,20',
        '21,50',
        '51,100',
        '101,200',
        '201,500',
        '501,1000',
      ],
      page: 1,
      per_page: 25,
    }
  );

  // Variation B: industry tag IDs
  await testVariation(
    'Variation B: organization_industry_tag_ids',
    '/organizations/search',
    {
      api_key: apiKey,
      organization_industry_tag_ids: ['5567cd4673696439b10a0000'], // Healthcare tag ID
      organization_num_employees_ranges: ['51,100', '101,200', '201,500'],
      page: 1,
      per_page: 25,
    }
  );

  // Variation C: organization_locations
  await testVariation(
    'Variation C: organization_locations',
    '/organizations/search',
    {
      api_key: apiKey,
      organization_locations: ['United States'],
      organization_num_employees_ranges: ['51,100', '101,200', '201,500'],
      page: 1,
      per_page: 25,
    }
  );

  // Variation D: mixed_companies/search endpoint
  await testVariation(
    'Variation D: mixed_companies/search endpoint',
    '/mixed_companies/search',
    {
      api_key: apiKey,
      q_organization_keyword_tags: ['technology'],
      organization_num_employees_ranges: ['51,100', '101,200', '201,500'],
      page: 1,
      per_page: 25,
    }
  );
}

runTests();
