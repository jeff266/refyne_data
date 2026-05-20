#!/usr/bin/env npx tsx
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(__dirname, '../.env.local') });

const GRAPHIQ_BASE_URL = 'https://app.graphiq.ai/api/v2';

async function testGraphIQ() {
  const apiKey = process.env.GRAPHIQ_API_KEY;
  if (!apiKey) {
    console.error('GRAPHIQ_API_KEY not set');
    return;
  }

  console.log('Testing GraphIQ /organizations/search\n');
  console.log('Query:');
  console.log('  Industry: Technology');
  console.log('  Location: United States');
  console.log('  Employee count: 20-1000');
  console.log('  Limit: 25\n');

  const payload = {
    organization: {
      industry: 'Technology',
      location: 'United States',
      // Note: GraphIQ may not support employee_count filter directly
      // We'll see what we get back
    },
    limit: 25,
  };

  console.log('Payload:', JSON.stringify(payload, null, 2), '\n');

  const response = await fetch(`${GRAPHIQ_BASE_URL}/organizations/search`, {
    method: 'POST',
    headers: {
      'X-API-Key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  console.log(`Status: ${response.status} ${response.statusText}\n`);

  if (response.ok) {
    const data: any = await response.json();
    const entities = data.entities || [];

    console.log(`Results: ${entities.length} companies\n`);

    if (entities.length > 0) {
      console.log('First 5 results:\n');
      entities.slice(0, 5).forEach((org: any, i: number) => {
        console.log(`${i + 1}. ${org.name || 'N/A'}`);
        console.log(`   Domain: ${org.website || org.domain || 'N/A'}`);
        console.log(`   Employee count: ${org.employee_count || org.employees || 'N/A'}`);
        console.log(`   Industry: ${org.industry || 'N/A'}`);
        console.log(`   Location: ${org.location || [org.city, org.state, org.country].filter(Boolean).join(', ') || 'N/A'}`);
        console.log('');
      });

      // Check employee count distribution
      const withCount = entities.filter((e: any) => e.employee_count || e.employees);
      const inRange = withCount.filter((e: any) => {
        const count = e.employee_count || e.employees;
        return count >= 20 && count <= 1000;
      });

      console.log(`Employee count stats:`);
      console.log(`  Total with count: ${withCount.length}`);
      console.log(`  In range (20-1000): ${inRange.length}`);
    }
  } else {
    const error = await response.text();
    console.log('Error:', error);
  }
}

testGraphIQ();
