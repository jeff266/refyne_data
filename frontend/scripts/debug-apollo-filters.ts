#!/usr/bin/env npx tsx
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(__dirname, '../.env.local') });

const APOLLO_BASE_URL = 'https://api.apollo.io/v1';

async function test() {
  const apiKey = process.env.APOLLO_API_KEY;

  console.log('Testing Apollo employee count filter...\n');

  // Test with explicit employee range
  const payload = {
    api_key: apiKey,
    page: 1,
    per_page: 5,
    organization_num_employees_ranges: ['51-200'],
    q_organization_keyword_tags: ['technology'],
  };

  console.log('Payload:', JSON.stringify(payload, null, 2));

  const response = await fetch(`${APOLLO_BASE_URL}/organizations/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (response.ok) {
    const data: any = await response.json();
    console.log(`\nTotal: ${data.pagination?.total_entries || 0}`);
    console.log(`Results: ${data.organizations?.length || 0}\n`);

    if (data.organizations && data.organizations.length > 0) {
      console.log('Companies (should all be 51-200 employees):');
      data.organizations.forEach((org: any, i: number) => {
        console.log(`${i + 1}. ${org.name} - ${org.estimated_num_employees} employees`);

        // Check if employee count is in range
        const count = org.estimated_num_employees;
        const inRange = count >= 51 && count <= 200;
        console.log(`   ${inRange ? '✓' : '✗'} Employee count ${inRange ? 'matches' : 'OUT OF RANGE'}`);
      });
    }
  } else {
    console.log('Error:', await response.text());
  }
}

test();
