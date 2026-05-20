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

  console.log('Testing GraphIQ with minimal query\n');

  // Test 1: Just a query string
  const payload1 = {
    organization: {
      query: 'technology companies',
    },
    limit: 25,
  };

  console.log('Test 1: Query only');
  console.log('Payload:', JSON.stringify(payload1, null, 2), '\n');

  let response = await fetch(`${GRAPHIQ_BASE_URL}/organizations/search`, {
    method: 'POST',
    headers: {
      'X-API-Key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload1),
  });

  console.log(`Status: ${response.status}\n`);

  if (response.ok) {
    const data: any = await response.json();
    const entities = data.entities || [];
    console.log(`Results: ${entities.length}\n`);

    if (entities.length > 0) {
      console.log('First 3:\n');
      entities.slice(0, 3).forEach((org: any, i: number) => {
        console.log(`${i + 1}. ${org.name || 'N/A'}`);
        console.log(`   Employees: ${org.employee_count || org.employees || 'N/A'}`);
      });
    }
  } else {
    console.log('Error:', await response.text());
  }

  console.log('\n' + '='.repeat(60) + '\n');

  // Test 2: Capabilities search
  const payload2 = {
    organization: {
      capabilities: ['software development', 'cloud computing'],
    },
    limit: 25,
  };

  console.log('Test 2: Capabilities search');
  console.log('Payload:', JSON.stringify(payload2, null, 2), '\n');

  response = await fetch(`${GRAPHIQ_BASE_URL}/organizations/search`, {
    method: 'POST',
    headers: {
      'X-API-Key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload2),
  });

  console.log(`Status: ${response.status}\n`);

  if (response.ok) {
    const data: any = await response.json();
    const entities = data.entities || [];
    console.log(`Results: ${entities.length}\n`);

    if (entities.length > 0) {
      console.log('First 3:\n');
      entities.slice(0, 3).forEach((org: any, i: number) => {
        console.log(`${i + 1}. ${org.name || 'N/A'}`);
        console.log(`   Employees: ${org.employee_count || org.employees || 'N/A'}`);
        console.log(`   Capabilities: ${(org.capabilities || []).slice(0, 3).join(', ')}`);
      });
    }
  } else {
    console.log('Error:', await response.text());
  }
}

testGraphIQ();
