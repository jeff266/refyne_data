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

  console.log('Testing GraphIQ with CORRECT parameter names\n');
  console.log('Query: Technology, 20-1000 employees, United States\n');

  const payload = {
    organization: {
      industries: ['Technology'],
      min_employees: 20,
      max_employees: 1000,
      country: 'United States',
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

  console.log(`Status: ${response.status}\n`);

  if (response.ok) {
    const data: any = await response.json();
    const entities = data.entities || [];

    console.log(`✅ Results: ${entities.length} companies\n`);

    if (entities.length > 0) {
      console.log('First 5 results:\n');
      entities.slice(0, Math.min(5, entities.length)).forEach((org: any, i: number) => {
        const employees = org.num_employees || org.employee_count || org.employees;
        const inRange = employees >= 20 && employees <= 1000;

        console.log(`${i + 1}. ${org.name || 'N/A'}`);
        console.log(`   Domain: ${org.website_url || org.website || org.domain || 'N/A'}`);
        console.log(`   Employees: ${employees || 'N/A'} ${employees ? (inRange ? '✓' : '✗') : ''}`);
        console.log(`   Revenue: ${org.revenue ? '$' + org.revenue.toLocaleString() : 'N/A'}`);
        console.log(`   Industry: ${org.industries?.join(', ') || 'N/A'}`);
        console.log(`   Location: ${[org.city, org.region, org.country].filter(Boolean).join(', ') || 'N/A'}`);
        console.log('');
      });

      // Check filter accuracy
      const withCount = entities.filter((e: any) => e.num_employees || e.employee_count);
      const inRange = withCount.filter((e: any) => {
        const count = e.num_employees || e.employee_count;
        return count >= 20 && count <= 1000;
      });

      console.log('Filter accuracy:');
      console.log(`  Total with employee count: ${withCount.length}`);
      console.log(`  In range (20-1000): ${inRange.length}/${withCount.length}`);
      console.log(`  Filter respected: ${inRange.length === withCount.length ? '✅ YES' : '❌ NO'}`);
    }
  } else {
    const error = await response.text();
    console.log('❌ Error:', error);
  }
}

testGraphIQ();
