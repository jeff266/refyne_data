#!/usr/bin/env npx tsx
/**
 * Simple Apollo Test - No Industry Filter
 */

import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(__dirname, '../.env.local') });

const APOLLO_BASE_URL = 'https://api.apollo.io/v1';

async function testApollo() {
  const apiKey = process.env.APOLLO_API_KEY;

  console.log('Testing Apollo with minimal payload...\n');

  // Test 1: Minimal search with just employee count
  const payload1 = {
    api_key: apiKey,
    page: 1,
    per_page: 3,
    organization_num_employees_ranges: ['51-200'],
  };

  console.log('Test 1: Employee count filter only');
  console.log('Payload:', JSON.stringify(payload1, null, 2));

  try {
    const response = await fetch(`${APOLLO_BASE_URL}/mixed_companies/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload1),
    });

    console.log(`Status: ${response.status} ${response.statusText}`);

    if (response.ok) {
      const data = await response.json();
      console.log(`✓ Success! Found ${data.organizations?.length || 0} companies`);

      if (data.organizations && data.organizations.length > 0) {
        console.log('\nFirst 3 results:');
        data.organizations.slice(0, 3).forEach((org: any, i: number) => {
          console.log(`\n${i + 1}. ${org.name}`);
          console.log(`   Domain: ${org.primary_domain}`);
          console.log(`   Employees: ${org.estimated_num_employees}`);
          console.log(`   Industry: ${org.industry || 'N/A'}`);
          console.log(`   Location: ${org.city}, ${org.state}, ${org.country}`);
        });
      }
    } else {
      const errorText = await response.text();
      console.log(`✗ Failed: ${errorText}`);
    }
  } catch (error) {
    console.log(`✗ Error: ${error}`);
  }

  console.log('\n' + '='.repeat(60) + '\n');

  // Test 2: With keyword search (no industry tags)
  const payload2 = {
    api_key: apiKey,
    page: 1,
    per_page: 3,
    q_organization_keyword_tags: ['software', 'technology'],
    organization_num_employees_ranges: ['51-200'],
  };

  console.log('Test 2: Keyword search (software, technology)');
  console.log('Payload:', JSON.stringify(payload2, null, 2));

  try {
    const response = await fetch(`${APOLLO_BASE_URL}/mixed_companies/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload2),
    });

    console.log(`Status: ${response.status} ${response.statusText}`);

    if (response.ok) {
      const data = await response.json();
      console.log(`✓ Success! Found ${data.organizations?.length || 0} companies`);

      if (data.organizations && data.organizations.length > 0) {
        console.log('\nFirst 3 results:');
        data.organizations.slice(0, 3).forEach((org: any, i: number) => {
          console.log(`\n${i + 1}. ${org.name}`);
          console.log(`   Domain: ${org.primary_domain}`);
          console.log(`   Employees: ${org.estimated_num_employees}`);
          console.log(`   Industry: ${org.industry || 'N/A'}`);
        });
      }
    } else {
      const errorText = await response.text();
      console.log(`✗ Failed: ${errorText}`);
    }
  } catch (error) {
    console.log(`✗ Error: ${error}`);
  }
}

testApollo();
