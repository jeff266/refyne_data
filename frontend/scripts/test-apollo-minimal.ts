#!/usr/bin/env npx tsx
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(__dirname, '../.env.local') });

async function test() {
  const apiKey = process.env.APOLLO_API_KEY;

  // Absolute minimal - just get some companies
  const payload = {
    api_key: apiKey,
    page: 1,
    per_page: 5,
  };

  console.log('Testing Apollo with no filters (should return any companies)...\n');

  const response = await fetch('https://api.apollo.io/v1/mixed_companies/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  console.log(`Status: ${response.status}`);

  if (response.ok) {
    const data: any = await response.json();
    console.log(`Total: ${data.pagination?.total_entries || 0}`);
    console.log(`Results: ${data.organizations?.length || 0}\n`);

    if (data.organizations && data.organizations.length > 0) {
      data.organizations.slice(0, 3).forEach((org: any, i: number) => {
        console.log(`${i + 1}. ${org.name}`);
        console.log(`   Domain: ${org.primary_domain}`);
        console.log(`   Employees: ${org.estimated_num_employees}`);
        console.log(`   Industry: ${org.industry || 'N/A'}`);
        console.log(`   City: ${org.city}, ${org.state}`);
        console.log('');
      });
    } else {
      console.log('No organizations returned. API key may have limited access.');
    }
  } else {
    console.log('Error:', await response.text());
  }
}

test();
