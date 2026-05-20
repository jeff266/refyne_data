#!/usr/bin/env npx tsx
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(__dirname, '../.env.local') });

async function test() {
  const apiKey = process.env.APOLLO_API_KEY;

  console.log('Testing Apollo organizations/search endpoint...\n');

  // Try the organizations/search endpoint instead of mixed_companies/search
  const payload = {
    api_key: apiKey,
    page: 1,
    per_page: 5,
    q_organization_name: 'technology',
  };

  console.log('Payload:', JSON.stringify(payload, null, 2));

  const response = await fetch('https://api.apollo.io/v1/organizations/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  console.log(`\nStatus: ${response.status}`);

  if (response.ok) {
    const data: any = await response.json();
    console.log(`Total: ${data.pagination?.total_entries || 0}`);
    console.log(`Results: ${data.organizations?.length || 0}\n`);

    if (data.organizations && data.organizations.length > 0) {
      console.log('First 3 companies:\n');
      data.organizations.slice(0, 3).forEach((org: any, i: number) => {
        console.log(`${i + 1}. ${org.name}`);
        console.log(`   Domain: ${org.primary_domain}`);
        console.log(`   Employees: ${org.estimated_num_employees}`);
        console.log(`   Industry: ${org.industry || 'N/A'}`);
        console.log(`   Location: ${org.city}, ${org.state}, ${org.country}`);
        console.log('');
      });
    } else {
      console.log('No organizations returned');
      console.log('\nResponse body:', JSON.stringify(data, null, 2).substring(0, 500));
    }
  } else {
    const error = await response.text();
    console.log('Error:', error);
  }
}

test();
