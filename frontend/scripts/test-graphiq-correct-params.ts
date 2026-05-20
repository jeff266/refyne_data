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

  console.log('Testing GraphIQ with different parameter names\n');

  // Test 1: Try 'region' instead of 'location'
  const tests = [
    {
      name: 'Test 1: region + industry',
      payload: {
        organization: {
          region: 'United States',
          industry: 'Technology',
        },
        limit: 25,
      },
    },
    {
      name: 'Test 2: revenue filter',
      payload: {
        organization: {
          revenue: { min: 1000000, max: 50000000 },
          region: 'United States',
        },
        limit: 25,
      },
    },
    {
      name: 'Test 3: capabilities only (known to work)',
      payload: {
        organization: {
          capabilities: ['software development', 'SaaS'],
        },
        limit: 25,
      },
    },
    {
      name: 'Test 4: Empty filter (get any companies)',
      payload: {
        organization: {},
        limit: 25,
      },
    },
  ];

  for (const test of tests) {
    console.log('='.repeat(60));
    console.log(test.name);
    console.log('Payload:', JSON.stringify(test.payload, null, 2));

    const response = await fetch(`${GRAPHIQ_BASE_URL}/organizations/search`, {
      method: 'POST',
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(test.payload),
    });

    console.log(`Status: ${response.status}\n`);

    if (response.ok) {
      const data: any = await response.json();
      const entities = data.entities || [];
      console.log(`✅ Results: ${entities.length} companies\n`);

      if (entities.length > 0) {
        console.log('First 3:');
        entities.slice(0, 3).forEach((org: any, i: number) => {
          console.log(`${i + 1}. ${org.name || 'N/A'}`);
          console.log(`   Domain: ${org.website || org.domain || 'N/A'}`);
          console.log(`   Employees: ${org.employee_count || org.employees || org.num_employees || 'N/A'}`);
          console.log(`   Revenue: ${org.revenue || 'N/A'}`);
          console.log(`   Industry: ${org.industry || 'N/A'}`);
        });
      }
    } else {
      const error = await response.text();
      console.log(`❌ Error: ${error}\n`);
    }

    console.log('');
  }
}

testGraphIQ();
