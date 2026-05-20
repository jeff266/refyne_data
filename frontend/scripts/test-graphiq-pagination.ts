#!/usr/bin/env npx tsx
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(__dirname, '../.env.local') });

const GRAPHIQ_BASE_URL = 'https://app.graphiq.ai/api/v2';

async function testPagination() {
  const apiKey = process.env.GRAPHIQ_API_KEY;
  if (!apiKey) {
    console.error('GRAPHIQ_API_KEY not set');
    return;
  }

  console.log('Testing GraphIQ pagination options\n');

  const basePayload = {
    organization: {
      industries: ['Technology'],
      min_employees: 20,
      max_employees: 1000,
      country: 'United States',
    },
  };

  // Test 1: Higher limit values
  const limitTests = [25, 50, 100, 200, 500];

  console.log('Testing different limit values:\n');

  for (const limit of limitTests) {
    const payload = { ...basePayload, limit };

    const response = await fetch(`${GRAPHIQ_BASE_URL}/organizations/search`, {
      method: 'POST',
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      const data: any = await response.json();
      const count = data.entities?.length || 0;
      console.log(`  limit=${limit}: ${count} results ${count === limit ? '✓' : ''}`);
    } else {
      console.log(`  limit=${limit}: Error ${response.status}`);
    }
  }

  console.log('\n' + '='.repeat(60) + '\n');

  // Test 2: Offset parameter
  console.log('Testing offset parameter:\n');

  const offsetPayload = {
    ...basePayload,
    limit: 10,
    offset: 10, // Try to get results 11-20
  };

  let response = await fetch(`${GRAPHIQ_BASE_URL}/organizations/search`, {
    method: 'POST',
    headers: {
      'X-API-Key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(offsetPayload),
  });

  console.log(`Offset test - Status: ${response.status}`);
  if (response.ok) {
    const data: any = await response.json();
    console.log(`Results: ${data.entities?.length || 0}`);
    if (data.entities?.length > 0) {
      console.log(`First result: ${data.entities[0].name}`);
    }
  } else {
    console.log(`Error: ${await response.text()}`);
  }

  console.log('\n' + '='.repeat(60) + '\n');

  // Test 3: Page parameter
  console.log('Testing page parameter:\n');

  const pagePayload = {
    ...basePayload,
    limit: 10,
    page: 2, // Try page 2
  };

  response = await fetch(`${GRAPHIQ_BASE_URL}/organizations/search`, {
    method: 'POST',
    headers: {
      'X-API-Key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(pagePayload),
  });

  console.log(`Page test - Status: ${response.status}`);
  if (response.ok) {
    const data: any = await response.json();
    console.log(`Results: ${data.entities?.length || 0}`);
  } else {
    console.log(`Error: ${await response.text()}`);
  }

  console.log('\n' + '='.repeat(60) + '\n');

  // Test 4: Cursor parameter
  console.log('Testing cursor parameter:\n');

  const cursorPayload = {
    ...basePayload,
    limit: 10,
    cursor: 'next', // Try cursor pagination
  };

  response = await fetch(`${GRAPHIQ_BASE_URL}/organizations/search`, {
    method: 'POST',
    headers: {
      'X-API-Key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(cursorPayload),
  });

  console.log(`Cursor test - Status: ${response.status}`);
  if (response.ok) {
    const data: any = await response.json();
    console.log(`Results: ${data.entities?.length || 0}`);
    console.log(`Response keys:`, Object.keys(data));
    if (data.next_cursor || data.cursor || data.pagination) {
      console.log(`Pagination info:`, data.next_cursor || data.cursor || data.pagination);
    }
  } else {
    console.log(`Error: ${await response.text()}`);
  }

  console.log('\n' + '='.repeat(60) + '\n');

  // Test 5: Check response structure for pagination hints
  console.log('Checking response structure for pagination metadata:\n');

  const structurePayload = { ...basePayload, limit: 10 };

  response = await fetch(`${GRAPHIQ_BASE_URL}/organizations/search`, {
    method: 'POST',
    headers: {
      'X-API-Key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(structurePayload),
  });

  if (response.ok) {
    const data: any = await response.json();
    console.log('Response top-level keys:', Object.keys(data));
    console.log('');

    // Look for pagination indicators
    const paginationKeys = ['total', 'count', 'next', 'previous', 'has_more', 'cursor', 'offset', 'page'];
    const found = paginationKeys.filter(key => key in data);

    if (found.length > 0) {
      console.log('Found pagination indicators:');
      found.forEach(key => {
        console.log(`  ${key}: ${JSON.stringify(data[key])}`);
      });
    } else {
      console.log('No standard pagination indicators found');
      console.log('Full response structure:');
      console.log(JSON.stringify(data, null, 2).substring(0, 500));
    }
  }
}

testPagination();
