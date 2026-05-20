#!/usr/bin/env npx tsx
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(__dirname, '../.env.local') });

async function test() {
  const apiKey = process.env.APOLLO_API_KEY;

  console.log('Testing Apollo enrichment endpoint (single company lookup)...\n');

  // Test with a known domain
  const payload = {
    api_key: apiKey,
    domain: 'apollo.io',
  };

  const response = await fetch('https://api.apollo.io/v1/organizations/enrich', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  console.log(`Status: ${response.status}`);

  if (response.ok) {
    const data: any = await response.json();

    if (data.organization) {
      const org = data.organization;
      console.log('\n✓ Enrichment works! Company data:');
      console.log(`Name: ${org.name}`);
      console.log(`Domain: ${org.primary_domain}`);
      console.log(`Employees: ${org.estimated_num_employees}`);
      console.log(`Industry: ${org.industry || 'N/A'}`);
      console.log(`Revenue: ${org.estimated_annual_revenue || 'N/A'}`);
      console.log(`Location: ${org.city}, ${org.state}, ${org.country}`);
      console.log(`Founded: ${org.founded_year || 'N/A'}`);
    } else {
      console.log('No organization data returned');
    }
  } else {
    const error = await response.text();
    console.log('Error:', error);
  }

  console.log('\n' + '='.repeat(60));
  console.log('\nConclusion:');
  console.log('If enrichment works but search returns 0 results, the API key');
  console.log('may not have access to the search endpoint. This would require');
  console.log('an upgrade to Apollo\'s paid plan or a different API tier.');
}

test();
